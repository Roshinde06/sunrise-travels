import { useState } from 'react';
import { Plane, Hotel, CheckCircle2, XCircle, AlertTriangle, Ticket, FileText, Star, MapPin, ShieldCheck, Send } from 'lucide-react';
import { inr, formatDate, time12, travelTypeLabel } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import InvoiceView from '../../components/InvoiceView';
import HotelImage from '../../components/HotelImage';
import SuccessAnimation from '../../components/SuccessAnimation';

const roleFor = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

/* ---------- shared bits ---------- */
function ActionButton({ action, onAction, disabled }) {
  if (action.link) {
    return (
      <a href={action.link} className={`btn btn-sm ${action.variant === 'primary' ? 'btn-primary' : action.variant === 'success' ? 'btn-success' : action.variant === 'danger' ? 'btn-danger' : 'btn-outline-secondary'}`}>
        {action.label}
      </a>
    );
  }
  if (action.type === 'download_invoice') {
    return (
      <button className="btn btn-sm btn-primary" onClick={() => onAction && onAction('download_invoice', action.requestId)}>
        <FileText size={13} className="me-1" />{action.label}
      </button>
    );
  }
  return (
    <button className={`btn btn-sm ${action.variant === 'primary' ? 'btn-primary' : action.variant === 'success' ? 'btn-success' : action.variant === 'danger' ? 'btn-danger' : 'btn-outline-secondary'}`} disabled={disabled} onClick={() => onAction && onAction(action.command)}>
      {action.label}
    </button>
  );
}

function ActionRow({ actions, onAction, needsCommentValue }) {
  if (!actions || !actions.length) return null;
  return (
    <div className="d-flex flex-wrap gap-2 mt-3">
      {actions.map((a, i) => (
        <ActionButton key={i} action={a} onAction={onAction} disabled={a.needsComment && !needsCommentValue} />
      ))}
    </div>
  );
}

/* ---------- view renderers ---------- */
function FlightsView({ view, onAction }) {
  return (
    <div>
      {view.analysis && <PriceAnalysisView view={view.analysis} compact />}
      {view.flights.map((f) => (
        <div key={f.id} className="border rounded-3 p-2 mb-2 bg-white">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="fw-semibold small" style={{ minWidth: 130 }}>{f.airline} <span className="text-muted">{f.flightNumber}</span></div>
            <div className="flex-grow-1 text-center small">
              <strong>{f.from}</strong> {time12(f.departureTime)} → <strong>{f.to}</strong> {time12(f.arrivalTime)}
              <div className="text-muted">{f.stops === 0 ? 'Non-stop' : `${f.stops} stop`} · {Math.floor(f.durationMinutes / 60)}h {f.durationMinutes % 60}m</div>
            </div>
            <div className="text-end">
              <div className="fw-bold text-primary">{inr(f.price)}</div>
              <span className="badge text-bg-light border">{f.travelClass}</span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onAction(`select_flight ${f.id}`)}>Select</button>
          </div>
          {f.policy && (!f.policy.classAllowed || !f.policy.underBudget) && (
            <div className="small text-danger mt-1 d-flex align-items-center gap-1">
              <AlertTriangle size={12} /> Exceeds your policy ({f.policy.classAllowed ? '' : 'class '}{!f.policy.classAllowed && !f.policy.underBudget ? '& ' : ''}{f.policy.underBudget ? '' : 'budget'})
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HotelsView({ view, onAction }) {
  return (
    <div>
      {view.analysis && <PriceAnalysisView view={view.analysis} compact hotel />}
      {view.hotels.map((h) => (
        <div key={h.id} className="border rounded-3 p-2 mb-2 bg-white d-flex gap-2 align-items-start">
          <div className="flex-shrink-0">
            <HotelImage
              hotel={h}
              hoverZoom
              alt={`${h.name} in ${h.city}`}
              style={{ width: 72, height: 56, borderRadius: '0.4rem' }}
            />
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="fw-semibold small" style={{ minWidth: 110 }}>{h.name}</div>
              <div className="flex-grow-1 small text-muted d-flex align-items-center gap-1">
                <MapPin size={12} /> {h.location}
              </div>
              <div className="text-end small">
                <div><Star size={11} className="text-warning" /> {h.starRating} · {h.roomType}</div>
                <div className="fw-bold text-primary">{inr(h.pricePerNight)}/night</div>
                <div className="text-muted">{inr(h.totalPrice)} total ({h.nights} night{h.nights === 1 ? '' : 's'})</div>
              </div>
              <button className="btn btn-sm btn-primary btn-lift" onClick={() => onAction(`select_hotel ${h.id}`)}>Select</button>
            </div>
            {h.policy && (!h.policy.starsAllowed || !h.policy.underBudget) && (
              <div className="small text-danger mt-1 d-flex align-items-center gap-1">
                <AlertTriangle size={12} /> Exceeds your policy ({h.policy.starsAllowed ? '' : 'star '}{!h.policy.starsAllowed && !h.policy.underBudget ? '& ' : ''}{h.policy.underBudget ? '' : 'budget'})
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceAnalysisView({ view, compact, hotel }) {
  const rec = view.recommended;
  return (
    <div className="rounded-3 p-2 mb-2" style={{ background: 'rgba(15,148,136,0.08)', border: '1px solid rgba(15,148,136,0.25)' }}>
      <div className="d-flex flex-wrap justify-content-between gap-2 small">
        <div><span className="text-muted">Cheapest: </span><strong>{inr(view.cheapest)}</strong></div>
        <div><span className="text-muted">Average: </span><strong>{inr(view.average)}</strong></div>
        {rec && (
          <div><span className="text-muted">Recommended: </span><strong>{hotel ? rec.name : `${rec.airline} ${rec.flightNumber || ''}`.trim()}</strong> · {inr(rec.price)}{hotel ? '/night' : ''}</div>
        )}
      </div>
      {view.reason && !compact && <div className="small text-muted mt-1">{view.reason}</div>}
    </div>
  );
}

function TripPlanView({ view, onAction }) {
  const p = view.plan || {};
  return (
    <div>
      <div className="rounded-3 p-2 mb-2" style={{ background: 'rgba(15,148,136,0.06)' }}>
        <div className="fw-semibold small mb-1">Trip Plan</div>
        <div className="small d-flex flex-wrap gap-2">
          <span className="badge text-bg-light border">Purpose: {p.purpose || '—'}</span>
          <span className="badge text-bg-light border">From: {p.origin || '—'}</span>
          <span className="badge text-bg-light border">To: {p.destination || '—'}</span>
          <span className="badge text-bg-light border">Outbound: {p.travelDate ? formatDate(p.travelDate) : '—'}</span>
          <span className="badge text-bg-light border">Return: {p.returnDate ? formatDate(p.returnDate) : '—'}</span>
          <span className="badge text-bg-light border">Hotel: {p.hotelNeeded || '—'}</span>
        </div>
        {view.missing && view.missing.length > 0 && (
          <div className="small text-warning mt-1">Missing: {view.missing.join(', ')}</div>
        )}
      </div>
      {view.flights && view.flights.length > 0 && (
        <>
          {view.analysis && <PriceAnalysisView view={view.analysis} />}
          <FlightsView view={{ flights: view.flights }} onAction={onAction} />
        </>
      )}
    </div>
  );
}

function TripSummaryView({ view, onAction }) {
  return (
    <div className="rounded-3 p-2 mb-1" style={{ background: 'rgba(15,148,136,0.06)', border: '1px solid rgba(15,148,136,0.2)' }}>
      <div className="fw-semibold small mb-1 d-flex align-items-center gap-1"><ShieldCheck size={14} className="text-primary" /> Trip Summary</div>
      <div className="small">
        {view.origin && <div><span className="text-muted">Route:</span> <strong>{view.origin} → {view.destination}</strong></div>}
        {!view.origin && view.destination && <div><span className="text-muted">Destination:</span> <strong>{view.destination}</strong></div>}
        <div><span className="text-muted">Travel Type:</span> {view.travelType}</div>
        {view.travelDate && <div><span className="text-muted">Dates:</span> {formatDate(view.travelDate)}{view.returnDate ? ` → ${formatDate(view.returnDate)}` : ''}</div>}
        {view.flight && <div className="d-flex align-items-center gap-1"><Plane size={12} className="text-primary" /> {view.flight.airline} {view.flight.flightNumber} — <strong>{inr(view.flight.price)}</strong></div>}
        {view.hotel && <div className="d-flex align-items-center gap-1"><Hotel size={12} className="text-primary" /> {view.hotel.name} ({view.hotel.nights} night{view.hotel.nights === 1 ? '' : 's'}) — <strong>{inr(view.hotel.totalPrice)}</strong></div>}
        <div className="border-top mt-1 pt-1 d-flex justify-content-between">
          <span className="text-muted">Estimated Total</span>
          <strong className="text-primary">{inr(view.totalAmount)}</strong>
        </div>
        {view.purpose && <div className="text-muted mt-1">Business Purpose: {view.purpose}</div>}
      </div>
    </div>
  );
}

function RequestsView({ view, role, onAction }) {
  return (
    <div>
      {view.items.map((r) => (
        <div key={r._id} className="border rounded-3 p-2 mb-2 bg-white">
          <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
            <div>
              <div className="fw-semibold small">{r.requestId} · {r.employeeName}</div>
              <div className="small text-muted">{r.destination} · {r.travelType}</div>
              <div className="small text-muted">{formatDate(r.travelDate)} · {inr(r.totalAmount)}</div>
              {r.status === 'REJECTED' && r.rejectionComment && (
                <div className="small text-danger mt-1"><XCircle size={12} /> {r.rejectionComment}</div>
              )}
            </div>
            <div className="text-end">
              <StatusBadge status={r.status} />
              <div className="small mt-1">
                <span className="badge text-bg-light border me-1">{r.bookingStatus === 'confirmed' ? 'Booked' : 'Not booked'}</span>
                <span className="badge text-bg-light border">{r.paymentStatus}</span>
              </div>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-1 mt-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => onAction(`show request ${r.requestId}`)}>Details</button>
            {role === 'manager' && r.status === 'PENDING' && (
              <>
                <button className="btn btn-sm btn-success" onClick={() => onAction(`approve ${r.requestId}`)}>Approve</button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => onAction(`reject ${r.requestId}`)}>Reject</button>
              </>
            )}
            {role === 'admin' && r.status === 'APPROVED' && (
              <button className="btn btn-sm btn-primary" onClick={() => onAction(`booking ${r.requestId}`)}>Confirm Booking</button>
            )}
            {role === 'admin' && r.status === 'TICKETED' && (
              <>
                <button className="btn btn-sm btn-outline-primary" onClick={() => onAction(`view_invoice ${r.requestId}`)}>Invoice</button>
                <button className="btn btn-sm btn-primary" onClick={() => onAction(`download_invoice ${r.requestId}`)}>Download Invoice</button>
              </>
            )}
            {role === 'employee' && r.status === 'TICKETED' && (
              <>
                <button className="btn btn-sm btn-outline-primary" onClick={() => onAction(`view_ticket ${r.requestId}`)}>Ticket</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => onAction(`view_invoice ${r.requestId}`)}>Invoice</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestDetailView({ view, role, onAction }) {
  const r = view.request;
  const hasFlight = r.travelType !== 'hotel';
  const hasHotel = r.travelType !== 'flight';
  return (
    <div className="rounded-3 p-2" style={{ background: 'rgba(15,148,136,0.04)', border: '1px solid rgba(15,148,136,0.15)' }}>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="fw-semibold small">Travel Request {r.requestId}</div>
        <StatusBadge status={r.status} />
      </div>
      <div className="small">
        <div><span className="text-muted">Employee:</span> {r.employeeName} {r.employeeDesignation ? `(${r.employeeDesignation})` : ''}</div>
        <div><span className="text-muted">Destination:</span> {r.travelType === 'hotel' ? (r.to || r.hotelSnapshot?.city) : `${r.from} → ${r.to}`}</div>
        <div><span className="text-muted">Travel Type:</span> {travelTypeLabel(r.travelType)}</div>
        <div><span className="text-muted">Travel Date:</span> {formatDate(r.travelDate)}{r.returnDate ? ` → ${formatDate(r.returnDate)}` : ''}</div>
        {r.employeeComment && <div><span className="text-muted">Business Purpose:</span> {r.employeeComment}</div>}
        {hasFlight && r.flightSnapshot?.airline && (
          <div className="d-flex align-items-center gap-1"><Plane size={12} className="text-primary" /> {r.flightSnapshot.airline} {r.flightSnapshot.flightNumber} ({r.flightSnapshot.travelClass}) — <strong>{inr(r.flightCost)}</strong></div>
        )}
        {hasHotel && r.hotelSnapshot?.name && (
          <div className="d-flex align-items-center gap-1"><Hotel size={12} className="text-primary" /> {r.hotelSnapshot.name} · {r.nights} night(s) — <strong>{inr(r.hotelCost)}</strong></div>
        )}
        <div className="border-top mt-1 pt-1 d-flex justify-content-between">
          <span className="text-muted">Estimated Cost</span>
          <strong className="text-primary">{inr(r.totalAmount)}</strong>
        </div>
        {(r.comments || []).length > 0 && (
          <div className="mt-1 border-top pt-1">
            <div className="text-muted small">Comments:</div>
            {(r.comments || []).map((c, i) => (
              <div key={i} className="small">
                <strong>{roleFor[c.role] || c.role}</strong> ({c.action}): {c.comment}
              </div>
            ))}
          </div>
        )}
      </div>
      {role === 'admin' && r.status === 'APPROVED' && (
        <div className="mt-2">
          <button className="btn btn-sm btn-primary" onClick={() => onAction(`booking ${r.requestId}`)}>Confirm Booking</button>
        </div>
      )}
    </div>
  );
}

function ConfirmationView({ view, onAction }) {
  const [comment, setComment] = useState('');
  const needsComment = view.commentRequired || (view.actions || []).some((a) => a.needsComment);
  return (
    <div className="rounded-3 p-2" style={{ background: 'rgba(15,148,136,0.04)', border: '1px solid rgba(15,148,136,0.2)' }}>
      <div className="fw-semibold small mb-1">{view.title}</div>
      {view.subtitle && <div className="small text-muted mb-1">{view.subtitle}</div>}
      <div className="small">
        {(view.rows || []).map(([k, v]) => (
          <div key={k} className="d-flex justify-content-between border-bottom py-1" style={{ borderColor: 'rgba(15,23,42,0.06) !important' }}>
            <span className="text-muted">{k}</span>
            <span className="fw-semibold">{v}</span>
          </div>
        ))}
      </div>
      {needsComment && (
        <div className="mt-2">
          <label className="form-label small fw-semibold mb-1">
            {view.commentRequired ? 'Comment / reason (required)' : 'Comment (optional)'}
          </label>
          <textarea
            className="form-control form-control-sm"
            rows={2}
            placeholder={view.commentRequired ? 'Please provide a reason for rejection.' : 'e.g. Approved for the client meeting.'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}
      <ActionRow actions={view.actions} onAction={(cmd) => onAction(needsComment ? `${cmd}${comment.trim() ? ' ' + comment.trim() : ''}` : cmd)} needsCommentValue={comment.trim()} />
    </div>
  );
}

function ResultView({ view }) {
  return view.ok ? (
    <div className="d-flex align-items-center gap-3 mt-1">
      <SuccessAnimation size={46} />
      <div>
        <div className="fw-semibold small">Done</div>
        <div className="small text-muted">{view.message}</div>
      </div>
    </div>
  ) : (
    <div className="alert alert-danger mb-0 d-flex align-items-start gap-2">
      <XCircle size={18} className="mt-1 flex-shrink-0" />
      <div className="small">{view.message}</div>
    </div>
  );
}

function TicketCardView({ view }) {
  const b = view.booking;
  const tr = view.travelRequest;
  if (!b) return null;
  const hasFlight = b.airline && tr?.travelType !== 'hotel';
  const hasHotel = b.hotelName && tr?.travelType !== 'flight';
  return (
    <div className="border rounded-3 overflow-hidden">
      <div className="bg-brand-gradient text-white px-3 py-2 d-flex justify-content-between align-items-center">
        <div className="fw-bold small">FINAL TICKET · {b.pnr}</div>
        <div className="small opacity-75">{b.bookingReference}</div>
      </div>
      <div className="p-2 small">
        <div><span className="text-muted">Passenger:</span> {tr?.employeeName || '—'} {tr?.employeeDesignation ? `(${tr.employeeDesignation})` : ''}</div>
        {hasFlight && (
          <div className="d-flex align-items-center gap-1 mt-1"><Plane size={12} className="text-primary" /> {b.airline} {b.flightNumber} · {b.flightFrom} → {b.flightTo} · {time12(b.flightDepartureTime)} – {time12(b.flightArrivalTime)} · {formatDate(b.flightDate)} · Seat {b.seat || '—'}</div>
        )}
        {hasHotel && (
          <div className="d-flex align-items-center gap-1 mt-1"><Hotel size={12} className="text-primary" /> {b.hotelName} · {b.hotelCity} · {b.hotelRoomType} · {formatDate(b.hotelCheckIn)} → {formatDate(b.hotelCheckOut)}</div>
        )}
        <div className="d-flex justify-content-between border-top mt-1 pt-1">
          <span className="text-muted">Total</span>
          <strong className="text-primary">{inr(b.totalAmount)}</strong>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ view }) {
  return (
    <div className="rounded-3 p-2" style={{ background: 'rgba(15,148,136,0.04)', border: '1px solid rgba(15,148,136,0.15)' }}>
      <div className="fw-semibold small mb-1">{view.title}</div>
      <div className="small">
        {(view.rows || []).map(([k, v]) => (
          <div key={k} className="d-flex justify-content-between border-bottom py-1">
            <span className="text-muted">{k}</span>
            <span className="fw-semibold">{v}</span>
          </div>
        ))}
        {view.travelTypes && (
          <div className="d-flex gap-2 pt-1">
            <span className="badge text-bg-primary">Flight: {view.travelTypes.flight}</span>
            <span className="badge text-bg-info">Hotel: {view.travelTypes.hotel}</span>
            <span className="badge text-bg-dark">Both: {view.travelTypes.flight_hotel}</span>
          </div>
        )}
        {view.highlights && view.highlights.length > 0 && (
          <div className="mt-2">
            <div className="text-muted">{view.highlightLabel || 'Highlights'}:</div>
            {view.highlights.map((h) => <div key={h} className="small">• {h}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function CostAnalysisView({ view }) {
  return (
    <div className="rounded-3 p-2" style={{ background: 'rgba(15,148,136,0.04)', border: '1px solid rgba(15,148,136,0.15)' }}>
      <div className="fw-semibold small mb-1">Corporate Travel Cost Analysis — {view.month}</div>
      <div className="small">
        {(view.rows || []).map(([k, v]) => (
          <div key={k} className="d-flex justify-content-between border-bottom py-1">
            <span className="text-muted">{k}</span>
            <span className="fw-semibold">{v}</span>
          </div>
        ))}
        {view.topDestination && <div className="pt-1"><span className="text-muted">Top Destination:</span> {view.topDestination}</div>}
        {view.previousMonthTotal != null && (
          <div className="pt-1"><span className="text-muted">Previous month total:</span> <strong>{inr(view.previousMonthTotal)}</strong></div>
        )}
      </div>
    </div>
  );
}

/* ---------- structured search / planning forms ---------- */
function FormShell({ title, children }) {
  return (
    <div className="rounded-3 p-2 mt-1" style={{ background: 'rgba(15,148,136,0.05)', border: '1px solid rgba(15,148,136,0.18)' }}>
      <div className="fw-semibold small mb-2">{title}</div>
      {children}
    </div>
  );
}

const fieldLabel = { fontSize: '0.7rem', fontWeight: 600, color: '#475569' };
const cleanCmd = (s) => String(s || '').replace(/[|=]/g, ' ').trim();

function FlightForm({ onAction }) {
  const [from, setFrom] = useState('Mumbai');
  const [to, setTo] = useState('Delhi');
  const [date, setDate] = useState('');
  const [ret, setRet] = useState('');
  const [nonstop, setNonstop] = useState(false);
  const [budget, setBudget] = useState('');
  const ready = from.trim() && to.trim() && date;
  const submit = () => {
    if (!ready) return;
    let cmd = `flight_form|from=${cleanCmd(from)}|to=${cleanCmd(to)}|date=${date}`;
    if (ret) cmd += `|return=${ret}`;
    if (nonstop) cmd += '|nonstop=true';
    if (budget) cmd += `|budget=${cleanCmd(budget)}`;
    onAction(cmd);
  };
  return (
    <FormShell title="✈ Search Flights">
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>From</label>
          <input className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Mumbai" />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>To</label>
          <input className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Delhi" />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Departure date</label>
          <input className="form-control form-control-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Return date (optional)</label>
          <input className="form-control form-control-sm" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Budget (₹, optional)</label>
          <input className="form-control form-control-sm" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="8000" />
        </div>
        <div className="col-6 d-flex align-items-end">
          <label className="form-check small">
            <input className="form-check-input" type="checkbox" checked={nonstop} onChange={(e) => setNonstop(e.target.checked)} />
            <span className="ms-1">Non-stop only</span>
          </label>
        </div>
      </div>
      <button className="btn btn-sm btn-primary mt-2 w-100" disabled={!ready} onClick={submit}>Search Flights</button>
    </FormShell>
  );
}

function HotelForm({ onAction }) {
  const [city, setCity] = useState('Delhi');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [budget, setBudget] = useState('');
  const ready = city.trim() && checkIn && checkOut;
  const submit = () => {
    if (!ready) return;
    let cmd = `hotel_form|city=${cleanCmd(city)}|checkin=${checkIn}|checkout=${checkOut}`;
    if (budget) cmd += `|budget=${cleanCmd(budget)}`;
    onAction(cmd);
  };
  return (
    <FormShell title="🏨 Search Hotels">
      <div className="row g-2">
        <div className="col-12">
          <label className="form-label mb-1" style={fieldLabel}>Destination</label>
          <input className="form-control form-control-sm" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Delhi" />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Check-in</label>
          <input className="form-control form-control-sm" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Check-out</label>
          <input className="form-control form-control-sm" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="form-label mb-1" style={fieldLabel}>Max budget per night (₹, optional)</label>
          <input className="form-control form-control-sm" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="6000" />
        </div>
      </div>
      <button className="btn btn-sm btn-primary mt-2 w-100" disabled={!ready} onClick={submit}>Search Hotels</button>
    </FormShell>
  );
}

function PlanForm({ onAction }) {
  const [from, setFrom] = useState('Mumbai');
  const [to, setTo] = useState('Delhi');
  const [date, setDate] = useState('');
  const [ret, setRet] = useState('');
  const [mode, setMode] = useState('flight');
  const [purpose, setPurpose] = useState('');
  const ready = from.trim() && to.trim() && date;
  const submit = () => {
    if (!ready) return;
    let cmd = `plan_form|from=${cleanCmd(from)}|to=${cleanCmd(to)}|date=${date}`;
    if (ret) cmd += `|return=${ret}`;
    cmd += `|mode=${mode}`;
    if (purpose.trim()) cmd += `|purpose=${cleanCmd(purpose)}`;
    onAction(cmd);
  };
  return (
    <FormShell title="🧳 Plan a Trip">
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>From</label>
          <input className="form-control form-control-sm" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Mumbai" />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>To</label>
          <input className="form-control form-control-sm" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Delhi" />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Travel date</label>
          <input className="form-control form-control-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label mb-1" style={fieldLabel}>Return date (optional)</label>
          <input className="form-control form-control-sm" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="form-label mb-1" style={fieldLabel}>I need</label>
          <div className="d-flex gap-3 small">
            {[['flight', 'Flight'], ['hotel', 'Hotel'], ['flight_hotel', 'Flight + Hotel']].map(([v, l]) => (
              <label key={v} className="form-check">
                <input className="form-check-input" type="radio" name="planMode" checked={mode === v} onChange={() => setMode(v)} />
                <span className="ms-1">{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-12">
          <label className="form-label mb-1" style={fieldLabel}>Business purpose (optional)</label>
          <input className="form-control form-control-sm" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Client meeting" />
        </div>
      </div>
      <button className="btn btn-sm btn-primary mt-2 w-100" disabled={!ready} onClick={submit}>Plan Trip</button>
    </FormShell>
  );
}

function FormView({ view, onAction }) {
  if (view.form === 'flight') return <FlightForm onAction={onAction} />;
  if (view.form === 'hotel') return <HotelForm onAction={onAction} />;
  if (view.form === 'plan') return <PlanForm onAction={onAction} />;
  return null;
}

/* ---------- main switch ---------- */
export default function AssistantView({ view, role, onAction }) {
  if (!view) return null;
  switch (view.type) {
    case 'welcome':
      return (
        <div className="small text-muted">
          I'm your corporate travel assistant for the <strong>{(roleFor[view.role] || '')} role</strong>. Try one of the quick actions below.
        </div>
      );
    case 'text':
      return null;
    case 'form':
      return <FormView view={view} onAction={onAction} />;
    case 'flights':
      return <FlightsView view={view} onAction={onAction} />;
    case 'hotels':
      return <HotelsView view={view} onAction={onAction} />;
    case 'price_analysis':
      return <PriceAnalysisView view={view} />;
    case 'trip_plan':
      return <TripPlanView view={view} onAction={onAction} />;
    case 'trip_summary':
      return <TripSummaryView view={view} />;
    case 'requests':
      return <RequestsView view={view} role={role} onAction={onAction} />;
    case 'request_detail':
      return <RequestDetailView view={view} role={role} onAction={onAction} />;
    case 'confirmation':
      return <ConfirmationView view={view} onAction={onAction} />;
    case 'result':
      return <ResultView view={view} />;
    case 'invoice':
      return <InvoiceView invoice={view.invoice} />;
    case 'ticket':
      return <TicketCardView view={view} />;
    case 'analytics':
      return <AnalyticsView view={view} />;
    case 'cost_analysis':
      return <CostAnalysisView view={view} />;
    case 'error':
      return <div className="alert alert-danger mb-0 small d-flex align-items-center gap-2"><AlertTriangle size={16} /> Action not permitted.</div>;
    default:
      return null;
  }
}

export { roleFor, ActionRow };
