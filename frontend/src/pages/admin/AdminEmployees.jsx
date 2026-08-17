import { useEffect, useState } from 'react';
import { UserPlus, Power } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/format';

const ROLES = ['employee', 'manager', 'admin'];
const DESIGNATIONS = ['Junior Executive', 'Senior Executive', 'Manager', 'Director', 'VP'];

export default function AdminEmployees() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', designation: 'Junior Executive', department: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/employees');
      setEmployees(res.data.employees || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setSubmitting(true);
    try {
      await client.post('/admin/employees', form);
      toast.success(`Employee ${form.name} created.`);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'employee', designation: 'Junior Executive', department: '' });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create employee.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (emp) => {
    try {
      await client.patch(`/admin/employees/${emp.id}`, { status: emp.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${emp.name} ${emp.status === 'active' ? 'deactivated' : 'activated'}.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed.'));
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">Employees & Designations</h4>
        <button className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={() => setShowCreate(true)}>
          <UserPlus size={17} /> Add employee
        </button>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Policy Band</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-4 text-muted">Loading…</td></tr>}
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="fw-semibold">{emp.name}</td>
                  <td className="small">{emp.email}</td>
                  <td><span className="badge text-bg-light border text-capitalize">{emp.role}</span></td>
                  <td>{emp.designation || '—'}</td>
                  <td className="small text-muted">{emp.department || '—'}</td>
                  <td className="small">{emp.policy ? emp.policy.designation : <span className="text-muted">—</span>}</td>
                  <td>
                    <span className={`badge ${emp.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'}`}>{emp.status}</span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleStatus(emp)}>
                      <Power size={14} /> {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <div className={`modal fade ${showCreate ? 'show' : ''}`} style={{ display: showCreate ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Add employee</h5>
              <button type="button" className="btn-close" onClick={() => setShowCreate(false)} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small">Full name</label>
                  <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label small">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label small">Password</label>
                  <input type="text" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 characters" />
                </div>
                <div className="col-6">
                  <label className="form-label small">Role</label>
                  <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r} className="text-capitalize">{r}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small">Designation</label>
                  <select className="form-select" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                    {DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small">Department</label>
                  <input className="form-control" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={create}>
                {submitting ? <span className="spinner-border spinner-border-sm" /> : <UserPlus size={16} />} Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
