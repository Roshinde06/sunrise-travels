import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Ticket } from 'lucide-react';
import client from '../../api/client';
import { inr, formatDate, formatDateTime } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'READY_FOR_TICKETING', 'TICKETED', 'REJECTED', 'CANCELLED'];

export default function AdminBookings() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'ALL', search: '' });

  const load = async (status, search) => {
    setLoading(true);
    try {
      const res = await client.get('/admin/bookings', {
        params: { status, search: search || undefined, limit: 50 },
      });
      setRequests(res.data.requests || []);
      setTotal(res.data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('ALL', '');
  }, []);

  return (
    <div>
      <h4 className="fw-bold mb-3">All Bookings & Requests</h4>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => {
                  const status = e.target.value;
                  setFilters({ ...filters, status });
                  load(status, filters.search);
                }}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text"><Search size={15} /></span>
                <input
                  className="form-control"
                  placeholder="Search by request ID, employee, or city…"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') load(filters.status, filters.search);
                  }}
                />
              </div>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={() => load(filters.status, filters.search)}>Search</button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-muted small mb-2">{total} request(s)</div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Route</th>
                <th>Travel Date</th>
                <th className="text-end">Total</th>
                <th>Policy</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={9} className="text-center py-4 text-muted">No requests match the filters.</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>
                    {r.employeeName}
                    <div className="small text-muted">{r.employeeDesignation}</div>
                  </td>
                  <td>{r.from} → {r.to}</td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td>{r.policyStatus === 'passed' ? <span className="badge text-bg-success">Passed</span> : <span className="badge text-bg-secondary">{r.policyStatus}</span>}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="small text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="text-end text-nowrap">
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
    </div>
  );
}
