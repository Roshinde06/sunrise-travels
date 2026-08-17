import { statusBadge } from '../utils/format';

/**
 * Status badge with a subtle pop transition.
 * The `key` forces a remount when the status changes so the CSS animation
 * replays (Pending → Approved → Booking → Confirmed), without large effects.
 */
export default function StatusBadge({ status }) {
  const meta = statusBadge(status);
  return <span key={status} className={`${meta.className} badge-pop`}>{meta.label}</span>;
}
