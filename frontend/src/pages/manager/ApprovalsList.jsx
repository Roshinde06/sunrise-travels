import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Check, X } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, formatDate, getErrorMessage } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';

export default function ApprovalsList() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/approvals/pending');
      setRequests(res.data.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, action) => {
    setActing(`${action}-${id}`);
    try {
      await client.post(`/approvals/${id}/${action}`, action === 'reject' ? { reason: 'Not approved at this time.' } : {});
      toast.success(action === 'approve' ? 'Request approved.' : 'Request rejected.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed.'));
    } finally {
      setActing('');
    }
  };

  return (
    <div>
      <h4 className="fw-bold mb-3">Pending Approvals</h4>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Request ID</th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Destination</th>
                <th>Travel Date</th>
                <th className="text-end">Amount</th>
                <th>Policy Status</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={10} className="text-center py-4 text-muted">No pending approvals. 🎉</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="fw-semibold">{r.requestId}</td>
                  <td>{r.employeeName}</td>
                  <td className="small text-muted">{r.employeeDesignation}</td>
                  <td>{r.from} → {r.to}</td>
                  <td>{formatDate(r.travelDate)}</td>
                  <td className="text-end">{inr(r.totalAmount)}</td>
                  <td><span className="badge text-bg-success">Passed</span></td>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-end text-nowrap">
                    <Link to={`/manager/approval/${r._id}`} className="btn btn-sm btn-outline-secondary"><Eye size={14} /></Link>{' '}
                    <button className="btn btn-sm btn-success" disabled={!!acting} onClick={() => decide(r._id, 'approve')}>
                      <Check size={14} /> Approve
                    </button>{' '}
                    <button className="btn btn-sm btn-outline-danger" disabled={!!acting} onClick={() => decide(r._id, 'reject')}>
                      <X size={14} /> Reject
                    </button>
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
