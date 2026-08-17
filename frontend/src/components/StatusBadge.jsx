import { statusBadge } from '../utils/format';

export default function StatusBadge({ status }) {
  const meta = statusBadge(status);
  return <span className={meta.className}>{meta.label}</span>;
}
