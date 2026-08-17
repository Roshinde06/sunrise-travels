import { Link } from 'react-router-dom';
import { Plane, LogIn, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'About', href: '#about' },
];

export default function LandingNavbar() {
  const { user } = useAuth();
  const dashboard = user ? `/${user.role}/dashboard` : '/login';

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-brand-gradient shadow-sm sticky-top" style={{ zIndex: 1030 }}>
      <div className="container">
        <a className="navbar-brand d-flex align-items-center gap-2" href="#home">
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center text-white"
            style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}
          >
            <Plane size={20} />
          </span>
          <span className="fw-bold fs-5">TravelCorp</span>
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#landingNav"
          aria-controls="landingNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="landingNav">
          <ul className="navbar-nav mx-auto mb-2 mb-lg-0">
            {LINKS.map((l) => (
              <li className="nav-item" key={l.label}>
                <a className="nav-link" href={l.href}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="d-flex align-items-center gap-2">
            {user ? (
              <>
                <span className="text-white small d-none d-md-inline opacity-75">
                  {user.name}
                </span>
                <Link to={dashboard} className="btn btn-light btn-sm fw-semibold d-inline-flex align-items-center gap-2">
                  <LayoutDashboard size={16} /> Dashboard
                </Link>
              </>
            ) : (
              <Link to="/login" className="btn btn-light btn-sm fw-semibold d-inline-flex align-items-center gap-2">
                <LogIn size={16} /> Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
