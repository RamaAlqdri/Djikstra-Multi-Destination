import React, { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8001/api';

const DEFAULT_DEPOT_LATITUDE = '-7.94244696762181';
const DEFAULT_DEPOT_LONGITUDE = '112.61640127197477';
const DEFAULT_CENTER = [Number(DEFAULT_DEPOT_LATITUDE), Number(DEFAULT_DEPOT_LONGITUDE)];
const ALGORITHM_ORDER = ['CDSSSD', 'MDMSMD', 'EAMDSP'];
const ROUTE_COLORS = ['#d7263d', '#f46036', '#2e294e', '#1b998b', '#e2c044', '#6a4c93'];

const emptyCustomerForm = {
  nama_pelanggan: '',
  alamat: '',
  latitude: DEFAULT_DEPOT_LATITUDE,
  longitude: DEFAULT_DEPOT_LONGITUDE,
};

const emptyDepotForm = {
  nama_depot: 'Depot Galon Pusat',
  alamat: '',
  latitude: DEFAULT_DEPOT_LATITUDE,
  longitude: DEFAULT_DEPOT_LONGITUDE,
};

function formatDistance(meters) {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return '-';
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '-';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}j ${minutes}m`;
}

function formatCurrency(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCost(value, metric) {
  if (metric === 'distance') return formatDistance(value);
  if (metric === 'ongkir') return formatCurrency(value);
  return formatDuration(value);
}

function numericInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  return String(value);
}

function parseCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload.message || payload.error || `Request gagal (${response.status})`;
    throw new Error(errorMessage);
  }

  return payload;
}

function pointIdFromVisitItem(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && typeof item.id === 'string') return item.id;
  return '';
}

function customerName(pointId, pointCustomerMap) {
  return pointCustomerMap?.[pointId]?.nama_pelanggan || pointId || '-';
}

function visitOrderText(result, pointCustomerMap) {
  const items = Array.isArray(result?.visit_order) ? result.visit_order : [];
  if (items.length === 0) return '-';
  return items.map((item) => customerName(pointIdFromVisitItem(item), pointCustomerMap)).join(' -> ');
}

function algorithmSort(a, b) {
  return ALGORITHM_ORDER.indexOf(a.algorithm) - ALGORITHM_ORDER.indexOf(b.algorithm);
}

function CoordinateClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat.toFixed(7),
        longitude: event.latlng.lng.toFixed(7),
      });
    },
  });

  return null;
}

function MapRecenter({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

function CoordinatePicker({ label, latitude, longitude, onSelect }) {
  const selectedPoint = parseCoordinate(latitude, longitude);
  const center = selectedPoint ? [selectedPoint.lat, selectedPoint.lng] : DEFAULT_CENTER;
  const zoom = selectedPoint ? 16 : 13;

  return (
    <div className="coordinate-picker">
      <div className="coordinate-picker-header">
        <strong>{label}</strong>
        <span>Klik peta untuk mengisi latitude dan longitude.</span>
      </div>

      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="coordinate-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRecenter center={center} zoom={zoom} />
        <CoordinateClickHandler onSelect={onSelect} />
        {selectedPoint && (
          <CircleMarker
            center={[selectedPoint.lat, selectedPoint.lng]}
            radius={9}
            pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.95, weight: 3 }}
          >
            <Tooltip direction="top" permanent>
              Titik
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <p className="coordinate-values">
        {selectedPoint
          ? `${selectedPoint.lat.toFixed(7)}, ${selectedPoint.lng.toFixed(7)}`
          : 'Belum ada titik dipilih.'}
      </p>
    </div>
  );
}

function DeliveryMap({ delivery, activeResult }) {
  const depot = delivery?.depot;
  const pointCustomerMap = delivery?.point_customer_map || {};
  const customers = Object.entries(pointCustomerMap);
  const center = depot ? [depot.latitude, depot.longitude] : DEFAULT_CENTER;
  const mapKey = `${delivery?.id || 'new'}-${activeResult?.algorithm || 'none'}`;

  return (
    <MapContainer key={mapKey} center={center} zoom={14} scrollWheelZoom className="route-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {depot && (
        <CircleMarker
          center={[depot.latitude, depot.longitude]}
          radius={10}
          pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.95, weight: 3 }}
        >
          <Tooltip direction="top" permanent>
            Depot
          </Tooltip>
        </CircleMarker>
      )}

      {customers.map(([pointId, pelanggan]) => (
        <CircleMarker
          key={`customer-${pointId}`}
          center={[pelanggan.latitude, pelanggan.longitude]}
          radius={8}
          pathOptions={{ color: '#ea580c', fillColor: '#fb923c', fillOpacity: 0.94, weight: 2 }}
        >
          <Tooltip direction="top" permanent>
            {pointId}
          </Tooltip>
        </CircleMarker>
      ))}

      {activeResult?.segments?.map((segment, index) => {
        const positions =
          Array.isArray(segment.geometry) && segment.geometry.length > 0
            ? segment.geometry
            : [
                [segment.from?.lat, segment.from?.lng],
                [segment.to?.lat, segment.to?.lng],
              ].filter((point) => point.every((value) => typeof value === 'number'));

        return (
          <Polyline
            key={`${activeResult.algorithm}-segment-${index}`}
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
  );
}

function ComparisonPanel({ delivery, activeAlgorithm, onActiveAlgorithmChange }) {
  if (!delivery) return null;

  const metric = delivery.cost_metric || 'duration';
  const pointCustomerMap = delivery.point_customer_map || {};
  const results = [...(delivery.algorithm_results || [])].sort(algorithmSort);
  const activeResult =
    results.find((result) => result.algorithm === activeAlgorithm) || results[0] || null;

  return (
    <section className="comparison-layout">
      <div className="comparison-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Perbandingan Algoritma</p>
            <h2>Hasil tersimpan untuk pengantaran #{delivery.id}</h2>
          </div>
          <span className="status-pill">{delivery.status}</span>
        </div>

        <div className="summary-grid">
          <div>
            <span>Best Cost</span>
            <strong>{delivery.best_by_total_cost || '-'}</strong>
          </div>
          <div>
            <span>Best Visited</span>
            <strong>{delivery.best_by_total_visited_nodes || '-'}</strong>
          </div>
          <div>
            <span>Total Jarak Best</span>
            <strong>{formatDistance((delivery.total_jarak_km || 0) * 1000)}</strong>
          </div>
          <div>
            <span>Total Durasi Best</span>
            <strong>{formatDuration(delivery.total_durasi_detik)}</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Algoritma</th>
                <th>Total Cost</th>
                <th>Jarak</th>
                <th>Durasi</th>
                <th>Visited</th>
                <th>Urutan</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.algorithm}
                  className={result.algorithm === activeResult?.algorithm ? 'is-active' : ''}
                  onClick={() => onActiveAlgorithmChange(result.algorithm)}
                >
                  <td>{result.algorithm}</td>
                  <td>{formatCost(result.total_cost, metric)}</td>
                  <td>{formatDistance(result.total_distance_m)}</td>
                  <td>{formatDuration(result.total_duration_s)}</td>
                  <td>{result.total_visited_nodes}</td>
                  <td>{visitOrderText(result, pointCustomerMap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="map-card">
        <DeliveryMap delivery={delivery} activeResult={activeResult} />
        {activeResult && (
          <div className="segment-list">
            <h3>Detail Segmen {activeResult.algorithm}</h3>
            {activeResult.segments?.map((segment, index) => {
              const fromId = segment.from?.id || '-';
              const toId = segment.to?.id || '-';
              return (
                <article key={`${activeResult.algorithm}-detail-${index}`} className="segment-item">
                  <h4>
                    {index + 1}. {fromId === 'S0' ? 'Depot' : customerName(fromId, pointCustomerMap)}
                    {' -> '}
                    {customerName(toId, pointCustomerMap)}
                  </h4>
                  <p>
                    Cost {formatCost(segment.cost, metric)} | Jarak {formatDistance(segment.distance_m)} | Durasi{' '}
                    {formatDuration(segment.duration_s)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState('pengantaran');
  const [depots, setDepots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDepotId, setSelectedDepotId] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [depotForm, setDepotForm] = useState(emptyDepotForm);
  const [editingDepotId, setEditingDepotId] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [costMetric, setCostMetric] = useState('duration');
  const [profile, setProfile] = useState('driving');
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [activeAlgorithm, setActiveAlgorithm] = useState('EAMDSP');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedCustomers = useMemo(() => {
    const selectedSet = new Set(selectedCustomerIds);
    return customers.filter((customer) => selectedSet.has(customer.id));
  }, [customers, selectedCustomerIds]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [depotPayload, customerPayload, historyPayload] = await Promise.all([
        apiFetch('/depot-galon'),
        apiFetch('/pelanggan'),
        apiFetch('/pengantaran'),
      ]);

      const loadedDepots = depotPayload.data || [];
      setDepots(loadedDepots);
      setCustomers(customerPayload.data || []);
      setHistory(historyPayload.data || []);
      if (loadedDepots.length > 0) {
        setSelectedDepotId(String(loadedDepots[0].id));
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadCustomers() {
    const payload = await apiFetch('/pelanggan');
    setCustomers(payload.data || []);
  }

  async function reloadDepots() {
    const payload = await apiFetch('/depot-galon');
    const loadedDepots = payload.data || [];
    setDepots(loadedDepots);
    if (!selectedDepotId && loadedDepots.length > 0) {
      setSelectedDepotId(String(loadedDepots[0].id));
    }
  }

  async function reloadHistory() {
    const payload = await apiFetch('/pengantaran');
    setHistory(payload.data || []);
  }

  function resetCustomerForm() {
    setCustomerForm(emptyCustomerForm);
    setEditingCustomerId(null);
  }

  function resetDepotForm() {
    setDepotForm(emptyDepotForm);
    setEditingDepotId(null);
  }

  async function saveCustomer(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');

    const payload = {
      ...customerForm,
      latitude: Number(customerForm.latitude),
      longitude: Number(customerForm.longitude),
    };

    try {
      if (editingCustomerId) {
        await apiFetch(`/pelanggan/${editingCustomerId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Data pelanggan berhasil diperbarui.');
      } else {
        await apiFetch('/pelanggan', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Data pelanggan berhasil disimpan.');
      }
      resetCustomerForm();
      await reloadCustomers();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function editCustomer(customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      nama_pelanggan: customer.nama_pelanggan,
      alamat: customer.alamat,
      latitude: numericInput(customer.latitude),
      longitude: numericInput(customer.longitude),
    });
    setActiveView('pelanggan');
  }

  async function deleteCustomer(customerId) {
    if (!window.confirm('Hapus pelanggan ini?')) return;
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');
    try {
      await apiFetch(`/pelanggan/${customerId}`, { method: 'DELETE' });
      setSelectedCustomerIds((prev) => prev.filter((id) => id !== customerId));
      setMessage('Pelanggan berhasil dihapus.');
      await reloadCustomers();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDepot(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');

    const payload = {
      ...depotForm,
      latitude: Number(depotForm.latitude),
      longitude: Number(depotForm.longitude),
    };

    try {
      if (editingDepotId) {
        await apiFetch(`/depot-galon/${editingDepotId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Data depot berhasil diperbarui.');
      } else {
        const response = await apiFetch('/depot-galon', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSelectedDepotId(String(response.data.id));
        setMessage('Data depot berhasil disimpan.');
      }
      resetDepotForm();
      await reloadDepots();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function editDepot(depot) {
    setEditingDepotId(depot.id);
    setDepotForm({
      nama_depot: depot.nama_depot,
      alamat: depot.alamat,
      latitude: numericInput(depot.latitude),
      longitude: numericInput(depot.longitude),
    });
  }

  function toggleCustomerSelection(customerId) {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  }

  async function createDelivery() {
    if (!selectedDepotId) {
      setErrorMessage('Pilih depot terlebih dahulu.');
      return;
    }
    if (selectedCustomerIds.length === 0) {
      setErrorMessage('Pilih minimal satu pelanggan tujuan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      const payload = await apiFetch('/pengantaran', {
        method: 'POST',
        body: JSON.stringify({
          depot_id: Number(selectedDepotId),
          tanggal_pengantaran: deliveryDate,
          pelanggan_ids: selectedCustomerIds,
          cost_metric: costMetric,
          profile,
        }),
      });

      setCurrentDelivery(payload.data);
      setActiveAlgorithm(payload.data.best_by_total_cost || 'EAMDSP');
      setMessage('Pengantaran dibuat. Hasil 3 algoritma sudah tersimpan di riwayat.');
      await reloadHistory();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function openHistoryItem(historyId) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const payload = await apiFetch(`/pengantaran/${historyId}`);
      setCurrentDelivery(payload.data);
      setActiveAlgorithm(payload.data.best_by_total_cost || 'EAMDSP');
      setActiveView('riwayat');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Sistem Informasi Depot Air</p>
          <h1>Pengelolaan Pelanggan dan Rute Pengantaran</h1>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={loadInitialData} disabled={isLoading}>
            Refresh
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeView === 'pengantaran' ? 'is-active' : ''} onClick={() => setActiveView('pengantaran')}>
          Pengantaran
        </button>
        <button className={activeView === 'pelanggan' ? 'is-active' : ''} onClick={() => setActiveView('pelanggan')}>
          Pelanggan
        </button>
        <button className={activeView === 'riwayat' ? 'is-active' : ''} onClick={() => setActiveView('riwayat')}>
          Riwayat
        </button>
      </nav>

      {(message || errorMessage) && (
        <div className={errorMessage ? 'notice error' : 'notice'}>
          {errorMessage || message}
        </div>
      )}

      <section className="metric-grid">
        <div>
          <span>Total Depot</span>
          <strong>{depots.length}</strong>
        </div>
        <div>
          <span>Total Pelanggan</span>
          <strong>{customers.length}</strong>
        </div>
        <div>
          <span>Riwayat Pengantaran</span>
          <strong>{history.length}</strong>
        </div>
        <div>
          <span>Pelanggan Dipilih</span>
          <strong>{selectedCustomerIds.length}</strong>
        </div>
      </section>

      {activeView === 'pengantaran' && (
        <>
          <main className="work-grid">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Buat Pengantaran</p>
                  <h2>Pilih depot dan pelanggan tujuan</h2>
                </div>
              </div>

              <label>
                Depot awal
                <select value={selectedDepotId} onChange={(event) => setSelectedDepotId(event.target.value)}>
                  <option value="">Pilih depot</option>
                  {depots.map((depot) => (
                    <option key={depot.id} value={depot.id}>
                      {depot.nama_depot}
                    </option>
                  ))}
                </select>
              </label>

              <div className="two-columns">
                <label>
                  Tanggal
                  <input value={deliveryDate} type="date" onChange={(event) => setDeliveryDate(event.target.value)} />
                </label>
                <label>
                  Cost metric
                  <select value={costMetric} onChange={(event) => setCostMetric(event.target.value)}>
                    <option value="duration">Duration</option>
                    <option value="distance">Distance</option>
                    <option value="ongkir">Ongkir</option>
                  </select>
                </label>
              </div>

              <label>
                Profile OSRM
                <input value={profile} onChange={(event) => setProfile(event.target.value)} />
              </label>

              <div className="customer-select-list">
                {customers.map((customer) => (
                  <label key={`select-${customer.id}`} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.includes(customer.id)}
                      onChange={() => toggleCustomerSelection(customer.id)}
                    />
                    <span>
                      <strong>{customer.nama_pelanggan}</strong>
                      <small>{customer.alamat}</small>
                    </span>
                  </label>
                ))}
              </div>

              <button className="btn btn-primary full-width" onClick={createDelivery} disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Hitung 3 Algoritma dan Simpan Riwayat'}
              </button>
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Pelanggan Terpilih</p>
                  <h2>{selectedCustomers.length} tujuan pengantaran</h2>
                </div>
              </div>
              <div className="selected-list">
                {selectedCustomers.length === 0 && <p className="muted">Belum ada pelanggan dipilih.</p>}
                {selectedCustomers.map((customer, index) => (
                  <article key={`selected-${customer.id}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{customer.nama_pelanggan}</strong>
                      <p>{customer.alamat}</p>
                      <small>
                        {customer.latitude}, {customer.longitude}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>

          <ComparisonPanel
            delivery={currentDelivery}
            activeAlgorithm={activeAlgorithm}
            onActiveAlgorithmChange={setActiveAlgorithm}
          />
        </>
      )}

      {activeView === 'pelanggan' && (
        <main className="work-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Master Depot</p>
                <h2>Data titik awal pengantaran</h2>
              </div>
            </div>

            <form onSubmit={saveDepot} className="form-stack">
              <input
                placeholder="Nama depot"
                value={depotForm.nama_depot}
                onChange={(event) => setDepotForm((prev) => ({ ...prev, nama_depot: event.target.value }))}
              />
              <textarea
                placeholder="Alamat depot"
                value={depotForm.alamat}
                onChange={(event) => setDepotForm((prev) => ({ ...prev, alamat: event.target.value }))}
              />
              <CoordinatePicker
                label="Pilih lokasi depot"
                latitude={depotForm.latitude}
                longitude={depotForm.longitude}
                onSelect={(coordinates) => setDepotForm((prev) => ({ ...prev, ...coordinates }))}
              />
              <div className="two-columns">
                <input
                  placeholder="Latitude"
                  value={depotForm.latitude}
                  onChange={(event) => setDepotForm((prev) => ({ ...prev, latitude: event.target.value }))}
                />
                <input
                  placeholder="Longitude"
                  value={depotForm.longitude}
                  onChange={(event) => setDepotForm((prev) => ({ ...prev, longitude: event.target.value }))}
                />
              </div>
              <div className="inline-actions">
                <button className="btn btn-primary" type="submit" disabled={isLoading}>
                  {editingDepotId ? 'Update Depot' : 'Simpan Depot'}
                </button>
                {editingDepotId && (
                  <button className="btn" type="button" onClick={resetDepotForm}>
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="compact-list">
              {depots.map((depot) => (
                <article key={depot.id}>
                  <div>
                    <strong>{depot.nama_depot}</strong>
                    <p>{depot.alamat}</p>
                  </div>
                  <button className="btn" onClick={() => editDepot(depot)}>
                    Edit
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Master Pelanggan</p>
                <h2>Data pelanggan tersimpan</h2>
              </div>
            </div>

            <form onSubmit={saveCustomer} className="form-stack">
              <input
                placeholder="Nama pelanggan"
                value={customerForm.nama_pelanggan}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, nama_pelanggan: event.target.value }))}
              />
              <textarea
                placeholder="Alamat lengkap"
                value={customerForm.alamat}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, alamat: event.target.value }))}
              />
              <CoordinatePicker
                label="Pilih lokasi pelanggan"
                latitude={customerForm.latitude}
                longitude={customerForm.longitude}
                onSelect={(coordinates) => setCustomerForm((prev) => ({ ...prev, ...coordinates }))}
              />
              <div className="two-columns">
                <input
                  placeholder="Latitude"
                  value={customerForm.latitude}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, latitude: event.target.value }))}
                />
                <input
                  placeholder="Longitude"
                  value={customerForm.longitude}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, longitude: event.target.value }))}
                />
              </div>
              <div className="inline-actions">
                <button className="btn btn-primary" type="submit" disabled={isLoading}>
                  {editingCustomerId ? 'Update Pelanggan' : 'Simpan Pelanggan'}
                </button>
                {editingCustomerId && (
                  <button className="btn" type="button" onClick={resetCustomerForm}>
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Alamat</th>
                    <th>Koordinat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{customer.nama_pelanggan}</td>
                      <td>{customer.alamat}</td>
                      <td>
                        {customer.latitude}, {customer.longitude}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn" onClick={() => editCustomer(customer)}>
                            Edit
                          </button>
                          <button className="btn btn-danger" onClick={() => deleteCustomer(customer.id)}>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {activeView === 'riwayat' && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Riwayat</p>
                <h2>Pengantaran yang sudah tersimpan</h2>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tanggal</th>
                    <th>Depot</th>
                    <th>Tujuan</th>
                    <th>Best Cost</th>
                    <th>Total Jarak</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>#{item.id}</td>
                      <td>{item.tanggal_pengantaran}</td>
                      <td>{item.depot?.nama_depot || '-'}</td>
                      <td>{item.pelanggan?.length || 0} pelanggan</td>
                      <td>{item.best_by_total_cost || '-'}</td>
                      <td>{formatDistance((item.total_jarak_km || 0) * 1000)}</td>
                      <td>{item.status}</td>
                      <td>
                        <button className="btn" onClick={() => openHistoryItem(item.id)}>
                          Lihat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <ComparisonPanel
            delivery={currentDelivery}
            activeAlgorithm={activeAlgorithm}
            onActiveAlgorithmChange={setActiveAlgorithm}
          />
        </>
      )}
    </div>
  );
}

export default App;
