import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plane, Clock, AlertTriangle } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import FavoriteButton from '../../components/FavoriteButton';
import { inr, formatDate, time12, durationLabel, getErrorMessage } from '../../utils/format';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Goa', 'Jaipur', 'Ahmedabad'];

const dateInput = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

function FlightCard({ flight, selected, policy, onSelect }) {
  const classAllowed = policy && policy.allowedFlightClasses.includes(flight.travelClass);
  const underBudget = policy && flight.price <= policy.flightBudget;
  const airlineCode = String(flight.flightNumber || '').split(' ')[0];

  return (
    <div className={`card mb-2 border ${selected ? 'border-primary border-2' : ''}`}>
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex align-items-center gap-2" style={{ minWidth: 160 }}>
            <div
              className="media-thumb text-white"
              style={{
                width: 52,
                height: 42,
                background: 'linear-gradient(135deg, #134e4a, #0f9488)',
                borderRadius: '0.5rem',
              }}
              title={flight.airline}
            >
              <span className="fw-bold" style={{ fontSize: '0.95rem', letterSpacing: '0.02em' }}>{airlineCode}</span>
            </div>
            <div>
              <div className="fw-semibold">{flight.airline}</div>
              <div className="small text-muted">{flight.flightNumber}</div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 flex-grow-1">
            <div>
              <div className="fw-bold">{flight.fromCode}</div>
              <div className="small text-muted">{time12(flight.departureTime)}</div>
            </div>
            <div className="text-center text-muted small flex-grow-1">
              <div>{durationLabel(flight.durationMinutes)}</div>
              <div className="border-top mx-2" />
              <div>{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop`}</div>
            </div>
            <div className="text-end">
              <div className="fw-bold">{flight.toCode}</div>
              <div className="small text-muted">{time12(flight.arrivalTime)}</div>
            </div>
          </div>

          <div className="text-center" style={{ minWidth: 120 }}>
            <span className="badge text-bg-light border">{flight.travelClass}</span>
            <div className="fw-bold text-primary">{inr(flight.price)}</div>
            <div className="small text-muted">{flight.availableSeats} seats</div>
          </div>

          <div style={{ minWidth: 110 }} className="text-end">
            {policy && !classAllowed && (
              <div className="small text-danger d-flex align-items-center gap-1 mb-1">
                <AlertTriangle size={13} /> Not allowed for your designation
              </div>
            )}
            {policy && classAllowed && !underBudget && (
              <div className="small text-warning mb-1">Exceeds flight budget</div>
            )}
            <div className="d-flex align-items-center justify-content-end gap-1">
              <FavoriteButton
                type="flight"
                id={flight._id}
                title={`${flight.airline} ${flight.flightNumber} · ${flight.travelClass}`}
                subtitle={`${flight.from} → ${flight.to} · ${formatDate(flight.departureDate)}`}
                price={flight.price}
              />
              <button className="btn btn-sm btn-primary" onClick={() => onSelect(flight)}>
                Select
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlightSearch() {
  const { policy } = useAuth();
  const { trip, updateTrip } = useTrip();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    from: trip?.from || 'Mumbai',
    to: trip?.to || 'Delhi',
    departureDate: trip?.travelDate || dateInput(1),
    returnDate: trip?.returnDate || '',
    passengers: 1,
    travelClass: 'All',
  });
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const search = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setResults(null);
    try {
      const params = {
        from: form.from,
        to: form.to,
        departureDate: form.departureDate,
        passengers: form.passengers,
        travelClass: form.travelClass,
      };
      if (form.returnDate) params.returnDate = form.returnDate;
      const res = await client.get('/flights/search', { params });
      setResults(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Flight search failed.'));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (flight) => {
    updateTrip({
      flight,
      from: flight.from,
      to: flight.to,
      travelDate: form.departureDate,
      returnDate: form.returnDate || null,
      passengers: Number(form.passengers),
      travelClass: flight.travelClass,
    });
    toast.success(`Flight selected — ${flight.from} → ${flight.to}. Now pick a hotel.`);
    navigate(`/employee/hotels?city=${encodeURIComponent(flight.to)}`);
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Search Flights</h4>

      <form onSubmit={search} className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-2">
              <label className="form-label small">From</label>
              <select className="form-select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">To</label>
              <select className="form-select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
                {CITIES.filter((c) => c !== form.from).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Departure</label>
              <input type="date" className="form-control" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Return (optional)</label>
              <input type="date" className="form-control" value={form.returnDate} min={form.departureDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
            </div>
            <div className="col-md-1">
              <label className="form-label small">Passengers</label>
              <input type="number" min="1" max="9" className="form-control" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Class</label>
              <select className="form-select" value={form.travelClass} onChange={(e) => setForm({ ...form, travelClass: e.target.value })}>
                <option>All</option>
                <option>Economy</option>
                <option>Premium Economy</option>
                <option>Business</option>
              </select>
            </div>
            <div className="col-md-1 d-flex align-items-end">
              <button className="btn btn-primary w-100" disabled={searching}>
                {searching ? <span className="spinner-border spinner-border-sm" /> : <Search size={18} />}
              </button>
            </div>
          </div>
        </div>
      </form>

      {searching && <div className="text-center py-5 text-muted">Searching flights…</div>}

      {results && !searching && (
        <div>
          {results.outbound.length === 0 ? (
            <div className="alert alert-warning">No flights found for {results.query.from} → {results.query.to} on {formatDate(results.query.departureDate)}. Try different dates or cities.</div>
          ) : (
            <>
              <div className="fw-semibold mb-2">
                {results.outbound.length} flight(s) · {results.query.from} → {results.query.to} · {formatDate(results.query.departureDate)} · {results.query.passengers} passenger(s)
              </div>
              {results.outbound.map((f) => (
                <FlightCard key={f._id} flight={f} policy={policy} onSelect={handleSelect} />
              ))}
            </>
          )}

          {results.return && results.return.length > 0 && (
            <>
              <h6 className="fw-bold mt-4 mb-2">Return flights · {results.query.to} → {results.query.from} · {formatDate(results.query.returnDate)}</h6>
              {results.return.map((f) => (
                <FlightCard key={f._id} flight={f} policy={policy} onSelect={handleSelect} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
