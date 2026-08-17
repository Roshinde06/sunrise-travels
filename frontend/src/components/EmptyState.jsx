/**
 * Professional empty state — icon, title, supporting text and optional action.
 */
export default function EmptyState({ icon, title, text, action, className = '' }) {
  return (
    <div className={`text-center py-5 px-3 ${className}`}>
      <div className="empty-state-icon">{icon}</div>
      <h6 className="fw-semibold mb-1">{title}</h6>
      {text && <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: 380 }}>{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
