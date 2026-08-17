import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import { formatDateTime } from '../../utils/format';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('ALL');
  const [search, setSearch] = useState('');

  const load = async (act, q) => {
    setLoading(true);
    try {
      const res = await client.get('/admin/audit-logs', { params: { action: act, search: q || undefined } });
      setLogs(res.data.logs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('ALL', '');
  }, []);

  const actions = [...new Set(logs.map((l) => l.action))].sort();

  return (
    <div>
      <h4 className="fw-bold mb-3 d-flex align-items-center gap-2">
        <ShieldCheck size={22} className="text-primary" /> Audit Logs
      </h4>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <select className="form-select" value={action} onChange={(e) => { setAction(e.target.value); load(e.target.value, search); }}>
                <option value="ALL">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text"><Search size={15} /></span>
                <input className="form-control" placeholder="Search by user, request ID, or action…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(action, search); }} />
              </div>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={() => load(action, search)}>Filter</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Transition</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-4 text-muted">Loading…</td></tr>}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-4 text-muted">No audit records match.</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="small text-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="fw-semibold">{log.userName}</td>
                  <td><span className="badge text-bg-light border text-capitalize">{log.role}</span></td>
                  <td><span className="badge text-bg-primary">{log.action}</span></td>
                  <td className="small">{log.entity || '—'}</td>
                  <td className="small text-muted">{log.entityId || '—'}</td>
                  <td className="small">
                    {log.oldStatus && log.newStatus ? (
                      <span>
                        <span className="text-muted">{log.oldStatus}</span> → <span className="fw-semibold">{log.newStatus}</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
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
