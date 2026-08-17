import { Link, NavLink } from 'react-router-dom';
import { Plane, X, Home, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ open, onClose, nav }) {
  const { user } = useAuth();
  const roleLabel = ({ employee: 'Employee', manager: 'Manager', admin: 'Travel Administrator' }[user?.role] || '');

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-lg-none"
          style={{ background: 'rgba(15, 23, 42, 0.5)', zIndex: 1040 }}
          onClick={onClose}
        />
      )}

      <aside className={`sidebar text-white ${open ? 'open' : ''}`} style={{ background: 'linear-gradient(180deg, #0f172a 0%, #134e4a 100%)' }}>
        {/* Brand */}
        <div className="d-flex align-items-center justify-content-between px-3 py-3 border-bottom">
          <Link to={`/${user?.role}/dashboard`} className="text-white text-decoration-none d-flex align-items-center gap-2">
            <span
              className="rounded-circle d-inline-flex align-items-center justify-content-center text-white"
              style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <Plane size={18} />
            </span>
            <div>
              <div className="fw-bold lh-sm">Sunrise Travel</div>
              <div className="small opacity-60 lh-sm" style={{ fontSize: '0.68rem' }}>Corporate Booking</div>
            </div>
          </Link>
          <button className="btn btn-sm text-white p-1 d-lg-none" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Section label */}
        <div className="px-3 pt-3 pb-1 small text-uppercase" style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
          {roleLabel || 'Menu'}
        </div>

        {/* Nav */}
        <nav className="flex-grow-1 px-2 py-1 d-flex flex-column gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer links */}
        <div className="px-3 py-3 border-top d-flex flex-column gap-2">
          <Link to="/" className="text-white-50 text-decoration-none small d-flex align-items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Home size={15} /> Back to website
          </Link>
          <div className="small d-flex align-items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <ShieldCheck size={15} /> Role: <span className="text-capitalize fw-semibold" style={{ color: '#5eead4' }}>{user?.role}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
