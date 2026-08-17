import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { ProtectedRoute, RoleRoute } from './components/RouteGuards';
import { useAuth } from './context/AuthContext';

// Public
import LoginPage from './pages/public/LoginPage';
import HomePage from './pages/public/HomePage';
import NotFoundPage from './pages/public/NotFoundPage';

// Employee
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import FlightSearch from './pages/employee/FlightSearch';
import HotelSearch from './pages/employee/HotelSearch';
import TravelRequestReview from './pages/employee/TravelRequestReview';
import MyTrips from './pages/employee/MyTrips';
import TicketPage from './pages/employee/TicketPage';

// Manager
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ApprovalsList from './pages/manager/ApprovalsList';
import ApprovalDetail from './pages/manager/ApprovalDetail';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookings from './pages/admin/AdminBookings';
import AdminTicketing from './pages/admin/AdminTicketing';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminPolicies from './pages/admin/AdminPolicies';
import TravelSpend from './pages/admin/TravelSpend';
import Analytics from './pages/admin/Analytics';
import AuditLogs from './pages/admin/AuditLogs';

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<RoleHome />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Employee */}
        <Route path="/employee/dashboard" element={<RoleRoute roles={['employee']}><EmployeeDashboard /></RoleRoute>} />
        <Route path="/employee/flights" element={<RoleRoute roles={['employee']}><FlightSearch /></RoleRoute>} />
        <Route path="/employee/hotels" element={<RoleRoute roles={['employee']}><HotelSearch /></RoleRoute>} />
        <Route path="/employee/travel-request" element={<RoleRoute roles={['employee']}><TravelRequestReview /></RoleRoute>} />
        <Route path="/employee/my-trips" element={<RoleRoute roles={['employee']}><MyTrips /></RoleRoute>} />
        <Route path="/employee/ticket/:id" element={<RoleRoute roles={['employee', 'manager', 'admin']}><TicketPage /></RoleRoute>} />

        {/* Manager */}
        <Route path="/manager/dashboard" element={<RoleRoute roles={['manager']}><ManagerDashboard /></RoleRoute>} />
        <Route path="/manager/approvals" element={<RoleRoute roles={['manager']}><ApprovalsList /></RoleRoute>} />
        <Route path="/manager/approval/:id" element={<RoleRoute roles={['manager']}><ApprovalDetail /></RoleRoute>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />
        <Route path="/admin/bookings" element={<RoleRoute roles={['admin']}><AdminBookings /></RoleRoute>} />
        <Route path="/admin/ticketing" element={<RoleRoute roles={['admin']}><AdminTicketing /></RoleRoute>} />
        <Route path="/admin/employees" element={<RoleRoute roles={['admin']}><AdminEmployees /></RoleRoute>} />
        <Route path="/admin/policies" element={<RoleRoute roles={['admin']}><AdminPolicies /></RoleRoute>} />
        <Route path="/admin/travel-spend" element={<RoleRoute roles={['admin']}><TravelSpend /></RoleRoute>} />
        <Route path="/admin/analytics" element={<RoleRoute roles={['admin']}><Analytics /></RoleRoute>} />
        <Route path="/admin/audit-logs" element={<RoleRoute roles={['admin']}><AuditLogs /></RoleRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
