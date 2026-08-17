import { Link } from 'react-router-dom';
import { Plane, Mail, Phone, MapPin, ArrowUp, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EXPLORE = [
  { label: 'Search Flights', to: '/employee/flights' },
  { label: 'Search Hotels', to: '/employee/hotels' },
  { label: 'My Trips & Tickets', to: '/employee/my-trips' },
  { label: 'Manager Approvals', to: '/manager/approvals' },
  { label: 'Ticketing Queue', to: '/admin/ticketing' },
  { label: 'Travel Spend & Analytics', to: '/admin/analytics' },
];

const DEMO_ACCOUNTS = [
  { label: 'Employee', email: 'employee@travelcorp.com' },
  { label: 'Manager', email: 'manager@travelcorp.com' },
  { label: 'Admin', email: 'admin@travelcorp.com' },
];

export default function AppFooter() {
  const { user } = useAuth();
  const dashboardTo = user ? `/${user.role}/dashboard` : '/login';

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="text-white" style={{ background: 'linear-gradient(180deg, #0f1f1e 0%, #134e4a 160%)' }}>
      {/* Main columns */}
      <div className="container-fluid px-4 pt-5 pb-4">
        <div className="row g-4">
          {/* Brand */}
          <div className="col-lg-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span
                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                <Plane size={20} />
              </span>
              <span className="fw-bold fs-5">Sunrise Travel</span>
            </div>
            <p className="text-white-50 small mb-3" style={{ maxWidth: 360 }}>
              Project Sunrise — a corporate travel booking platform. Search flights and hotels, get automatic policy
              validation, request manager approval, and receive your final ticketed itinerary — all in one controlled
              workflow.
            </p>
            <div className="small text-white-50">
              <div className="d-flex align-items-center gap-2 mb-1">
                <Mail size={14} /> support@travelcorp.com
              </div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <Phone size={14} /> +91 22 4000 0000
              </div>
              <div className="d-flex align-items-center gap-2">
                <MapPin size={14} /> Bandra Kurla Complex, Mumbai, India
              </div>
            </div>
          </div>

          {/* Explore */}
          <div className="col-6 col-lg-2">
            <div className="text-uppercase small fw-semibold mb-3" style={{ letterSpacing: '0.06em', color: '#5eead4' }}>
              Explore
            </div>
            <ul className="list-unstyled d-flex flex-column gap-2 small">
              {EXPLORE.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-white-50 text-decoration-none hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="col-6 col-lg-2">
            <div className="text-uppercase small fw-semibold mb-3" style={{ letterSpacing: '0.06em', color: '#5eead4' }}>
              Company
            </div>
            <ul className="list-unstyled d-flex flex-column gap-2 small">
              <li><Link to="/" className="text-white-50 text-decoration-none hover:text-white">Home</Link></li>
              <li><Link to="/login" className="text-white-50 text-decoration-none hover:text-white">Sign in</Link></li>
              <li><Link to={dashboardTo} className="text-white-50 text-decoration-none hover:text-white">My dashboard</Link></li>
              <li><Link to="/employee/flights" className="text-white-50 text-decoration-none hover:text-white">Plan a trip</Link></li>
            </ul>
            <div className="small text-white-50 mt-3 d-flex align-items-center gap-2">
              <Clock size={14} /> Support: Mon–Sat, 9am–7pm
            </div>
          </div>

          {/* Demo accounts */}
          <div className="col-lg-4">
            <div className="text-uppercase small fw-semibold mb-3" style={{ letterSpacing: '0.06em', color: '#5eead4' }}>
              Demo accounts
            </div>
            <p className="small text-white-50 mb-2">Use these demo credentials to explore each role (local development only):</p>
            <div className="d-flex flex-column gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <div key={acc.email} className="rounded-3 px-3 py-2 d-flex justify-content-between align-items-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="small fw-semibold">{acc.label}</span>
                  <code className="small text-white-50">{acc.email}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-top border-white-10" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="container-fluid px-4 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="small text-white-50">
            © 2026 Project Sunrise · Corporate Travel Booking Platform · Demo application with simulated booking services
          </div>
          <button
            className="btn btn-sm d-inline-flex align-items-center gap-1 text-white"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={scrollTop}
            title="Back to top"
          >
            <ArrowUp size={15} /> Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
