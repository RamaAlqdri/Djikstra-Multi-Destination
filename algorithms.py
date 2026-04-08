"""Reusable shortest-path algorithms for multi-destination indoor routing.

Algorithms implemented:
- CDSSSD: Conventional Dijkstra Single Source Single Destination
- MDMSMD: Modified Dijkstra Multi-Source Multi-Destination
- EAMDSP: Efficient Algorithm for Multi-Destination Shortest Path

The module intentionally uses only Python standard library components.
"""

from __future__ import annotations

from dataclasses import dataclass
from heapq import heappop, heappush
from math import inf
from typing import Dict, Iterable, List, Sequence, Tuple, Union

Number = Union[int, float]
Node = str
Graph = Dict[Node, List[Tuple[Node, Number]]]


class PathNotFoundError(RuntimeError):
    """Raised when a destination node is not reachable from a given source."""


@dataclass(frozen=True)
class PathResult:
    """Container for one shortest-path query result."""

    path: List[Node]
    cost: float
    visited_nodes: int


def validate_graph(graph: Graph) -> None:
    """Validate adjacency-list graph structure and edge constraints.

    Parameters
    ----------
    graph:
        Mapping of node -> list of (neighbor, weight).

    Raises
    ------
    TypeError
        If graph structure is malformed.
    ValueError
        If edge weights are negative or references unknown nodes.
    """

    if not isinstance(graph, dict):
        raise TypeError("graph must be a dictionary adjacency list")

    for node, neighbors in graph.items():
        if not isinstance(node, str) or not node:
            raise TypeError("each node key must be a non-empty string")
        if not isinstance(neighbors, list):
            raise TypeError(f"neighbors for node {node!r} must be a list")

    for node, neighbors in graph.items():
        for edge in neighbors:
            if not (isinstance(edge, tuple) and len(edge) == 2):
                raise TypeError(
                    f"edge in node {node!r} must be a tuple (neighbor, weight)"
                )
            neighbor, weight = edge
            if not isinstance(neighbor, str) or not neighbor:
                raise TypeError(f"neighbor in node {node!r} must be a non-empty string")
            if neighbor not in graph:
                raise ValueError(
                    f"neighbor {neighbor!r} referenced by node {node!r} is not in graph"
                )
            if not isinstance(weight, (int, float)) or isinstance(weight, bool):
                raise TypeError(
                    f"weight for edge ({node!r}, {neighbor!r}) must be int/float"
                )
            if weight < 0:
                raise ValueError(
                    f"negative edge weight on ({node!r}, {neighbor!r}) is not allowed"
                )


def _validate_node(graph: Graph, node: Node, name: str) -> None:
    """Validate that a node exists in graph."""

    if not isinstance(node, str) or not node:
        raise TypeError(f"{name} must be a non-empty string")
    if node not in graph:
        raise ValueError(f"{name} {node!r} does not exist in graph")


def _validate_destinations(graph: Graph, destinations: Iterable[Node]) -> List[Node]:
    """Validate and normalize destinations into a list preserving order and duplicates."""

    if isinstance(destinations, (str, bytes)):
        raise TypeError("destinations must be an iterable of nodes, not a string")

    normalized = list(destinations)
    for idx, destination in enumerate(normalized):
        if not isinstance(destination, str) or not destination:
            raise TypeError(f"destinations[{idx}] must be a non-empty string")
        if destination not in graph:
            raise ValueError(f"destinations[{idx}] {destination!r} does not exist in graph")
    return normalized


def _reconstruct_path(predecessor: Dict[Node, Node], source: Node, target: Node) -> List[Node]:
    """Rebuild path from predecessor map."""

    path = [target]
    current = target
    while current != source:
        current = predecessor[current]
        path.append(current)
    path.reverse()
    return path


def _dijkstra_core(graph: Graph, source: Node, target: Node) -> PathResult:
    """Run Dijkstra from source to target and return detailed path result."""

    if source == target:
        return PathResult(path=[source], cost=0.0, visited_nodes=1)

    distances: Dict[Node, float] = {node: inf for node in graph}
    predecessor: Dict[Node, Node] = {}
    visited = set()

    distances[source] = 0.0
    heap: List[Tuple[float, Node]] = [(0.0, source)]

    while heap:
        current_distance, current_node = heappop(heap)

        if current_node in visited:
            continue
        visited.add(current_node)

        if current_node == target:
            path = _reconstruct_path(predecessor, source, target)
            return PathResult(
                path=path,
                cost=current_distance,
                visited_nodes=len(visited),
            )

        for neighbor, weight in graph[current_node]:
            if neighbor in visited:
                continue
            candidate = current_distance + float(weight)
            if candidate < distances[neighbor]:
                distances[neighbor] = candidate
                predecessor[neighbor] = current_node
                heappush(heap, (candidate, neighbor))

    raise PathNotFoundError(
        f"target {target!r} is not reachable from source {source!r}"
    )


def dijkstra_shortest_path(graph: Graph, source: Node, target: Node) -> Dict[str, Union[List[Node], float, int]]:
    """Find shortest path from source to target using Dijkstra.

    Parameters
    ----------
    graph:
        Non-negative weighted graph in adjacency-list form.
    source:
        Start node.
    target:
        End node.

    Returns
    -------
    dict
        {
            "path": [..nodes..],
            "cost": <float>,
            "visited_nodes": <int>
        }
    """

    validate_graph(graph)
    _validate_node(graph, source, "source")
    _validate_node(graph, target, "target")
    result = _dijkstra_core(graph, source, target)
    return {
        "path": result.path,
        "cost": result.cost,
        "visited_nodes": result.visited_nodes,
    }


def _merge_without_duplicate(last_path: List[Node], new_path: Sequence[Node]) -> List[Node]:
    """Merge path segments while avoiding duplicated junction node."""

    if not new_path:
        return list(last_path)
    if not last_path:
        return list(new_path)
    if last_path[-1] == new_path[0]:
        return list(last_path) + list(new_path[1:])
    return list(last_path) + list(new_path)


def run_cdsssd(
    graph: Graph,
    source: Node,
    destinations: Iterable[Node],
) -> Dict[str, Union[str, Node, List[dict], float, int]]:
    """Run CDSSSD: independent Dijkstra query for each destination.

    Notes
    -----
    - Every destination is solved from the same original source.
    - Destination duplicates are preserved and computed repeatedly.
    - If a destination equals source, the segment cost is 0.
    """

    validate_graph(graph)
    _validate_node(graph, source, "source")
    normalized_destinations = _validate_destinations(graph, destinations)

    destination_results: List[dict] = []
    total_cost = 0.0
    total_visited_nodes = 0

    for destination in normalized_destinations:
        one_result = _dijkstra_core(graph, source, destination)
        destination_results.append(
            {
                "destination": destination,
                "path": one_result.path,
                "cost": one_result.cost,
                "visited_nodes": one_result.visited_nodes,
            }
        )
        total_cost += one_result.cost
        total_visited_nodes += one_result.visited_nodes

    return {
        "algorithm": "CDSSSD",
        "source": source,
        "destination_results": destination_results,
        "visit_order": normalized_destinations,
        "total_cost": total_cost,
        "total_visited_nodes": total_visited_nodes,
    }


def run_mdmsmd(
    graph: Graph,
    source: Node,
    destinations: Iterable[Node],
) -> Dict[str, Union[str, List[Node], List[dict], float, int]]:
    """Run MDMSMD: follow destination order; each reached destination becomes new source."""

    validate_graph(graph)
    _validate_node(graph, source, "source")
    normalized_destinations = _validate_destinations(graph, destinations)

    active_source = source
    full_path: List[Node] = [source]
    segments: List[dict] = []
    visit_order: List[Node] = []
    total_cost = 0.0
    total_visited_nodes = 0

    for destination in normalized_destinations:
        one_result = _dijkstra_core(graph, active_source, destination)
        full_path = _merge_without_duplicate(full_path, one_result.path)
        segments.append(
            {
                "from": active_source,
                "to": destination,
                "path": one_result.path,
                "cost": one_result.cost,
                "visited_nodes": one_result.visited_nodes,
            }
        )
        visit_order.append(destination)
        total_cost += one_result.cost
        total_visited_nodes += one_result.visited_nodes
        active_source = destination

    return {
        "algorithm": "MDMSMD",
        "full_path": full_path,
        "segments": segments,
        "visit_order": visit_order,
        "total_cost": total_cost,
        "total_visited_nodes": total_visited_nodes,
    }


def run_eamdsp(
    graph: Graph,
    source: Node,
    destinations: Iterable[Node],
) -> Dict[str, Union[str, List[Node], List[dict], float, int]]:
    """Run EAMDSP: iteratively visit nearest destination from current source.

    Notes
    -----
    - Remaining destinations are evaluated at each iteration.
    - If multiple destinations have identical minimum cost, the first one in
      remaining input order is selected for deterministic behavior.
    - Destination duplicates are treated as separate requests.
    """

    validate_graph(graph)
    _validate_node(graph, source, "source")
    remaining = _validate_destinations(graph, destinations)

    active_source = source
    full_path: List[Node] = [source]
    segments: List[dict] = []
    visit_order: List[Node] = []
    total_cost = 0.0
    total_visited_nodes = 0

    while remaining:
        best_index = -1
        best_destination = ""
        best_result: PathResult | None = None

        for idx, destination in enumerate(remaining):
            candidate_result = _dijkstra_core(graph, active_source, destination)
            if best_result is None:
                best_index = idx
                best_destination = destination
                best_result = candidate_result
                continue

            if candidate_result.cost < best_result.cost:
                best_index = idx
                best_destination = destination
                best_result = candidate_result

        assert best_result is not None  # remaining is non-empty

        full_path = _merge_without_duplicate(full_path, best_result.path)
        segments.append(
            {
                "from": active_source,
                "to": best_destination,
                "path": best_result.path,
                "cost": best_result.cost,
                "visited_nodes": best_result.visited_nodes,
            }
        )
        visit_order.append(best_destination)
        total_cost += best_result.cost
        total_visited_nodes += best_result.visited_nodes
        active_source = best_destination

        remaining.pop(best_index)

    return {
        "algorithm": "EAMDSP",
        "full_path": full_path,
        "segments": segments,
        "visit_order": visit_order,
        "total_cost": total_cost,
        "total_visited_nodes": total_visited_nodes,
    }


__all__ = [
    "PathNotFoundError",
    "dijkstra_shortest_path",
    "run_cdsssd",
    "run_mdmsmd",
    "run_eamdsp",
    "validate_graph",
]
