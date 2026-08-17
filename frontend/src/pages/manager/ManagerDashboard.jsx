import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Briefcase, Eye, Check, X, ClipboardCheck, ArrowRight } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, formatDateTime, getErrorMessage } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');

  const load = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([client.get('/approvals/stats'), client.get('/approvals/pending')]);
      setData(statsRes.data);
      setPending(pendingRes.data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, action, reason = '') => {
    setActing(`${action}-${id}`);
    try {
      await client.post(`/approvals/${id}/${action}`, reason ? { reason } : {});
      toast.success(action === 'approve' ? 'Request approved.' : 'Request rejected.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed.'));
    } finally {
      setActing('');
    }
  };

  if (loading || !data) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  const s = data.stats;

  return (
    <div>
      {/* Welcome banner */}
      <div
        className="text-white rounded-4 p-4 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(19,78,74,0.94) 0%, rgba(15,148,136,0.78) 60%, rgba(15,148,136,0.45) 100%), url('https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1600&auto=format&fit=crop')",
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
            <div className="opacity-75">Approver · Review pending travel requests</div>
            {s.pendingApprovals > 0 && (
              <div className="small mt-2 opacity-90">
                <span className="badge text-bg-warning text-dark">{s.pendingApprovals} request{s.pendingApprovals === 1 ? '' : 's'} waiting for your decision</span>
              </div>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to="/manager/approvals" className="btn btn-light fw-semibold d-flex align-items-center gap-2">
            <ClipboardCheck size={18} /> Review Approvals
          </Link>
          <Link to="/manager/approvals" className="btn btn-outline-light d-flex align-items-center gap-2">
            View all <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <StatCard label="Pending Approvals" value={s.pendingApprovals} icon={<Clock size={20} />} accent="warning" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Approved Today" value={s.approvedToday} icon={<CheckCircle2 size={20} />} accent="success" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Rejected Today" value={s.rejectedToday} icon={<XCircle size={20} />} accent="danger" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Total Requests" value={s.totalRequests} icon={<Briefcase size={20} />} accent="primary" />
        </div>
      </div>

      {/* Pending queue */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">Pending Travel Requests</h5>
          <Link to="/manager/approvals" className="btn btn-sm btn-outline-primary">View all</Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Destination</th>
                <th>Travel Date</th>
                <th className="text-end">Amount</th>
                <th>Policy</th>
                <th>Submitted</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr><td colSpan={8} className="text-center py-4 text-muted">No pending approvals. 🎉</td></tr>
              )}
              {pending.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.employeeName}
                    <div className="small text-muted">{r.employeeDesignation}</div>
                  </td>
                  <td>{r.from} → {r.to}</td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><span className="badge text-bg-success">Passed</span></td>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td className="text-end text-nowrap">
                    <Link to={`/manager/approval/${r._id}`} className="btn btn-sm btn-outline-secondary"><Eye size={14} /></Link>{' '}
                    <button className="btn btn-sm btn-success" disabled={!!acting} onClick={() => decide(r._id, 'approve')}>
                      <Check size={14} /> Approve
                    </button>{' '}
                    <button className="btn btn-sm btn-outline-danger" disabled={!!acting} onClick={() => decide(r._id, 'reject', 'Not approved at this time.')}>
                      <X size={14} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval history */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white fw-semibold">My Approval History</div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request</th>
                <th>Employee</th>
                <th>Route</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Decided</th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 && (
                <tr><td colSpan={6} className="text-center py-4 text-muted">No approvals decided yet.</td></tr>
              )}
              {data.history.map((h) => (
                <tr key={h._id}>
                  <td className="fw-semibold">{h.travelRequestId?.requestId || '—'}</td>
                  <td>{h.travelRequestId?.employeeName || '—'}</td>
                  <td>{h.travelRequestId ? `${h.travelRequestId.from} → ${h.travelRequestId.to}` : '—'}</td>
                  <td>
                    {h.action === 'approve' ? (
                      <span className="badge text-bg-success">Approved</span>
                    ) : (
                      <span className="badge text-bg-danger">Rejected</span>
                    )}
                  </td>
                  <td className="small text-muted">{h.reason || '—'}</td>
                  <td className="small text-muted">{formatDateTime(h.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
