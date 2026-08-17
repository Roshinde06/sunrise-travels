import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Plane,
  Menu,
  LayoutDashboard,
  Search,
  Hotel,
  Luggage,
  ClipboardCheck,
  Ticket,
  Briefcase,
  Wallet,
  BarChart3,
  Users,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import FavoritesMenu from './FavoritesMenu';
import AccountMenu from './AccountMenu';
import AppFooter from './AppFooter';
import Sidebar from './Sidebar';
import TravelAssistant from './TravelAssistant';

const NAV = {
  employee: [
    { to: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/employee/flights', label: 'Search Flights', icon: Search },
    { to: '/employee/hotels', label: 'Search Hotels', icon: Hotel },
    { to: '/employee/my-trips', label: 'My Trips', icon: Luggage },
  ],
  manager: [
    { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/manager/approvals', label: 'Approvals', icon: ClipboardCheck },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/ticketing', label: 'Ticketing', icon: Ticket },
    { to: '/admin/bookings', label: 'Bookings', icon: Briefcase },
    { to: '/admin/travel-spend', label: 'Travel Spend', icon: Wallet },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/employees', label: 'Employees', icon: Users },
    { to: '/admin/policies', label: 'Policies', icon: ShieldCheck },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: Activity },
  ],
};

export default function AppLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = NAV[user?.role] || [];
  const location = useLocation();

  return (
    <div className="d-flex min-vh-100">
      {/* Left sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} nav={nav} />

      {/* Right column: top navbar + content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <nav className="navbar navbar-dark bg-brand-gradient shadow-sm sticky-top" style={{ zIndex: 1030 }}>
          <div className="container-fluid px-3 px-md-4">
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-light d-lg-none p-1 d-inline-flex align-items-center justify-content-center"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                title="Menu"
              >
                <Menu size={20} />
              </button>
              <NavLink className="navbar-brand d-flex align-items-center gap-2 mb-0" to={`/${user.role}/dashboard`}>
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center text-white"
                  style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}
                >
                  <Plane size={19} />
                </span>
                <span className="fw-bold d-none d-sm-inline">Sunrise Travel</span>
                <span className="badge rounded-pill text-bg-light opacity-75 d-none d-md-inline" style={{ fontSize: '0.65rem' }}>
                  Corporate Booking
                </span>
              </NavLink>
            </div>

            <div className="d-flex align-items-center gap-3">
              <FavoritesMenu />
              <NotificationBell />
              <div className="vr opacity-25 d-none d-md-block" style={{ height: 26 }} />
              <div className="text-white text-end d-none d-md-block me-1">
                <div className="fw-semibold lh-sm" style={{ fontSize: '0.85rem' }}>{user?.name}</div>
                <div className="opacity-75 text-capitalize lh-sm" style={{ fontSize: '0.72rem' }}>{user?.role} · {user?.designation || '—'}</div>
              </div>
              <AccountMenu />
            </div>
          </div>
        </nav>

        <main className="flex-grow-1 px-3 px-md-4 py-4">
          {/* Subtle fade-in on route change (150–250ms, no slow transitions) */}
          <div key={location.pathname} className="page-fade">
            <Outlet />
          </div>
        </main>

        <AppFooter />

        {/* Role-based Corporate Travel Assistant */}
        <TravelAssistant />
      </div>
    </div>
  );
}
