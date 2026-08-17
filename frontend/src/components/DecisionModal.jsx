import { useEffect, useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * Modal for manager/admin decisions.
 * props:
 *   show: boolean
 *   action: 'approve' | 'reject'
 *   title: header text
 *   subtitle: context line (request id / employee)
 *   commentRequired: boolean (true for rejections)
 *   submitting: boolean
 *   onClose()
 *   onSubmit(comment)
 */
export default function DecisionModal({ show, action, title, subtitle, commentRequired = false, submitting = false, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setComment('');
      setError('');
    }
  }, [show, action]);

  if (!show) return null;

  const isReject = action === 'reject';

  const submit = () => {
    const text = comment.trim();
    if (commentRequired && !text) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError('');
    onSubmit(text);
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(15, 23, 42, 0.55)', zIndex: 2000 }}
      onClick={onClose}
    >
      <div className="bg-white rounded-4 shadow-lg p-4" style={{ width: 'min(520px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <span className={`rounded-circle d-inline-flex align-items-center justify-content-center text-white ${isReject ? 'bg-danger' : 'bg-success'}`} style={{ width: 34, height: 34 }}>
              {isReject ? <X size={18} /> : <Check size={18} />}
            </span>
            <div>
              <h5 className="mb-0 fw-bold">{title}</h5>
              {subtitle && <div className="small text-muted">{subtitle}</div>}
            </div>
          </div>
          <button className="btn btn-sm btn-outline-secondary border-0" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <label className="form-label fw-semibold">
          {isReject ? 'Comment / reason' : 'Comment (optional)'}
          {commentRequired && <span className="text-danger"> *</span>}
        </label>
        <textarea
          className="form-control"
          rows={3}
          placeholder={isReject
            ? 'e.g. Rejected because the requested travel date is outside the approved project schedule.'
            : 'e.g. Approved for the client meeting.'}
          value={comment}
          onChange={(e) => { setComment(e.target.value); if (error) setError(''); }}
        />
        {error && (
          <div className="d-flex align-items-center gap-1 text-danger small mt-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-4">
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${isReject ? 'btn-danger' : 'btn-success'} d-inline-flex align-items-center gap-2`} disabled={submitting} onClick={submit}>
            {submitting ? <span className="spinner-border spinner-border-sm" /> : (isReject ? <X size={16} /> : <Check size={16} />)}
            {isReject ? 'Confirm rejection' : 'Confirm approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
