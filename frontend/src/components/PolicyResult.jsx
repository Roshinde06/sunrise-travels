import { CheckCircle2, AlertTriangle, Plane, Hotel, XCircle, Check } from 'lucide-react';
import { inr } from '../utils/format';

/**
 * Renders the Corporate Policy Engine result.
 * result: { passed, reasons[], flightViolations[], hotelViolations[], details }
 * Shows which item (flight / hotel) violates policy so the employee can change it.
 */
export default function PolicyResult({ result, compact = false }) {
  if (!result) return null;

  if (result.passed) {
    return (
      <div className="alert alert-success d-flex align-items-start gap-2 mb-0">
        <CheckCircle2 size={20} className="mt-1 flex-shrink-0" />
        <div>
          <div className="fw-semibold">✓ This travel option complies with company policy.</div>
          {!compact && result.details && (
            <div className="small mt-1 text-secondary">
              Allowed: {result.details.allowedFlightClasses.join(', ')} flights · up to {result.details.maximumHotelStars}-star hotel
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fall back to a flat list when the grouped fields are absent.
  const flightIssues = Array.isArray(result.flightViolations) ? result.flightViolations : [];
  const hotelIssues = Array.isArray(result.hotelViolations) ? result.hotelViolations : [];
  const hasGroups = flightIssues.length > 0 || hotelIssues.length > 0;
  const flat = hasGroups ? [] : result.reasons || [];

  const Section = ({ icon, title, issues }) => (
    <div className="border rounded-2 p-2 mb-2" style={{ background: 'rgba(255,255,255,0.55)' }}>
      <div className="d-flex align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          {icon}
          <span className="fw-semibold small">{title}</span>
        </div>
        {issues.length === 0 ? (
          <span className="badge text-bg-success"><Check size={12} className="me-1" />Compliant</span>
        ) : (
          <span className="badge text-bg-danger"><XCircle size={12} className="me-1" />{issues.length} violation{issues.length === 1 ? '' : 's'}</span>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="small mb-0 mt-1 ps-3">
          {issues.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="alert alert-danger d-flex align-items-start gap-2 mb-0">
      <AlertTriangle size={20} className="mt-1 flex-shrink-0" />
      <div className="flex-grow-1">
        <div className="fw-semibold">⚠ Policy Violation — fix the flagged item below</div>

        {hasGroups ? (
          <>
            <div className="mt-2">
              <Section icon={<Plane size={15} className="text-primary" />} title="Flight" issues={flightIssues} />
              <Section icon={<Hotel size={15} className="text-primary" />} title="Hotel" issues={hotelIssues} />
            </div>
            <div className="small text-secondary mt-1">
              Use <strong>Change flight</strong> or <strong>Change hotel</strong> above to pick a compliant option.
            </div>
          </>
        ) : (
          <ul className="small mb-1 mt-1 ps-3">
            {flat.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        {!compact && result.details && (
          <div className="small text-secondary mt-2">
            Your designation ({result.details.designation}) allows {result.details.allowedFlightClasses.join(', ')} flights, up to{' '}
            {result.details.maximumHotelStars}-star hotels, flight budget {inr(result.details.flightBudget)}, hotel budget{' '}
            {inr(result.details.hotelBudgetPerNight)}/night.
          </div>
        )}
      </div>
    </div>
  );
}
