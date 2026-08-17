import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Briefcase, Eye, Check, X, ClipboardCheck, ArrowRight } from 'lucide-react';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, formatDateTime, getErrorMessage, formatRoute, travelTypeLabel } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';
import RequestFilters from '../../components/RequestFilters';
import DecisionModal from '../../components/DecisionModal';

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'TICKETED', 'CANCELLED'];
const EMPTY_FILTERS = { search: '', status: 'ALL', travelType: 'ALL', dateFrom: '', dateTo: '' };

export default function ManagerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [decision, setDecision] = useState(null); // { action, request }

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (nextFilters.search) params.search = nextFilters.search;
      if (nextFilters.status && nextFilters.status !== 'ALL') params.status = nextFilters.status;
      if (nextFilters.travelType && nextFilters.travelType !== 'ALL') params.travelType = nextFilters.travelType;
      if (nextFilters.dateFrom) params.dateFrom = nextFilters.dateFrom;
      if (nextFilters.dateTo) params.dateTo = nextFilters.dateTo;
      const [statsRes, reqRes] = await Promise.all([
        client.get('/approvals/stats'),
        client.get('/travel-requests', { params }),
      ]);
      setData(statsRes.data);
      setRequests(reqRes.data.requests || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load requests.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (comment) => {
    const { action, request } = decision;
    setActing(`${action}-${request._id}`);
    try {
      await client.post(`/approvals/${request._id}/${action}`, comment ? { reason: comment } : {});
      toast.success(action === 'approve' ? 'Request approved.' : 'Request rejected.');
      setDecision(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed.'));
    } finally {
      setActing('');
    }
  };

  if (loading && !data) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }

  const s = data?.stats;

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
            <div className="opacity-75">Approver · Review employee travel requests</div>
            {s?.pendingApprovals > 0 && (
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
          <StatCard label="Pending Approvals" value={s?.pendingApprovals ?? 0} icon={<Clock size={20} />} accent="warning" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Approved Today" value={s?.approvedToday ?? 0} icon={<CheckCircle2 size={20} />} accent="success" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Rejected Today" value={s?.rejectedToday ?? 0} icon={<XCircle size={20} />} accent="danger" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard label="Total Requests" value={s?.totalRequests ?? 0} icon={<Briefcase size={20} />} accent="primary" />
        </div>
      </div>

      {/* Search & filter */}
      <RequestFilters
        filters={filters}
        onChange={(patch) => setFilters({ ...filters, ...patch })}
        onApply={() => load(filters)}
        onClear={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); }}
        statusOptions={STATUSES}
      />

      {/* Requests table */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">Travel Requests</h5>
          <span className="text-muted small">{requests.length} request(s)</span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Destination</th>
                <th>Type</th>
                <th>Travel Date</th>
                <th className="text-end">Amount</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={9} className="text-center py-4 text-muted">No requests match the filters.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/manager/approval/${r._id}`)}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.employeeName}
                    <div className="small text-muted">{r.employeeDesignation}</div>
                  </td>
                  <td>{formatRoute(r)}</td>
                  <td><span className="badge text-bg-light border">{travelTypeLabel(r.travelType)}</span></td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td className="text-end text-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/manager/approval/${r._id}`} className="btn btn-sm btn-outline-secondary"><Eye size={14} /></Link>{' '}
                    {r.status === 'PENDING' && (
                      <>
                        <button className="btn btn-sm btn-success" disabled={!!acting} onClick={() => setDecision({ action: 'approve', request: r })}>
                          <Check size={14} /> Approve
                        </button>{' '}
                        <button className="btn btn-sm btn-outline-danger" disabled={!!acting} onClick={() => setDecision({ action: 'reject', request: r })}>
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}
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
              {!data?.history?.length && (
                <tr><td colSpan={6} className="text-center py-4 text-muted">No approvals decided yet.</td></tr>
              )}
              {(data?.history || []).map((h) => (
                <tr key={h._id}>
                  <td className="fw-semibold">{h.travelRequestId?.requestId || '—'}</td>
                  <td>{h.travelRequestId?.employeeName || '—'}</td>
                  <td>{h.travelRequestId ? formatRoute(h.travelRequestId) : '—'}</td>
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

      {/* Decision modal */}
      <DecisionModal
        show={!!decision}
        action={decision?.action}
        title={decision?.action === 'approve' ? `Approve ${decision?.request?.requestId}` : `Reject ${decision?.request?.requestId}`}
        subtitle={decision?.request ? `${decision.request.employeeName} · ${formatRoute(decision.request)} · ${inr(decision.request.totalAmount)}` : ''}
        commentRequired={decision?.action === 'reject'}
        submitting={!!acting}
        onClose={() => setDecision(null)}
        onSubmit={decide}
      />
    </div>
  );
}
