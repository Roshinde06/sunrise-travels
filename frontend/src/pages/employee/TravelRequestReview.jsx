import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Hotel, Send, ArrowLeft, ShieldCheck, XCircle, Check, RefreshCw } from 'lucide-react';
import client from '../../api/client';
import { useTrip } from '../../context/TripContext';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, time12, getErrorMessage } from '../../utils/format';
import PolicyResult from '../../components/PolicyResult';
import CompliantPicker from '../../components/CompliantPicker';

export default function TravelRequestReview() {
  const { trip, clearTrip } = useTrip();
  const toast = useToast();
  const navigate = useNavigate();

  const [policyResult, setPolicyResult] = useState(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState(null); // 'flight' | 'hotel' | null

  const flight = trip?.flight;
  const hotel = trip?.hotel;

  useEffect(() => {
    if (!flight || !hotel) {
      setChecking(false);
      return;
    }
    (async () => {
      setChecking(true);
      try {
        const res = await client.post('/policy/validate', {
          flightId: flight._id,
          hotelId: hotel._id,
          passengers: Number(trip.passengers || 1),
          rooms: Number(trip.rooms || 1),
          travelDate: trip.travelDate,
          returnDate: trip.returnDate || undefined,
        });
        setPolicyResult(res.data);
      } catch (err) {
        setPolicyResult(null);
        toast.error(getErrorMessage(err, 'Policy validation failed.'));
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?._id, hotel?._id]);

  if (!flight || !hotel) {
    return (
      <div className="text-center py-5">
        <h5 className="fw-bold mb-3">No trip selected yet</h5>
        <p className="text-muted mb-4">Select a flight and a hotel before reviewing your travel request.</p>
        <Link to="/employee/flights" className="btn btn-primary">Search Flights</Link>
      </div>
    );
  }

  const costs = policyResult?.costs;
  const nights = costs?.nights || hotel.nights || 1;

  const flightViolations = policyResult?.flightViolations || [];
  const hotelViolations = policyResult?.hotelViolations || [];

  const replaceSelection = (item) => {
    updateTrip(picker === 'flight' ? { flight: item } : { hotel: item });
    setPicker(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await client.post('/travel-requests', {
        flightId: flight._id,
        hotelId: hotel._id,
        travelDate: trip.travelDate,
        returnDate: trip.returnDate || undefined,
        passengers: Number(trip.passengers || 1),
        rooms: Number(trip.rooms || 1),
      });
      toast.success(`${res.data.travelRequest.requestId} submitted — waiting for manager approval.`);
      clearTrip();
      navigate('/employee/my-trips');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit the travel request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link to="/employee/hotels" className="small text-decoration-none text-secondary mb-3 d-inline-flex align-items-center gap-1">
        <ArrowLeft size={14} /> Change hotel
      </Link>
      <h4 className="fw-bold mb-3">Review Travel Request</h4>

      <div className="row g-4">
        {/* Selected travel */}
        <div className="col-lg-8">
          <div className={`card border-0 shadow-sm mb-3 ${policyResult && !policyResult.passed && flightViolations.length ? 'border-start border-4 border-danger' : ''}`}>
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Plane size={18} className="text-primary" /> Flight
              {policyResult && !checking && (
                flightViolations.length ? (
                  <span className="badge text-bg-danger ms-1 d-inline-flex align-items-center gap-1">
                    <XCircle size={13} /> Violates policy
                  </span>
                ) : (
                  <span className="badge text-bg-success ms-1 d-inline-flex align-items-center gap-1">
                    <Check size={13} /> Compliant
                  </span>
                )
              )}
              <button className="btn btn-sm btn-outline-primary ms-auto d-inline-flex align-items-center gap-1" onClick={() => setPicker('flight')}>
                <RefreshCw size={14} /> Change flight
              </button>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div
                  className="media-thumb text-white"
                  style={{ width: 52, height: 42, background: 'linear-gradient(135deg, #134e4a, #0f9488)', borderRadius: '0.5rem' }}
                >
                  <span className="fw-bold" style={{ fontSize: '0.95rem' }}>{String(flight.flightNumber || '').split(' ')[0]}</span>
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{flight.airline} {flight.flightNumber}</div>
                  <div className="small text-muted">{flight.from} → {flight.to} · {formatDate(trip.travelDate)}</div>
                </div>
                <div>
                  <span className="badge text-bg-light border me-2">{flight.travelClass}</span>
                  <span className="fw-semibold">{time12(flight.departureTime)} – {time12(flight.arrivalTime)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`card border-0 shadow-sm mb-3 ${policyResult && !policyResult.passed && hotelViolations.length ? 'border-start border-4 border-danger' : ''}`}>
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Hotel size={18} className="text-primary" /> Hotel
              {policyResult && !checking && (
                hotelViolations.length ? (
                  <span className="badge text-bg-danger ms-1 d-inline-flex align-items-center gap-1">
                    <XCircle size={13} /> Violates policy
                  </span>
                ) : (
                  <span className="badge text-bg-success ms-1 d-inline-flex align-items-center gap-1">
                    <Check size={13} /> Compliant
                  </span>
                )
              )}
              <button className="btn btn-sm btn-outline-primary ms-auto d-inline-flex align-items-center gap-1" onClick={() => setPicker('hotel')}>
                <RefreshCw size={14} /> Change hotel
              </button>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div className="media-thumb position-relative text-secondary" style={{ width: 104, height: 72 }}>
                  <Hotel size={22} className="position-absolute" style={{ zIndex: 0 }} />
                  {hotel.image && (
                    <img
                      src={hotel.image}
                      alt={hotel.name}
                      className="position-relative"
                      style={{ zIndex: 1 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{hotel.name}</div>
                  <div className="small text-muted">
                    {hotel.city} · {'★'.repeat(hotel.starRating)} · {hotel.roomType} room · {nights} night(s) × {trip.rooms || 1} room(s)
                  </div>
                </div>
                <div className="fw-semibold">{inr(hotel.pricePerNight)}/night</div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Corporate Policy Validation
            </div>
            <div className="card-body">
              {checking ? (
                <div className="d-flex align-items-center gap-2 text-muted">
                  <span className="spinner-border spinner-border-sm" /> Running policy engine…
                </div>
              ) : policyResult ? (
                <PolicyResult result={policyResult} />
              ) : (
                <div className="alert alert-danger mb-0">Policy validation could not be completed. Please reselect your travel options.</div>
              )}
            </div>
          </div>
        </div>

        {/* Cost summary */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm sticky-top" style={{ top: 16 }}>
            <div className="card-header bg-white fw-semibold">Cost Summary</div>
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Flight ({trip.passengers || 1} × {inr(flight.price)})</span>
                <span className="fw-semibold">{inr(costs?.flightCost ?? flight.price * (trip.passengers || 1))}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Hotel ({nights} nights × {trip.rooms || 1} × {inr(hotel.pricePerNight)})</span>
                <span className="fw-semibold">{inr(costs?.hotelCost ?? hotel.pricePerNight * nights * (trip.rooms || 1))}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between fs-5">
                <span className="fw-semibold">Total</span>
                <span className="fw-bold text-primary">{inr(costs?.total ?? (flight.price * (trip.passengers || 1) + hotel.pricePerNight * nights * (trip.rooms || 1)))}</span>
              </div>

              <button
                className="btn btn-primary w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
                disabled={submitting || checking || !policyResult?.passed}
                onClick={handleSubmit}
              >
                {submitting ? <span className="spinner-border spinner-border-sm" /> : <Send size={18} />}
                Submit Travel Request
              </button>
              {policyResult && !policyResult.passed && (
                <div className="small text-danger text-center mt-2">
                  A policy-violating request cannot be submitted. Please select compliant options.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compliant alternative picker */}
      {picker && (
        <CompliantPicker
          type={picker}
          trip={trip}
          current={picker === 'flight' ? flight : hotel}
          details={policyResult?.details}
          onSelect={replaceSelection}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
