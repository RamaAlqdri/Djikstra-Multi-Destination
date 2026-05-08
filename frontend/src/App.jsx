import React, { useMemo, useState } from 'react';
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
const CHART_ALGORITHM_ORDER = ['EAMDSP', 'CDSSSD', 'MDMSMD'];
const CHART_COLORS = {
  EAMDSP: '#3b82f6',
  CDSSSD: '#ef4444',
  MDMSMD: '#84cc16',
};

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

function formatChartValue(value) {
  if (typeof value !== 'number') return '';
  return `${Math.round(value)}`;
}

function CostComparisonChart({ dataPoints, costMetric }) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) return null;

  const width = 820;
  const height = 360;
  const margin = { top: 28, right: 26, bottom: 64, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCost = dataPoints.reduce((acc, item) => {
    const values = CHART_ALGORITHM_ORDER.map((name) => item.costByAlgorithm?.[name]).filter(
      (value) => typeof value === 'number'
    );
    if (values.length === 0) return acc;
    return Math.max(acc, ...values);
  }, 0);
  const yMax = maxCost <= 0 ? 1 : Math.ceil(maxCost * 1.1);
  const yTicks = 5;

  function xPosition(index) {
    if (dataPoints.length === 1) return margin.left + plotWidth / 2;
    return margin.left + (index / (dataPoints.length - 1)) * plotWidth;
  }

  function yPosition(value) {
    return margin.top + ((yMax - value) / yMax) * plotHeight;
  }

  return (
    <div className="chart-panel card">
      <h3>Cost Wise Comparison</h3>
      <p className="chart-caption">
        Total Cost by No. of Items ({costMetric === 'distance' ? 'meter' : 'detik'})
      </p>

      <svg className="comparison-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        {[...Array(yTicks + 1)].map((_, tick) => {
          const ratio = tick / yTicks;
          const value = Math.round(yMax * (1 - ratio));
          const y = margin.top + ratio * plotHeight;
          return (
            <g key={`y-tick-${tick}`}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + plotWidth}
                y2={y}
                stroke="rgba(100, 116, 139, 0.25)"
                strokeWidth="1"
              />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="axis-label">
                {value}
              </text>
            </g>
          );
        })}

        {CHART_ALGORITHM_ORDER.map((algorithm) => {
          const points = dataPoints
            .map((item, index) => {
              const value = item.costByAlgorithm?.[algorithm];
              if (typeof value !== 'number') return null;
              return { index, value, x: xPosition(index), y: yPosition(value) };
            })
            .filter(Boolean);
          const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <g key={`series-${algorithm}`}>
              {polylinePoints && (
                <polyline
                  fill="none"
                  stroke={CHART_COLORS[algorithm]}
                  strokeWidth="3"
                  points={polylinePoints}
                />
              )}
              {points.map((point) => (
                <g key={`${algorithm}-${point.index}`}>
                  <circle cx={point.x} cy={point.y} r="4.5" fill={CHART_COLORS[algorithm]} />
                  <text x={point.x} y={point.y - 10} textAnchor="middle" className="value-label">
                    {formatChartValue(point.value)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {dataPoints.map((item, index) => (
          <text
            key={`x-label-${index}`}
            x={xPosition(index)}
            y={height - margin.bottom + 26}
            textAnchor="middle"
            className="axis-label"
          >
            {`Items (${item.itemCount})`}
          </text>
        ))}
      </svg>

      <div className="chart-legend">
        {CHART_ALGORITHM_ORDER.map((algorithm) => (
          <span key={`legend-${algorithm}`} className="legend-item">
            <i style={{ backgroundColor: CHART_COLORS[algorithm] }} />
            {algorithm}
          </span>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [costMetric, setCostMetric] = useState('duration');
  const [profile, setProfile] = useState('driving');

  const [source, setSource] = useState(null);
  const [destinations, setDestinations] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);
  const [activeAlgorithm, setActiveAlgorithm] = useState('EAMDSP');
  const [comparisonHistory, setComparisonHistory] = useState([]);

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
    setActiveAlgorithm('EAMDSP');
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
      setComparisonHistory((prev) => {
        const costByAlgorithm = {};
        for (const item of payload.data.results || []) {
          if (typeof item?.total_cost === 'number') {
            costByAlgorithm[item.algorithm] = item.total_cost;
          }
        }

        const entry = {
          metric: payload.data.cost_metric,
          itemCount: destinations.length,
          costByAlgorithm,
        };
        return [...prev, entry];
      });
      const defaultAlgorithm = payload.data.best_by_total_cost || payload.data.algorithms?.[0] || 'EAMDSP';
      setActiveAlgorithm(defaultAlgorithm);
    } catch (error) {
      setResult(null);
      setActiveAlgorithm('EAMDSP');
      setErrorMessage(error.message || 'Terjadi error saat memproses route.');
    } finally {
      setIsLoading(false);
    }
  }

  const activeResult = useMemo(() => {
    if (!result || !Array.isArray(result.results)) return null;
    return result.results.find((item) => item.algorithm === activeAlgorithm) || result.results[0] || null;
  }, [result, activeAlgorithm]);

  const chartData = useMemo(() => {
    const filtered = comparisonHistory.filter((item) => item.metric === costMetric);
    const byItems = new Map();
    for (const item of filtered) {
      byItems.set(item.itemCount, item);
    }
    return Array.from(byItems.values()).sort((a, b) => a.itemCount - b.itemCount);
  }, [comparisonHistory, costMetric]);

  return (
    <div className="page-shell">
      <header className="top-header">
        <h1>Outdoor Multi-Destination Routing</h1>
        <p>
          Klik peta untuk memilih source dan destination, lalu jalankan perbandingan otomatis
          <code>CDSSSD</code>, <code>MDMSMD</code>, dan <code>EAMDSP</code>.
        </p>
      </header>

      <main className="layout-grid">
        <section className="control-panel card">
          <h2>Control Panel</h2>

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
              {isLoading ? 'Memproses...' : 'Run Perbandingan 3 Algoritma'}
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
              <h3>Ringkasan Perbandingan</h3>
              <p>
                <strong>Best Total Cost:</strong> {result.best_by_total_cost}
              </p>
              <p>
                <strong>Best Total Visited Nodes:</strong> {result.best_by_total_visited_nodes}
              </p>

              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Total Cost</th>
                    <th>Visited Nodes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results?.map((item) => (
                    <tr
                      key={`compare-${item.algorithm}`}
                      className={item.algorithm === activeAlgorithm ? 'is-active' : ''}
                      onClick={() => setActiveAlgorithm(item.algorithm)}
                    >
                      <td>{item.algorithm}</td>
                      <td>{formatCost(item.total_cost, result.cost_metric)}</td>
                      <td>{item.total_visited_nodes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            {activeResult?.segments?.map((segment, index) => {
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

          {activeResult && (
            <div className="segment-list">
              <h3>
                Segments ({activeResult.algorithm}) | Visit Order:{' '}
                {activeResult.visit_order?.map((point) => point.id).join(' -> ') || '-'}
              </h3>
              {activeResult.segments.map((segment, index) => (
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

      <CostComparisonChart dataPoints={chartData} costMetric={costMetric} />
    </div>
  );
}

export default App;
