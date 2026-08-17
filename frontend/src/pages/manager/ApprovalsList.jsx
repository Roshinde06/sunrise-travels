import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Check, X } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, getErrorMessage, formatRoute, travelTypeLabel } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import RequestFilters from '../../components/RequestFilters';
import DecisionModal from '../../components/DecisionModal';

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'TICKETED', 'CANCELLED'];
const EMPTY_FILTERS = { search: '', status: 'ALL', travelType: 'ALL', dateFrom: '', dateTo: '' };

export default function ApprovalsList() {
  const toast = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [decision, setDecision] = useState(null);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (nextFilters.search) params.search = nextFilters.search;
      if (nextFilters.status && nextFilters.status !== 'ALL') params.status = nextFilters.status;
      if (nextFilters.travelType && nextFilters.travelType !== 'ALL') params.travelType = nextFilters.travelType;
      if (nextFilters.dateFrom) params.dateFrom = nextFilters.dateFrom;
      if (nextFilters.dateTo) params.dateTo = nextFilters.dateTo;
      const res = await client.get('/travel-requests', { params });
      setRequests(res.data.requests || []);
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">Travel Requests — Review</h4>
        <span className="text-muted small">{requests.length} request(s)</span>
      </div>

      <RequestFilters
        filters={filters}
        onChange={(patch) => setFilters({ ...filters, ...patch })}
        onApply={() => load(filters)}
        onClear={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); }}
        statusOptions={STATUSES}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Destination</th>
                <th>Type</th>
                <th>Travel Date</th>
                <th className="text-end">Amount</th>
                <th>Policy Status</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={11} className="text-center py-4 text-muted">No requests match the filters.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/manager/approval/${r._id}`)}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>{r.employeeName}</td>
                  <td className="small text-muted">{r.employeeDesignation}</td>
                  <td>{formatRoute(r)}</td>
                  <td><span className="badge text-bg-light border">{travelTypeLabel(r.travelType)}</span></td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><span className="badge text-bg-success">Passed</span></td>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td><StatusBadge status={r.status} /></td>
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
