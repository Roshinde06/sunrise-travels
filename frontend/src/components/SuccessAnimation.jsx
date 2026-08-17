/**
 * Small checkmark animation (draw + pop, plays once).
 * Use after successful submissions/bookings — not a celebration effect.
 */
export default function SuccessAnimation({ size = 72 }) {
  return (
    <div className="success-check" style={{ width: size, height: size }} role="img" aria-label="Success">
      <svg viewBox="0 0 52 52" width={size} height={size} fill="none">
        <circle cx="26" cy="26" r="24" stroke="#0f9488" strokeWidth="3" strokeLinecap="round" />
        <path
          stroke="#0f9488"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 27l8 8 16-16"
        />
      </svg>
    </div>
  );
}
