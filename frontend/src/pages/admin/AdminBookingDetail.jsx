import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plane, Hotel, User, ShieldCheck, History, Ticket, FileText, Download, Eye, X } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, formatDateTime, time12, getErrorMessage, travelTypeLabel, bookingStatusBadge, paymentStatusBadge } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import InvoiceView from '../../components/InvoiceView';

const ROLE_LABEL = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

export default function AdminBookingDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [request, setRequest] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(`/travel-requests/${id}`);
        const req = res.data.travelRequest;
        setRequest(req);
        if (req.status === 'TICKETED') {
          try {
            const inv = await client.get(`/invoices/${id}`);
            setInvoice(inv.data.invoice);
            setBooking(inv.data.booking);
          } catch (err) {
            toast.error(getErrorMessage(err, 'Could not load the invoice.'));
          }
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Could not load the booking.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const downloadInvoice = async () => {
    setDownloading(true);
    try {
      const res = await client.get(`/invoices/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Invoice downloaded.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invoice download failed.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }
  if (!request) {
    return <div className="alert alert-warning">Booking not found.</div>;
  }

  const hasFlight = request.travelType !== 'hotel';
  const hasHotel = request.travelType !== 'flight';
  const ticket = request.ticketDetails || {};

  return (
    <div>
      <Link to="/admin/bookings" className="small text-decoration-none text-secondary mb-3 d-inline-flex align-items-center gap-1">
        <ArrowLeft size={14} /> Back to bookings
      </Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h4 className="fw-bold mb-0">Booking {request.requestId}</h4>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="badge text-bg-light border">{travelTypeLabel(request.travelType)}</span>
          <span className={bookingStatusBadge(request.bookingStatus).className}>{bookingStatusBadge(request.bookingStatus).label}</span>
          <span className={paymentStatusBadge(request.paymentStatus).className}>{paymentStatusBadge(request.paymentStatus).label}</span>
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          {/* Employee */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <User size={18} className="text-primary" /> Employee Details
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-md-4"><div className="small text-muted">Name</div><div className="fw-semibold">{request.employeeName}</div></div>
                <div className="col-md-4"><div className="small text-muted">Designation</div><div>{request.employeeDesignation || '—'}</div></div>
                <div className="col-md-4"><div className="small text-muted">Department</div><div>{request.employeeDepartment || '—'}</div></div>
              </div>
            </div>
          </div>

          {/* Employee comment */}
          {request.employeeComment && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold">Business Purpose / Employee Comment</div>
              <div className="card-body"><div className="alert alert-light border mb-0">{request.employeeComment}</div></div>
            </div>
          )}

          {/* Flight */}
          {hasFlight && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <Plane size={18} className="text-primary" /> Flight Details
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{request.flightSnapshot?.airline} {request.flightSnapshot?.flightNumber}</div>
                    <div className="small text-muted">
                      {request.flightSnapshot?.from || request.from} → {request.flightSnapshot?.to || request.to} · {formatDate(request.travelDate)}
                    </div>
                    <div className="small text-muted">{request.passengers} passenger(s) · {time12(request.flightSnapshot?.departureTime)} – {time12(request.flightSnapshot?.arrivalTime)}</div>
                  </div>
                  <div className="text-end">
                    <span className="badge text-bg-light border">{request.flightSnapshot?.travelClass}</span>
                    <div className="fw-semibold mt-1">{inr(request.flightCost)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hotel */}
          {hasHotel && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <Hotel size={18} className="text-primary" /> Hotel Details
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="fw-semibold">{request.hotelSnapshot?.name}</div>
                    <div className="small text-muted">
                      {request.hotelSnapshot?.city} · {'★'.repeat(request.hotelSnapshot?.starRating || 0)} · {request.hotelSnapshot?.roomType}
                    </div>
                    <div className="small text-muted">
                      Check-in {formatDate(request.travelDate)} → Check-out {formatDate(request.returnDate)} · {request.rooms} room(s) × {request.nights} night(s)
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-semibold">{inr(request.hotelCost)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking + ticket */}
          {request.status === 'TICKETED' && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <Ticket size={18} className="text-primary" /> Booking Details
              </div>
              <div className="card-body">
                <div className="row g-2">
                  <div className="col-md-3"><div className="small text-muted">Booking ID</div><div className="fw-semibold">{booking?.bookingReference || ticket.bookingReference || '—'}</div></div>
                  <div className="col-md-3"><div className="small text-muted">PNR / Ticket No</div><div className="fw-semibold">{booking?.pnr || ticket.ticketNumber || '—'}</div></div>
                  <div className="col-md-3"><div className="small text-muted">Seat</div><div>{booking?.seat || ticket.seat || '—'}</div></div>
                  <div className="col-md-3"><div className="small text-muted">Total Fare</div><div className="fw-semibold">{inr(booking?.totalAmount ?? request.totalAmount)}</div></div>
                </div>
                {booking?.ticketedAt && <div className="small text-muted mt-2">Confirmed on {formatDateTime(booking.ticketedAt)}</div>}
              </div>
            </div>
          )}

          {/* Policy */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <ShieldCheck size={18} className="text-primary" /> Policy Check
            </div>
            <div className="card-body">
              <div className="alert alert-success mb-0 d-flex align-items-center gap-2">
                <ShieldCheck size={18} /> {request.policyMessage || 'Complies with company travel policy.'}
              </div>
            </div>
          </div>

          {/* Comment history */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <History size={18} className="text-primary" /> Approval History & Comments
            </div>
            <div className="card-body">
              {(!request.comments || request.comments.length === 0) && <div className="text-muted small">No comments yet.</div>}
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
                      <span className={`badge ${c.action === 'approved' || c.action === 'booked' || c.action === 'submitted' ? 'text-bg-success' : 'text-bg-danger'}`}>{c.action}</span>
                    )}
                    <div className="small mt-1">{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost + invoice actions */}
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
              <div className="small text-muted mt-1">{request.passengers} passenger(s) · {request.rooms} room(s) · {request.nights} night(s)</div>

              {request.status === 'TICKETED' && (
                <div className="mt-3">
                  <div className="alert alert-success small mb-2 d-flex align-items-center gap-2">
                    <FileText size={15} /> Invoice generated — {invoice?.invoiceNumber || '—'}
                  </div>
                  <div className="d-grid gap-2">
                    <button className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2" onClick={() => setShowInvoice(true)}>
                      <Eye size={16} /> View Invoice
                    </button>
                    <button className="btn btn-primary d-flex align-items-center justify-content-center gap-2" disabled={downloading} onClick={downloadInvoice}>
                      {downloading ? <span className="spinner-border spinner-border-sm" /> : <Download size={16} />} Download Invoice
                    </button>
                  </div>
                </div>
              )}

              {request.status === 'TICKETED' && (
                <Link to={`/employee/ticket/${request._id}`} className="btn btn-outline-secondary w-100 mt-2 d-flex align-items-center justify-content-center gap-2">
                  <Ticket size={16} /> View Final Ticket
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice modal */}
      <div className={`modal fade ${showInvoice ? 'show' : ''}`} style={{ display: showInvoice ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Trip Invoice — {invoice?.invoiceNumber}</h5>
              <button type="button" className="btn-close" onClick={() => setShowInvoice(false)} />
            </div>
            <div className="modal-body">
              {invoice ? <InvoiceView invoice={invoice} /> : <div className="text-muted small">Invoice not available.</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowInvoice(false)}><X size={16} className="me-1" />Close</button>
              <button className="btn btn-primary" disabled={downloading} onClick={downloadInvoice}>
                {downloading ? <span className="spinner-border spinner-border-sm" /> : <Download size={16} className="me-1" />} Download Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
