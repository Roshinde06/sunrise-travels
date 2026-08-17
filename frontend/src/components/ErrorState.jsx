import { AlertTriangle } from 'lucide-react';

/**
 * Professional error state. Technical details stay in the console/backend
 * logs — the UI only shows a friendly message and a retry action.
 */
export default function ErrorState({
  title = 'Unable to load',
  message = "We couldn't retrieve the information right now. Please try again.",
  onRetry,
}) {
  return (
    <div className="text-center py-5 px-3">
      <div className="empty-state-icon" style={{ background: '#fdeaea', color: '#dc2626' }}>
        <AlertTriangle size={28} />
      </div>
      <h6 className="fw-semibold mb-1">{title}</h6>
      <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: 380 }}>{message}</p>
      {onRetry && (
        <button className="btn btn-primary btn-sm mt-3 btn-lift" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
