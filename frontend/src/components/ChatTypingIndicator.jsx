/**
 * Chat typing indicator — three dots animating sequentially.
 * Pure CSS, plays while the assistant is working.
 */
export default function ChatTypingIndicator({ label = '' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-muted small py-1">
      <span className="typing-dots" aria-hidden="true">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}
