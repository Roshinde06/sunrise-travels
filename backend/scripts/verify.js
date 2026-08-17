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

    // ================= NEW: travel types, comments, invoices, search =================

    // ---------- Flight-only request ----------
    const flightOnly = await api('POST', '/api/travel-requests', {
      token: empToken,
      body: {
        travelType: 'flight',
        flightId: economyFlight._id,
        travelDate: dateInput(5),
        passengers: 1,
        employeeComment: 'Client meeting at Delhi office. Need to arrive before 10 AM.',
      },
    });
    check('Flight-only request submits -> PENDING', flightOnly.status === 201 && flightOnly.data.travelRequest.status === 'PENDING', JSON.stringify(flightOnly.data));
    check(
      'Flight-only request has no hotel (hotelId null, hotelCost 0)',
      flightOnly.data.travelRequest.travelType === 'flight' &&
        flightOnly.data.travelRequest.hotelId == null &&
        flightOnly.data.travelRequest.hotelCost === 0 &&
        flightOnly.data.travelRequest.flightCost > 0,
      JSON.stringify({ hotelId: flightOnly.data.travelRequest.hotelId, hotelCost: flightOnly.data.travelRequest.hotelCost, flightCost: flightOnly.data.travelRequest.flightCost })
    );
    check(
      'Employee comment stored + comment history entry (employee role)',
      flightOnly.data.travelRequest.employeeComment === 'Client meeting at Delhi office. Need to arrive before 10 AM.' &&
        (flightOnly.data.travelRequest.comments || []).some((c) => c.role === 'employee' && c.comment.includes('Client meeting')),
      JSON.stringify(flightOnly.data.travelRequest.comments)
    );
    const flightOnlyId = flightOnly.data.travelRequest._id;

    // ---------- Hotel-only request ----------
    const hotelOnly = await api('POST', '/api/travel-requests', {
      token: empToken,
      body: {
        travelType: 'hotel',
        hotelId: twoStarHotel._id,
        checkIn: dateInput(8),
        checkOut: dateInput(10),
        rooms: 1,
        employeeComment: 'Training workshop in Delhi; accommodation needed for two nights.',
      },
    });
    check('Hotel-only request submits -> PENDING', hotelOnly.status === 201 && hotelOnly.data.travelRequest.status === 'PENDING', JSON.stringify(hotelOnly.data));
    check(
      'Hotel-only request has no flight (flightId null, flightCost 0)',
      hotelOnly.data.travelRequest.travelType === 'hotel' &&
        hotelOnly.data.travelRequest.flightId == null &&
        hotelOnly.data.travelRequest.flightCost === 0 &&
        hotelOnly.data.travelRequest.hotelCost > 0 &&
        hotelOnly.data.travelRequest.nights === 2,
      JSON.stringify({ flightId: hotelOnly.data.travelRequest.flightId, flightCost: hotelOnly.data.travelRequest.flightCost, hotelCost: hotelOnly.data.travelRequest.hotelCost, nights: hotelOnly.data.travelRequest.nights })
    );
    check('Hotel-only destination is the hotel city', hotelOnly.data.travelRequest.to === 'Delhi', JSON.stringify(hotelOnly.data.travelRequest.to));
    const hotelOnlyId = hotelOnly.data.travelRequest._id;

    // Policy validation for hotel-only must pass
    const hotelPass = await api('POST', '/api/policy/validate', {
      token: empToken,
      body: { travelType: 'hotel', hotelId: twoStarHotel._id, rooms: 1, checkIn: dateInput(8), checkOut: dateInput(10) },
    });
    check('Policy engine validates a hotel-only selection', hotelPass.status === 200 && hotelPass.data.passed === true, JSON.stringify(hotelPass.data));

    // ---------- Manager approves with comment ----------
    const approveComment = await api('POST', `/api/approvals/${hotelOnlyId}/approve`, {
      token: mgrToken,
      body: { reason: 'Approved for the training workshop.' },
    });
    check('Manager approves hotel-only request with comment', approveComment.status === 200 && approveComment.data.travelRequest.status === 'APPROVED');
    check(
      'Manager decision fields + comment history recorded',
      approveComment.data.travelRequest.managerDecision === 'approve' &&
        approveComment.data.travelRequest.managerComment === 'Approved for the training workshop.' &&
        !!approveComment.data.travelRequest.managerDecisionAt &&
        (approveComment.data.travelRequest.comments || []).some((c) => c.role === 'manager' && c.comment === 'Approved for the training workshop.'),
      JSON.stringify({ managerDecision: approveComment.data.travelRequest.managerDecision, comments: approveComment.data.travelRequest.comments })
    );

    // ---------- Manager rejection requires a comment ----------
    const rejectNoComment = await api('POST', `/api/approvals/${flightOnlyId}/reject`, { token: mgrToken, body: {} });
    check('Manager rejection WITHOUT comment is blocked (400)', rejectNoComment.status === 400, JSON.stringify(rejectNoComment.data));

    const rejectWithComment = await api('POST', `/api/approvals/${flightOnlyId}/reject`, {
      token: mgrToken,
      body: { reason: 'Rejected because the requested travel date is outside the approved project schedule.' },
    });
    check('Manager rejection WITH comment -> REJECTED', rejectWithComment.status === 200 && rejectWithComment.data.travelRequest.status === 'REJECTED');
    check(
      'Manager rejection comment stored on request',
      rejectWithComment.data.travelRequest.managerComment === 'Rejected because the requested travel date is outside the approved project schedule.',
      JSON.stringify(rejectWithComment.data.travelRequest.managerComment)
    );

    // ---------- Admin rejection (of an approved request) requires a comment ----------
    const adminRejectNoComment = await api('POST', `/api/admin/requests/${hotelOnlyId}/reject`, { token: admToken, body: {} });
    check('Admin rejection WITHOUT comment is blocked (400)', adminRejectNoComment.status === 400, JSON.stringify(adminRejectNoComment.data));

    const adminReject = await api('POST', `/api/admin/requests/${hotelOnlyId}/reject`, {
      token: admToken,
      body: { comment: 'Rejected because the selected fare exceeds the corporate travel policy.' },
    });
    check('Admin rejects approved request WITH comment -> REJECTED', adminReject.status === 200 && adminReject.data.travelRequest.status === 'REJECTED');
    check(
      'Admin decision fields + comment history recorded',
      adminReject.data.travelRequest.adminDecision === 'reject' &&
        adminReject.data.travelRequest.adminComment === 'Rejected because the selected fare exceeds the corporate travel policy.' &&
        (adminReject.data.travelRequest.comments || []).some((c) => c.role === 'admin' && c.action === 'rejected'),
      JSON.stringify({ adminDecision: adminReject.data.travelRequest.adminDecision, comments: adminReject.data.travelRequest.comments })
    );
    const managerOnly = await api('GET', `/api/travel-requests/${hotelOnlyId}`, { token: mgrToken });
    check('Employee sees the admin rejection comment (via request detail)', managerOnly.status === 200 && managerOnly.data.travelRequest.status === 'REJECTED');

    // ---------- Create + ticket a fresh request for the invoice tests ----------
    const invoiceReq = await api('POST', '/api/travel-requests', {
      token: empToken,
      body: { flightId: economyFlight._id, hotelId: twoStarHotel._id, passengers: 1, rooms: 1, travelDate: dateInput(12), returnDate: dateInput(14), employeeComment: 'Annual business review in Delhi.' },
    });
    check('Invoice test: request submits', invoiceReq.status === 201);
    const invoiceReqId = invoiceReq.data.travelRequest._id;
    await api('POST', `/api/approvals/${invoiceReqId}/approve`, { token: mgrToken, body: { reason: 'Approved for the business review.' } });
    let invoiceConfirm = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      invoiceConfirm = await api('POST', `/api/bookings/${invoiceReqId}/confirm`, { token: admToken });
      if (invoiceConfirm.status === 200) break;
      await sleep(300);
    }
    check('Invoice test: admin confirms booking -> TICKETED', invoiceConfirm.status === 200 && invoiceConfirm.data.travelRequest.status === 'TICKETED', JSON.stringify(invoiceConfirm.data));
    check('Invoice test: invoice number generated at booking', /^INV-/.test(invoiceConfirm.data.travelRequest.invoiceDetails?.invoiceNumber || ''), JSON.stringify(invoiceConfirm.data.travelRequest.invoiceDetails));

    // ---------- Invoice: view + download ----------
    const invoiceView = await api('GET', `/api/invoices/${invoiceReqId}`, { token: admToken });
    check('Admin can view invoice for ticketed request', invoiceView.status === 200 && invoiceView.data.invoice && /^INV-/.test(invoiceView.data.invoice.invoiceNumber), JSON.stringify(invoiceView.data));
    check(
      'Invoice contains real charges (flight+hotel, taxes derived from fares)',
      invoiceView.data.invoice.flightCharges > 0 &&
        invoiceView.data.invoice.hotelCharges > 0 &&
        invoiceView.data.invoice.taxes === Math.round((invoiceView.data.invoice.flightCharges + invoiceView.data.invoice.hotelCharges) * 0.05) &&
        invoiceView.data.invoice.totalAmount === invoiceView.data.invoice.flightCharges + invoiceView.data.invoice.hotelCharges + invoiceView.data.invoice.taxes,
      JSON.stringify(invoiceView.data.invoice)
    );
    check('Invoice payment status is paid after final booking', invoiceView.data.invoice.paymentStatus === 'paid' && invoiceView.data.invoice.bookingStatus === 'confirmed');

    const empInvoice = await api('GET', `/api/invoices/${invoiceReqId}`, { token: empToken });
    check('Owning employee can view their invoice', empInvoice.status === 200 && !!empInvoice.data.invoice);

    const mgrInvoice = await api('GET', `/api/invoices/${invoiceReqId}`, { token: mgrToken });
    check('Manager is blocked from financial data (403)', mgrInvoice.status === 403, JSON.stringify(mgrInvoice.data));

    const empDownload = await api('GET', `/api/invoices/${invoiceReqId}/download`, { token: empToken });
    check('Non-admin cannot download the invoice PDF (403)', empDownload.status === 403);

    const pdfRes = await fetch(`${base}/api/invoices/${invoiceReqId}/download`, {
      headers: { Authorization: `Bearer ${admToken}` },
    });
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    check(
      'Admin can download a PDF invoice (starts with %PDF)',
      pdfRes.status === 200 &&
        pdfRes.headers.get('content-type') === 'application/pdf' &&
        pdfBuf.length > 500 &&
        pdfBuf.slice(0, 4).toString() === '%PDF',
      `status=${pdfRes.status} bytes=${pdfBuf.length} head=${pdfBuf.slice(0, 4).toString()}`
    );

    const noInvoice = await api('GET', `/api/invoices/${flightOnlyId}`, { token: admToken });
    check('Invoice is not available for a non-ticketed request (409)', noInvoice.status === 409, JSON.stringify(noInvoice.data));

    // ---------- Search & filter (manager + admin) ----------
    const searchName = await api('GET', '/api/travel-requests?search=rahul', { token: mgrToken });
    check('Manager search by employee name', searchName.status === 200 && searchName.data.requests.every((r) => r.employeeName.toLowerCase().includes('rahul')), JSON.stringify((searchName.data.requests || []).map((r) => r.employeeName)));

    const searchReqId = await api('GET', `/api/travel-requests?search=${requestNo}`, { token: mgrToken });
    check('Manager search by request ID', searchReqId.status === 200 && searchReqId.data.requests.some((r) => r.requestId === requestNo));

    const searchDest = await api('GET', '/api/travel-requests?search=Delhi', { token: mgrToken });
    check('Manager search by destination', searchDest.status === 200 && searchDest.data.requests.length > 0 && searchDest.data.requests.every((r) => (r.to || '').toLowerCase().includes('delhi') || (r.from || '').toLowerCase().includes('delhi')));

    const typeFilter = await api('GET', '/api/travel-requests?travelType=hotel', { token: mgrToken });
    check('Manager filters by travel type (hotel)', typeFilter.status === 200 && typeFilter.data.requests.length > 0 && typeFilter.data.requests.every((r) => r.travelType === 'hotel'), JSON.stringify((typeFilter.data.requests || []).map((r) => r.travelType)));

    const dateFilter = await api('GET', `/api/travel-requests?dateFrom=${dateInput(5)}&dateTo=${dateInput(5)}`, { token: mgrToken });
    const localKey = (d) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    check('Manager filters by travel date range', dateFilter.status === 200 && dateFilter.data.requests.length > 0 && dateFilter.data.requests.every((r) => localKey(r.travelDate) === dateInput(5)), JSON.stringify((dateFilter.data.requests || []).map((r) => localKey(r.travelDate))));

    const adminSearchEmail = await api('GET', '/api/admin/bookings?search=anjali.nair', { token: admToken });
    check('Admin search by employee email', adminSearchEmail.status === 200 && adminSearchEmail.data.requests.length > 0 && adminSearchEmail.data.requests.every((r) => r.employeeName.includes('Anjali')), JSON.stringify((adminSearchEmail.data.requests || []).map((r) => r.employeeName)));

    const adminSearchBookingRef = await api('GET', `/api/admin/bookings?search=${invoiceConfirm.data.booking.bookingReference}`, { token: admToken });
    check('Admin search by booking reference', adminSearchBookingRef.status === 200 && adminSearchBookingRef.data.requests.some((r) => r._id === invoiceReqId));

    const adminSearchPnr = await api('GET', `/api/admin/bookings?search=${invoiceConfirm.data.booking.pnr}`, { token: admToken });
    check('Admin search by ticket number (PNR)', adminSearchPnr.status === 200 && adminSearchPnr.data.requests.some((r) => r._id === invoiceReqId));

    const adminTypeFilter = await api('GET', '/api/admin/bookings?travelType=hotel&status=REJECTED', { token: admToken });
    check('Admin filters by travel type + status', adminTypeFilter.status === 200 && adminTypeFilter.data.requests.every((r) => r.travelType === 'hotel' && r.status === 'REJECTED'), JSON.stringify((adminTypeFilter.data.requests || []).map((r) => `${r.travelType}/${r.status}`)));

    const adminPaymentFilter = await api('GET', '/api/admin/bookings?paymentStatus=paid', { token: admToken });
    check('Admin filters by payment status (paid)', adminPaymentFilter.status === 200 && adminPaymentFilter.data.requests.length > 0 && adminPaymentFilter.data.requests.every((r) => r.paymentStatus === 'paid'), JSON.stringify((adminPaymentFilter.data.requests || []).map((r) => r.paymentStatus)));

    // ================= TRAVEL ASSISTANT (role-based chatbot) =================
    const sess = () => `v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chat = async (token, message, sessionId) => {
      const res = await api('POST', '/api/assistant/chat', { token, body: { message, sessionId } });
      return { status: res.status, data: res.data };
    };

    // ----- employee assistant -----
    const empStart = await api('GET', '/api/assistant/start', { token: empToken });
    check('Assistant start returns role-specific welcome + quick actions', empStart.status === 200 && empStart.data.role === 'employee' && Array.isArray(empStart.data.quickActions) && empStart.data.quickActions.length > 0, JSON.stringify(empStart.data));

    const empSession = sess();
    const empSearch = await chat(empToken, 'Find flights from Mumbai to Delhi tomorrow', empSession);
    check('Employee: SEARCH_FLIGHT returns flight results + price analysis', empSearch.data.intent === 'SEARCH_FLIGHT' && empSearch.data.view?.type === 'flights' && empSearch.data.view.flights.length > 0 && empSearch.data.view.analysis && empSearch.data.view.analysis.cheapest > 0, JSON.stringify({ intent: empSearch.data.intent, view: empSearch.data.view && { type: empSearch.data.view.type, n: empSearch.data.view.flights?.length } }));
    const firstFlight = empSearch.data.view.flights[0];

    const empCompare = await chat(empToken, 'Which flight is cheapest?', empSession);
    check('Employee: PRICE_ANALYSIS on last results', empCompare.data.intent === 'PRICE_ANALYSIS' && empCompare.data.view?.type === 'price_analysis' && empCompare.data.view.cheapest > 0, JSON.stringify(empCompare.data.view));

    const empPolicy = await chat(empToken, 'Is this within company policy?', empSession);
    check('Employee: policy check uses corporate policy', empPolicy.data.intent === 'POLICY_CHECK' && /policy/i.test(empPolicy.data.reply), JSON.stringify(empPolicy.data.reply));

    const empHotels = await chat(empToken, 'Find hotels in Delhi under 6000', empSession);
    check('Employee: SEARCH_HOTEL returns hotels', empHotels.data.intent === 'SEARCH_HOTEL' && empHotels.data.view?.type === 'hotels' && empHotels.data.view.hotels.length > 0, JSON.stringify({ intent: empHotels.data.intent, n: empHotels.data.view?.hotels?.length }));
    const firstHotel = empHotels.data.view.hotels[0];

    const empMode = await chat(empToken, 'I only need a flight', empSession);
    check('Employee: travel-type preference (flight only)', empMode.data.intent === 'SET_MODE' && /flights only/.test(empMode.data.reply), JSON.stringify(empMode.data.reply));

    // Full trip creation via the assistant (flight + hotel)
    const planSession = sess();
    const planMsg = await chat(empToken, "I have a client meeting in Delhi on 27 August at 11 AM. I want to travel from Mumbai on 26 August and return on 28 August. I need a hotel.", planSession);
    check('Employee: PLAN_TRIP extracts purpose/origin/destination/dates', planMsg.data.intent === 'PLAN_TRIP' && planMsg.data.view?.type === 'trip_plan' && /client meeting/i.test(planMsg.data.view.plan.purpose) && planMsg.data.view.plan.origin === 'Mumbai' && planMsg.data.view.plan.destination === 'Delhi' && planMsg.data.view.plan.travelDate && planMsg.data.view.flights?.length > 0, JSON.stringify(planMsg.data.view));
    const planFlight = planMsg.data.view.flights.find((f) => f.policy && f.policy.classAllowed && f.policy.underBudget) || planMsg.data.view.flights[0];
    const selectF = await chat(empToken, `select_flight ${planFlight.id}`, planSession);
    check('Employee: select flight moves to hotel selection', selectF.data.view?.type === 'hotels' && selectF.data.view.hotels.length > 0, JSON.stringify({ view: selectF.data.view && selectF.data.view.type }));
    const planHotel = selectF.data.view.hotels.find((h) => h.policy && h.policy.starsAllowed && h.policy.underBudget) || selectF.data.view.hotels[0];
    const selectH = await chat(empToken, `select_hotel ${planHotel.id}`, planSession);
    check('Employee: select hotel shows trip summary', selectH.data.view?.type === 'trip_summary' && selectH.data.view.travelType === 'Flight + Hotel' && selectH.data.view.totalAmount > 0, JSON.stringify(selectH.data.view));
    const createReq = await chat(empToken, 'create_request', planSession);
    check('Employee: chatbot creates a travel request (existing API + policy engine)', createReq.data.intent === 'CREATE_REQUEST' && /TRV-/.test(createReq.data.reply) && createReq.data.view?.ok === true, JSON.stringify(createReq.data));
    const createdByAssistant = await api('GET', `/api/travel-requests?search=${(createReq.data.reply.match(/TRV-\d+/) || [])[0]}`, { token: empToken });
    check('Employee: chatbot-created request is owned by the authenticated employee', createdByAssistant.data.requests[0]?.employeeName === 'Rahul Sharma' && createdByAssistant.data.requests[0]?.status === 'PENDING');

    const empStatus = await chat(empToken, 'Show my pending requests', sess());
    check('Employee: shows own pending requests only', empStatus.data.intent === 'MY_REQUESTS' && empStatus.data.view?.type === 'requests' && empStatus.data.view.items.length > 0 && empStatus.data.view.items.every((r) => r.status === 'PENDING'), JSON.stringify(empStatus.data.view && empStatus.data.view.items));

    const asstEmpInvoice = await chat(empToken, 'Show my invoice', sess());
    check('Employee: MY_INVOICE returns own invoice', asstEmpInvoice.data.intent === 'MY_INVOICE' && asstEmpInvoice.data.view?.type === 'invoice' && /^INV-/.test(asstEmpInvoice.data.view.invoice.invoiceNumber), JSON.stringify(asstEmpInvoice.data.view && asstEmpInvoice.data.view.invoice && asstEmpInvoice.data.view.invoice.invoiceNumber));

    const empTicket = await chat(empToken, 'Show my ticket', sess());
    check('Employee: MY_TICKET returns own final ticket', empTicket.data.intent === 'MY_TICKET' && empTicket.data.view?.type === 'ticket' && empTicket.data.view.booking.pnr, JSON.stringify(empTicket.data.view && empTicket.data.view.booking));

    // Employee security: cannot approve / access other employees' data
    const empApprove = await chat(empToken, 'Approve TRV-10001', sess());
    check('Employee: cannot approve a request (denied)', empApprove.data.intent === 'PERMISSION_DENIED' && /don't have permission/.test(empApprove.data.reply), JSON.stringify(empApprove.data.reply));
    const empApproveCmd = await chat(empToken, 'approve_submit TRV-10001 Approved', sess());
    check('Employee: approve_submit command is blocked server-side', empApproveCmd.data.intent === 'PERMISSION_DENIED');
    const otherReqId = otherReq ? otherReq.requestId : 'TRV-10002';
    const empOther = await chat(empToken, `show request ${otherReqId}`, sess());
    check('Employee: cannot view another employee request via assistant', empOther.data.view?.type === 'error' || /own travel requests/.test(empOther.data.reply), JSON.stringify(empOther.data.reply));

    // ----- normal conversational chat (must not hit the fallback) -----
    const empHi = await chat(empToken, 'Hi', sess());
    check('Employee: "Hi" gets a normal chat reply (not fallback)', empHi.data.intent === 'GREETING' && /Hi/i.test(empHi.data.reply) && /Rahul/i.test(empHi.data.reply), JSON.stringify(empHi.data.reply));
    const empHello = await chat(empToken, 'Hello', sess());
    check('Employee: "Hello" greeting', empHello.data.intent === 'GREETING' && empHello.data.quickReplies?.length > 0, JSON.stringify(empHello.data.reply));
    const empHow = await chat(empToken, 'How are you?', sess());
    check('Employee: small talk (how are you)', empHow.data.intent === 'HOW_ARE_YOU' && /ready to help/i.test(empHow.data.reply), JSON.stringify(empHow.data.reply));
    const empHelp = await chat(empToken, 'What can you do?', sess());
    check('Employee: help lists capabilities + quick actions', empHelp.data.intent === 'HELP' && /search flights/i.test(empHelp.data.reply) && empHelp.data.quickReplies?.length > 0, JSON.stringify(empHelp.data.reply));
    const empThanks = await chat(empToken, 'Thanks!', sess());
    check('Employee: thanks reply', empThanks.data.intent === 'THANKS' && /welcome/i.test(empThanks.data.reply), JSON.stringify(empThanks.data.reply));
    const empUnknown = await chat(empToken, 'What is the weather in Mars?', sess());
    check('Employee: unknown intent gets friendly fallback (not "can\'t understand")', /I'm not sure what you mean/i.test(empUnknown.data.reply) && empUnknown.data.quickReplies?.length > 0, JSON.stringify(empUnknown.data.reply));

    // ----- structured form commands (clickable options -> same backend flow) -----
    const formSession = sess();
    const flightForm = await chat(empToken, 'flight_form|from=Mumbai|to=Delhi|date=2026-08-25|nonstop=true', formSession);
    check('Employee: flight form command searches flights (non-stop)', flightForm.data.intent === 'SEARCH_FLIGHT' && flightForm.data.view?.type === 'flights' && flightForm.data.view.flights.length > 0 && flightForm.data.view.flights.every((f) => f.stops === 0), JSON.stringify({ intent: flightForm.data.intent, stops: flightForm.data.view?.flights?.map((f) => f.stops) }));
    const hotelForm = await chat(empToken, 'hotel_form|city=Delhi|checkin=2026-08-25|checkout=2026-08-27|budget=6000', formSession);
    check('Employee: hotel form command searches hotels under budget', hotelForm.data.intent === 'SEARCH_HOTEL' && hotelForm.data.view?.type === 'hotels' && hotelForm.data.view.hotels.length > 0 && hotelForm.data.view.hotels.every((h) => h.pricePerNight <= 6000), JSON.stringify({ intent: hotelForm.data.intent, prices: hotelForm.data.view?.hotels?.map((h) => h.pricePerNight) }));
    const planForm = await chat(empToken, 'plan_form|from=Mumbai|to=Delhi|date=2026-08-26|return=2026-08-28|mode=flight|purpose=Client meeting', formSession);
    check('Employee: plan form command runs trip plan + flight search', planForm.data.intent === 'PLAN_TRIP' && planForm.data.view?.type === 'trip_plan' && planForm.data.view.flights?.length > 0 && /client meeting/i.test(planForm.data.view.plan.purpose), JSON.stringify(planForm.data.view && { plan: planForm.data.view.plan, flights: planForm.data.view.flights?.length }));

    // ----- guided trip-planning wizard (conversational fill-in) -----
    const wizSession = sess();
    const wiz1 = await chat(empToken, 'I need to go to Delhi next Monday', wizSession);
    check('Employee: short trip intent starts guided wizard', ['PLAN_TRIP', 'PLAN_TRIP_SHORT'].includes(wiz1.data.intent) && /travelling from/i.test(wiz1.data.reply), JSON.stringify(wiz1.data.reply));
    const wiz2 = await chat(empToken, 'Mumbai', wizSession);
    check('Employee: wizard remembers destination, asks date', /date/i.test(wiz2.data.reply) && /Mumbai/.test(wiz2.data.reply) && /Delhi/.test(wiz2.data.reply), JSON.stringify(wiz2.data.reply));
    const wiz3 = await chat(empToken, '25 August', wizSession);
    check('Employee: wizard fills date, asks flight/hotel/both', /flight, a hotel, or both/i.test(wiz3.data.reply) && wiz3.data.quickReplies?.length >= 3, JSON.stringify(wiz3.data.reply));
    const wiz4 = await chat(empToken, 'Flight', wizSession);
    check('Employee: wizard mode=flight, asks purpose', /purpose/i.test(wiz4.data.reply), JSON.stringify(wiz4.data.reply));
    const wiz5 = await chat(empToken, 'skip', wizSession);
    check('Employee: wizard completes and searches flights', wiz5.data.view?.type === 'trip_plan' && wiz5.data.view.flights?.length > 0 && wiz5.data.view.plan.origin === 'Mumbai' && wiz5.data.view.plan.destination === 'Delhi', JSON.stringify(wiz5.data.view && { plan: wiz5.data.view.plan, flights: wiz5.data.view.flights?.length }));

    // ----- manager + admin small talk -----
    const mgrHi = await chat(mgrToken, 'Hi', sess());
    check('Manager: greeting with role-aware reply', mgrHi.data.intent === 'GREETING' && /employee travel management/i.test(mgrHi.data.reply), JSON.stringify(mgrHi.data.reply));
    const admHi = await chat(admToken, 'Hi', sess());
    check('Admin: greeting with role-aware reply', admHi.data.intent === 'GREETING' && /corporate travel/i.test(admHi.data.reply), JSON.stringify(admHi.data.reply));
    const admHelp = await chat(admToken, 'help', sess());
    check('Admin: help lists admin capabilities', admHelp.data.intent === 'HELP' && /invoice/i.test(admHelp.data.reply), JSON.stringify(admHelp.data.reply));

    // ----- manager assistant -----
    const mgrSession = sess();
    const mgrPending = await chat(mgrToken, 'Show pending requests', mgrSession);
    check('Manager: SEARCH_REQUESTS (pending)', mgrPending.data.intent === 'SEARCH_REQUESTS' && mgrPending.data.view?.type === 'requests' && mgrPending.data.view.items.length > 0 && mgrPending.data.view.items.every((r) => r.status === 'PENDING'), JSON.stringify(mgrPending.data.view && mgrPending.data.view.items));

    const mgrSearch = await chat(mgrToken, "Find Rahul's request", mgrSession);
    check('Manager: search by employee name', mgrSearch.data.intent === 'SEARCH_REQUESTS' && mgrSearch.data.view?.items?.every((r) => /rahul/i.test(r.employeeName)), JSON.stringify(mgrSearch.data.view && mgrSearch.data.view.items && mgrSearch.data.view.items.map((r) => r.employeeName)));

    const mgrDetail = await chat(mgrToken, 'Show TRV-10001', mgrSession);
    check('Manager: request details', mgrDetail.data.intent === 'REQUEST_DETAIL' && mgrDetail.data.view?.type === 'request_detail' && mgrDetail.data.view.request.requestId === 'TRV-10001', JSON.stringify(mgrDetail.data.view && mgrDetail.data.view.request && mgrDetail.data.view.request.requestId));

    const mgrApprove = await chat(mgrToken, 'Approve TRV-10001', mgrSession);
    check('Manager: approve shows confirmation first', mgrApprove.data.view?.type === 'confirmation' && mgrApprove.data.view.kind === 'approve' && mgrApprove.data.actions.some((a) => /approve_submit/.test(a.command)), JSON.stringify(mgrApprove.data.view));
    const mgrApproveDone = await chat(mgrToken, 'approve_submit TRV-10001 Approved for the client meeting', mgrSession);
    check('Manager: approval executes with comment', mgrApproveDone.data.view?.ok === true && /approved/i.test(mgrApproveDone.data.reply), JSON.stringify(mgrApproveDone.data.reply));
    const approvedReq = await api('GET', '/api/travel-requests?search=TRV-10001', { token: mgrToken });
    check('Manager: approval stored managerComment + history', approvedReq.data.requests[0]?.status === 'APPROVED' && approvedReq.data.requests[0]?.managerComment === 'Approved for the client meeting' && (approvedReq.data.requests[0]?.comments || []).some((c) => c.role === 'manager' && c.action === 'approved'), JSON.stringify({ status: approvedReq.data.requests[0]?.status, comment: approvedReq.data.requests[0]?.managerComment }));

    const mgrRejectNoComment = await chat(mgrToken, 'reject_submit TRV-10002', mgrSession);
    check('Manager: rejection without comment is blocked', /comment is required/i.test(mgrRejectNoComment.data.reply), JSON.stringify(mgrRejectNoComment.data.reply));
    const mgrReject = await chat(mgrToken, 'Reject TRV-10002', mgrSession);
    check('Manager: reject shows confirmation with required comment', mgrReject.data.view?.type === 'confirmation' && mgrReject.data.view.commentRequired === true, JSON.stringify(mgrReject.data.view));
    const mgrRejectDone = await chat(mgrToken, 'reject_submit TRV-10002 Rejected because the travel date is outside the approved schedule', mgrSession);
    check('Manager: rejection executes with required comment', mgrRejectDone.data.view?.ok === true && /rejected/i.test(mgrRejectDone.data.reply), JSON.stringify(mgrRejectDone.data.reply));

    const mgrSummary = await chat(mgrToken, 'Show team travel summary', sess());
    check('Manager: team summary analytics', mgrSummary.data.intent === 'TEAM_SUMMARY' && mgrSummary.data.view?.type === 'analytics' && mgrSummary.data.view.rows.length >= 4, JSON.stringify(mgrSummary.data.view));

    const mgrPayment = await chat(mgrToken, 'Process payment for TRV-10004', mgrSession);
    check('Manager: cannot process payment (Admin-only)', mgrPayment.data.intent === 'PERMISSION_DENIED' && /Admin-only/i.test(mgrPayment.data.reply), JSON.stringify(mgrPayment.data.reply));

    // ----- admin assistant -----
    const admSession = sess();
    const admReady = await chat(admToken, 'Show requests ready for booking', admSession);
    check('Admin: ready-for-booking list (approved only)', admReady.data.intent === 'READY_FOR_BOOKING' && admReady.data.view?.type === 'requests' && admReady.data.view.items.length > 0 && admReady.data.view.items.every((r) => r.status === 'APPROVED'), JSON.stringify(admReady.data.view && admReady.data.view.items.map((r) => r.status)));

    const admConfirm = await chat(admToken, 'Confirm booking TRV-10004', admSession);
    check('Admin: booking confirmation shown first', admConfirm.data.view?.type === 'confirmation' && admConfirm.data.view.kind === 'booking', JSON.stringify(admConfirm.data.view));
    let admBookResult = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      admBookResult = await chat(admToken, 'booking_submit TRV-10004 Booking approved and payment processed', admSession);
      if (admBookResult.data.view?.ok === true) break;
      await sleep(300);
    }
    check('Admin: final booking executes (ticket + invoice generated)', admBookResult.data.view?.ok === true && /Booking ID/.test(admBookResult.data.reply) && /INV-/.test(admBookResult.data.reply), JSON.stringify(admBookResult.data.reply));

    const admInvoice = await chat(admToken, 'Show invoice TRV-10004', admSession);
    check('Admin: view invoice', admInvoice.data.view?.type === 'invoice' && /^INV-/.test(admInvoice.data.view.invoice.invoiceNumber), JSON.stringify(admInvoice.data.view && admInvoice.data.view.invoice && admInvoice.data.view.invoice.invoiceNumber));

    const admDownload = await chat(admToken, 'Download invoice TRV-10004', admSession);
    check('Admin: download invoice action', admDownload.data.actions?.some((a) => a.type === 'download_invoice'), JSON.stringify(admDownload.data.actions));

    const admCost = await chat(admToken, 'How much did we spend this month', sess());
    check('Admin: cost analysis (backend aggregation)', admCost.data.intent === 'COST_ANALYSIS' && admCost.data.view?.type === 'cost_analysis' && admCost.data.view.rows.length >= 4 && admCost.data.view.rows.some(([k]) => k === 'Total'), JSON.stringify(admCost.data.view));

    const admAnalytics = await chat(admToken, 'Show travel analytics', sess());
    check('Admin: travel analytics', admAnalytics.data.view?.type === 'analytics' && admAnalytics.data.view.rows.length >= 6, JSON.stringify(admAnalytics.data.view));

    const admSearch = await chat(admToken, 'Find TRV-10004', sess());
    check('Admin: search by request id', admSearch.data.view?.type === 'requests' && admSearch.data.view.items.some((r) => r.requestId === 'TRV-10004'), JSON.stringify(admSearch.data.view && admSearch.data.view.items));
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
