import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Ban, Eye, Clock, CheckCircle2, XCircle, Plane, Hotel, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, time12 } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import PolicyResult from '../../components/PolicyResult';
import { getErrorMessage } from '../../utils/format';

export default function MyTrips() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/travel-requests');
      setRequests(res.data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const count = (status) => requests.filter((r) => r.status === status).length;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await client.post(`/bookings/${cancelTarget._id}/cancel`, { reason: cancelReason });
      toast.success(`Booking ${cancelTarget.requestId} cancelled.`);
      setCancelTarget(null);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Cancellation failed.'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">My Trips</h4>

      {/* Status summary */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {[
          { label: 'Pending', value: count('PENDING'), color: 'text-bg-warning' },
          { label: 'Approved', value: count('APPROVED'), color: 'text-bg-primary' },
          { label: 'Ticketed', value: count('TICKETED'), color: 'text-bg-success' },
          { label: 'Rejected', value: count('REJECTED'), color: 'text-bg-danger' },
          { label: 'Cancelled', value: count('CANCELLED'), color: 'text-bg-dark' },
        ].map((s) => (
          <span key={s.label} className={`badge ${s.color} px-3 py-2 fs-6`}>
            {s.label}: {s.value}
          </span>
        ))}
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Destination</th>
                <th>Travel Date</th>
                <th className="text-end">Total</th>
                <th>Policy</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-4 text-muted">Loading…</td></tr>
              )}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No trips yet. <Link to="/employee/flights" className="fw-semibold">Plan your first trip →</Link>
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.from} → {r.to}
                    <div className="small text-muted">{r.flightSnapshot?.flightNumber} · {r.hotelSnapshot?.name}</div>
                  </td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td>
                    {r.policyStatus === 'passed' ? (
                      <span className="badge text-bg-success">Passed</span>
                    ) : (
                      <span className="badge text-bg-danger">{r.policyStatus}</span>
                    )}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setDetail(r)}>
                      <Eye size={14} /> Details
                    </button>{' '}
                    {r.status === 'TICKETED' && (
                      <>
                        <Link to={`/employee/ticket/${r._id}`} className="btn btn-sm btn-primary">
                          <Ticket size={14} /> Ticket
                        </Link>{' '}
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setCancelTarget(r)}>
                          <Ban size={14} /> Cancel
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

      {/* Detail modal */}
      <div className={`modal fade ${detail ? 'show' : ''}`} style={{ display: detail ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Request {detail?.requestId}</h5>
              <button type="button" className="btn-close" onClick={() => setDetail(null)} />
            </div>
            {detail && (
              <div className="modal-body">
                <div className="d-flex gap-2 mb-3">
                  <StatusBadge status={detail.status} />
                  {detail.policyStatus === 'passed' && <span className="badge text-bg-success">Policy Passed</span>}
                </div>

                <div className="card mb-3">
                  <div className="card-body d-flex align-items-center gap-3">
                    <Plane className="text-primary flex-shrink-0" size={20} />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{detail.flightSnapshot?.airline} {detail.flightSnapshot?.flightNumber} · {detail.flightSnapshot?.travelClass}</div>
                      <div className="small text-muted">
                        {detail.from} → {detail.to} · {formatDate(detail.travelDate)} · {time12(detail.flightSnapshot?.departureTime)} – {time12(detail.flightSnapshot?.arrivalTime)}
                      </div>
                    </div>
                    <div className="fw-semibold">{inr(detail.flightCost)}</div>
                  </div>
                </div>

                <div className="card mb-3">
                  <div className="card-body d-flex align-items-center gap-3">
                    <Hotel className="text-primary flex-shrink-0" size={20} />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{detail.hotelSnapshot?.name}</div>
                      <div className="small text-muted">
                        {detail.hotelSnapshot?.city} · {'★'.repeat(detail.hotelSnapshot?.starRating || 0)} · {detail.hotelSnapshot?.roomType} · {detail.nights} night(s)
                      </div>
                    </div>
                    <div className="fw-semibold">{inr(detail.hotelCost)}</div>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-semibold">Total Amount</span>
                  <span className="fw-bold fs-5 text-primary">{inr(detail.totalAmount)}</span>
                </div>

                {detail.policyDetails && Object.keys(detail.policyDetails).length > 0 && (
                  <div className="card mb-3">
                    <div className="card-header bg-white d-flex align-items-center gap-2 fw-semibold">
                      <ShieldCheck size={16} className="text-primary" /> Policy Check
                    </div>
                    <div className="card-body">
                      <PolicyResult result={{ passed: detail.policyStatus === 'passed', reasons: [], details: detail.policyDetails }} compact />
                    </div>
                  </div>
                )}

                {detail.status === 'REJECTED' && (
                  <div className="alert alert-danger mb-0">
                    <div className="fw-semibold d-flex align-items-center gap-2"><XCircle size={16} /> Travel Request Rejected</div>
                    <div className="small mt-1">
                      This request was rejected by the approver. Please contact your manager for details or submit a new compliant request.
                    </div>
                  </div>
                )}
                {detail.status === 'APPROVED' && (
                  <div className="alert alert-primary mb-0 d-flex align-items-center gap-2">
                    <CheckCircle2 size={16} /> Approved — waiting for final ticket booking by the Travel Administrator.
                  </div>
                )}
                {detail.status === 'PENDING' && (
                  <div className="alert alert-warning mb-0 d-flex align-items-center gap-2">
                    <Clock size={16} /> Waiting for Manager Approval.
                  </div>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      <div className={`modal fade ${cancelTarget ? 'show' : ''}`} style={{ display: cancelTarget ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Cancel booking {cancelTarget?.requestId}</h5>
              <button type="button" className="btn-close" onClick={() => setCancelTarget(null)} />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                Cancelling this ticketed booking will release the inventory. This action cannot be undone.
              </p>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Reason for cancellation (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelTarget(null)}>Keep booking</button>
              <button className="btn btn-danger" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? <span className="spinner-border spinner-border-sm" /> : <Ban size={16} />} Confirm cancellation
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
