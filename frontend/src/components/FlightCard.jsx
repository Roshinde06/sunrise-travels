import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { inr, formatDate, time12, durationLabel } from '../utils/format';
import FavoriteButton from './FavoriteButton';
import FlightRoute from './FlightRoute';

export default function FlightCard({ flight, policy, onSelect, showDetails = true }) {
  const [open, setOpen] = useState(false);
  const classAllowed = policy && policy.allowedFlightClasses.includes(flight.travelClass);
  const underBudget = policy && flight.price <= policy.flightBudget;
  const airlineCode = String(flight.flightNumber || '').split(' ')[0];
  const stopsLabel = flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`;

  return (
    <div className="card border-0 shadow-sm card-hover mb-3 anim-fade-in overflow-hidden">
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* Airline */}
          <div className="d-flex align-items-center gap-2" style={{ minWidth: 150 }}>
            <div
              className="media-thumb text-white"
              style={{
                width: 46,
                height: 40,
                background: 'linear-gradient(135deg, #134e4a, #0f9488)',
                borderRadius: '0.5rem',
              }}
              title={flight.airline}
            >
              <span className="fw-bold" style={{ fontSize: '0.9rem', letterSpacing: '0.02em' }}>{airlineCode}</span>
            </div>
            <div>
              <div className="fw-semibold lh-sm">{flight.airline}</div>
              <div className="small text-muted lh-sm">{flight.flightNumber}</div>
            </div>
          </div>

          {/* Route + times */}
          <div className="d-flex align-items-center gap-3 flex-grow-1">
            <div className="text-center">
              <div className="fw-bold fs-5 lh-1">{flight.fromCode}</div>
              <div className="small text-muted">{time12(flight.departureTime)}</div>
            </div>
            <div className="text-center text-muted small flex-grow-1">
              <div>{durationLabel(flight.durationMinutes)}</div>
              <div className="d-flex align-items-center gap-1">
                <span className="flex-grow-1 border-top mx-1" style={{ borderColor: '#cbd5e1' }} />
                <span style={{ color: '#0f9488', fontSize: '0.8rem' }}>✈</span>
                <span className="flex-grow-1 border-top mx-1" style={{ borderColor: '#cbd5e1' }} />
              </div>
              <div>{stopsLabel}</div>
            </div>
            <div className="text-center">
              <div className="fw-bold fs-5 lh-1">{flight.toCode}</div>
              <div className="small text-muted">{time12(flight.arrivalTime)}</div>
            </div>
          </div>

          {/* Price + class */}
          <div className="text-center" style={{ minWidth: 110 }}>
            <span className="badge text-bg-light border">{flight.travelClass}</span>
            <div className="fw-bold text-primary fs-5">{inr(flight.price)}</div>
            <div className="small text-muted">{flight.availableSeats} seats</div>
          </div>

          {/* Policy + actions */}
          <div style={{ minWidth: 100 }} className="text-end">
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
              <button className="btn btn-sm btn-primary btn-lift" onClick={() => onSelect(flight)}>
                Select
              </button>
            </div>
          </div>
        </div>

        {/* Route animation detail */}
        {showDetails && (
          <>
            <button
              className="btn btn-sm btn-link text-decoration-none small p-0 mt-2 d-inline-flex align-items-center gap-1"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {open ? 'Hide route' : 'View route'}
            </button>
            {open && (
              <div className="mt-2">
                <FlightRoute
                  from={`${flight.from} (${flight.fromCode})`}
                  to={`${flight.to} (${flight.toCode})`}
                  fromTime={time12(flight.departureTime)}
                  toTime={time12(flight.arrivalTime)}
                  durationLabel={durationLabel(flight.durationMinutes)}
                  stopsLabel={stopsLabel}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
