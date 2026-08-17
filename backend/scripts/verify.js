/**
 * End-to-end smoke test for the Sunrise API.
 *
 * Boots an in-memory MongoDB (mongodb-memory-server), seeds it with the demo
 * data, starts the API, and walks through the complete corporate travel
 * workflow over real HTTP:
 *
 *   employee search -> policy validation (pass + violation) -> submit request
 *   -> manager approve -> admin confirm booking -> ticketed -> cancel
 *   + role-guard checks (403s) + audit log + notifications
 *
 * Usage: node scripts/verify.js
 */
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5099';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  -> ${extra}` : ''}`);
}

function dateInput(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('sunrise_test');
  console.log(`In-memory MongoDB started.`);

  // 1. Seed (then disconnect so server.js can connect fresh)
  const seed = require('../src/seed/seed');
  const seedSummary = await seed.seedAll();
  await mongoose.disconnect();
  console.log(`Seeded: ${JSON.stringify(seedSummary)}`);

  // 2. Start the API (server.js connects + listens)
  require('../server');

  const base = `http://localhost:${process.env.PORT}`;
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  check('API is up and healthy', ready);
  if (!ready) {
    console.error('API did not start. Aborting.');
    process.exit(1);
  }

  const api = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  };

  try {
    // ---------- Auth ----------
    const badLogin = await api('POST', '/api/auth/login', { body: { email: 'employee@travelcorp.com', password: 'wrong' } });
    check('Login rejects a wrong password (401)', badLogin.status === 401);

    const empLogin = await api('POST', '/api/auth/login', { body: { email: 'employee@travelcorp.com', password: 'Employee@123' } });
    check('Employee login succeeds', empLogin.status === 200 && empLogin.data.token && empLogin.data.user.role === 'employee', JSON.stringify(empLogin.data));
    const empToken = empLogin.data.token;

    const mgrLogin = await api('POST', '/api/auth/login', { body: { email: 'manager@travelcorp.com', password: 'Manager@123' } });
    check('Manager login succeeds', mgrLogin.status === 200 && mgrLogin.data.user.role === 'manager');
    const mgrToken = mgrLogin.data.token;

    const admLogin = await api('POST', '/api/auth/login', { body: { email: 'admin@travelcorp.com', password: 'Admin@123' } });
    check('Admin login succeeds', admLogin.status === 200 && admLogin.data.user.role === 'admin');
    const admToken = admLogin.data.token;

    const anjuLogin = await api('POST', '/api/auth/login', { body: { email: 'anjali.nair@travelcorp.com', password: 'Anjali@12345' } });
    const anjuToken = anjuLogin.data.token;

    // ---------- Flight & hotel search ----------
    const depDate = dateInput(1);
    const flightSearch = await api('GET', `/api/flights/search?from=Mumbai&to=Delhi&departureDate=${depDate}&passengers=1`, { token: empToken });
    check('Flight search returns results (Mumbai→Delhi)', flightSearch.status === 200 && flightSearch.data.outbound.length > 0);
    const economyFlight = (flightSearch.data.outbound || []).find((f) => f.travelClass === 'Economy');
    const businessFlight = (flightSearch.data.outbound || []).find((f) => f.travelClass === 'Business');
    check('Economy flight available for search', !!economyFlight);
    check('Business flight available for search (for violation demo)', !!businessFlight);

    const hotelSearch = await api('GET', `/api/hotels/search?city=Delhi&checkIn=${depDate}&checkOut=${dateInput(3)}&rooms=1`, { token: empToken });
    check('Hotel search returns results (Delhi)', hotelSearch.status === 200 && hotelSearch.data.hotels.length > 0);
    const twoStarHotel = (hotelSearch.data.hotels || []).find((h) => h.starRating === 2);
    const fiveStarHotel = (hotelSearch.data.hotels || []).find((h) => h.starRating === 5);
    check('2-star hotel available', !!twoStarHotel);

    // ---------- Policy engine ----------
    const pass = await api('POST', '/api/policy/validate', {
      token: empToken,
      body: { flightId: economyFlight._id, hotelId: twoStarHotel._id, passengers: 1, rooms: 1, travelDate: depDate },
    });
    check('Policy engine PASSES compliant selection', pass.status === 200 && pass.data.passed === true, JSON.stringify(pass.data));

    const violation = await api('POST', '/api/policy/validate', {
      token: empToken,
      body: { flightId: businessFlight._id, hotelId: fiveStarHotel?._id || twoStarHotel._id, passengers: 1, rooms: 1, travelDate: depDate },
    });
    check('Policy engine FAILS Business class for Junior Executive', violation.status === 200 && violation.data.passed === false && violation.data.reasons.length > 0, JSON.stringify(violation.data));
    check(
      'Violations are categorized as flight vs hotel',
      violation.status === 200 &&
        Array.isArray(violation.data.flightViolations) &&
        Array.isArray(violation.data.hotelViolations) &&
        violation.data.flightViolations.length > 0 &&
        violation.data.flightViolations.length + violation.data.hotelViolations.length === violation.data.reasons.length,
      JSON.stringify({ f: violation.data.flightViolations, h: violation.data.hotelViolations, reasons: violation.data.reasons })
    );

    // ---------- Submit request ----------
    const submit = await api('POST', '/api/travel-requests', {
      token: empToken,
      body: { flightId: economyFlight._id, hotelId: twoStarHotel._id, passengers: 1, rooms: 1, travelDate: depDate, returnDate: dateInput(3) },
    });
    check('Compliant request submits -> PENDING', submit.status === 201 && submit.data.travelRequest.status === 'PENDING' && /^TRV-/.test(submit.data.travelRequest.requestId), JSON.stringify(submit.data));
    const reqId = submit.data.travelRequest._id;
    const requestNo = submit.data.travelRequest.requestId;

    const badSubmit = await api('POST', '/api/travel-requests', {
      token: empToken,
      body: { flightId: businessFlight._id, hotelId: twoStarHotel._id, passengers: 1, rooms: 1, travelDate: depDate },
    });
    check('Policy-violating request is BLOCKED at submission (400)', badSubmit.status === 400, JSON.stringify(badSubmit.data));

    // ---------- Manager approval ----------
    const pending = await api('GET', '/api/approvals/pending', { token: mgrToken });
    check('Manager sees the pending request', pending.status === 200 && pending.data.requests.some((r) => r._id === reqId));

    const approve = await api('POST', `/api/approvals/${reqId}/approve`, { token: mgrToken });
    check('Manager approves request -> APPROVED', approve.status === 200 && approve.data.travelRequest.status === 'APPROVED', JSON.stringify(approve.data));

    const approveAgain = await api('POST', `/api/approvals/${reqId}/approve`, { token: mgrToken });
    check('Double approval is rejected (409)', approveAgain.status === 409);

    // ---------- Admin ticketing (with possible simulated failures) ----------
    const ticketing = await api('GET', '/api/ticketing/pending', { token: admToken });
    check('Admin sees the approved request in ticketing queue', ticketing.status === 200 && ticketing.data.requests.some((r) => r._id === reqId));

    let confirmRes = null;
    let sawFailure = false;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      confirmRes = await api('POST', `/api/bookings/${reqId}/confirm`, { token: admToken });
      if (confirmRes.status === 200) break;
      sawFailure = true;
      console.log(`  [info] simulated booking failure on attempt ${attempt}: ${confirmRes.data?.message}`);
      await sleep(300);
    }
    check('Admin confirms final booking -> TICKETED (after retries if needed)', confirmRes.status === 200 && confirmRes.data.travelRequest.status === 'TICKETED', JSON.stringify(confirmRes.data));
    check('Ticket carries PNR + booking reference', !!(confirmRes.data.booking?.pnr && confirmRes.data.booking?.bookingReference), JSON.stringify(confirmRes.data.booking));
    console.log(`  [info] simulated booking failures observed: ${sawFailure ? 'yes' : 'no (random failure rate did not trigger this run)'}`);

    // ---------- Employee views final ticket ----------
    const ticket = await api('GET', `/api/bookings/${reqId}/ticket`, { token: empToken });
    check('Employee can view their final ticket', ticket.status === 200 && ticket.data.booking.pnr && ticket.data.travelRequest.status === 'TICKETED', JSON.stringify(ticket.data));

    // ---------- Notifications ----------
    const notifs = await api('GET', '/api/notifications', { token: empToken });
    check('Employee received booking-confirmed notification', notifs.status === 200 && notifs.data.notifications.some((n) => n.title.includes('Confirmed')));

    // ---------- Cancellation ----------
    const cancel = await api('POST', `/api/bookings/${reqId}/cancel`, { token: empToken, body: { reason: 'Change of plans' } });
    check('Employee cancels ticketed booking -> CANCELLED', cancel.status === 200 && cancel.data.travelRequest.status === 'CANCELLED', JSON.stringify(cancel.data));

    // ---------- Role guards ----------
    const empOnAdmin = await api('GET', '/api/admin/dashboard', { token: empToken });
    check('Employee is blocked from admin endpoints (403)', empOnAdmin.status === 403);

    const empOnApprovals = await api('GET', '/api/approvals/pending', { token: empToken });
    check('Employee is blocked from manager approvals (403)', empOnApprovals.status === 403);

    const others = await api('GET', '/api/travel-requests', { token: anjuToken });
    const otherReq = (others.data.requests || []).find((r) => r.employeeName !== 'Rahul Sharma');
    const crossAccess = await api('GET', `/api/travel-requests/${otherReq?._id}`, { token: empToken });
    check('Employee cannot view another employee\u2019s request (403)', crossAccess.status === 403);

    // ---------- Admin dashboard + audit ----------
    const dash = await api('GET', '/api/admin/dashboard', { token: admToken });
    const m = dash.data?.metrics || {};
    check(
      'Admin dashboard exposes all required metrics',
      dash.status === 200 &&
        typeof m.todayBookings === 'number' &&
        typeof m.pendingApprovals === 'number' &&
        typeof m.cancelledBookings === 'number' &&
        typeof m.travelSpend === 'number' &&
        typeof m.mostTravelledCity === 'string',
      JSON.stringify(m)
    );

    const auditLogs = await api('GET', '/api/admin/audit-logs', { token: admToken });
    const actions = (auditLogs.data?.logs || []).map((l) => l.action);
    check('Audit trail records the full lifecycle', ['REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED'].every((a) => actions.includes(a)), actions.join(', '));

    const spend = await api('GET', '/api/admin/travel-spend', { token: admToken });
    check('Travel spend endpoint returns breakdowns', spend.status === 200 && Array.isArray(spend.data.byMonth) && Array.isArray(spend.data.byCity) && Array.isArray(spend.data.byClass));

    // ---------- Policy soft delete (deactivate) + hard delete ----------
    const policyList = await api('GET', '/api/admin/policies', { token: admToken });
    const policyTarget = (policyList.data?.policies || []).find((p) => p.designationKey === 'manager');
    check('Admin can list policies', policyList.status === 200 && Array.isArray(policyList.data?.policies) && policyList.data.policies.length > 0);

    const softDel = await api('PUT', `/api/admin/policies/${policyTarget?._id}`, { token: admToken, body: { isActive: false } });
    check('Admin can soft-delete (deactivate) a policy', softDel.status === 200 && softDel.data.policy.isActive === false, JSON.stringify(softDel.data));

    const hardDel = await api('DELETE', `/api/admin/policies/${policyTarget?._id}`, { token: admToken });
    check('Admin can hard-delete a policy permanently', hardDel.status === 200 && hardDel.data.success, JSON.stringify(hardDel.data));

    const policyList2 = await api('GET', '/api/admin/policies', { token: admToken });
    check('Hard-deleted policy is no longer listed', policyList2.status === 200 && !(policyList2.data.policies || []).some((p) => p._id === policyTarget?._id));
  } finally {
    await mongod.stop();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
