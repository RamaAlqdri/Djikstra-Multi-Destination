import { useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';

const DEFAULT_CENTER = [-6.2088, 106.8456]; // Jakarta
const ROUTE_COLORS = ['#d7263d', '#f46036', '#2e294e', '#1b998b', '#e2c044', '#6a4c93'];

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });
  return null;
}

function formatDistance(meters) {
  if (typeof meters !== 'number') return '-';
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number') return '-';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatCost(totalCost, costMetric) {
  if (typeof totalCost !== 'number') return '-';
  if (costMetric === 'distance') return formatDistance(totalCost);
  return formatDuration(totalCost);
}

function App() {
  const [algorithm, setAlgorithm] = useState('EAMDSP');
  const [costMetric, setCostMetric] = useState('duration');
  const [profile, setProfile] = useState('driving');

  const [source, setSource] = useState(null);
  const [destinations, setDestinations] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);

  const markerSummary = useMemo(() => {
    if (!source) return 'Klik peta untuk set source.';
    if (destinations.length === 0) {
      return 'Source sudah dipilih. Klik peta lagi untuk menambah destination.';
    }
    return `Source + ${destinations.length} destination siap diproses.`;
  }, [source, destinations]);

  function handleMapClick(latlng) {
    const point = { lat: latlng.lat, lng: latlng.lng };
    if (!source) {
      setSource(point);
      setErrorMessage('');
      return;
    }

    setDestinations((prev) => [...prev, point]);
    setErrorMessage('');
  }

  function clearAllPoints() {
    setSource(null);
    setDestinations([]);
    setResult(null);
    setErrorMessage('');
  }

  function undoLastDestination() {
    setDestinations((prev) => prev.slice(0, -1));
    setResult(null);
  }

  async function runRouting() {
    if (!source) {
      setErrorMessage('Source belum dipilih. Klik peta untuk set source terlebih dulu.');
      return;
    }
    if (destinations.length === 0) {
      setErrorMessage('Tambahkan minimal satu destination sebelum menjalankan algoritma.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          algorithm,
          cost_metric: costMetric,
          profile,
          source,
          destinations,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Request gagal dengan status ${response.status}`);
      }

      setResult(payload.data);
    } catch (error) {
      setResult(null);
      setErrorMessage(error.message || 'Terjadi error saat memproses route.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="top-header">
        <h1>Outdoor Multi-Destination Routing</h1>
        <p>
          Klik peta untuk memilih source dan destination, lalu jalankan algoritma
          <code>CDSSSD</code>, <code>MDMSMD</code>, atau <code>EAMDSP</code>.
        </p>
      </header>

      <main className="layout-grid">
        <section className="control-panel card">
          <h2>Control Panel</h2>

          <label>
            Algorithm
            <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
              <option value="CDSSSD">CDSSSD</option>
              <option value="MDMSMD">MDMSMD</option>
              <option value="EAMDSP">EAMDSP</option>
            </select>
          </label>

          <label>
            Cost Metric
            <select value={costMetric} onChange={(event) => setCostMetric(event.target.value)}>
              <option value="duration">Duration (detik)</option>
              <option value="distance">Distance (meter)</option>
            </select>
          </label>

          <label>
            Profile
            <input
              value={profile}
              onChange={(event) => setProfile(event.target.value)}
              placeholder="driving"
            />
          </label>

          <div className="inline-actions">
            <button className="btn btn-primary" onClick={runRouting} disabled={isLoading}>
              {isLoading ? 'Memproses...' : 'Run Algorithm'}
            </button>
            <button className="btn" onClick={undoLastDestination} disabled={destinations.length === 0}>
              Undo Destination
            </button>
            <button className="btn btn-danger" onClick={clearAllPoints}>
              Reset
            </button>
          </div>

          <div className="hint-box">
            <strong>Status titik:</strong>
            <p>{markerSummary}</p>
          </div>

          {errorMessage && (
            <div className="error-box">
              <strong>Error</strong>
              <p>{errorMessage}</p>
            </div>
          )}

          {result && (
            <div className="result-summary">
              <h3>Ringkasan Hasil</h3>
              <p>
                <strong>Algorithm:</strong> {result.algorithm}
              </p>
              <p>
                <strong>Total Cost:</strong> {formatCost(result.total_cost, result.cost_metric)}
              </p>
              <p>
                <strong>Total Visited Nodes:</strong> {result.total_visited_nodes}
              </p>
              <p>
                <strong>Visit Order:</strong>{' '}
                {result.visit_order.map((point) => point.id).join(' -> ') || '-'}
              </p>
            </div>
          )}
        </section>

        <section className="map-panel card">
          <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom className="leaflet-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />

            {source && (
              <CircleMarker
                center={[source.lat, source.lng]}
                radius={10}
                pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.95, weight: 3 }}
              >
                <Tooltip direction="top" permanent>
                  S
                </Tooltip>
              </CircleMarker>
            )}

            {destinations.map((point, index) => (
              <CircleMarker
                key={`destination-${index}-${point.lat}-${point.lng}`}
                center={[point.lat, point.lng]}
                radius={9}
                pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.92, weight: 2 }}
              >
                <Tooltip direction="top" permanent>
                  D{index + 1}
                </Tooltip>
              </CircleMarker>
            ))}

            {result?.segments?.map((segment, index) => {
              const positions =
                Array.isArray(segment.geometry) && segment.geometry.length > 0
                  ? segment.geometry
                  : [
                      [segment.from.lat, segment.from.lng],
                      [segment.to.lat, segment.to.lng],
                    ];
              return (
                <Polyline
                  key={`segment-${index}`}
                  positions={positions}
                  pathOptions={{
                    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                    weight: 5,
                    opacity: 0.86,
                  }}
                />
              );
            })}
          </MapContainer>

          {result && (
            <div className="segment-list">
              <h3>Segments</h3>
              {result.segments.map((segment, index) => (
                <article className="segment-item" key={`segment-item-${index}`}>
                  <h4>
                    {index + 1}. {segment.from.id} → {segment.to.id}
                  </h4>
                  <p>
                    Cost: {formatCost(segment.cost, result.cost_metric)} | Distance:{' '}
                    {formatDistance(segment.distance_m)} | Duration: {formatDuration(segment.duration_s)}
                  </p>
                  <p>Visited nodes: {segment.visited_nodes}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
