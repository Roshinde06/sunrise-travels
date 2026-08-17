import { useEffect, useState } from 'react';
import { Plane, Hotel, X, Check, Star, AlertTriangle, RefreshCw } from 'lucide-react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { inr, time12, formatDate, getErrorMessage } from '../utils/format';

/**
 * Modal that lists policy-compliant alternatives for the violating item.
 * props:
 *   type: 'flight' | 'hotel'
 *   trip: { travelDate, returnDate, passengers, rooms, ... } from TripContext
 *   current: the currently selected flight or hotel
 *   details: policy details from the validation result (allowed classes, budgets, stars)
 *   onSelect(item): called with the chosen replacement
 *   onClose()
 */
export default function CompliantPicker({ type, trip, current, details, onSelect, onClose }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isFlight = type === 'flight';

  const isCompliant = (item) => {
    if (!details) return true;
    if (isFlight) {
      const allowed = details.allowedFlightClasses || [];
      return allowed.includes(item.travelClass) && item.price <= (details.flightBudget ?? Infinity);
    }
    return (
      item.starRating <= (details.maximumHotelStars ?? Infinity) &&
      item.pricePerNight <= (details.hotelBudgetPerNight ?? Infinity)
    );
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (isFlight) {
          const res = await client.get('/flights/search', {
            params: {
              from: current.from,
              to: current.to,
              departureDate: trip.travelDate,
              passengers: trip.passengers || 1,
            },
          });
          const all = res.data.outbound || [];
          setItems(all.filter((f) => f._id !== current._id && isCompliant(f)));
        } else {
          const checkIn = trip.travelDate;
          const checkOut =
            trip.returnDate ||
            new Date(new Date(`${checkIn}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10);
          const res = await client.get('/hotels/search', {
            params: {
              city: current.city,
              checkIn,
              checkOut,
              guests: trip.guests || 1,
              rooms: trip.rooms || 1,
            },
          });
          const all = res.data.hotels || [];
          setItems(all.filter((h) => h._id !== current._id && isCompliant(h)));
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load alternative options.'));
        toast.error(getErrorMessage(err, 'Could not load alternative options.'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(15, 23, 42, 0.55)', zIndex: 2000 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4 shadow-lg d-flex flex-column"
        style={{ width: 'min(720px, 94vw)', maxHeight: '86vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <span
              className="rounded-circle d-inline-flex align-items-center justify-content-center text-white"
              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #134e4a, #0f9488)' }}
            >
              {isFlight ? <Plane size={18} /> : <Hotel size={18} />}
            </span>
            <div>
              <h5 className="mb-0 fw-bold">
                {isFlight ? 'Choose a compliant flight' : 'Choose a compliant hotel'}
              </h5>
              <div className="small text-muted">
                {isFlight
                  ? `${current.from} → ${current.to} · ${formatDate(trip.travelDate)}`
                  : `${current.city} · ${formatDate(trip.travelDate)}`}
                {details && (
                  <span className="text-success ms-1">· only policy-compliant options shown</span>
                )}
              </div>
            </div>
          </div>
          <button className="btn btn-sm btn-outline-secondary border-0" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow-1 overflow-auto px-3 py-2" style={{ minHeight: 200 }}>
          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-2" />
              <div className="text-muted small">Finding compliant {isFlight ? 'flights' : 'hotels'}…</div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-0 mt-3">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-5 text-muted">
              <AlertTriangle size={28} className="mb-2 opacity-50" />
              <div className="fw-semibold text-dark">No compliant options found</div>
              <div className="small">
                No {isFlight ? 'flight' : 'hotel'} matches your policy on this route/date. Try different dates, or ask the
                travel administrator for help.
              </div>
            </div>
          )}

          {!loading &&
            items.map((item) => (
              <div key={item._id} className="border rounded-3 p-3 mb-2 d-flex flex-wrap align-items-center gap-3">
                {isFlight ? (
                  <>
                    <div
                      className="media-thumb text-white flex-shrink-0"
                      style={{ width: 52, height: 42, background: 'linear-gradient(135deg, #134e4a, #0f9488)', borderRadius: '0.5rem' }}
                    >
                      <span className="fw-bold" style={{ fontSize: '0.95rem' }}>{String(item.flightNumber || '').split(' ')[0]}</span>
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold">{item.airline} {item.flightNumber}</div>
                      <div className="small text-muted">
                        {item.from} → {item.to} · {time12(item.departureTime)} – {time12(item.arrivalTime)} · {item.stops} stop(s)
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-semibold">{inr(item.price)}</div>
                      <span className="badge text-bg-light border">{item.travelClass}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="media-thumb position-relative text-secondary flex-shrink-0" style={{ width: 88, height: 62 }}>
                      <Hotel size={20} className="position-absolute" style={{ zIndex: 0 }} />
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="position-relative"
                          style={{ zIndex: 1 }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{item.name}</div>
                      <div className="small text-muted">
                        {item.city} · <span className="text-warning">{'★'.repeat(item.starRating)}</span> · {item.roomType} · {item.nights || 1} night(s)
                      </div>
                      {item.amenities?.length > 0 && (
                        <div className="small text-muted text-truncate">{item.amenities.slice(0, 3).join(' · ')}</div>
                      )}
                    </div>
                    <div className="text-end">
                      <div className="fw-semibold">{inr(item.pricePerNight)}/night</div>
                      <div className="small text-muted">Total {inr(item.totalPrice ?? item.pricePerNight)}</div>
                    </div>
                  </>
                )}
                <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={() => onSelect(item)}>
                  <Check size={15} /> Select
                </button>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-top d-flex justify-content-between align-items-center">
          <div className="small text-muted d-flex align-items-center gap-1">
            <RefreshCw size={13} /> Re-searching on the same route &amp; dates
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Keep current {isFlight ? 'flight' : 'hotel'}
          </button>
        </div>
      </div>
    </div>
  );
}
