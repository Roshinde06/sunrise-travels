import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Hotel, Briefcase, Clock, CheckCircle2, Ticket, XCircle, Ban, ArrowRight } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { inr, formatDate } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';

export default function EmployeeDashboard() {
  const { user, policy } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/travel-requests');
        setRequests(res.data.requests || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const count = (status) => requests.filter((r) => r.status === status).length;
  const recent = requests.slice(0, 6);

  return (
    <div>
      {/* Welcome */}
      <div
        className="text-white rounded-4 p-4 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(19,78,74,0.94) 0%, rgba(15,148,136,0.78) 60%, rgba(15,148,136,0.45) 100%), url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1600&auto=format&fit=crop')",
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
            <h2 className="fw-bold mb-1">Welcome, {user?.name || 'there'} 👋</h2>
            <div className="opacity-75">
              {user?.designation || 'Employee'} · {user?.department || '—'}
            </div>
            {policy && (
              <div className="small mt-2 opacity-90">
                <span className="badge text-bg-light">
                  Policy: {policy.allowedFlightClasses.join(' / ')} flights · up to {policy.maximumHotelStars}-star hotel
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to="/employee/flights" className="btn btn-light fw-semibold d-flex align-items-center gap-2">
            <Plane size={18} /> Search Flight
          </Link>
          <Link to="/employee/hotels" className="btn btn-outline-light d-flex align-items-center gap-2">
            <Hotel size={18} /> Search Hotel
          </Link>
        </div>
      </div>

      {/* Counts */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Pending" value={count('PENDING')} icon={<Clock size={20} />} accent="warning" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Approved" value={count('APPROVED')} icon={<CheckCircle2 size={20} />} accent="primary" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Ticketed" value={count('TICKETED')} icon={<Ticket size={20} />} accent="success" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Rejected" value={count('REJECTED')} icon={<XCircle size={20} />} accent="danger" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Cancelled" value={count('CANCELLED')} icon={<Ban size={20} />} accent="dark" />
        </div>
        <div className="col-6 col-md-4 col-lg-2">
          <StatCard label="Total" value={requests.length} icon={<Briefcase size={20} />} accent="info" />
        </div>
      </div>

      {/* Recent bookings */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">My Travel Requests</h5>
          <Link to="/employee/my-trips" className="btn btn-sm btn-outline-primary">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Destination</th>
                <th>Travel Date</th>
                <th className="text-end">Total Cost</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">Loading…</td>
                </tr>
              )}
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No travel requests yet.{' '}
                    <Link to="/employee/flights" className="fw-semibold">Start your first trip →</Link>
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.from} → {r.to}
                    <div className="small text-muted">{r.flightSnapshot?.airline} {r.flightSnapshot?.flightNumber} · {r.flightSnapshot?.travelClass}</div>
                  </td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-end">
                    <Link to="/employee/my-trips" className="btn btn-sm btn-outline-secondary">Details</Link>{' '}
                    {r.status === 'TICKETED' && (
                      <Link to={`/employee/ticket/${r._id}`} className="btn btn-sm btn-primary">Ticket</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
