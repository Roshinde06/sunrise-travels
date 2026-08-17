import { useEffect, useState } from 'react';
import { Plane, Ticket, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, getErrorMessage } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';

export default function AdminTicketing() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
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
      const res = await client.post(`/bookings/${confirmTarget._id}/confirm`);
      setResult({ ok: true, message: res.data.message, pnr: res.data.booking?.pnr });
      toast.success(`Booking confirmed — PNR ${res.data.booking?.pnr}`);
      setConfirmTarget(null);
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

  return (
    <div>
      <h4 className="fw-bold mb-3">Final Booking / Ticketing</h4>
      <p className="text-muted small mb-4">
        Approved requests below are waiting for the final booking. Confirming runs the simulated booking service — it may
        fail occasionally (like a real provider outage); failed requests stay <em>Approved</em> and can be retried.
      </p>

      <div className="card border-0 shadow-sm mb-4">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Route</th>
                <th>Travel Date</th>
                <th className="text-end">Total</th>
                <th>Status</th>
                <th>Attempts</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={8} className="text-center py-4 text-muted">No approved requests waiting for ticketing.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>{r.employeeName}</td>
                  <td>{r.from} → {r.to}</td>
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
                  <td className="text-end">
                    <button className="btn btn-sm btn-primary" disabled={!!acting} onClick={() => setConfirmTarget(r)}>
                      <Ticket size={14} /> Confirm Final Booking
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
                    <span className="fw-semibold">{confirmTarget.requestId}</span> ({confirmTarget.employeeName}, {confirmTarget.from} →{' '}
                    {confirmTarget.to}, {inr(confirmTarget.totalAmount)}). A PNR will be generated and the request will be marked{' '}
                    <span className="fw-semibold">Ticketed</span> on success.
                  </p>
                  {confirmTarget.failedBookingAttempts > 0 && confirmTarget.bookingFailureMessage && (
                    <div className="alert alert-warning small mb-0 d-flex align-items-start gap-2">
                      <AlertTriangle size={16} className="mt-1 flex-shrink-0" />
                      <div>
                        Previous attempt failed: <em>{confirmTarget.bookingFailureMessage}</em>
                        <div className="mt-1 d-inline-flex align-items-center gap-1"><RotateCcw size={13} /> Retrying is allowed — the request is still Approved.</div>
                      </div>
                    </div>
                  )}
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

      {/* Result toast area */}
      {result && (
        <div className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} d-flex align-items-start gap-2 mt-3`}>
          {result.ok ? <CheckCircle2 size={18} className="mt-1" /> : <AlertTriangle size={18} className="mt-1" />}
          <div>
            <div className="fw-semibold">{result.ok ? 'Booking successful' : 'Final booking failed'}</div>
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
