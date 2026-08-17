import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  UserRound,
  LayoutDashboard,
  Plane,
  ClipboardCheck,
  Ticket,
  Wallet,
  HelpCircle,
  X,
  ShieldCheck,
  Star,
  Hotel,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { inr, formatDate } from '../utils/format';

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const roleLabel = (role) =>
  ({ employee: 'Employee', manager: 'Manager', admin: 'Travel Administrator' }[role] || role);

export default function AccountMenu() {
  const { user, policy, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const quickLinks = {
    employee: [
      { icon: Plane, label: 'My Trips & Tickets', to: '/employee/my-trips' },
      { icon: Wallet, label: 'Plan a trip', to: '/employee/flights' },
    ],
    manager: [
      { icon: ClipboardCheck, label: 'Pending Approvals', to: '/manager/approvals' },
    ],
    admin: [
      { icon: Ticket, label: 'Ticketing Queue', to: '/admin/ticketing' },
      { icon: Wallet, label: 'Travel Spend', to: '/admin/travel-spend' },
    ],
  }[user?.role] || [];

  return (
    <>
      <div className="position-relative" ref={ref}>
        <button
          className="btn btn-link text-white text-decoration-none d-flex align-items-center gap-2 p-1"
          onClick={() => setOpen((o) => !o)}
          title="Account & profile"
          aria-label="Account menu"
        >
          <span className="position-relative d-inline-flex">
            <span
              className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white"
              style={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #2dd4bf, #0f9488)',
                border: '2px solid rgba(255,255,255,0.55)',
                fontSize: '0.9rem',
              }}
            >
              {initials(user?.name)}
            </span>
            <span
              className="position-absolute rounded-circle bg-success border border-white"
              style={{ width: 10, height: 10, bottom: 0, right: 0 }}
              title="Online"
            />
          </span>
          <ChevronDown size={15} className="opacity-75" />
        </button>

        {open && (
          <div
            className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border overflow-hidden"
            style={{ width: 280, zIndex: 1050 }}
          >
            {/* Identity card */}
            <div
              className="px-3 py-3 text-white"
              style={{ background: 'linear-gradient(135deg, #134e4a, #0f9488)' }}
            >
              <div className="d-flex align-items-center gap-2">
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold bg-white"
                  style={{ width: 40, height: 40, color: '#0f766e', fontSize: '0.95rem', flexShrink: 0 }}
                >
                  {initials(user?.name)}
                </span>
                <div className="min-w-0">
                  <div className="fw-semibold text-truncate">{user?.name}</div>
                  <div className="small opacity-75 text-truncate">{user?.email}</div>
                </div>
              </div>
              <div className="mt-2 d-flex flex-wrap gap-1">
                <span className="badge rounded-pill text-bg-light text-dark">{roleLabel(user?.role)}</span>
                {user?.designation && <span className="badge rounded-pill border border-light-subtle">{user.designation}</span>}
                {user?.department && <span className="badge rounded-pill border border-light-subtle">{user.department}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="py-1">
              <MenuButton icon={UserRound} label="My Profile" onClick={() => { setOpen(false); setShowProfile(true); }} />
              <MenuButton icon={LayoutDashboard} label="My dashboard" onClick={() => go(`/${user.role}/dashboard`)} />
              {quickLinks.map((l) => (
                <MenuButton key={l.label} icon={l.icon} label={l.label} onClick={() => go(l.to)} />
              ))}
              <MenuButton icon={HelpCircle} label="Help & Support" onClick={() => { setOpen(false); setShowHelp(true); }} />
            </div>

            <div className="border-top py-1">
              <MenuButton icon={LogOut} label="Logout" danger onClick={handleLogout} />
            </div>
          </div>
        )}
      </div>

      {showProfile && (
        <ProfileModal user={user} policy={policy} onClose={() => setShowProfile(false)} />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      className={`d-flex align-items-center gap-2 w-100 text-start px-3 py-2 border-0 bg-transparent small ${
        danger ? 'text-danger' : 'text-dark'
      }`}
      onClick={onClick}
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={16} className={danger ? 'text-danger' : 'text-secondary'} />
      {label}
    </button>
  );
}

function ProfileModal({ user, policy, onClose }) {
  const policyRows = policy
    ? [
        { icon: Plane, label: 'Allowed flight classes', value: (policy.allowedFlightClasses || []).join(', ') },
        { icon: Star, label: 'Max hotel category', value: `${policy.maximumHotelStars}-star` },
        { icon: Wallet, label: 'Flight budget', value: `${inr(policy.flightBudget)} / passenger` },
        { icon: Hotel, label: 'Hotel budget', value: `${inr(policy.hotelBudgetPerNight)} / night` },
      ]
    : [];

  return (
    <ModalShell title="My Profile" onClose={onClose}>
      <div className="d-flex align-items-center gap-3">
        <span
          className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
          style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #134e4a, #0f9488)', fontSize: '1.2rem' }}
        >
          {initials(user?.name)}
        </span>
        <div>
          <div className="fs-5 fw-semibold">{user?.name}</div>
          <div className="text-muted small">{user?.email}</div>
          <div className="mt-1 d-flex flex-wrap gap-1">
            <span className="badge text-bg-success text-capitalize">{roleLabel(user?.role)}</span>
            {user?.designation && <span className="badge text-bg-light border text-dark">{user.designation}</span>}
          </div>
        </div>
      </div>

      <hr />

      <div className="small text-muted text-uppercase fw-semibold mb-2">Account details</div>
      <div className="row g-2 small">
        <div className="col-sm-6">
          <div className="text-muted">Department</div>
          <div className="fw-semibold">{user?.department || '—'}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted">Member since</div>
          <div className="fw-semibold d-flex align-items-center gap-1">
            <Calendar size={13} className="text-secondary" /> {formatDate(user?.createdAt)}
          </div>
        </div>
      </div>

      {policy && (
        <>
          <hr />
          <div className="small text-muted text-uppercase fw-semibold mb-2 d-flex align-items-center gap-1">
            <ShieldCheck size={14} className="text-success" /> My travel policy
          </div>
          <div className="d-flex flex-column gap-2">
            {policyRows.map((r) => (
              <div key={r.label} className="d-flex align-items-center gap-2 bg-light rounded-2 px-3 py-2">
                <r.icon size={15} className="text-brand-500 flex-shrink-0" />
                <div className="flex-grow-1 small text-muted">{r.label}</div>
                <div className="small fw-semibold text-end">{r.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="d-flex justify-content-end mt-4">
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function HelpModal({ onClose }) {
  return (
    <ModalShell title="Help & Support" onClose={onClose}>
      <p className="small text-muted">
        Need a hand? Here's how the corporate travel flow works, plus demo logins so you can try every role.
      </p>

      <ol className="small mb-3">
        <li><strong>Employee</strong> searches flights &amp; hotels, and submits a policy-checked travel request.</li>
        <li><strong>Manager</strong> reviews and approves or rejects the request (a reason is required for rejection).</li>
        <li><strong>Travel Administrator</strong> confirms the final booking — this generates the PNR and ticket.</li>
        <li><strong>Employee</strong> views the final ticket under <em>My Trips</em>.</li>
      </ol>

      <div className="small text-muted text-uppercase fw-semibold mb-2">Demo accounts</div>
      <div className="d-flex flex-column gap-2">
        <div className="bg-light rounded-2 px-3 py-2 small">
          <div className="fw-semibold">Employee</div>
          <div className="text-muted">employee@travelcorp.com · Employee@123</div>
        </div>
        <div className="bg-light rounded-2 px-3 py-2 small">
          <div className="fw-semibold">Manager</div>
          <div className="text-muted">manager@travelcorp.com · Manager@123</div>
        </div>
        <div className="bg-light rounded-2 px-3 py-2 small">
          <div className="fw-semibold">Travel Administrator</div>
          <div className="text-muted">admin@travelcorp.com · Admin@123</div>
        </div>
      </div>

      <div className="d-flex justify-content-end mt-4">
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(15, 23, 42, 0.55)', zIndex: 2000 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4 shadow-lg p-4"
        style={{ width: 'min(480px, 92vw)', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="mb-0 fw-bold">{title}</h5>
          <button className="btn btn-sm btn-outline-secondary border-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
