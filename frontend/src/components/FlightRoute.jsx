import { Plane } from 'lucide-react';

/**
 * Subtle route animation — the plane flies along the track ONCE when the
 * component mounts (1.8s). Not continuously animated.
 */
export default function FlightRoute({ from, to, fromTime, toTime, durationLabel, stopsLabel }) {
  return (
    <div className="flight-route pt-1">
      <div className="d-flex justify-content-between align-items-center mb-1 small">
        <div>
          <strong>{from}</strong>{' '}
          <span className="text-muted">{fromTime}</span>
        </div>
        <div className="text-muted">{durationLabel} · {stopsLabel}</div>
        <div className="text-end">
          <strong>{to}</strong>{' '}
          <span className="text-muted">{toTime}</span>
        </div>
      </div>
      <div className="flight-route-track">
        <span className="flight-route-dot" />
        <span className="flight-route-plane" aria-hidden="true"><Plane size={14} /></span>
        <span className="flight-route-dot" style={{ left: 'auto', right: 0 }} />
      </div>
    </div>
  );
}
