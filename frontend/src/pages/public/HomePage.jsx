import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  ShieldCheck,
  ClipboardCheck,
  Ticket,
  ArrowRight,
  Search,
  UserCheck,
  MapPin,
  Building2,
  Briefcase,
  Settings2,
  Users,
  Wallet,
  FileText,
  Clock,
  CheckCircle2,
  Ban,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LandingNavbar from '../../components/LandingNavbar';
import AppFooter from '../../components/AppFooter';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2000&auto=format&fit=crop';

const FEATURES = [
  { icon: <Briefcase size={22} />, title: 'Easy Travel Booking', text: 'Employees can submit business travel requirements easily, with flights and hotels in one request.' },
  { icon: <ClipboardCheck size={22} />, title: 'Manager Approval', text: 'Managers review employee travel requests before booking — approve or reject with a clear reason.' },
  { icon: <Building2 size={22} />, title: 'Centralized Booking', text: 'Admins manage approved travel from one place, complete final bookings and generate tickets.' },
  { icon: <ShieldCheck size={22} />, title: 'Corporate Policies', text: 'Keep employee travel aligned with company policies through automatic designation-based validation.' },
  { icon: <Wallet size={22} />, title: 'Expense Tracking', text: 'Track estimated and final travel expenses with live spend dashboards and city-level analytics.' },
  { icon: <Ticket size={22} />, title: 'Digital Tickets', text: 'Employees receive final confirmed tickets digitally, with PNR and booking reference in one place.' },
];

const STEPS = [
  { icon: <Search size={20} />, title: 'Search & validate', text: 'Pick a flight and hotel — the policy engine checks them against your entitlements instantly.' },
  { icon: <UserCheck size={20} />, title: 'Manager approves', text: 'Your request reaches your manager for a quick approve or reject with a clear reason.' },
  { icon: <Ticket size={20} />, title: 'Get ticketed', text: 'The travel administrator confirms the booking, and your final ticket with PNR is generated.' },
];

const LIFECYCLE = [
  { label: 'Draft', color: '#64748b', icon: <FileText size={16} /> },
  { label: 'Pending', color: '#d97706', icon: <Clock size={16} /> },
  { label: 'Approved', color: '#0f9488', icon: <CheckCircle2 size={16} /> },
  { label: 'Ready for Ticketing', color: '#0ea5e9', icon: <Plane size={16} /> },
  { label: 'Ticketed', color: '#16a34a', icon: <Ticket size={16} /> },
  { label: 'Cancelled', color: '#475569', icon: <Ban size={16} /> },
];

const ROLES = [
  {
    icon: <Briefcase size={20} />,
    name: 'Employee',
    blurb: 'Search flights & hotels, submit policy-checked travel requests, track status and download your final ticket.',
    points: ['Policy-checked search', 'Submit travel request', 'My trips & tickets'],
  },
  {
    icon: <UserCheck size={20} />,
    name: 'Manager',
    blurb: 'Review pending employee requests, validate policy results and approve or reject with a reason.',
    points: ['Pending approval queue', 'Policy validation view', 'Approval history'],
  },
  {
    icon: <Settings2 size={20} />,
    name: 'Travel Administrator',
    blurb: 'Complete the final booking, generate PNRs, manage policies and employees, and watch travel spend.',
    points: ['Ticketing queue', 'PNR generation', 'Spend & analytics'],
  },
];

const DESTINATIONS = [
  { city: 'Mumbai', code: 'BOM', image: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?q=80&w=800&auto=format&fit=crop', tag: 'Financial capital' },
  { city: 'Delhi', code: 'DEL', image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=800&auto=format&fit=crop', tag: 'Capital city' },
  { city: 'Bangalore', code: 'BLR', image: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?q=80&w=800&auto=format&fit=crop', tag: 'Tech hub' },
  { city: 'Goa', code: 'GOI', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=800&auto=format&fit=crop', tag: 'Business retreats' },
];

const STATS = [
  { value: '4,000+', label: 'Flights across 10 cities' },
  { value: '140+', label: 'Hand-picked hotels' },
  { value: '3', label: 'Workflow roles' },
  { value: '24/7', label: 'Request tracking' },
];

export default function HomePage() {
  const { user } = useAuth();
  const dashboard = user ? `/${user.role}/dashboard` : '/login';

  return (
    <div id="home">
      <LandingNavbar />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="text-white position-relative"
        style={{
          backgroundImage: `linear-gradient(100deg, rgba(15,23,42,0.88) 0%, rgba(19,78,74,0.82) 45%, rgba(15,148,136,0.45) 100%), url('${HERO_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container py-5" style={{ paddingTop: '5.5rem', paddingBottom: '5.5rem' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="badge rounded-pill px-3 py-2 mb-3 d-inline-flex align-items-center gap-2" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.35)' }}>
                <Plane size={14} /> Corporate Travel Booking Platform
              </span>
              <h1 className="display-5 fw-bold mb-3 lh-sm">
                Business travel,<br />
                <span style={{ color: '#5eead4' }}>planned &amp; approved</span> in one place.
              </h1>
              <p className="lead mb-4 opacity-90" style={{ maxWidth: 560 }}>
                Search flights and hotels, get automatic policy validation, submit requests, and follow every
                booking from <strong>pending → approved → ticketed</strong> — with role-based access for
                employees, managers and the travel administrator.
              </p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {user ? (
                  <Link to={dashboard} className="btn btn-light btn-lg fw-semibold">
                    Go to my dashboard <ArrowRight size={18} />
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-light btn-lg fw-semibold">
                      Sign in <ArrowRight size={18} />
                    </Link>
                    <a href="#features" className="btn btn-outline-light btn-lg">
                      Explore features
                    </a>
                  </>
                )}
              </div>
              {!user && (
                <div className="small opacity-80 d-flex flex-wrap gap-2 align-items-center">
                  <span className="d-inline-flex align-items-center gap-1"><Users size={14} /> Try any role:</span>
                  {['employee', 'manager', 'admin'].map((r) => (
                    <Link key={r} to="/login" className="text-white text-decoration-none border border-light-subtle rounded-pill px-3 py-1">
                      {r}@travelcorp.com
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Floating mini status card */}
            <div className="col-lg-5 d-none d-lg-block">
              <div className="bg-white text-dark rounded-4 shadow-lg p-4 ms-auto" style={{ maxWidth: 380 }}>
                <div className="small text-muted text-uppercase fw-semibold mb-3">Live booking status</div>
                <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3">
                  <div>
                    <div className="fw-bold">TRV-10001 · Mumbai → Delhi</div>
                    <div className="small text-muted">6E-201 · 20 Aug · Economy</div>
                  </div>
                  <span className="badge text-bg-warning">Pending</span>
                </div>
                <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3">
                  <div>
                    <div className="fw-bold">TRV-10002 · Delhi → Bangalore</div>
                    <div className="small text-muted">AI-462 · 22 Aug · Premium Economy</div>
                  </div>
                  <span className="badge text-bg-success">Ticketed</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="fw-bold">TRV-10003 · Mumbai → Goa</div>
                    <div className="small text-muted">6E-511 · 25 Aug · Economy</div>
                  </div>
                  <span className="badge text-bg-info">Approved</span>
                </div>
                <div className="mt-3 small text-muted">
                  Policy: <span className="fw-semibold text-success">Passed</span> · PNR: <span className="fw-semibold">A7K9PL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────── */}
      <section className="bg-white border-bottom">
        <div className="container">
          <div className="row text-center py-4 g-3">
            {STATS.map((s) => (
              <div className="col-6 col-md-3" key={s.label}>
                <div className="display-6 fw-bold text-brand-500">{s.value}</div>
                <div className="text-muted small">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (6 cards) ───────────────────────────── */}
      <section id="features" className="container py-5">
        <div className="text-center mb-4">
          <span className="badge text-bg-light border text-brand-500 fw-semibold mb-2">Why TravelCorp</span>
          <h2 className="fw-bold mb-1">Everything your company needs for travel</h2>
          <p className="text-muted">Six capabilities that take business travel from request to confirmed ticket.</p>
        </div>
        <div className="row g-4">
          {FEATURES.map((f) => (
            <div className="col-md-6 col-lg-4" key={f.title}>
              <div className="stat-card h-100 p-4 bg-white d-flex gap-3">
                <span
                  className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{ width: 46, height: 46, background: 'linear-gradient(135deg, #134e4a, #0f9488)' }}
                >
                  {f.icon}
                </span>
                <div>
                  <div className="fw-semibold mb-1">{f.title}</div>
                  <div className="text-secondary small">{f.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Booking lifecycle (stepper) ──────────────────── */}
      <section className="py-5" style={{ background: '#eef6f5' }}>
        <div className="container">
          <div className="rounded-4 p-4 p-md-5 text-white" style={{ background: 'linear-gradient(135deg, #134e4a 0%, #0f9488 100%)' }}>
            <div className="text-center mb-4">
              <h2 className="fw-bold mb-1">The booking lifecycle</h2>
              <p className="mb-0 opacity-75">Every request moves through these controlled states — never skipped, always audited.</p>
            </div>
            <div className="d-flex flex-wrap justify-content-center align-items-start gap-2 gap-md-3">
              {LIFECYCLE.map((s, i) => (
                <Fragment key={s.label}>
                  <div className="d-flex flex-column align-items-center text-center" style={{ width: 118 }}>
                    <span
                      className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-2"
                      style={{ width: 44, height: 44, background: s.color, boxShadow: '0 4px 10px rgba(0,0,0,0.25)' }}
                    >
                      {s.icon}
                    </span>
                    <span className="small fw-semibold lh-sm" style={{ fontSize: '0.72rem' }}>{s.label}</span>
                    {i === LIFECYCLE.length - 1 && (
                      <span className="badge rounded-pill mt-1" style={{ background: 'rgba(255,255,255,0.18)', fontSize: '0.6rem' }}>
                        <Check size={10} className="me-1" />Final state
                      </span>
                    )}
                  </div>
                  {i < LIFECYCLE.length - 1 && (
                    <ArrowRight size={20} className="mt-3 text-white opacity-60 d-none d-md-block" />
                  )}
                  {i < LIFECYCLE.length - 1 && (
                    <ArrowRight size={16} className="text-white opacity-60 d-md-none mt-2" style={{ transform: 'rotate(90deg)' }} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="container py-5">
        <div className="text-center mb-4">
          <h2 className="fw-bold mb-1">How it works</h2>
          <p className="text-muted">Three steps between “I need to travel” and a confirmed ticket.</p>
        </div>
        <div className="row g-4">
          {STEPS.map((s, i) => (
            <div className="col-md-4" key={s.title}>
              <div className="stat-card h-100 p-4 bg-white position-relative">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <span className="rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0" style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #134e4a, #0f9488)' }}>
                    {s.icon}
                  </span>
                  <span className="display-6 fw-bold text-muted opacity-25">{i + 1}</span>
                </div>
                <div className="fw-semibold mb-1">{s.title}</div>
                <div className="text-secondary small">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────── */}
      <section className="py-5" style={{ background: '#eef6f5' }}>
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-1">Built for every role in the travel workflow</h2>
            <p className="text-muted">Role-based access keeps each step controlled and audited.</p>
          </div>
          <div className="row g-4">
            {ROLES.map((r) => (
              <div className="col-md-4" key={r.name}>
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-body p-4">
                    <span className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-3" style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #134e4a, #0f9488)' }}>
                      {r.icon}
                    </span>
                    <h5 className="fw-bold mb-2">{r.name}</h5>
                    <p className="text-secondary small mb-3">{r.blurb}</p>
                    <ul className="list-unstyled small mb-0">
                      {r.points.map((p) => (
                        <li key={p} className="d-flex align-items-center gap-2 mb-1">
                          <ShieldCheck size={14} className="text-success flex-shrink-0" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────── */}
      <section id="about" className="container py-5">
        <div className="row g-4 align-items-center">
          <div className="col-lg-6">
            <div className="rounded-4 overflow-hidden shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1200&auto=format&fit=crop"
                alt="TravelCorp team planning corporate travel"
                className="w-100"
                style={{ objectFit: 'cover', maxHeight: 380 }}
                loading="lazy"
              />
            </div>
          </div>
          <div className="col-lg-6">
            <span className="badge text-bg-light border text-brand-500 fw-semibold mb-2">About TravelCorp</span>
            <h2 className="fw-bold mb-3">Corporate travel, run like a business process</h2>
            <p className="text-secondary">
              TravelCorp is a corporate travel booking platform that treats travel as a governed business workflow —
              not a free-for-all. Every request is checked against company policy, approved by the right person,
              and booked centrally, so travel spend stays under control and employees always know where their trip stands.
            </p>
            <div className="row g-3 mt-1">
              <div className="col-sm-6">
                <div className="d-flex gap-2">
                  <Check size={18} className="text-success flex-shrink-0 mt-1" />
                  <div>
                    <div className="fw-semibold small">Policy-first</div>
                    <div className="text-secondary small">Entitlements matched to designation and salary band.</div>
                  </div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="d-flex gap-2">
                  <Check size={18} className="text-success flex-shrink-0 mt-1" />
                  <div>
                    <div className="fw-semibold small">Fully audited</div>
                    <div className="text-secondary small">Every status change logged for complete transparency.</div>
                  </div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="d-flex gap-2">
                  <Check size={18} className="text-success flex-shrink-0 mt-1" />
                  <div>
                    <div className="fw-semibold small">Role-based access</div>
                    <div className="text-secondary small">Employees, managers and admins each see only what they need.</div>
                  </div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="d-flex gap-2">
                  <Check size={18} className="text-success flex-shrink-0 mt-1" />
                  <div>
                    <div className="fw-semibold small">Ready to scale</div>
                    <div className="text-secondary small">Mock providers can be swapped for live travel APIs later.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured destinations ────────────────────────── */}
      <section className="py-5" style={{ background: '#eef6f5' }}>
        <div className="container">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-4">
            <div>
              <h2 className="fw-bold mb-1">Popular business destinations</h2>
              <p className="text-muted mb-0">Flights and hotels ready for the routes your team travels most.</p>
            </div>
            <Link to="/login" className="btn btn-outline-primary btn-sm">
              Explore all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="row g-4">
            {DESTINATIONS.map((d) => (
              <div className="col-sm-6 col-lg-3" key={d.city}>
                <Link to="/login" className="text-decoration-none">
                  <div className="rounded-4 overflow-hidden shadow-sm position-relative" style={{ height: 220 }}>
                    <img src={d.image} alt={d.city} className="w-100 h-100" style={{ objectFit: 'cover' }} loading="lazy" />
                    <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(15,23,42,0.75))' }} />
                    <span className="position-absolute badge rounded-pill" style={{ top: 12, left: 12, background: 'rgba(255,255,255,0.85)', color: '#134e4a' }}>
                      <Building2 size={12} className="me-1" />{d.code}
                    </span>
                    <div className="position-absolute bottom-0 start-0 p-3 text-white">
                      <div className="fw-bold fs-5 d-flex align-items-center gap-1">
                        <MapPin size={16} /> {d.city}
                      </div>
                      <div className="small opacity-80">{d.tag}</div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="py-5">
        <div className="container">
          <div className="bg-brand-gradient text-white rounded-4 p-4 p-md-5 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h3 className="fw-bold mb-1">Ready to plan your next business trip?</h3>
              <p className="mb-0 opacity-75">
                {user
                  ? 'Continue to your dashboard to search flights, track requests and view your tickets.'
                  : 'Sign in as an employee, manager or travel administrator to explore the platform.'}
              </p>
            </div>
            <Link to={dashboard} className="btn btn-light btn-lg fw-semibold">
              {user ? 'Go to dashboard' : 'Sign in'} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
