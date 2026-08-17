import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plane } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import FlightCard from '../../components/FlightCard';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { formatDate, getErrorMessage } from '../../utils/format';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Goa', 'Jaipur', 'Ahmedabad'];

const dateInput = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const TRAVEL_TYPES = [
  { value: 'flight', label: 'Flight only' },
  { value: 'hotel', label: 'Hotel only' },
  { value: 'flight_hotel', label: 'Flight + Hotel' },
];

export default function FlightSearch() {
  const { policy } = useAuth();
  const { trip, updateTrip } = useTrip();
  const toast = useToast();
  const navigate = useNavigate();

  const [travelType, setTravelType] = useState(trip?.travelType || 'flight_hotel');
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
  const [error, setError] = useState(null);

  const handleTravelTypeChange = (value) => {
    setTravelType(value);
    updateTrip({ travelType: value, ...(value === 'flight' ? { hotel: null } : {}) });
    if (value === 'hotel') {
      toast.info('Hotel-only request — search for a hotel.');
      navigate('/employee/hotels');
    }
  };

  // A hotel-only request has no flight — send the employee straight to hotel search.
  useEffect(() => {
    if (trip?.travelType === 'hotel') navigate('/employee/hotels');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setResults(null);
    setError(null);
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
      const msg = getErrorMessage(err, 'Flight search failed.');
      setError(msg);
      toast.error(msg);
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
      travelType,
      flight,
      from: flight.from,
      to: flight.to,
      travelDate: form.departureDate,
      returnDate: form.returnDate || null,
      passengers: Number(form.passengers),
      travelClass: flight.travelClass,
    });
    if (travelType === 'flight') {
      toast.success(`Flight selected — ${flight.from} → ${flight.to}. Review and submit your request.`);
      navigate('/employee/travel-request');
    } else {
      toast.success(`Flight selected — ${flight.from} → ${flight.to}. Now pick a hotel.`);
      navigate(`/employee/hotels?city=${encodeURIComponent(flight.to)}`);
    }
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Search Flights</h4>

      {/* Travel requirement */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <label className="form-label fw-semibold mb-2">Travel Requirement</label>
          <div className="d-flex flex-wrap gap-4">
            {TRAVEL_TYPES.map((t) => (
              <div key={t.value} className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="travelType"
                  id={`travelType-${t.value}`}
                  value={t.value}
                  checked={travelType === t.value}
                  onChange={(e) => handleTravelTypeChange(e.target.value)}
                />
                <label className="form-check-label" htmlFor={`travelType-${t.value}`}>{t.label}</label>
              </div>
            ))}
            {travelType === 'flight' && (
              <span className="small text-muted align-self-center">You can submit this request without selecting a hotel.</span>
            )}
            {travelType === 'flight_hotel' && (
              <span className="small text-muted align-self-center">You will select a hotel after the flight.</span>
            )}
          </div>
        </div>
      </div>

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

      {searching && (
        <div className="anim-fade-in">
          <div className="fw-semibold text-muted mb-2 d-flex align-items-center gap-2">
            <Plane size={16} /> Searching flights…
          </div>
          <LoadingSkeleton variant="flight" count={3} />
        </div>
      )}

      {error && !searching && (
        <ErrorState title="Unable to load flights" message={error} onRetry={search} />
      )}

      {results && !searching && !error && (
        <div>
          {results.outbound.length === 0 ? (
            <EmptyState
              icon={<Plane size={28} />}
              title={`No flights found`}
              text={`No flights from ${results.query.from} to ${results.query.to} on ${formatDate(results.query.departureDate)}. Try different dates or cities.`}
            />
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
