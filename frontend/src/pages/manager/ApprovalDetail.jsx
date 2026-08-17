import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, Hotel, Check, X, ShieldCheck, User, MessageSquare, History } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, formatDateTime, time12, getErrorMessage, travelTypeLabel } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import DecisionModal from '../../components/DecisionModal';

const ROLE_LABEL = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

export default function ApprovalDetail() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(`/approvals/${id}`);
        setRequest(res.data.travelRequest);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Could not load the request.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const decide = async (comment) => {
    const action = decision.action;
    setActing(action);
    try {
      await client.post(`/approvals/${id}/${action}`, comment ? { reason: comment } : {});
      toast.success(action === 'approve' ? 'Request approved. It now moves to the final booking queue.' : 'Request rejected.');
      navigate('/manager/approvals');
    } catch (err) {
      toast.error(getErrorMessage(err, `${action === 'approve' ? 'Approval' : 'Rejection'} failed.`));
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

  const isHotelOnly = request.travelType === 'hotel';
  const isFlightOnly = request.travelType === 'flight';
  const hasFlight = !isHotelOnly;
  const hasHotel = !isFlightOnly;

  return (
    <div>
      <Link to="/manager/approvals" className="small text-decoration-none text-secondary mb-3 d-inline-flex align-items-center gap-1">
        <ArrowLeft size={14} /> Back to approvals
      </Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h4 className="fw-bold mb-0">Request {request.requestId}</h4>
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-light border">{travelTypeLabel(request.travelType)}</span>
          <StatusBadge status={request.status} />
        </div>
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
              <div className="small text-muted">{request.employeeDesignation}{request.employeeDepartment ? ` · ${request.employeeDepartment}` : ''}</div>
            </div>
          </div>

          {/* Employee comment */}
          {request.employeeComment && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <MessageSquare size={18} className="text-primary" /> Business Purpose / Employee Comment
              </div>
              <div className="card-body">
                <div className="alert alert-light border mb-0">{request.employeeComment}</div>
              </div>
            </div>
          )}

          {/* Flight */}
          {hasFlight && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <Plane size={18} className="text-primary" /> Flight
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between">
                  <div>
                    <div className="fw-semibold">{request.flightSnapshot?.airline} {request.flightSnapshot?.flightNumber}</div>
                    <div className="small text-muted">
                      {request.flightSnapshot?.from || request.from} → {request.flightSnapshot?.to || request.to} · {formatDate(request.travelDate)}
                    </div>
                  </div>
                  <div>
                    <span className="badge text-bg-light border me-2">{request.flightSnapshot?.travelClass}</span>
                    <span>{time12(request.flightSnapshot?.departureTime)} – {time12(request.flightSnapshot?.arrivalTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hotel */}
          {hasHotel && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <Hotel size={18} className="text-primary" /> Hotel
              </div>
              <div className="card-body">
                <div className="fw-semibold">{request.hotelSnapshot?.name}</div>
                <div className="small text-muted">
                  {request.hotelSnapshot?.city} · {'★'.repeat(request.hotelSnapshot?.starRating || 0)} · {request.hotelSnapshot?.roomType} · {request.nights} night(s)
                  <div>{formatDate(request.travelDate)} → {formatDate(request.returnDate)}</div>
                </div>
              </div>
            </div>
          )}

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

          {/* Comment history */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <History size={18} className="text-primary" /> Approval History & Comments
            </div>
            <div className="card-body">
              {(!request.comments || request.comments.length === 0) && (
                <div className="text-muted small">No comments yet.</div>
              )}
              {(request.comments || []).map((c, i) => (
                <div key={i} className="d-flex gap-3 mb-3">
                  <span
                    className={`rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 fw-semibold ${
                      c.role === 'employee' ? 'bg-primary' : c.role === 'manager' ? 'bg-success' : 'bg-dark'
                    }`}
                    style={{ width: 36, height: 36, fontSize: '0.8rem' }}
                  >
                    {(ROLE_LABEL[c.role] || c.role || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <div className="fw-semibold small">{ROLE_LABEL[c.role] || c.role}</div>
                      <div className="small text-muted">{formatDateTime(c.createdAt)}</div>
                    </div>
                    {c.action && (
                      <div className="small">
                        <span className={`badge ${c.action === 'approved' || c.action === 'booked' || c.action === 'submitted' ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {c.action}
                        </span>
                      </div>
                    )}
                    <div className="small mt-1">{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost + actions */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm sticky-top" style={{ top: 16 }}>
            <div className="card-header bg-white fw-semibold">Cost Summary</div>
            <div className="card-body">
              {hasFlight && (
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Flight</span>
                  <span className="fw-semibold">{inr(request.flightCost)}</span>
                </div>
              )}
              {hasHotel && (
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted">Hotel</span>
                  <span className="fw-semibold">{inr(request.hotelCost)}</span>
                </div>
              )}
              <hr />
              <div className="d-flex justify-content-between fs-5">
                <span className="fw-semibold">Total</span>
                <span className="fw-bold text-primary">{inr(request.totalAmount)}</span>
              </div>
              <div className="small text-muted mt-1">
                {request.passengers} passenger(s) · {request.rooms} room(s) · {request.nights} night(s)
              </div>

              {request.status === 'PENDING' ? (
                <div className="d-grid gap-2 mt-3">
                  <button className="btn btn-success d-flex align-items-center justify-content-center gap-2" disabled={!!acting} onClick={() => setDecision({ action: 'approve' })}>
                    {acting === 'approve' ? <span className="spinner-border spinner-border-sm" /> : <Check size={18} />} Approve Request
                  </button>
                  <button className="btn btn-outline-danger d-flex align-items-center justify-content-center gap-2" disabled={!!acting} onClick={() => setDecision({ action: 'reject' })}>
                    <X size={18} /> Reject Request
                  </button>
                </div>
              ) : request.status === 'REJECTED' ? (
                <div className="alert alert-danger mt-3 mb-0">
                  <div className="fw-semibold">Rejected</div>
                  <div className="small mt-1">{request.managerComment || request.adminComment || 'No comment provided.'}</div>
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

      {/* Decision modal */}
      <DecisionModal
        show={!!decision}
        action={decision?.action}
        title={decision?.action === 'approve' ? `Approve ${request.requestId}` : `Reject ${request.requestId}`}
        subtitle={`${request.employeeName} · ${request.requestId}`}
        commentRequired={decision?.action === 'reject'}
        submitting={!!acting}
        onClose={() => setDecision(null)}
        onSubmit={decide}
      />
    </div>
  );
}
