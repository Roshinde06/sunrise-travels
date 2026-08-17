import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, Ban, Wallet, MapPin, Plane, Ticket, AlertTriangle, Activity, ArrowRight, Settings2 } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { inr, formatDateTime } from '../../utils/format';
import StatCard from '../../components/StatCard';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/admin/dashboard');
        setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  const m = data.metrics;

  return (
    <div>
      {/* Welcome banner */}
      <div
        className="text-white rounded-4 p-4 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(15,23,42,0.92) 0%, rgba(19,78,74,0.85) 55%, rgba(15,148,136,0.5) 100%), url('https://images.unsplash.com/photo-1529074963764-98f45c47344b?q=80&w=1600&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white"
            style={{ width: 54, height: 54, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.4)', fontSize: '1.1rem' }}
          >
            {(user?.name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
          </span>
          <div>
            <h2 className="fw-bold mb-1">Welcome, {user?.name?.split(' ')[0] || 'there'} 👋</h2>
            <div className="opacity-75">Travel Administrator · Central visibility of the corporate travel program</div>
            {m.approvedForTicketing > 0 && (
              <div className="small mt-2 opacity-90">
                <span className="badge text-bg-warning text-dark">{m.approvedForTicketing} approved booking{m.approvedForTicketing === 1 ? '' : 's'} waiting for final ticketing</span>
              </div>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to="/admin/ticketing" className="btn btn-light fw-semibold d-flex align-items-center gap-2">
            <Plane size={18} /> Ticketing Queue
          </Link>
          <Link to="/admin/policies" className="btn btn-outline-light d-flex align-items-center gap-2">
            <Settings2 size={16} /> Manage Policies
          </Link>
          <Link to="/admin/travel-spend" className="btn btn-outline-light d-flex align-items-center gap-2">
            <ArrowRight size={16} /> Travel Spend
          </Link>
        </div>
      </div>

      {/* Required metrics */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Today's Bookings" value={m.todayBookings} icon={<CalendarCheck size={20} />} accent="primary" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Pending Approvals" value={m.pendingApprovals} icon={<Clock size={20} />} accent="warning" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Cancelled Bookings" value={m.cancelledBookings} icon={<Ban size={20} />} accent="danger" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Travel Spend" value={inr(m.travelSpend)} icon={<Wallet size={20} />} accent="success" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Most Travelled City" value={m.mostTravelledCity} icon={<MapPin size={20} />} accent="info" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Approved → Ticketing" value={m.approvedForTicketing} icon={<Plane size={20} />} accent="dark" />
        </div>
      </div>

      <div className="row g-4">
        {/* Ticketing queue */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex justify-content-between">
              <span>Ticketing Queue</span>
              <Link to="/admin/ticketing" className="small">Open →</Link>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted">Approved, waiting for ticketing</span>
                <span className="fw-bold">{m.approvedForTicketing}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted">Ticketed bookings</span>
                <span className="fw-bold">{m.ticketedBookings}</span>
              </div>
              <div className="d-flex justify-content-between py-2">
                <span className="text-muted d-inline-flex align-items-center gap-1">
                  <AlertTriangle size={14} className="text-warning" /> Failed booking attempts
                </span>
                <span className="fw-bold">{m.failedBookingAttempts}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent cancellations */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Ban size={16} className="text-danger" /> Recent Cancellations
            </div>
            <div className="list-group list-group-flush">
              {data.recentCancellations.length === 0 && <div className="list-group-item text-muted small">No cancellations yet.</div>}
              {data.recentCancellations.map((r) => (
                <div key={r._id} className="list-group-item">
                  <div className="d-flex justify-content-between">
                    <span className="fw-semibold small">{r.requestId}</span>
                    <span className="text-muted small">{inr(r.totalAmount)}</span>
                  </div>
                  <div className="small text-muted">{r.employeeName} · {r.from} → {r.to}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Activity size={16} className="text-primary" /> Recent Activity (audit log)
            </div>
            <div className="list-group list-group-flush">
              {data.recentActivity.map((log) => (
                <div key={log._id} className="list-group-item">
                  <div className="d-flex justify-content-between">
                    <span className="fw-semibold small">{log.userName}</span>
                    <span className="text-muted small">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="small">
                    <span className="badge text-bg-light border me-1">{log.action}</span>
                    {log.entityId && <span className="text-muted">{log.entityId}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
