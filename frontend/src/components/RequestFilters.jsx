import { Search, RotateCcw } from 'lucide-react';

/**
 * Reusable search & filter bar for request lists.
 * props:
 *   filters: { search, status, travelType, dateFrom, dateTo, bookingStatus?, paymentStatus? }
 *   onChange(patch)
 *   onApply()
 *   onClear()
 *   statusOptions: array of status values (with 'ALL' first)
 *   showBookingPayment: show booking/payment status filters (admin)
 */
export default function RequestFilters({
  filters,
  onChange,
  onApply,
  onClear,
  statusOptions = [],
  showBookingPayment = false,
}) {
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body">
        <div className="row g-2">
          <div className="col-md-4 col-lg-3">
            <label className="form-label small fw-semibold">Search employee / request</label>
            <div className="input-group">
              <span className="input-group-text"><Search size={15} /></span>
              <input
                className="form-control"
                placeholder="Name, email, ID, request ID, destination, booking…"
                value={filters.search || ''}
                onChange={(e) => onChange({ search: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
              />
            </div>
          </div>
          <div className="col-md-2 col-lg-2">
            <label className="form-label small fw-semibold">Status</label>
            <select
              className="form-select"
              value={filters.status || 'ALL'}
              onChange={(e) => onChange({ status: e.target.value })}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 col-lg-2">
            <label className="form-label small fw-semibold">Travel Type</label>
            <select
              className="form-select"
              value={filters.travelType || 'ALL'}
              onChange={(e) => onChange({ travelType: e.target.value })}
            >
              <option value="ALL">All types</option>
              <option value="flight">Flight only</option>
              <option value="hotel">Hotel only</option>
              <option value="flight_hotel">Flight + Hotel</option>
            </select>
          </div>
          {showBookingPayment && (
            <>
              <div className="col-md-2 col-lg-2">
                <label className="form-label small fw-semibold">Booking Status</label>
                <select
                  className="form-select"
                  value={filters.bookingStatus || 'ALL'}
                  onChange={(e) => onChange({ bookingStatus: e.target.value })}
                >
                  <option value="ALL">All bookings</option>
                  <option value="none">Not booked</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-md-2 col-lg-2">
                <label className="form-label small fw-semibold">Payment Status</label>
                <select
                  className="form-select"
                  value={filters.paymentStatus || 'ALL'}
                  onChange={(e) => onChange({ paymentStatus: e.target.value })}
                >
                  <option value="ALL">All payments</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </>
          )}
          <div className="col-md-2 col-lg-2">
            <label className="form-label small fw-semibold">From date</label>
            <input
              type="date"
              className="form-control"
              value={filters.dateFrom || ''}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
            />
          </div>
          <div className="col-md-2 col-lg-2">
            <label className="form-label small fw-semibold">To date</label>
            <input
              type="date"
              className="form-control"
              value={filters.dateTo || ''}
              onChange={(e) => onChange({ dateTo: e.target.value })}
            />
          </div>
          <div className="col-md-2 col-lg-3 d-flex align-items-end gap-2">
            <button className="btn btn-primary flex-grow-1" onClick={onApply}>
              <Search size={15} className="me-1" /> Apply Filters
            </button>
            <button className="btn btn-outline-secondary" onClick={onClear} title="Clear filters">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
