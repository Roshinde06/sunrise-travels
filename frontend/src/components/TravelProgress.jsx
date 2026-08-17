import { Check } from 'lucide-react';

/**
 * Travel workflow progress stepper.
 * steps  — array of labels
 * current — index of the active step (0-based)
 * Completed steps show ✓, the current step pulses, pending steps are muted.
 * Horizontal on desktop, vertical timeline on mobile (CSS).
 */
export default function TravelProgress({ steps, current = 0, className = '' }) {
  return (
    <ol className={`travel-progress ${className}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={`travel-progress-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <span className="travel-progress-dot">
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className="travel-progress-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
