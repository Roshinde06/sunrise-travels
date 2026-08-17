import { useEffect, useState } from 'react';
import { Plane, Ticket, RotateCcw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, getErrorMessage, formatRoute, travelTypeLabel } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import DecisionModal from '../../components/DecisionModal';
import SuccessAnimation from '../../components/SuccessAnimation';

export default function AdminTicketing() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmComment, setConfirmComment] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/ticketing/pending');
      setRequests(res.data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const confirmBooking = async () => {
    setActing(confirmTarget._id);
    try {
      const res = await client.post(`/bookings/${confirmTarget._id}/confirm`, { comment: confirmComment });
      setResult({ ok: true, message: res.data.message, pnr: res.data.booking?.pnr });
      toast.success(`Booking confirmed — PNR ${res.data.booking?.pnr}`);
      setConfirmTarget(null);
      setConfirmComment('');
      load();
    } catch (err) {
      const msg = getErrorMessage(err, 'Final booking failed.');
      setResult({ ok: false, message: msg });
      toast.error(msg);
      load();
    } finally {
      setActing('');
    }
  };

  const rejectRequest = async (comment) => {
    setActing(`reject-${rejectTarget._id}`);
    try {
      await client.post(`/admin/requests/${rejectTarget._id}/reject`, { comment });
      toast.success('Request rejected. The employee has been notified.');
      setRejectTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Rejection failed.'));
    } finally {
      setActing('');
    }
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Final Booking / Ticketing</h4>
      <p className="text-muted small mb-4">
        Approved requests below are waiting for the final booking. Confirming runs the simulated booking service — it may
        fail occasionally (like a real provider outage); failed requests stay <em>Approved</em> and can be retried. You can
        also reject an approved request with a comment — the comment is required.
      </p>

      <div className="card border-0 shadow-sm mb-4">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Destination</th>
                <th>Type</th>
                <th>Travel Date</th>
                <th className="text-end">Total</th>
                <th>Status</th>
                <th>Attempts</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={9} className="text-center py-4 text-muted">No approved requests waiting for ticketing.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>{r.employeeName}</td>
                  <td>{formatRoute(r)}</td>
                  <td><span className="badge text-bg-light border">{travelTypeLabel(r.travelType)}</span></td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    {r.failedBookingAttempts > 0 ? (
                      <span className="badge text-bg-warning">{r.failedBookingAttempts} failed</span>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-primary" disabled={!!acting} onClick={() => setConfirmTarget(r)}>
                      <Ticket size={14} /> Confirm Final Booking
                    </button>{' '}
                    <button className="btn btn-sm btn-outline-danger" disabled={!!acting} onClick={() => setRejectTarget(r)}>
                      <X size={14} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm modal */}
      <div className={`modal fade ${confirmTarget ? 'show' : ''}`} style={{ display: confirmTarget ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Confirm final booking</h5>
              <button type="button" className="btn-close" onClick={() => setConfirmTarget(null)} />
            </div>
            <div className="modal-body">
              {confirmTarget && (
                <div>
                  <p className="small text-muted">
                    This will call the mock airline/hotel booking service for{' '}
                    <span className="fw-semibold">{confirmTarget.requestId}</span> ({confirmTarget.employeeName},{' '}
                    {formatRoute(confirmTarget)}, {inr(confirmTarget.totalAmount)}). A PNR will be generated and the request will be marked{' '}
                    <span className="fw-semibold">Ticketed</span> on success.
                  </p>
                  {confirmTarget.failedBookingAttempts > 0 && confirmTarget.bookingFailureMessage && (
                    <div className="alert alert-warning small mb-2 d-flex align-items-start gap-2">
                      <AlertTriangle size={16} className="mt-1 flex-shrink-0" />
                      <div>
                        Previous attempt failed: <em>{confirmTarget.bookingFailureMessage}</em>
                        <div className="mt-1 d-inline-flex align-items-center gap-1"><RotateCcw size={13} /> Retrying is allowed — the request is still Approved.</div>
                      </div>
                    </div>
                  )}
                  <label className="form-label fw-semibold mt-1">Admin comment (optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Booking approved and payment processed."
                    value={confirmComment}
                    onChange={(e) => setConfirmComment(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!!acting} onClick={confirmBooking}>
                {acting === confirmTarget?._id ? <span className="spinner-border spinner-border-sm" /> : <Plane size={16} />} Confirm Booking
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal (comment required) */}
      <DecisionModal
        show={!!rejectTarget}
        action="reject"
        title={rejectTarget ? `Reject ${rejectTarget.requestId}` : 'Reject'}
        subtitle={rejectTarget ? `${rejectTarget.employeeName} · ${formatRoute(rejectTarget)} · ${inr(rejectTarget.totalAmount)}` : ''}
        commentRequired
        submitting={!!acting}
        onClose={() => setRejectTarget(null)}
        onSubmit={rejectRequest}
      />

      {/* Result toast area */}
      {result && (
        <div className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} d-flex align-items-start gap-3 mt-3 anim-fade-in`}>
          {result.ok ? <SuccessAnimation size={44} /> : <AlertTriangle size={18} className="mt-1" />}
          <div>
            <div className="fw-semibold">{result.ok ? 'Booking Confirmed' : 'Final booking failed'}</div>
            <div className="small">{result.message}</div>
            {!result.ok && (
              <div className="small mt-1">The request remains <strong>Approved</strong> and can be retried by the Travel Administrator.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
