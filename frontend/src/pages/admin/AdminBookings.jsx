import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, FileText } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, getErrorMessage, formatRoute, travelTypeLabel, bookingStatusBadge, paymentStatusBadge } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import RequestFilters from '../../components/RequestFilters';

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'READY_FOR_TICKETING', 'TICKETED', 'REJECTED', 'CANCELLED'];
const EMPTY_FILTERS = { search: '', status: 'ALL', travelType: 'ALL', bookingStatus: 'ALL', paymentStatus: 'ALL', dateFrom: '', dateTo: '' };

export default function AdminBookings() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (nextFilters.search) params.search = nextFilters.search;
      if (nextFilters.status && nextFilters.status !== 'ALL') params.status = nextFilters.status;
      if (nextFilters.travelType && nextFilters.travelType !== 'ALL') params.travelType = nextFilters.travelType;
      if (nextFilters.bookingStatus && nextFilters.bookingStatus !== 'ALL') params.bookingStatus = nextFilters.bookingStatus;
      if (nextFilters.paymentStatus && nextFilters.paymentStatus !== 'ALL') params.paymentStatus = nextFilters.paymentStatus;
      if (nextFilters.dateFrom) params.dateFrom = nextFilters.dateFrom;
      if (nextFilters.dateTo) params.dateTo = nextFilters.dateTo;
      const res = await client.get('/admin/bookings', { params });
      setRequests(res.data.requests || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load bookings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h4 className="fw-bold mb-3">All Bookings & Requests</h4>

      <RequestFilters
        filters={filters}
        onChange={(patch) => setFilters({ ...filters, ...patch })}
        onApply={() => load(filters)}
        onClear={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); }}
        statusOptions={STATUSES}
        showBookingPayment
      />

      <div className="text-muted small mb-2">{total} request(s)</div>

      <div className="card border-0 shadow-sm">
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
                <th>Policy</th>
                <th>Booking</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={11} className="text-center py-4 text-muted">No requests match the filters.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.employeeName}
                    <div className="small text-muted">{r.employeeDesignation}</div>
                  </td>
                  <td>{formatRoute(r)}</td>
                  <td><span className="badge text-bg-light border">{travelTypeLabel(r.travelType)}</span></td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td>{r.policyStatus === 'passed' ? <span className="badge text-bg-success">Passed</span> : <span className="badge text-bg-secondary">{r.policyStatus}</span>}</td>
                  <td>
                    <span className={bookingStatusBadge(r.bookingStatus).className}>{bookingStatusBadge(r.bookingStatus).label}</span>
                  </td>
                  <td>
                    <span className={paymentStatusBadge(r.paymentStatus).className}>{paymentStatusBadge(r.paymentStatus).label}</span>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-end text-nowrap">
                    <Link to={`/admin/bookings/${r._id}`} className="btn btn-sm btn-outline-secondary">
                      <FileText size={14} /> Details
                    </Link>{' '}
                    {r.status === 'TICKETED' && (
                      <Link to={`/employee/ticket/${r._id}`} className="btn btn-sm btn-primary"><Ticket size={14} /> Ticket</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="small text-muted mt-2">{requests.length < total ? `Showing first ${requests.length} of ${total} — refine your filters for more specific results.` : ''}</div>
    </div>
  );
}
