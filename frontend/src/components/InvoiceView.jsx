import { FileText, Plane, Hotel } from 'lucide-react';
import { inr, formatDate, formatDateTime, travelTypeLabel } from '../utils/format';

export default function InvoiceView({ invoice }) {
  if (!invoice) return null;

  const charges = [];
  if (invoice.travelType !== 'hotel') charges.push(['Flight Charges', invoice.flightCharges || 0]);
  if (invoice.travelType !== 'flight') charges.push(['Hotel Charges', invoice.hotelCharges || 0]);
  charges.push(['Taxes (GST 5%)', invoice.taxes || 0]);
  if (invoice.serviceCharges > 0) charges.push(['Service Charges', invoice.serviceCharges]);
  if (invoice.otherCharges > 0) charges.push(['Other Charges', invoice.otherCharges]);

  return (
    <div className="border rounded-3 overflow-hidden">
      {/* Header */}
      <div className="bg-brand-gradient text-white px-4 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <FileText size={22} />
          <div>
            <div className="fw-bold">SUNRISE TRAVELS</div>
            <div className="small opacity-75">Corporate Travel Booking Platform</div>
          </div>
        </div>
        <div className="text-end">
          <div className="fw-semibold">CORPORATE TRAVEL INVOICE</div>
          <div className="small opacity-75">No: {invoice.invoiceNumber} · {formatDate(invoice.invoiceDate)}</div>
        </div>
      </div>

      <div className="p-4">
        {/* Bill to / reference */}
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <div className="text-muted small text-uppercase">Bill To</div>
            <div className="fw-semibold">{invoice.employeeName}</div>
            <div className="small text-secondary">
              Employee ID: {invoice.employeeId}
              {invoice.department ? ` · ${invoice.department}` : ''}
              {invoice.designation ? ` · ${invoice.designation}` : ''}
            </div>
          </div>
          <div className="col-md-6">
            <div className="text-muted small text-uppercase">Reference</div>
            <div className="small">Travel Request: <span className="fw-semibold">{invoice.requestId}</span></div>
            <div className="small">Booking ID: <span className="fw-semibold">{invoice.bookingReference || '—'}</span></div>
            <div className="small">PNR / Ticket: <span className="fw-semibold">{invoice.pnr || '—'}</span></div>
            <div className="small">Travel Type: <span className="fw-semibold">{travelTypeLabel(invoice.travelType)}</span></div>
          </div>
        </div>

        <hr />

        {/* Travel details */}
        {invoice.flight && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Plane size={16} className="text-primary" />
              <span className="fw-semibold small">Flight — {invoice.flight.airline} {invoice.flight.flightNumber}</span>
              <span className="badge text-bg-light border">{invoice.flight.travelClass}</span>
            </div>
            <div className="small text-secondary">
              {invoice.flight.from} → {invoice.flight.to} · {formatDate(invoice.flight.travelDate)} ·{' '}
              {invoice.flight.departureTime} – {invoice.flight.arrivalTime} · {invoice.flight.passengers} passenger(s)
            </div>
          </div>
        )}
        {invoice.hotel && (
          <div className="mb-3">
            <div className="d-flex align-items-center gap-2 mb-1">
              <Hotel size={16} className="text-primary" />
              <span className="fw-semibold small">Hotel — {invoice.hotel.name}</span>
              <span className="badge text-bg-light border">{invoice.hotel.roomType}</span>
            </div>
            <div className="small text-secondary">
              {invoice.hotel.city} · Check-in {formatDate(invoice.hotel.checkIn)} → Check-out {formatDate(invoice.hotel.checkOut)} ·{' '}
              {invoice.hotel.rooms} room(s) × {invoice.hotel.nights} night(s)
            </div>
          </div>
        )}

        <hr />

        {/* Charges */}
        <table className="table table-sm mb-3">
          <thead className="table-light">
            <tr>
              <th className="small">CHARGE</th>
              <th className="small text-end">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {charges.map(([label, amount]) => (
              <tr key={label}>
                <td className="small">{label}</td>
                <td className="small text-end fw-semibold">{inr(amount)}</td>
              </tr>
            ))}
            <tr className="bg-brand-gradient text-white">
              <td className="fw-bold">Total Amount</td>
              <td className="fw-bold text-end">{inr(invoice.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Status */}
        <div className="row g-3">
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Payment Status</div>
            <span className={`badge ${invoice.paymentStatus === 'paid' ? 'text-bg-success' : 'text-bg-warning'}`}>
              {invoice.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
            </span>
            {invoice.paymentDate && <div className="small text-secondary mt-1">Paid on {formatDateTime(invoice.paymentDate)}</div>}
          </div>
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Booking Status</div>
            <span className={`badge ${invoice.bookingStatus === 'confirmed' ? 'text-bg-success' : 'text-bg-secondary'}`}>
              {invoice.bookingStatus === 'confirmed' ? 'Confirmed' : invoice.bookingStatus || '—'}
            </span>
          </div>
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Invoice</div>
            <div className="small">{invoice.invoiceNumber}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
