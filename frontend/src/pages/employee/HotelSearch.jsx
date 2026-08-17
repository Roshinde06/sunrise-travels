import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Hotel as HotelIcon, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import FavoriteButton from '../../components/FavoriteButton';
import { inr, formatDate, getErrorMessage } from '../../utils/format';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Goa', 'Jaipur', 'Ahmedabad'];

const dateInput = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

function HotelThumb({ hotel }) {
  const [failed, setFailed] = useState(false);
  if (failed || !hotel.image) {
    return (
      <div className="media-thumb text-secondary" style={{ width: 120, height: 84 }}>
        <HotelIcon size={26} />
      </div>
    );
  }
  return (
    <div className="media-thumb" style={{ width: 120, height: 84 }}>
      <img src={hotel.image} alt={hotel.name} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

function HotelCard({ hotel, policy, checkIn, checkOut, onSelect }) {
  const starsAllowed = policy && hotel.starRating <= policy.maximumHotelStars;
  const rateAllowed = policy && hotel.pricePerNight <= policy.hotelBudgetPerNight;

  return (
    <div className="card mb-2">
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <HotelThumb hotel={hotel} />
          <div style={{ minWidth: 200 }}>
            <div className="fw-semibold">
              {hotel.name}
            </div>
            <div className="small text-muted d-flex align-items-center gap-1">
              <MapPin size={13} /> {hotel.location}
            </div>
            <div className="small">
              <span className="text-warning">{'★'.repeat(hotel.starRating)}</span>
              <span className="text-muted ms-2">{hotel.roomType} room</span>
            </div>
          </div>

          <div className="flex-grow-1">
            <div className="small text-muted mb-1">
              {formatDate(checkIn)} → {formatDate(checkOut)} · {hotel.nights} night(s) × {hotel._rooms || 1} room(s)
            </div>
            <div className="small">
              {hotel.amenities.slice(0, 4).map((a) => (
                <span key={a} className="badge text-bg-light border me-1">{a}</span>
              ))}
            </div>
          </div>

          <div className="text-end" style={{ minWidth: 150 }}>
            <div className="small text-muted">{inr(hotel.pricePerNight)}/night</div>
            <div className="fw-bold text-primary">{inr(hotel.totalPrice)} total</div>
            {policy && !starsAllowed && (
              <div className="small text-danger d-flex align-items-center gap-1">
                <AlertTriangle size={13} /> Exceeds {policy.maximumHotelStars}-star limit
              </div>
            )}
            {policy && starsAllowed && !rateAllowed && (
              <div className="small text-warning">Exceeds hotel budget/night</div>
            )}
            {policy && starsAllowed && rateAllowed && (
              <div className="small text-success d-flex align-items-center gap-1">
                <CheckCircle2 size={13} /> Policy compliant
              </div>
            )}
            <div className="d-flex align-items-center justify-content-end gap-1 mt-1">
              <FavoriteButton
                type="hotel"
                id={hotel._id}
                title={hotel.name}
                subtitle={`${hotel.city} · ${'★'.repeat(hotel.starRating)} · ${hotel.roomType}`}
                price={hotel.totalPrice}
              />
              <button className="btn btn-sm btn-primary" onClick={() => onSelect(hotel)}>
                Select
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotelSearch() {
  const { policy } = useAuth();
  const { trip, updateTrip } = useTrip();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const defaultCity = params.get('city') || trip?.to || 'Delhi';
  const defaultCheckIn = trip?.travelDate || dateInput(1);
  const defaultCheckOut = trip?.returnDate || dateInput(3);

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

  const search = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setResults(null);
    try {
      const res = await client.get('/hotels/search', {
        params: { ...form, stars: form.stars === 'Any' ? undefined : form.stars },
      });
      setResults(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Hotel search failed.'));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (hotel) => {
    const decorated = {
      ...hotel,
      _checkIn: form.checkIn,
      _checkOut: form.checkOut,
      _rooms: Number(form.rooms),
    };
    updateTrip({ hotel: decorated, checkIn: form.checkIn, checkOut: form.checkOut, rooms: Number(form.rooms), guests: Number(form.guests) });
    toast.success(`Hotel selected — ${hotel.name}. Review your travel request.`);
    navigate('/employee/travel-request');
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Search Hotels</h4>

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

      {searching && <div className="text-center py-5 text-muted">Searching hotels…</div>}

      {results && !searching && (
        <div>
          {results.hotels.length === 0 ? (
            <div className="alert alert-warning">No hotels found in {results.query.city}. Try another city or dates.</div>
          ) : (
            <>
              <div className="fw-semibold mb-2">
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
