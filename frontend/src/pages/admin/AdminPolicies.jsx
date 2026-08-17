import { useEffect, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Plane, Hotel, Power, CheckCircle2, Trash2 } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inr, getErrorMessage } from '../../utils/format';

const CLASSES = ['Economy', 'Premium Economy', 'Business'];

const EMPTY = {
  designation: '',
  allowedFlightClasses: ['Economy'],
  maximumHotelStars: 2,
  flightBudget: 8000,
  hotelBudgetPerNight: 3000,
  description: '',
};

export default function AdminPolicies() {
  const toast = useToast();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // policy object or 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // policy object to hard-delete
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/policies');
      setPolicies(res.data.policies || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (policy) => {
    setEditing(policy);
    setForm({
      designation: policy.designation,
      allowedFlightClasses: [...policy.allowedFlightClasses],
      maximumHotelStars: policy.maximumHotelStars,
      flightBudget: policy.flightBudget,
      hotelBudgetPerNight: policy.hotelBudgetPerNight,
      description: policy.description || '',
    });
  };

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY);
  };

  const toggleClass = (cls) => {
    setForm((f) => ({
      ...f,
      allowedFlightClasses: f.allowedFlightClasses.includes(cls)
        ? f.allowedFlightClasses.filter((c) => c !== cls)
        : [...f.allowedFlightClasses, cls],
    }));
  };

  const toggleActive = async (p) => {
    try {
      await client.put(`/admin/policies/${p._id}`, { isActive: !p.isActive });
      toast.success(p.isActive ? `Policy "${p.designation}" deactivated (soft delete).` : `Policy "${p.designation}" activated.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update policy.'));
    }
  };

  const confirmHardDelete = async () => {
    setDeleting(true);
    try {
      const res = await client.delete(`/admin/policies/${confirmDelete._id}`);
      toast.success(res.data.message || 'Policy deleted.');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete policy.'));
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    if (!form.designation || form.allowedFlightClasses.length === 0) {
      toast.warning('Designation and at least one flight class are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        await client.post('/admin/policies', form);
        toast.success('Policy created.');
      } else {
        await client.put(`/admin/policies/${editing._id}`, form);
        toast.success('Policy updated.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save policy.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">Corporate Travel Policies</h4>
        <button className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={openNew}>
          <Plus size={17} /> New policy
        </button>
      </div>

      <div className="row g-3">
        {loading && <div className="col-12 text-center py-4"><div className="spinner-border text-primary" /></div>}
        {policies.map((p) => (
          <div className="col-md-6 col-xl-4" key={p._id}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold fs-5">{p.designation}</div>
                    {!p.isActive && <span className="badge text-bg-secondary mt-1">Inactive (soft deleted)</span>}
                  </div>
                  <div className="d-flex gap-1">
                    <button className="btn btn-sm btn-outline-secondary" title="Edit" onClick={() => openEdit(p)}>
                      <Pencil size={14} />
                    </button>
                    {p.isActive ? (
                      <button className="btn btn-sm btn-outline-warning" title="Deactivate (soft delete)" onClick={() => toggleActive(p)}>
                        <Power size={14} />
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-outline-success" title="Activate (restore)" onClick={() => toggleActive(p)}>
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" title="Delete permanently (hard delete)" onClick={() => setConfirmDelete(p)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <hr />
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Plane size={16} className="text-primary" />
                  <div className="small">
                    <span className="fw-semibold">{p.allowedFlightClasses.join(' / ')}</span> class
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Hotel size={16} className="text-primary" />
                  <div className="small">
                    Max <span className="fw-semibold">{p.maximumHotelStars}-star</span> hotel
                  </div>
                </div>
                <div className="small text-muted">
                  Flight budget <span className="fw-semibold text-dark">{inr(p.flightBudget)}</span> · Hotel{' '}
                  <span className="fw-semibold text-dark">{inr(p.hotelBudgetPerNight)}/night</span>
                </div>
                {p.description && <div className="small text-muted mt-2">{p.description}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hard delete confirm modal */}
      <div className={`modal fade ${confirmDelete ? 'show' : ''}`} style={{ display: confirmDelete ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">Delete policy permanently?</h5>
              <button type="button" className="btn-close" onClick={() => setConfirmDelete(null)} />
            </div>
            <div className="modal-body">
              <p className="mb-2">
                Permanently delete the <strong>{confirmDelete?.designation}</strong> policy?
                {confirmDelete?.isActive === false && ' This policy is already inactive.'}
              </p>
              <p className="small text-muted mb-0">
                Employees currently assigned to this policy will be detached and will fall back to
                designation-based policy matching. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger d-inline-flex align-items-center gap-2" disabled={deleting} onClick={confirmHardDelete}>
                {deleting ? <span className="spinner-border spinner-border-sm" /> : <Trash2 size={16} />} Delete permanently
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit/create modal */}
      <div className={`modal fade ${editing ? 'show' : ''}`} style={{ display: editing ? 'block' : 'none' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-semibold">{editing === 'new' ? 'New travel policy' : `Edit policy — ${editing?.designation}`}</h5>
              <button type="button" className="btn-close" onClick={() => setEditing(null)} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small">Designation</label>
                  <input className="form-control" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Executive" />
                </div>
                <div className="col-12">
                  <label className="form-label small">Allowed flight classes</label>
                  <div className="d-flex gap-2">
                    {CLASSES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`btn btn-sm ${form.allowedFlightClasses.includes(c) ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => toggleClass(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-6">
                  <label className="form-label small">Maximum hotel stars</label>
                  <select
                    className="form-select"
                    value={form.maximumHotelStars}
                    onChange={(e) => setForm({ ...form, maximumHotelStars: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} Star</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small">Flight budget (₹/passenger)</label>
                  <input type="number" className="form-control" value={form.flightBudget} onChange={(e) => setForm({ ...form, flightBudget: Number(e.target.value) })} />
                </div>
                <div className="col-6">
                  <label className="form-label small">Hotel budget (₹/night)</label>
                  <input type="number" className="form-control" value={form.hotelBudgetPerNight} onChange={(e) => setForm({ ...form, hotelBudgetPerNight: Number(e.target.value) })} />
                </div>
                <div className="col-12">
                  <label className="form-label small">Description</label>
                  <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary d-inline-flex align-items-center gap-2" disabled={saving} onClick={save}>
                {saving ? <span className="spinner-border spinner-border-sm" /> : <ShieldCheck size={16} />} Save policy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
