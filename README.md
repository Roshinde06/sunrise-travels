# Project Sunrise — Corporate Travel Booking Platform

A full-stack corporate travel booking system with role-based access (employee / manager / admin), an automated corporate travel policy engine, a manager approval workflow, and a simulated final ticketing service.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, JavaScript, Vite, Tailwind CSS (utilities), Bootstrap 5 (components), React Router DOM, Axios, Lucide React |
| Backend  | Node.js, Express, Mongoose, JWT, bcryptjs, dotenv, cors, helmet, express-validator |
| Database | MongoDB Atlas (connection string in `backend/.env`) |

## Project structure

```
├── backend/   Express REST API (models, services, controllers, routes, seed)
└── frontend/  React SPA (Vite)
```

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # put your MongoDB Atlas connection string in MONGO_URI
npm run seed           # create demo accounts, policies, mock flights/hotels
npm run dev            # API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # app on http://localhost:5173 (proxies /api to backend)
```

## Verify (no database required)

A self-contained end-to-end test boots an in-memory MongoDB, seeds it, starts the API,
and walks through the entire workflow over HTTP (search → policy validation → submit
→ approve → ticketing → cancel, plus role-guard and audit checks):

```bash
cd backend
node scripts/verify.js
```

## Demo accounts

| Role    | Email                     | Password     | Person |
|---------|---------------------------|--------------|--------|
| Employee | employee@travelcorp.com   | Employee@123 | Rahul Sharma (Junior Executive) |
| Manager  | manager@travelcorp.com    | Manager@123  | Priya Mehta |
| Admin    | admin@travelcorp.com      | Admin@123    | Amit Patil |

Passwords are hashed with bcrypt. Demo credentials are for local development only.

## Booking lifecycle (state machine)

```
DRAFT → PENDING → APPROVED → READY_FOR_TICKETING → TICKETED → CANCELLED
                         ↘ REJECTED
```

- Policy validation happens **before** submission (server re-validates; a violating request cannot be submitted).
- Manager approval and final ticketing are separate stages.
- Final ticketing is done by the Travel Administrator through a simulated booking service. On simulated failure the request stays `APPROVED` and can be retried — it is never marked `Ticketed` on a failure.
- Every status change is written to the audit log, and employees/managers are notified.

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Flights | `GET /api/flights/search`, `GET /api/flights/:id` |
| Hotels | `GET /api/hotels/search`, `GET /api/hotels/:id` |
| Policy | `POST /api/policy/validate`, `GET /api/policies` |
| Travel requests | `POST /api/travel-requests`, `GET /api/travel-requests`, `GET /api/travel-requests/:id` |
| Approvals | `GET /api/approvals/pending`, `POST /api/approvals/:id/approve`, `POST /api/approvals/:id/reject` |
| Ticketing | `GET /api/ticketing/pending`, `POST /api/bookings/:id/confirm`, `GET /api/bookings/:id/ticket`, `POST /api/bookings/:id/cancel` |
| Admin | `GET /api/admin/dashboard`, `GET /api/admin/bookings`, `GET /api/admin/travel-spend`, `GET /api/admin/analytics`, policies/employees/audit-logs CRUD |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read` |

## Notes

- Mock flight/hotel data lives in MongoDB (seeded) and is served through the API — the frontend never reads JSON files directly, so the mock providers can later be swapped for real travel APIs.
- Backend enforces authorization on every endpoint (not just the frontend).
