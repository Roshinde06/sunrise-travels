# Project Sunrise — Corporate Travel Booking Platform

A full-stack corporate travel booking system with role-based access (employee / manager / admin), an automated corporate travel policy engine, a manager approval workflow, a simulated final ticketing service, PDF invoices, analytics, and a built-in conversational travel assistant.

## What this is (plain English)

Imagine a company where every business trip — a flight to a client meeting, a hotel for a workshop — has to be approved and paid for by the company. **Sunrise is the tool that manages that whole journey.**

1. **Employees** search flights and hotels, get told automatically whether an option is *within company policy* (e.g. "Economy only, max ₹8,000 per flight, up to 2-star hotels" for junior staff), and submit a travel request with a business reason.
2. **Managers** see all pending requests from their team and approve or reject each one with a comment.
3. **Admins** (Travel Administrators) run the final booking: they confirm approved trips, which generates a ticket (PNR) and a PDF invoice, manage travel policies and employees, and watch dashboards of spending and analytics.
4. **Everyone** gets notifications as the request moves forward, and every action is written to an audit log.

There is also a **Travel Assistant** — a chatbot built into the app that can do all of the above in plain language ("find flights from Mumbai to Delhi tomorrow", "approve TRV-10004", "how much did we spend this month?") with capabilities that change depending on who is logged in.

## Key features

- **Role-based access** — employee / manager / admin portals, enforced on the backend for every endpoint, not just hidden in the UI.
- **Corporate policy engine** — validates flight class, flight budget, hotel star category, hotel budget per night, and real availability (seats/rooms). A policy-violating request **cannot be submitted** (server re-validates at submission).
- **Approval workflow** — manager approval, optional admin rejection, comments preserved in an append-only comment history.
- **Simulated ticketing** — final booking generates a PNR + booking reference; simulated failures keep the request `APPROVED` so it can be retried (never falsely marked `Ticketed`).
- **Tickets & PDF invoices** — generated after the final booking, viewable/downloadable with role restrictions (only the owning employee, manager-approved roles, and admin).
- **Notifications & audit log** — every status change notifies the involved users and is recorded with who/what/when.
- **Travel Assistant** — rule-based conversational chatbot (regex intent parsing, pluggable for an LLM later) with per-role tools, a guided trip-planning wizard, and in-memory session state (30-min TTL).
- **Analytics** — admin dashboards, travel spend breakdowns (by month/city/class), and booking metrics.
- **Seed data & E2E smoke test** — deterministic mock flights/hotels and a full workflow verification script that needs no real database.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, JavaScript, Vite, Tailwind CSS (utilities), Bootstrap 5 (components), React Router DOM, Axios, Lucide React |
| Backend  | Node.js, Express, Mongoose, JWT, bcryptjs, dotenv, cors, helmet, express-validator, pdfkit |
| Database | MongoDB Atlas (connection string in `backend/.env`; `mongodb-memory-server` for tests) |

## Project structure

```
├── backend/                  Express REST API
│   ├── server.js             App bootstrap, middleware, crash handlers
│   └── src/
│       ├── config/           DB connection
│       ├── models/           Mongoose schemas (User, TravelRequest, Booking, Flight,
│       │                     Hotel, TravelPolicy, Approval, Notification, AuditLog, Counter)
│       ├── services/         Business logic (policy engine, booking/ticketing, invoices,
│       │                     analytics, notifications, audit, travel assistant)
│       ├── controllers/      HTTP handlers (thin, delegate to services)
│       ├── routes/           REST route definitions + auth/role middleware
│       ├── middlewares/      auth (JWT + role), validation, error handler
│       ├── seed/             Deterministic demo data (users, policies, flights, hotels, samples)
│       └── utils/            ApiError, asyncHandler, JWT helpers
├── frontend/                 React SPA (Vite)
│   └── src/
│       ├── pages/            public / employee / manager / admin screens
│       ├── components/       UI building blocks (cards, badges, layouts, assistant widget…)
│       ├── context/          Auth, Favorites, Toast, Trip state
│       └── api/              Axios client
└── backend/scripts/verify.js Self-contained E2E smoke test
```

## How it works (technical overview)

### Architecture
A classic **layered REST backend** (routes → controllers → services → models) with a React SPA consuming it over HTTP. The frontend never touches the database — everything goes through the API, which also means the mock flight/hotel providers can later be swapped for real travel APIs without touching the UI.

### Data model (core)
- **User** — name, email, bcrypt-hashed password, role (`employee`/`manager`/`admin`), designation, department, linked `policyId`.
- **TravelPolicy** — policy band per designation: allowed flight classes, max hotel stars, flight budget, hotel budget/night.
- **TravelRequest** — the central document: selected flight/hotel **snapshots** (stable even if inventory changes), computed costs, policy result, status, manager/admin decisions, append-only comment history, booking/ticket/invoice details, ticketing-failure counters.
- **Booking** — final ticket record (PNR, booking reference, seat, costs, status).
- **Approval / Notification / AuditLog** — decision trail, per-user notifications, and the audit trail.

### Booking lifecycle (state machine)
```
DRAFT → PENDING → APPROVED → READY_FOR_TICKETING → TICKETED → CANCELLED
                         ↘ REJECTED
```
- Policy validation happens **before** submission (server re-validates; a violating request cannot be submitted).
- Manager approval and final ticketing are separate stages.
- Final ticketing is done by the Travel Administrator through a **simulated booking service**. On simulated failure the request stays `APPROVED` and can be retried — it is never marked `Ticketed` on a failure.
- Every status change is written to the audit log, and employees/managers are notified.

### Security & auth
JWT issued at login, verified by `authenticate` middleware; `authorize('admin')` (or role checks inside services) gates every sensitive endpoint. Passwords are bcrypt-hashed. Ownership is enforced too — e.g. an employee cannot view another employee's request (403).

### Travel Assistant
`assistantService.js` is a **rule-based conversational agent** (no external LLM): regex intent classification (`parseCommand`/`classify`), natural-language parsing for cities/dates/budgets ("25 August", "next Monday", "under ₹5,000"), a guided trip-planning wizard that fills in missing fields, and a per-role toolset that calls the **same services** as the REST API (search, policy check, create request, approve/reject, confirm booking, invoices, analytics) — each tool performs its own authorization checks. Sessions live in an in-memory `Map` with a 30-minute TTL and periodic pruning. The intent layer is explicitly designed to be swapped for an LLM later.

### Verify script
`node scripts/verify.js` boots an **in-memory MongoDB** (`mongodb-memory-server`), seeds it, starts the API, and walks the full workflow over real HTTP: search → policy pass + violation → submit → approve → confirm booking (with retry on simulated failure) → ticket → cancel, plus role-guard 403s, audit-trail and invoice/PDF checks.

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
The seed also creates a few more employees (Sita Rao, Vikram Singh, Anjali Nair, Deepak Verma) with different designations/policies so dashboards and analytics have data to show.

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
| Invoices | `GET /api/invoices/:id`, `GET /api/invoices/:id/download` (PDF) |
| Travel Assistant | `GET /api/assistant/start`, `POST /api/assistant/chat` |
| Admin | `GET /api/admin/dashboard`, `GET /api/admin/bookings`, `GET /api/admin/travel-spend`, `GET /api/admin/analytics`, policies/employees/audit-logs CRUD |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read` |

## Notes

- Mock flight/hotel data lives in MongoDB (seeded) and is served through the API — the frontend never reads JSON files directly, so the mock providers can later be swapped for real travel APIs.
- Backend enforces authorization on every endpoint (not just the frontend).
- The seed uses a deterministic PRNG, so mock inventory is stable across reseeds (`npm run seed:reset` wipes everything first).
