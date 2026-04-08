"""Simple outdoor multi-destination routing API.

This server uses:
- OSRM Table API to build pairwise directed travel costs
- Existing algorithms.py (CDSSSD, MDMSMD, EAMDSP) for multi-destination logic
- OSRM Route API to fetch polyline geometry for each chosen segment

Run:
    python3 outdoor_server.py --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Iterable, List, Literal, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from algorithms import PathNotFoundError, run_cdsssd, run_eamdsp, run_mdmsmd

AlgorithmName = Literal["CDSSSD", "MDMSMD", "EAMDSP"]
CostMetric = Literal["distance", "duration"]


class ApiValidationError(ValueError):
    """Raised when incoming payload is invalid."""


class ExternalServiceError(RuntimeError):
    """Raised when OSRM is unavailable or returns an invalid response."""


@dataclass(frozen=True)
class GeoPoint:
    """Represents one geographic point used by routing."""

    point_id: str
    lat: float
    lng: float

    def to_dict(self) -> Dict[str, Any]:
        """Serialize point for JSON response."""

        return {
            "id": self.point_id,
            "lat": self.lat,
            "lng": self.lng,
        }


def _json_dumps(data: Dict[str, Any]) -> bytes:
    """Encode JSON using UTF-8."""

    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def _read_json_body(handler: BaseHTTPRequestHandler) -> Dict[str, Any]:
    """Read and decode request body as JSON object."""

    content_length = handler.headers.get("Content-Length")
    if content_length is None:
        raise ApiValidationError("missing Content-Length header")

    try:
        body_size = int(content_length)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ApiValidationError("invalid Content-Length header") from exc

    raw_body = handler.rfile.read(body_size)
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ApiValidationError("request body must be valid JSON") from exc

    if not isinstance(payload, dict):
        raise ApiValidationError("request body must be a JSON object")
    return payload


def _parse_float(value: Any, field_name: str) -> float:
    """Parse float and validate numeric input."""

    if isinstance(value, bool):
        raise ApiValidationError(f"{field_name} must be numeric")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ApiValidationError(f"{field_name} must be numeric") from exc
    return parsed


def _parse_point(raw: Any, field_name: str, point_id: str) -> GeoPoint:
    """Validate and normalize one point object."""

    if not isinstance(raw, dict):
        raise ApiValidationError(f"{field_name} must be an object")

    if "lat" not in raw or "lng" not in raw:
        raise ApiValidationError(f"{field_name} requires lat and lng")

    lat = _parse_float(raw["lat"], f"{field_name}.lat")
    lng = _parse_float(raw["lng"], f"{field_name}.lng")

    if not (-90.0 <= lat <= 90.0):
        raise ApiValidationError(f"{field_name}.lat must be within [-90, 90]")
    if not (-180.0 <= lng <= 180.0):
        raise ApiValidationError(f"{field_name}.lng must be within [-180, 180]")

    return GeoPoint(point_id=point_id, lat=lat, lng=lng)


def _parse_algorithm(value: Any) -> AlgorithmName:
    """Validate requested algorithm name."""

    if not isinstance(value, str):
        raise ApiValidationError("algorithm must be a string")

    allowed: Tuple[AlgorithmName, ...] = ("CDSSSD", "MDMSMD", "EAMDSP")
    if value not in allowed:
        raise ApiValidationError(f"algorithm must be one of: {', '.join(allowed)}")
    return value  # type: ignore[return-value]


def _parse_cost_metric(value: Any) -> CostMetric:
    """Validate requested cost metric."""

    if value is None:
        return "duration"
    if not isinstance(value, str):
        raise ApiValidationError("cost_metric must be a string")

    allowed: Tuple[CostMetric, ...] = ("distance", "duration")
    if value not in allowed:
        raise ApiValidationError("cost_metric must be 'distance' or 'duration'")
    return value  # type: ignore[return-value]


def _parse_profile(value: Any) -> str:
    """Validate OSRM profile string."""

    if value is None:
        return "driving"
    if not isinstance(value, str) or not value.strip():
        raise ApiValidationError("profile must be a non-empty string")
    return value.strip()


def _http_get_json(url: str) -> Dict[str, Any]:
    """Execute HTTP GET and parse JSON response."""

    verify_tls_raw = os.environ.get("OSRM_VERIFY_TLS", "1").strip().lower()
    verify_tls = verify_tls_raw not in {"0", "false", "no"}
    tls_context = None
    if url.startswith("https://") and not verify_tls:
        # Development fallback for environments without proper CA bundle.
        tls_context = ssl._create_unverified_context()

    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "multi-destination-routing/1.0",
        },
    )

    try:
        with urlopen(request, timeout=25, context=tls_context) as response:
            raw = response.read()
    except HTTPError as exc:
        raise ExternalServiceError(
            f"routing provider responded with HTTP {exc.code}"
        ) from exc
    except URLError as exc:
        raise ExternalServiceError("failed to reach routing provider") from exc

    try:
        payload = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ExternalServiceError("routing provider returned non-JSON response") from exc

    if not isinstance(payload, dict):  # pragma: no cover - defensive
        raise ExternalServiceError("routing provider returned unexpected payload")

    return payload


def _build_coordinates_path(points: Iterable[GeoPoint]) -> str:
    """Serialize point list into OSRM coordinate sequence."""

    return ";".join(f"{point.lng},{point.lat}" for point in points)


def _fetch_cost_matrix(
    osrm_base_url: str,
    profile: str,
    points: List[GeoPoint],
    cost_metric: CostMetric,
) -> List[List[float | None]]:
    """Fetch directed pairwise distance/duration matrix from OSRM Table API."""

    if len(points) < 2:
        raise ApiValidationError("at least 2 points are required")

    coordinates = _build_coordinates_path(points)
    url = (
        f"{osrm_base_url}/table/v1/{quote(profile)}/{coordinates}"
        f"?annotations={quote(cost_metric)}"
    )
    payload = _http_get_json(url)

    if payload.get("code") != "Ok":
        raise ExternalServiceError("routing provider failed to build cost matrix")

    key = "distances" if cost_metric == "distance" else "durations"
    matrix = payload.get(key)
    if not isinstance(matrix, list):
        raise ExternalServiceError("routing provider returned invalid matrix payload")

    parsed_matrix: List[List[float | None]] = []
    for row in matrix:
        if not isinstance(row, list):
            raise ExternalServiceError("routing provider returned invalid matrix row")

        parsed_row: List[float | None] = []
        for value in row:
            if value is None:
                parsed_row.append(None)
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ExternalServiceError(
                    "routing provider returned non-numeric matrix cost"
                )
            parsed_row.append(float(value))
        parsed_matrix.append(parsed_row)

    return parsed_matrix


def _build_graph_from_matrix(
    points: List[GeoPoint],
    matrix: List[List[float | None]],
) -> Dict[str, List[Tuple[str, float]]]:
    """Convert matrix into adjacency-list graph for algorithms.py."""

    if len(points) != len(matrix):
        raise ExternalServiceError("matrix dimension does not match points")

    graph: Dict[str, List[Tuple[str, float]]] = {}
    point_ids = [point.point_id for point in points]

    for row_idx, source_id in enumerate(point_ids):
        row = matrix[row_idx]
        if len(row) != len(points):
            raise ExternalServiceError("matrix row length does not match points")

        edges: List[Tuple[str, float]] = []
        for col_idx, target_id in enumerate(point_ids):
            if source_id == target_id:
                continue
            cost = row[col_idx]
            if cost is None:
                continue
            if cost < 0:
                raise ExternalServiceError("routing provider returned negative cost")
            edges.append((target_id, cost))

        graph[source_id] = edges

    return graph


def _fetch_segment_geometry(
    osrm_base_url: str,
    profile: str,
    start: GeoPoint,
    end: GeoPoint,
) -> Dict[str, Any]:
    """Fetch route polyline between two points from OSRM Route API."""

    coordinates = f"{start.lng},{start.lat};{end.lng},{end.lat}"
    url = (
        f"{osrm_base_url}/route/v1/{quote(profile)}/{coordinates}"
        "?overview=full&geometries=geojson&steps=false"
    )
    payload = _http_get_json(url)

    if payload.get("code") != "Ok":
        raise ExternalServiceError("routing provider failed to build segment geometry")

    routes = payload.get("routes")
    if not isinstance(routes, list) or not routes:
        raise ExternalServiceError("routing provider did not return a route")

    first_route = routes[0]
    if not isinstance(first_route, dict):
        raise ExternalServiceError("routing provider returned invalid route payload")

    geometry = first_route.get("geometry")
    if not isinstance(geometry, dict):
        raise ExternalServiceError("routing provider returned invalid geometry payload")

    coordinates_list = geometry.get("coordinates")
    if not isinstance(coordinates_list, list):
        raise ExternalServiceError("routing provider returned invalid geometry coordinates")

    lat_lng_path: List[List[float]] = []
    for coordinate in coordinates_list:
        if (
            not isinstance(coordinate, list)
            or len(coordinate) < 2
            or isinstance(coordinate[0], bool)
            or isinstance(coordinate[1], bool)
            or not isinstance(coordinate[0], (int, float))
            or not isinstance(coordinate[1], (int, float))
        ):
            raise ExternalServiceError("routing provider returned invalid coordinate pair")

        lng, lat = float(coordinate[0]), float(coordinate[1])
        lat_lng_path.append([lat, lng])

    distance_m = first_route.get("distance")
    duration_s = first_route.get("duration")
    if not isinstance(distance_m, (int, float)) or isinstance(distance_m, bool):
        raise ExternalServiceError("routing provider returned invalid route distance")
    if not isinstance(duration_s, (int, float)) or isinstance(duration_s, bool):
        raise ExternalServiceError("routing provider returned invalid route duration")

    return {
        "geometry": lat_lng_path,
        "distance_m": float(distance_m),
        "duration_s": float(duration_s),
    }


def _run_algorithm(
    algorithm: AlgorithmName,
    graph: Dict[str, List[Tuple[str, float]]],
    source_id: str,
    destination_ids: List[str],
) -> Dict[str, Any]:
    """Dispatch algorithm execution."""

    if algorithm == "CDSSSD":
        return run_cdsssd(graph, source_id, destination_ids)
    if algorithm == "MDMSMD":
        return run_mdmsmd(graph, source_id, destination_ids)
    return run_eamdsp(graph, source_id, destination_ids)


def _map_points_by_id(points: Iterable[GeoPoint]) -> Dict[str, GeoPoint]:
    """Build lookup map from id to point."""

    return {point.point_id: point for point in points}


def _serialize_path_ids(path_ids: List[str], point_lookup: Dict[str, GeoPoint]) -> List[Dict[str, Any]]:
    """Convert list of point ids into list of point objects."""

    return [point_lookup[node_id].to_dict() for node_id in path_ids]


def _enrich_segments(
    algorithm: AlgorithmName,
    raw_result: Dict[str, Any],
    source_id: str,
    point_lookup: Dict[str, GeoPoint],
    osrm_base_url: str,
    profile: str,
) -> List[Dict[str, Any]]:
    """Enrich algorithm segment outputs with map geometry."""

    enriched: List[Dict[str, Any]] = []

    if algorithm == "CDSSSD":
        # CDSSSD reports per-destination independent query results.
        destination_results = raw_result.get("destination_results", [])
        if not isinstance(destination_results, list):
            raise ExternalServiceError("invalid CDSSSD result payload")

        for item in destination_results:
            if not isinstance(item, dict):
                raise ExternalServiceError("invalid CDSSSD destination payload")

            destination_id = item.get("destination")
            path_ids = item.get("path")
            cost = item.get("cost")
            visited_nodes = item.get("visited_nodes")

            if not isinstance(destination_id, str):
                raise ExternalServiceError("invalid CDSSSD destination id")
            if not isinstance(path_ids, list) or not all(
                isinstance(node_id, str) for node_id in path_ids
            ):
                raise ExternalServiceError("invalid CDSSSD path payload")
            if not isinstance(cost, (int, float)) or isinstance(cost, bool):
                raise ExternalServiceError("invalid CDSSSD cost payload")
            if not isinstance(visited_nodes, int):
                raise ExternalServiceError("invalid CDSSSD visited_nodes payload")

            start_point = point_lookup[source_id]
            end_point = point_lookup[destination_id]
            geometry_data = _fetch_segment_geometry(
                osrm_base_url=osrm_base_url,
                profile=profile,
                start=start_point,
                end=end_point,
            )

            enriched.append(
                {
                    "from": start_point.to_dict(),
                    "to": end_point.to_dict(),
                    "path_ids": path_ids,
                    "path_coordinates": _serialize_path_ids(path_ids, point_lookup),
                    "cost": float(cost),
                    "visited_nodes": visited_nodes,
                    "geometry": geometry_data["geometry"],
                    "distance_m": geometry_data["distance_m"],
                    "duration_s": geometry_data["duration_s"],
                }
            )

        return enriched

    # MDMSMD and EAMDSP return segment lists with explicit "from" and "to".
    segments = raw_result.get("segments", [])
    if not isinstance(segments, list):
        raise ExternalServiceError("invalid segments payload")

    for item in segments:
        if not isinstance(item, dict):
            raise ExternalServiceError("invalid segment payload")

        from_id = item.get("from")
        to_id = item.get("to")
        path_ids = item.get("path")
        cost = item.get("cost")
        visited_nodes = item.get("visited_nodes")

        if not isinstance(from_id, str) or not isinstance(to_id, str):
            raise ExternalServiceError("invalid segment from/to payload")
        if not isinstance(path_ids, list) or not all(
            isinstance(node_id, str) for node_id in path_ids
        ):
            raise ExternalServiceError("invalid segment path payload")
        if not isinstance(cost, (int, float)) or isinstance(cost, bool):
            raise ExternalServiceError("invalid segment cost payload")
        if not isinstance(visited_nodes, int):
            raise ExternalServiceError("invalid segment visited_nodes payload")

        geometry_data = _fetch_segment_geometry(
            osrm_base_url=osrm_base_url,
            profile=profile,
            start=point_lookup[from_id],
            end=point_lookup[to_id],
        )

        enriched.append(
            {
                "from": point_lookup[from_id].to_dict(),
                "to": point_lookup[to_id].to_dict(),
                "path_ids": path_ids,
                "path_coordinates": _serialize_path_ids(path_ids, point_lookup),
                "cost": float(cost),
                "visited_nodes": visited_nodes,
                "geometry": geometry_data["geometry"],
                "distance_m": geometry_data["distance_m"],
                "duration_s": geometry_data["duration_s"],
            }
        )

    return enriched


def solve_outdoor_multidest(payload: Dict[str, Any], osrm_base_url: str) -> Dict[str, Any]:
    """Solve multi-destination routing request.

    Expected payload:
    {
      "algorithm": "EAMDSP" | "MDMSMD" | "CDSSSD",
      "cost_metric": "duration" | "distance",
      "profile": "driving",
      "source": {"lat": ..., "lng": ...},
      "destinations": [{"lat": ..., "lng": ...}, ...]
    }
    """

    algorithm = _parse_algorithm(payload.get("algorithm", "EAMDSP"))
    cost_metric = _parse_cost_metric(payload.get("cost_metric"))
    profile = _parse_profile(payload.get("profile"))

    source = _parse_point(payload.get("source"), "source", point_id="S0")
    raw_destinations = payload.get("destinations")
    if not isinstance(raw_destinations, list):
        raise ApiValidationError("destinations must be an array")
    if not raw_destinations:
        raise ApiValidationError("destinations cannot be empty")
    if len(raw_destinations) > 20:
        raise ApiValidationError("destinations cannot exceed 20 points")

    destinations: List[GeoPoint] = []
    for index, raw_destination in enumerate(raw_destinations, start=1):
        destinations.append(
            _parse_point(raw_destination, f"destinations[{index - 1}]", point_id=f"D{index}")
        )

    all_points = [source] + destinations
    point_lookup = _map_points_by_id(all_points)

    matrix = _fetch_cost_matrix(
        osrm_base_url=osrm_base_url,
        profile=profile,
        points=all_points,
        cost_metric=cost_metric,
    )

    graph = _build_graph_from_matrix(points=all_points, matrix=matrix)
    destination_ids = [point.point_id for point in destinations]

    try:
        raw_result = _run_algorithm(
            algorithm=algorithm,
            graph=graph,
            source_id=source.point_id,
            destination_ids=destination_ids,
        )
    except PathNotFoundError as exc:
        raise ApiValidationError(str(exc)) from exc

    segments = _enrich_segments(
        algorithm=algorithm,
        raw_result=raw_result,
        source_id=source.point_id,
        point_lookup=point_lookup,
        osrm_base_url=osrm_base_url,
        profile=profile,
    )

    visit_order_ids = raw_result.get("visit_order", [])
    if not isinstance(visit_order_ids, list) or not all(
        isinstance(node_id, str) for node_id in visit_order_ids
    ):
        raise ExternalServiceError("invalid visit_order in algorithm output")

    full_path_ids: List[str] = []
    raw_full_path = raw_result.get("full_path")
    if isinstance(raw_full_path, list) and all(isinstance(node_id, str) for node_id in raw_full_path):
        full_path_ids = list(raw_full_path)

    response: Dict[str, Any] = {
        "algorithm": algorithm,
        "profile": profile,
        "cost_metric": cost_metric,
        "cost_unit": "meters" if cost_metric == "distance" else "seconds",
        "source": source.to_dict(),
        "destinations": [point.to_dict() for point in destinations],
        "visit_order": [point_lookup[node_id].to_dict() for node_id in visit_order_ids],
        "total_cost": raw_result.get("total_cost"),
        "total_visited_nodes": raw_result.get("total_visited_nodes"),
        "segments": segments,
        "full_path_ids": full_path_ids,
        "full_path_coordinates": _serialize_path_ids(full_path_ids, point_lookup)
        if full_path_ids
        else [],
        "raw_result": raw_result,
    }

    return response


def _build_handler(osrm_base_url: str):
    """Create request handler bound to one OSRM base URL."""

    class RoutingHandler(BaseHTTPRequestHandler):
        """HTTP handler for routing API endpoints."""

        server_version = "OutdoorRoutingHTTP/1.0"

        def _set_json_headers(self, status_code: int) -> None:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def _send_json(self, status_code: int, payload: Dict[str, Any]) -> None:
            self._set_json_headers(status_code)
            self.wfile.write(_json_dumps(payload))

        def do_OPTIONS(self) -> None:  # noqa: N802 (HTTP method signature)
            self._set_json_headers(204)

        def do_GET(self) -> None:  # noqa: N802 (HTTP method signature)
            if self.path == "/health":
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "message": "outdoor routing server is running",
                        "osrm_base_url": osrm_base_url,
                    },
                )
                return

            self._send_json(
                404,
                {
                    "ok": False,
                    "error": "endpoint not found",
                },
            )

        def do_POST(self) -> None:  # noqa: N802 (HTTP method signature)
            if self.path != "/api/solve":
                self._send_json(404, {"ok": False, "error": "endpoint not found"})
                return

            try:
                payload = _read_json_body(self)
                result = solve_outdoor_multidest(payload, osrm_base_url=osrm_base_url)
                self._send_json(200, {"ok": True, "data": result})
            except ApiValidationError as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})
            except ExternalServiceError as exc:
                self._send_json(502, {"ok": False, "error": str(exc)})
            except Exception as exc:  # pragma: no cover - unexpected runtime issue
                self._send_json(500, {"ok": False, "error": f"internal server error: {exc}"})

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            # Keep terminal output concise but still useful for development.
            print(f"[{self.log_date_time_string()}] {self.address_string()} - {format % args}")

    return RoutingHandler


def main() -> None:
    """Entry point for command-line execution."""

    parser = argparse.ArgumentParser(description="Outdoor multi-destination routing server")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP host")
    parser.add_argument("--port", default=8000, type=int, help="HTTP port")
    parser.add_argument(
        "--osrm-base-url",
        default=os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org"),
        help="OSRM base URL (default: https://router.project-osrm.org)",
    )
    parser.add_argument(
        "--insecure-skip-tls-verify",
        action="store_true",
        help="disable TLS certificate verification for OSRM HTTPS requests",
    )
    args = parser.parse_args()

    if args.insecure_skip_tls_verify:
        os.environ["OSRM_VERIFY_TLS"] = "0"

    handler_class = _build_handler(args.osrm_base_url.rstrip("/"))
    server = ThreadingHTTPServer((args.host, args.port), handler_class)

    print("Outdoor routing API server")
    print(f"- Listening on: http://{args.host}:{args.port}")
    print(f"- Health check: http://{args.host}:{args.port}/health")
    print(f"- Solve endpoint: http://{args.host}:{args.port}/api/solve")
    print(f"- OSRM base URL: {args.osrm_base_url}")
    print(f"- TLS verify: {os.environ.get('OSRM_VERIFY_TLS', '1') not in {'0', 'false', 'no'}}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
