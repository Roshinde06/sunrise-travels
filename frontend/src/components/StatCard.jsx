import CountUp from './CountUp';

export default function StatCard({ label, value, icon, accent = 'primary' }) {
  const iconBg = {
    primary: 'bg-primary-subtle text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    danger: 'bg-danger-subtle text-danger',
    info: 'bg-info-subtle text-info',
    dark: 'bg-secondary-subtle text-secondary',
  }[accent];

  return (
    <div className="stat-card p-3 d-flex align-items-center gap-3 bg-white card-hover">
      {icon && (
        <div className={`rounded-3 p-2 ${iconBg} icon-lift`} style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-muted text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div className="fw-bold fs-4">
          <CountUp value={value} />
        </div>
      </div>
    </div>
  );
}
