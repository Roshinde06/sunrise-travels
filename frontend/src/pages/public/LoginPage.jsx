import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, LogIn, ShieldCheck, ClipboardCheck, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/format';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1600&auto=format&fit=crop';

const DEMO_ACCOUNTS = [
  { label: 'Employee', email: 'employee@travelcorp.com', password: 'Employee@123', desc: 'Rahul Sharma · Junior Executive' },
  { label: 'Manager', email: 'manager@travelcorp.com', password: 'Manager@123', desc: 'Priya Mehta · Travel Approver' },
  { label: 'Admin', email: 'admin@travelcorp.com', password: 'Admin@123', desc: 'Amit Patil · Travel Administrator' },
];

const HIGHLIGHTS = [
  { icon: <ShieldCheck size={17} />, text: 'Automatic corporate policy validation' },
  { icon: <ClipboardCheck size={17} />, text: 'Manager approval workflow' },
  { icon: <Ticket size={17} />, text: 'Final ticketing with PNR generation' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(user.role === 'employee' ? '/employee/dashboard' : `/${user.role}/dashboard`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex">
      {/* Left: travel imagery */}
      <div
        className="d-none d-lg-flex flex-column justify-content-between text-white p-5"
        style={{
          flex: '1 1 55%',
          backgroundImage: `linear-gradient(135deg, rgba(19,78,74,0.93), rgba(15,148,136,0.72)), url('${HERO_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="d-flex align-items-center gap-2 fs-4 fw-bold">
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center"
            style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}
          >
            <Plane size={22} />
          </span>
          Sunrise Travel
        </div>
        <div>
          <h1 className="display-6 fw-bold mb-3">Project Sunrise</h1>
          <p className="lead mb-4" style={{ maxWidth: 460 }}>
            The corporate travel booking platform — search, validate, approve and ticket every business trip in one
            controlled workflow.
          </p>
          <ul className="list-unstyled d-flex flex-column gap-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="d-flex align-items-center gap-2">
                <span className="d-inline-flex align-items-center justify-content-center rounded-circle" style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.15)' }}>
                  {h.icon}
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="small opacity-75">
          Employees · Managers · Travel Administrators — one journey, fully controlled.
        </div>
      </div>

      {/* Right: login card */}
      <div className="d-flex align-items-center justify-content-center flex-grow-1 bg-light p-3">
        <div className="card border-0 shadow-lg w-100" style={{ maxWidth: 430 }}>
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="d-lg-none d-inline-flex align-items-center gap-2 text-primary mb-2">
                <Plane size={28} />
              </div>
              <h5 className="fw-bold mb-1">Welcome back</h5>
              <div className="text-muted small">Sign in to the corporate travel platform</div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" disabled={submitting}>
                {submitting ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <>
                    <LogIn size={18} /> Sign in
                  </>
                )}
              </button>
            </form>

            <hr className="my-4" />
            <div className="text-muted small mb-2">Demo accounts (for local development):</div>
            <div className="d-grid gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="btn btn-outline-primary text-start d-flex justify-content-between align-items-center"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                >
                  <span>
                    <span className="fw-semibold">{acc.label}</span>
                    <span className="d-block small text-muted">{acc.desc}</span>
                  </span>
                  <span className="small text-muted">{acc.email}</span>
                </button>
              ))}
            </div>

            <div className="text-center mt-4">
              <Link to="/" className="small text-decoration-none">← Back to home</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
