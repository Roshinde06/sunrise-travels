export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const time12 = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const durationLabel = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const STATUS_META = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'primary' },
  READY_FOR_TICKETING: { label: 'Ready for Ticketing', variant: 'info' },
  TICKETED: { label: 'Ticketed', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'dark' },
};

export const statusBadge = (status) => {
  const meta = STATUS_META[status] || { label: status, variant: 'secondary' };
  return { ...meta, className: `badge text-bg-${meta.variant}` };
};

export const getErrorMessage = (err, fallback = 'Something went wrong.') => {
  if (err.response && err.response.data) {
    const data = err.response.data;
    if (data.message) {
      if (data.details && Array.isArray(data.details)) return `${data.message}: ${data.details.join(', ')}`;
      return data.message;
    }
  }
  return err.message || fallback;
};
