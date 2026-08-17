import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Hotel as HotelIcon, Plane } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import HotelCard from '../../components/HotelCard';
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

export default function HotelSearch() {
  const { policy } = useAuth();
  const { trip, updateTrip } = useTrip();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [travelType, setTravelType] = useState(trip?.travelType || 'flight_hotel');
  const defaultCity = params.get('city') || trip?.to || 'Delhi';
  const defaultCheckIn = trip?.travelDate || trip?.checkIn || dateInput(1);
  const defaultCheckOut = trip?.returnDate || trip?.checkOut || dateInput(3);

  const [form, setForm] = useState({
    city: defaultCity,
    checkIn: defaultCheckIn,
    checkOut: defaultCheckOut,
    guests: 1,
    rooms: 1,
    stars: 'Any',
  });
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const search = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setResults(null);
    setError(null);
    try {
      const res = await client.get('/hotels/search', {
        params: { ...form, stars: form.stars === 'Any' ? undefined : form.stars },
      });
      setResults(res.data);
    } catch (err) {
      const msg = getErrorMessage(err, 'Hotel search failed.');
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

  const handleTravelTypeChange = (value) => {
    setTravelType(value);
    updateTrip({ travelType: value, ...(value === 'hotel' ? { flight: null } : {}) });
    if (value === 'flight') {
      toast.info('Flight-only request — search for a flight.');
      navigate('/employee/flights');
    } else if (value === 'flight_hotel' && !trip?.flight) {
      toast.info('Flight + Hotel request — pick a flight first.');
      navigate('/employee/flights');
    }
  };

  const handleSelect = (hotel) => {
    const decorated = {
      ...hotel,
      _checkIn: form.checkIn,
      _checkOut: form.checkOut,
      _rooms: Number(form.rooms),
    };
    const patch = {
      travelType,
      hotel: decorated,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      rooms: Number(form.rooms),
      guests: Number(form.guests),
    };
    if (travelType === 'hotel') {
      // Hotel-only requests carry their dates on travelDate/returnDate too
      patch.travelDate = form.checkIn;
      patch.returnDate = form.checkOut;
    }
    updateTrip(patch);
    toast.success(`Hotel selected — ${hotel.name}. Review your travel request.`);
    navigate('/employee/travel-request');
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Search Hotels</h4>

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
            {travelType === 'hotel' && (
              <span className="small text-muted align-self-center">No flight is required — only the hotel stay will be submitted.</span>
            )}
            {travelType === 'flight_hotel' && trip?.flight && (
              <span className="small text-muted align-self-center">Flight selected: {trip.flight.from} → {trip.flight.to} · {formatDate(trip.travelDate)}</span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={search} className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-2">
              <label className="form-label small">City</label>
              <select className="form-select" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Check-in</label>
              <input type="date" className="form-control" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Check-out</label>
              <input type="date" className="form-control" value={form.checkOut} min={form.checkIn} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
            </div>
            <div className="col-md-1">
              <label className="form-label small">Guests</label>
              <input type="number" min="1" max="6" className="form-control" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} />
            </div>
            <div className="col-md-1">
              <label className="form-label small">Rooms</label>
              <input type="number" min="1" max="4" className="form-control" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Star rating</label>
              <select className="form-select" value={form.stars} onChange={(e) => setForm({ ...form, stars: e.target.value })}>
                <option value="Any">Any</option>
                {[2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} Star</option>)}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
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
            <HotelIcon size={16} /> Finding hotels…
          </div>
          <LoadingSkeleton variant="hotel" count={3} />
        </div>
      )}

      {error && !searching && (
        <ErrorState title="Unable to load hotels" message={error} onRetry={search} />
      )}

      {results && !searching && !error && (
        <div>
          {results.hotels.length === 0 ? (
            <EmptyState
              icon={<HotelIcon size={28} />}
              title={`No hotels found in ${results.query.city}`}
              text="Try different dates, a nearby city, or a higher star rating."
            />
          ) : (
            <>
              <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
                <Plane size={15} className="text-primary" />
                {results.hotels.length} hotel(s) in {results.query.city}
              </div>
              {results.hotels.map((h) => (
                <HotelCard key={h._id} hotel={h} policy={policy} checkIn={form.checkIn} checkOut={form.checkOut} onSelect={handleSelect} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
