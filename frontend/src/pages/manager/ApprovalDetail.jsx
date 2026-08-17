import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, Hotel, Check, X, ShieldCheck, User } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, time12, getErrorMessage } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';

export default function ApprovalDetail() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(`/approvals/${id}`);
        setRequest(res.data.travelRequest);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const approve = async () => {
    setActing('approve');
    try {
      await client.post(`/approvals/${id}/approve`);
      toast.success('Request approved. It now moves to the final booking queue.');
      navigate('/manager/approvals');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Approval failed.'));
    } finally {
      setActing('');
    }
  };

  const reject = async () => {
    if (!reason.trim()) {
      toast.warning('Please enter a rejection reason.');
      return;
    }
    setActing('reject');
    try {
      await client.post(`/approvals/${id}/reject`, { reason: reason.trim() });
      toast.success('Request rejected.');
      navigate('/manager/approvals');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Rejection failed.'));
    } finally {
      setActing('');
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }
  if (!request) {
    return <div className="alert alert-warning">Request not found.</div>;
  }

  return (
    <div>
      <Link to="/manager/approvals" className="small text-decoration-none text-secondary mb-3 d-inline-flex align-items-center gap-1">
        <ArrowLeft size={14} /> Back to approvals
      </Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h4 className="fw-bold mb-0">Request {request.requestId}</h4>
        <StatusBadge status={request.status} />
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          {/* Employee */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <User size={18} className="text-primary" /> Employee
            </div>
            <div className="card-body">
              <div className="fw-semibold">{request.employeeName}</div>
              <div className="small text-muted">{request.employeeDesignation}</div>
            </div>
          </div>

          {/* Flight */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Plane size={18} className="text-primary" /> Flight
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between">
                <div>
                  <div className="fw-semibold">{request.flightSnapshot?.airline} {request.flightSnapshot?.flightNumber}</div>
                  <div className="small text-muted">
                    {request.from} → {request.to} · {formatDate(request.travelDate)}
                  </div>
                </div>
                <div>
                  <span className="badge text-bg-light border me-2">{request.flightSnapshot?.travelClass}</span>
                  <span>{time12(request.flightSnapshot?.departureTime)} – {time12(request.flightSnapshot?.arrivalTime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hotel */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Hotel size={18} className="text-primary" /> Hotel
            </div>
            <div className="card-body">
              <div className="fw-semibold">{request.hotelSnapshot?.name}</div>
              <div className="small text-muted">
                {request.hotelSnapshot?.city} · {'★'.repeat(request.hotelSnapshot?.starRating || 0)} · {request.hotelSnapshot?.roomType} · {request.nights} night(s)
              </div>
            </div>
          </div>

          {/* Policy */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Policy Validation Result
            </div>
            <div className="card-body">
              <div className="alert alert-success mb-2 d-flex align-items-center gap-2">
                <Check size={18} /> {request.policyMessage || 'Complies with company travel policy.'}
              </div>
              {request.policyDetails && (
                <div className="small text-muted">
                  Policy band: <span className="fw-semibold">{request.policyDetails.designation}</span> · Allowed classes:{' '}
                  <span className="fw-semibold">{(request.policyDetails.allowedFlightClasses || []).join(', ')}</span> · Max hotel:{' '}
                  <span className="fw-semibold">{request.policyDetails.maximumHotelStars}-star</span> · Flight budget:{' '}
                  <span className="fw-semibold">{inr(request.policyDetails.flightBudget)}</span> · Hotel budget:{' '}
                  <span className="fw-semibold">{inr(request.policyDetails.hotelBudgetPerNight)}/night</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost + actions */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm sticky-top" style={{ top: 16 }}>
            <div className="card-header bg-white fw-semibold">Cost Summary</div>
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Flight</span>
                <span className="fw-semibold">{inr(request.flightCost)}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Hotel</span>
                <span className="fw-semibold">{inr(request.hotelCost)}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between fs-5">
                <span className="fw-semibold">Total</span>
                <span className="fw-bold text-primary">{inr(request.totalAmount)}</span>
              </div>
              <div className="small text-muted mt-1">{request.passengers} passenger(s) · {request.rooms} room(s) · {request.nights} night(s)</div>

              {request.status === 'PENDING' ? (
                <div className="d-grid gap-2 mt-3">
                  <button className="btn btn-success d-flex align-items-center justify-content-center gap-2" disabled={!!acting} onClick={approve}>
                    {acting === 'approve' ? <span className="spinner-border spinner-border-sm" /> : <Check size={18} />} Approve Request
                  </button>
                  <button className="btn btn-outline-danger d-flex align-items-center justify-content-center gap-2" disabled={!!acting} onClick={() => setShowReject(true)}>
                    <X size={18} /> Reject Request
                  </button>
                </div>
              ) : (
                <div className="alert alert-secondary mt-3 mb-0">
                  This request is no longer pending ({request.status}). It cannot be approved or rejected anymore.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      <div className={`modal fade ${showReject ? 'show' : ''}`} style={{ display: showReject ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Reject {request.requestId}</h5>
              <button type="button" className="btn-close" onClick={() => setShowReject(false)} />
            </div>
            <div className="modal-body">
              <label className="form-label fw-semibold">Rejection reason <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Travel dates are not approved for the requested business activity."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="form-text">The employee will be notified with this reason.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn btn-danger" disabled={acting === 'reject'} onClick={reject}>
                {acting === 'reject' ? <span className="spinner-border spinner-border-sm" /> : <X size={16} />} Confirm rejection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
