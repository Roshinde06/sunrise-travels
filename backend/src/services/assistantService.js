const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');
const TravelRequest = require('../models/TravelRequest');
const Booking = require('../models/Booking');
const { searchFlights } = require('./flightService');
const { searchHotels, computeNights } = require('./hotelService');
const { getPolicyForUser } = require('./policyService');
const { createTravelRequest } = require('./travelRequestService');
const { approveRequest, rejectRequest } = require('./approvalService');
const { confirmBooking } = require('./bookingService');
const { buildInvoice } = require('./invoiceService');
const { getTeamSummary, getTravelAnalytics, getCostAnalysis } = require('./analyticsService');
const audit = require('./auditService');

/* ------------------------------------------------------------------ */
/* Session context (short-term, in-memory, TTL-scoped)                 */
/* ------------------------------------------------------------------ */
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map(); // `${userId}:${sessionId}` -> session object

function getSession(userId, sessionId) {
  const key = `${userId}:${sessionId}`;
  const now = Date.now();
  let session = sessions.get(key);
  if (session && now - session.lastActive > SESSION_TTL_MS) {
    sessions.delete(key);
    session = null;
  }
  if (!session) {
    session = { lastActive: now, mode: 'flight_hotel', history: [], flightResults: [], hotelResults: [], tripPlan: null, pending: null };
    sessions.set(key, session);
  }
  session.lastActive = now;
  return session;
}

// prune expired sessions occasionally
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.lastActive > SESSION_TTL_MS) sessions.delete(key);
  }
}, 10 * 60 * 1000).unref();

/* ------------------------------------------------------------------ */
/* Role configuration                                                  */
/* ------------------------------------------------------------------ */
const firstName = (user) => (user && user.name ? String(user.name).trim().split(/\s+/)[0] : '');

const ROLE_WELCOME = {
  employee:
    "Hi! 👋 I'm your Corporate Travel Assistant.\n\nI can help you plan and manage your business travel.\n\nWhat would you like to do?",
  manager:
    "Hi! 👋 I'm your Manager Travel Assistant.\n\nI can help you review employee travel requests, approve or reject requests and analyze team travel.\n\nWhat would you like to do?",
  admin:
    "Hi! 👋 I'm your Corporate Travel Admin Assistant.\n\nI can help you manage travel requests, book approved trips, check payments, view tickets and invoices, and analyze travel costs.\n\nWhat would you like to do?",
};

const GREETING_REPLY = {
  employee: (n) => `Hi ${n}! 👋 How can I help with your business travel today?`,
  manager: (n) => `Hi ${n}! 👋 You currently have access to employee travel management. What would you like to do?`,
  admin: (n) => `Hi ${n}! 👋 How can I help you manage corporate travel today?`,
};

const ROLE_HELP = {
  employee:
    "Sure! I can help you with:\n\n✈ Search flights\n🏨 Find hotels\n🧳 Plan a business trip\n💰 Compare travel prices\n📋 Create travel requests\n📊 Check request status\n🎫 View tickets\n🧾 View invoices\n\nJust type naturally or use the quick options below.",
  manager:
    "Sure! I can help you with:\n\n📋 Review employee travel requests\n✅ Approve requests\n❌ Reject requests (with a reason)\n🔎 Search team trips\n📊 Team travel summaries\n🧳 Upcoming trips",
  admin:
    "Sure! I can help you with:\n\n📋 Search all travel requests\n✈ Final bookings\n💳 Payment status\n🎫 Tickets\n🧾 Invoices (view / download)\n📊 Travel analytics\n💰 Cost analysis",
};

const ROLE_QUICK_ACTIONS = {
  employee: [
    { label: '✈ Search Flights', command: 'search flights' },
    { label: '🏨 Search Hotels', command: 'search hotels' },
    { label: '🧳 Plan Trip', command: 'plan a trip' },
    { label: '💰 Compare Prices', command: 'compare prices' },
    { label: '📋 My Requests', command: 'my requests' },
    { label: '🎫 My Tickets', command: 'show my ticket' },
    { label: '🧾 My Invoices', command: 'show my invoice' },
  ],
  manager: [
    { label: '📋 Pending Requests', command: 'show pending requests' },
    { label: '🔎 Search Employee', command: 'search requests' },
    { label: '👀 Review Request', command: 'show request' },
    { label: '✅ Approve Request', command: 'approve request' },
    { label: '❌ Reject Request', command: 'reject request' },
    { label: '📊 Team Summary', command: 'show team travel summary' },
    { label: '🧳 Upcoming Trips', command: 'show upcoming team travel' },
  ],
  admin: [
    { label: '📋 All Requests', command: 'search requests' },
    { label: '🔎 Search Request', command: 'search requests' },
    { label: '🧾 Booking Status', command: 'show booking status' },
    { label: '💳 Payment Status', command: 'show payment status' },
    { label: '✈ Final Booking', command: 'show requests ready for booking' },
    { label: '🎫 Tickets', command: 'show ticketed requests' },
    { label: '🧾 Invoices', command: 'show invoices' },
    { label: '📊 Travel Analytics', command: 'show travel analytics' },
    { label: '💰 Cost Analysis', command: 'how much did we spend this month' },
  ],
};

const ROLE_FALLBACK = {
  employee:
    "I'm not sure what you mean. I can help with flights, hotels, trip planning, travel requests, bookings, tickets and invoices.",
  manager:
    "I'm not sure what you mean. I can help you review and approve/reject employee travel requests, search team trips and view travel summaries.",
  admin:
    "I'm not sure what you mean. I can help you search requests, manage final bookings, payments, tickets, invoices and travel analytics.",
};

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Goa', 'Jaipur', 'Ahmedabad'];
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const DAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

const toDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dateKeyOffset = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
};

function extractCities(text) {
  const found = [];
  for (const city of CITIES) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) found.push(city);
  }
  return found;
}

/** Extracts a YYYY-MM-DD date from natural language, or null. */
function extractDate(text) {
  const t = ` ${text} `;
  // ISO / numeric
  let m = t.match(/20\d{2}-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[0].slice(0, 4)}-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  m = t.match(/(\d{1,2})[-\/](\d{1,2})(?:[-\/](20\d{2}))?/);
  if (m && m[1] <= 31 && m[2] <= 12) {
    const year = m[3] ? Number(m[3]) : new Date().getFullYear();
    return `${year}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  // "25 august" / "25 aug"
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${String(MONTHS[m[2].toLowerCase()] + 1).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  // "in 3 days"
  m = t.match(/in\s+(\d+)\s+days?/);
  if (m) return dateKeyOffset(Number(m[1]));
  // weekdays
  m = t.match(/\b(next|this|coming)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (m) {
    const now = new Date();
    const target = DAYS[m[2].toLowerCase()];
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    now.setDate(now.getDate() + diff);
    return toDateKey(now);
  }
  if (/\btomorrow\b/i.test(t)) return dateKeyOffset(1);
  if (/\btoday\b/i.test(t)) return dateKeyOffset(0);
  return null;
}

function extractBudget(text) {
  const m = text.match(/(?:under|less than|below|max(?:imum)?|upto|up to|within|budget(?: of)?|around)\s*(?:rs\.?|inr|₹)?\s*([\d,]+)\s*(?:per night|\/night)?/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

function extractPurpose(text) {
  const m = text.match(/(client meeting|meeting|conference|workshop|training|site visit|on-site|audit|review|interview|seminar|business trip|client visit|project work|delivery)/i);
  return m ? m[1].toLowerCase() : null;
}

function extractRequestRef(text) {
  const m = text.match(/\b(TRV?-\d+)\b/i);
  if (m) {
    const num = m[1].match(/\d+/)[0];
    return { ref: m[1], num };
  }
  if (/show\s+request/i.test(text) || /details?\s+of/i.test(text) || /status of/i.test(text)) {
    const m2 = text.match(/(?:request|booking|trip|invoice)\s*(?:id)?\s*[:\s]*(TRV?-\d+)/i);
    if (m2) {
      const num = m2[1].match(/\d+/)[0];
      return { ref: m2[1], num };
    }
  }
  return null;
}

/** Finds a travel request by requestId (TRV-10004 / TR-10004) or Mongo id. */
async function findRequestByRef(ref) {
  if (!ref) return null;
  if (mongoose.isValidObjectId(ref)) return TravelRequest.findById(ref);
  const m = String(ref).match(/(\d+)$/);
  if (m) {
    return TravelRequest.findOne({ $or: [{ requestId: `TRV-${m[1]}` }, { requestId: { $regex: `-${m[1]}$` } }] });
  }
  return TravelRequest.findOne({ requestId: ref });
}

function findTimePref(text) {
  if (/(morning|early)/i.test(text)) return 'morning';
  if (/(afternoon)/i.test(text)) return 'afternoon';
  if (/(evening)/i.test(text)) return 'evening';
  if (/(night|late)/i.test(text)) return 'night';
  return null;
}

function timeMinutes(t) {
  if (!t) return 24 * 60;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ------------------------------------------------------------------ */
/* Guided trip-planning wizard (conversational fill-in)                */
/* ------------------------------------------------------------------ */
const formatDateKey = (key) => {
  if (!key) return '';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function isGreeting(text) {
  const t = String(text || '').trim().toLowerCase();
  return /^(hi+|hello|hey|yo|namaste|good\s*(morning|afternoon|evening|day))\b/.test(t);
}

function matchCity(text) {
  const cities = extractCities(text);
  return cities.length ? cities[0] : null;
}

function extractReturnDate(text) {
  const m = String(text).match(/(?:return|come back|back).*?((?:\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)|20\d{2}-\d{1,2}-\d{1,2}))/i);
  return m ? extractDate(m[1]) : null;
}

function absorbWizardText(plan, text) {
  const cities = extractCities(text);
  if (cities.length >= 2) {
    if (!plan.origin) plan.origin = cities[0];
    if (!plan.destination) plan.destination = cities[1];
  } else if (cities.length === 1) {
    // A single city fills whichever slot is still missing (destination may be
    // pre-filled from the user's first message, e.g. "I need to go to Delhi").
    if (!plan.origin) plan.origin = cities[0];
    else if (!plan.destination) plan.destination = cities[0];
  }
  if (!plan.travelDate) plan.travelDate = extractDate(text);
  if (!plan.returnDate) plan.returnDate = extractReturnDate(text);
  if (plan.purpose == null && !/skip|none|no purpose/i.test(text)) {
    const p = extractPurpose(text);
    if (p) plan.purpose = p;
  }
}

function nextWizardQuestion(plan) {
  if (!plan.origin) return { step: 'origin', question: 'Where are you travelling from?' };
  if (!plan.destination) return { step: 'destination', question: `Great, from ${plan.origin}. Where are you travelling to?` };
  if (!plan.travelDate) return { step: 'date', question: `${plan.origin} → ${plan.destination}. What date are you travelling? (e.g. "25 August" or "tomorrow")` };
  if (!plan.mode) return { step: 'mode', question: `Travelling on ${formatDateKey(plan.travelDate)}. Do you need a flight, a hotel, or both?` };
  if (plan.purpose == null) return { step: 'purpose', question: "What's the business purpose? (optional — type \"skip\" to continue)" };
  return null;
}

async function handleWizardStep(user, session, text) {
  const w = session.wizard;
  if (!w) return null;
  if (isGreeting(text)) return null; // let the greeting reply happen; keep the wizard state
  if (parseCommand(text)) {
    session.wizard = null; // the user switched to an explicit command
    return null;
  }
  const plan = w.plan || {};
  absorbWizardText(plan, text);
  if (!plan.mode) {
    if (/(both|flight.*hotel|flight and hotel|flight \+ hotel)/i.test(text)) plan.mode = 'flight_hotel';
    else if (/(hotel)/i.test(text) && !/(flight)/i.test(text)) plan.mode = 'hotel';
    else if (/(flight)/i.test(text)) plan.mode = 'flight';
  }
  if (plan.purpose == null && /skip|none|no purpose/i.test(text)) plan.purpose = '';

  const next = nextWizardQuestion(plan);
  if (next) {
    w.step = next.step;
    return ok(next.question, { intent: 'PLAN_TRIP', quickReplies: next.step === 'mode' ? ['Flight', 'Hotel', 'Flight + Hotel'] : next.step === 'purpose' ? ['skip'] : [] });
  }
  session.wizard = null;
  return runPlannedSearch(user, session, plan);
}

/* ------------------------------------------------------------------ */
/* Response builders                                                   */
/* ------------------------------------------------------------------ */
const ok = (reply, extra = {}) => ({ reply, intent: extra.intent || 'GENERIC', view: extra.view || null, actions: extra.actions || [], quickReplies: extra.quickReplies || [], pending: !!extra.pending });

const travelTypeLabel = (t) => ({ flight: 'Flight only', hotel: 'Hotel only', flight_hotel: 'Flight + Hotel' }[t] || t || '—');

const requestRow = (r) => ({
  requestId: r.requestId,
  _id: r._id,
  employeeName: r.employeeName,
  destination: r.travelType === 'hotel' ? (r.to || r.hotelSnapshot?.city) : (r.from ? `${r.from} → ${r.to}` : (r.to || '—')),
  travelType: travelTypeLabel(r.travelType),
  travelDate: r.travelDate,
  totalAmount: r.totalAmount,
  status: r.status,
  bookingStatus: r.bookingStatus || 'none',
  paymentStatus: r.paymentStatus || 'pending',
  employeeComment: r.employeeComment,
  rejectionComment: (r.managerComment || r.adminComment || ''),
});

const flightRow = (f) => ({
  id: f._id,
  airline: f.airline,
  flightNumber: f.flightNumber,
  from: f.from,
  to: f.to,
  departureTime: f.departureTime,
  arrivalTime: f.arrivalTime,
  durationMinutes: f.durationMinutes,
  stops: f.stops,
  travelClass: f.travelClass,
  price: f.price,
});

const hotelRow = (h) => ({
  id: h._id,
  name: h.name,
  city: h.city,
  location: h.location || h.city,
  starRating: h.starRating,
  roomType: h.roomType,
  pricePerNight: h.pricePerNight,
  nights: h.nights || 1,
  totalPrice: h.totalPrice || h.pricePerNight * (h.nights || 1),
  amenities: (h.amenities || []).slice(0, 5),
  image: h.image || '',
});

/* ------------------------------------------------------------------ */
/* Tools — each performs its own authorization checks                  */
/* ------------------------------------------------------------------ */

// ---------- shared: flight / hotel search (read-only, any role) ----------
async function searchFlightsTool(user, { from, to, date, stops, budget, timePref, returnDate }) {
  const result = await searchFlights({ from, to, departureDate: date, returnDate, passengers: 1 });
  let outbound = result.outbound || [];
  if (stops === 0) outbound = outbound.filter((f) => f.stops === 0);
  if (stops === 1) outbound = outbound.filter((f) => f.stops === 1);
  if (budget) outbound = outbound.filter((f) => f.price <= budget);
  if (timePref === 'morning') outbound = outbound.filter((f) => timeMinutes(f.departureTime) < 12 * 60);
  if (timePref === 'afternoon') outbound = outbound.filter((f) => timeMinutes(f.departureTime) >= 12 * 60 && timeMinutes(f.departureTime) < 17 * 60);
  if (timePref === 'evening') outbound = outbound.filter((f) => timeMinutes(f.departureTime) >= 17 * 60);

  const policy = await getPolicyForUser(user).catch(() => null);
  const items = outbound.map((f) => {
    const row = flightRow(f);
    if (policy) {
      row.policy = {
        classAllowed: (policy.allowedFlightClasses || []).includes(f.travelClass),
        underBudget: f.price <= policy.flightBudget,
        flightBudget: policy.flightBudget,
      };
    }
    return row;
  });

  return { items, returnLeg: (result.return || []).map(flightRow) };
}

function priceAnalysis(items, policy) {
  if (!items.length) return null;
  const prices = items.map((f) => f.price);
  const cheapest = Math.min(...prices);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const compliant = items.filter((f) => !f.policy || (f.policy.classAllowed && f.policy.underBudget));
  const pool = compliant.length ? compliant : items;
  const score = (f) => f.price + f.stops * 900 + Math.max(0, (f.durationMinutes || 180) - 150) * 20 + (timeMinutes(f.departureTime) >= 22 * 60 ? 400 : 0);
  const recommended = [...pool].sort((a, b) => score(a) - score(b))[0];
  return { cheapest, average, recommended, count: items.length };
}

async function searchHotelsTool(user, { city, checkIn, checkOut, budget, maxStars }) {
  const hotels = await searchHotels({ city, checkIn, checkOut, guests: 1, rooms: 1 });
  let list = hotels;
  if (budget) list = list.filter((h) => h.pricePerNight <= budget);
  if (maxStars) list = list.filter((h) => h.starRating <= maxStars);
  const policy = await getPolicyForUser(user).catch(() => null);
  const items = list.map((h) => {
    const row = hotelRow(h);
    if (policy) {
      row.policy = {
        starsAllowed: h.starRating <= policy.maximumHotelStars,
        underBudget: h.pricePerNight <= policy.hotelBudgetPerNight,
        hotelBudgetPerNight: policy.hotelBudgetPerNight,
      };
    }
    return row;
  });
  return items;
}

function hotelAnalysis(items) {
  if (!items.length) return null;
  const nights = items[0].nights || 1;
  const prices = items.map((h) => h.pricePerNight);
  const cheapest = Math.min(...prices);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const compliant = items.filter((h) => !h.policy || (h.policy.starsAllowed && h.policy.underBudget));
  const pool = compliant.length ? compliant : items;
  const recommended = [...pool].sort((a, b) => a.pricePerNight - b.pricePerNight || b.starRating - a.starRating)[0];
  return { cheapest, average, recommended, nights };
}

// ---------- employee tools ----------
async function getMyRequestsTool(user, filters = {}) {
  const query = { employeeId: user._id };
  if (filters.status && filters.status !== 'ALL') query.status = filters.status;
  const requests = await TravelRequest.find(query).sort({ createdAt: -1 }).limit(20);
  return requests.map(requestRow);
}

async function getMyLatestTicketed(user) {
  const request = await TravelRequest.findOne({ employeeId: user._id, status: 'TICKETED' }).sort({ createdAt: -1 });
  if (!request) return null;
  const booking = await Booking.findOne({ travelRequestId: request._id, status: 'confirmed' });
  return { request, booking };
}

// ---------- manager / admin shared: request search ----------
async function searchRequestsTool(role, filters = {}) {
  const query = {};
  if (filters.status && filters.status !== 'ALL') query.status = filters.status;
  if (filters.travelType && filters.travelType !== 'ALL') query.travelType = filters.travelType;
  if (filters.bookingStatus && filters.bookingStatus !== 'ALL') query.bookingStatus = filters.bookingStatus;
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') query.paymentStatus = filters.paymentStatus;
  if (filters.upcoming) {
    query.status = { $in: ['PENDING', 'APPROVED', 'READY_FOR_TICKETING', 'TICKETED'] };
    query.travelDate = { $gte: new Date() };
  }
  if (filters.dateFrom || filters.dateTo) {
    query.travelDate = query.travelDate || {};
    if (filters.dateFrom) query.travelDate.$gte = new Date(`${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) query.travelDate.$lte = new Date(`${filters.dateTo}T23:59:59`);
  }
  if (filters.search && String(filters.search).trim()) {
    const term = String(filters.search).trim();
    const or = [
      { requestId: { $regex: term, $options: 'i' } },
      { employeeName: { $regex: term, $options: 'i' } },
      { from: { $regex: term, $options: 'i' } },
      { to: { $regex: term, $options: 'i' } },
    ];
    if (mongoose.isValidObjectId(term)) or.push({ employeeId: term });
    if (role === 'admin' && /^(BK-|bk-)/.test(term)) {
      const bookings = await Booking.find({ bookingReference: { $regex: term, $options: 'i' } }).select('travelRequestId');
      if (bookings.length) or.push({ _id: { $in: bookings.map((b) => b.travelRequestId) } });
    }
    query.$or = or;
  }
  const requests = await TravelRequest.find(query).sort({ createdAt: -1 }).limit(10);
  return requests.map(requestRow);
}

/* ------------------------------------------------------------------ */
/* Intent classification (rule-based; pluggable for an LLM later)      */
/* ------------------------------------------------------------------ */
function parseCommand(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (/^(confirm|yes|yeah|proceed|go ahead)$/i.test(t)) return { intent: 'CONFIRM_PENDING' };
  if (/^(cancel|no|never mind|stop)$/i.test(t)) return { intent: 'CANCEL_PENDING' };
  if (/^(help|what can you do|how can you help|who are you|what are you)/i.test(t)) return { intent: 'HELP' };
  if (/^(reset|start over|clear)/i.test(t)) return { intent: 'RESET' };
  if (/^create(_| )request/i.test(t)) return { intent: 'CREATE_REQUEST' };
  if (/^search flights?$/i.test(t)) return { intent: 'SEARCH_FLIGHT', params: {} };
  if (/^search hotels?$/i.test(t)) return { intent: 'SEARCH_HOTEL', params: {} };
  if (/^compare prices$/i.test(t)) return { intent: 'COMPARE_PRICES' };
  if (/^my requests$/i.test(t)) return { intent: 'MY_REQUESTS' };
  if (/^plan a trip$/i.test(t)) return { intent: 'PLAN_TRIP_HELP' };
  if (/^show invoices$/i.test(t)) return { intent: 'SHOW_INVOICES' };
  if (/^show booking status$/i.test(t)) return { intent: 'BOOKING_STATUS' };
  if (/^search requests$/i.test(t)) return { intent: 'SEARCH_REQUESTS' };

  const ref = extractRequestRef(t);
  const selectFlight = t.match(/^select[_ ]flight\s+([a-f0-9]{24})/i);
  if (selectFlight) return { intent: 'SELECT_FLIGHT', params: { id: selectFlight[1] } };
  const selectHotel = t.match(/^select[_ ]hotel\s+([a-f0-9]{24})/i);
  if (selectHotel) return { intent: 'SELECT_HOTEL', params: { id: selectHotel[1] } };

  // Structured form submissions from the frontend search/plan forms.
  // Format: flight_form|from=Mumbai|to=Delhi|date=2026-08-25|return=2026-08-28|budget=8000
  const form = t.match(/^(flight_form|hotel_form|plan_form)\|([\s\S]*)$/i);
  if (form) {
    const fields = {};
    form[2].split('|').forEach((pair) => {
      const eq = pair.indexOf('=');
      if (eq > 0) fields[pair.slice(0, eq).trim().toLowerCase()] = pair.slice(eq + 1).trim();
    });
    const kind = form[1].toLowerCase();
    if (kind === 'flight_form') {
      return { intent: 'SEARCH_FLIGHT', params: { from: fields.from, to: fields.to, date: fields.date, returnDate: fields.return || fields.returnDate, stops: fields.nonstop === 'true' ? 0 : null, budget: fields.budget ? Number(fields.budget) : null } };
    }
    if (kind === 'hotel_form') {
      return { intent: 'SEARCH_HOTEL', params: { city: fields.city, checkIn: fields.checkin, checkOut: fields.checkout, budget: fields.budget ? Number(fields.budget) : null } };
    }
    if (kind === 'plan_form') {
      return { intent: 'PLAN_TRIP', params: { from: fields.from, to: fields.to, date: fields.date, returnDate: fields.return || fields.returnDate, mode: fields.mode || 'flight', purpose: fields.purpose || '' } };
    }
  }

  const approveSubmit = t.match(/^approve[_ ]submit\s+(TRV?-\d+)\s*([\s\S]*)/i);
  if (approveSubmit) return { intent: 'APPROVE_SUBMIT', params: { ref: approveSubmit[1], comment: approveSubmit[2].trim() } };
  const rejectSubmit = t.match(/^reject[_ ]submit\s+(TRV?-\d+)\s*([\s\S]*)/i);
  if (rejectSubmit) return { intent: 'REJECT_SUBMIT', params: { ref: rejectSubmit[1], comment: rejectSubmit[2].trim() } };
  const bookingSubmit = t.match(/^booking[_ ]submit\s+(TRV?-\d+)\s*([\s\S]*)/i);
  if (bookingSubmit) return { intent: 'BOOKING_SUBMIT', params: { ref: bookingSubmit[1], comment: bookingSubmit[2].trim() } };

  const bookingCmd = t.match(/^booking\s+(TRV?-\d+)/i);
  if (bookingCmd) return { intent: 'CONFIRM_BOOKING', params: { ref: bookingCmd[1] } };
  const downloadInv = t.match(/^download[_ ]invoice\s*(TRV?-\d+)?/i);
  if (downloadInv) return { intent: 'DOWNLOAD_INVOICE', params: { ref: downloadInv[1] || '' } };
  const viewInv = t.match(/^view[_ ]invoice\s*(TRV?-\d+)?/i);
  if (viewInv) return { intent: 'VIEW_INVOICE', params: { ref: viewInv[1] || '' } };
  const viewTicket = t.match(/^view[_ ]ticket\s*(TRV?-\d+)?/i);
  if (viewTicket) return { intent: 'VIEW_TICKET', params: { ref: viewTicket[1] || '' } };
  if (ref && /^show\s+request/i.test(t)) return { intent: 'REQUEST_DETAIL', params: { ref: ref.ref } };

  return null;
}

function classify(user, text) {
  const role = user.role;
  const t = ` ${text.toLowerCase()} `;
  const trimmed = t.trim();

  // Small talk — these must never fall through to the unknown-intent fallback.
  if (isGreeting(trimmed)) return { intent: 'GREETING' };
  if (/(how are you|how's it going|how do you do|how r u|what's up)/.test(t)) return { intent: 'HOW_ARE_YOU' };
  if (/(thank(s| you)?|thx|appreciate)/.test(t)) return { intent: 'THANKS' };
  if (/^(bye|goodbye|see you|good\s*night)/.test(trimmed)) return { intent: 'GOODBYE' };

  // Role-denied sensitive intents first (so we answer with the right message).
  // Note: "my invoice" must still reach the employee's own-invoice intent.
  if (role === 'employee' && /(approve|reject|confirm booking|process payment|all employees|download invoice|view all invoices)/.test(t)) {
    return { intent: 'DENIED_EMPLOYEE' };
  }
  if (role === 'manager' && /(process payment|payment processing|confirm booking|final booking|download invoice|change policy|modify.*invoice|admin.*booking)/.test(t)) {
    return { intent: 'DENIED_MANAGER' };
  }

  // Travel type preference
  if (/(only|just).*flight|flight\s+only|flights?\s+only/i.test(t)) return { intent: 'SET_MODE', params: { mode: 'flight' } };
  if (/(only|just).*hotel|hotel\s+only|hotels?\s+only/i.test(t)) return { intent: 'SET_MODE', params: { mode: 'hotel' } };
  if (/(need|want|require).*(both|flight and hotel)|flight\s*\+\s*hotel/i.test(t)) return { intent: 'SET_MODE', params: { mode: 'flight_hotel' } };

  const cities = extractCities(text);

  // PLAN_TRIP — natural-language trip description
  if (role === 'employee' && /(client meeting|meeting|conference|workshop|training|visit|audit|review|interview|on-site|seminar|business trip)/.test(t) && (cities.length >= 1 || extractDate(text))) {
    return { intent: 'PLAN_TRIP' };
  }

  // Short travel intent ("I need to go to Delhi next Monday") → guided wizard.
  if (role === 'employee' && /(i (need|want|have) to|going to|travell?ing to|travel to|planning?|need a trip)/i.test(t) && cities.length) {
    return { intent: 'PLAN_TRIP_SHORT', params: { destination: cities[0], date: extractDate(text) } };
  }

  // Price / comparison intents
  if (/(cheapest|cheap|best value|best price|compare|which.*(cheap|best|good|value)|price analysis)/.test(t)) {
    return role === 'employee' ? { intent: 'PRICE_ANALYSIS' } : { intent: 'COMPARE_PRICES' };
  }

  // Corporate policy check on the current selection
  if (role === 'employee' && /(policy|compliant|within.*(limit|budget|policy)|allowed)/.test(t)) {
    return { intent: 'POLICY_CHECK' };
  }

  // Employee: status / ticket / invoice
  if (role === 'employee') {
    if (/(my invoice|invoice)/.test(t) && /(show|view|my|get|latest)/.test(t)) return { intent: 'MY_INVOICE' };
    if (/(my ticket|ticket)/.test(t) && /(show|view|my|get|latest)/.test(t)) return { intent: 'MY_TICKET' };
    if (/(my request|my trips|my trips|status|approved my trip|rejected|pending request|confirmed trip|track)/.test(t) && /(show|what|has|why|when|my|track|status)/.test(t)) {
      return { intent: 'MY_REQUESTS', params: { statusFilter: statusFromText(t) } };
    }
    if (/create.*(request|trip)|submit.*(request|trip)|book my trip/i.test(t)) return { intent: 'CREATE_REQUEST' };
  }

  // Manager intents
  if (role === 'manager') {
    const ref = extractRequestRef(text);
    if (/approve/i.test(t) && ref) return { intent: 'APPROVE_REQUEST', params: { ref: ref.ref } };
    if (/reject/i.test(t) && ref) return { intent: 'REJECT_REQUEST', params: { ref: ref.ref } };
    if (ref && /(show|details|view|status of)/i.test(t)) return { intent: 'REQUEST_DETAIL', params: { ref: ref.ref } };
    if (/(team travel summary|team summary|how many|analytics|summary)/.test(t)) return { intent: 'TEAM_SUMMARY' };
    if (/(upcoming|next week|next month)/.test(t)) return { intent: 'UPCOMING_TRAVEL' };
    if (/(pending|approved|rejected|ticketed|cancelled)\s+requests?/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { status: statusFromText(t) } };
    if (/(hotel request|hotel only|hotel-only)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { travelType: 'hotel' } };
    if (/(flight request|flight only|flight-only)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { travelType: 'flight' } };
    if (/(find|search|show).*(request|trips?|travel)/i.test(t) || cities.length) return { intent: 'SEARCH_REQUESTS' };
    if (/approve/i.test(t)) return { intent: 'APPROVE_HELP' };
    if (/reject/i.test(t)) return { intent: 'REJECT_HELP' };
  }

  // Admin intents
  if (role === 'admin') {
    const ref = extractRequestRef(text);
    if (/ready.*(book|ticket)|pending booking|requests? ready/i.test(t)) return { intent: 'READY_FOR_BOOKING' };
    if (/confirm.*booking|book.*(request|trip)/i.test(t)) return { intent: 'CONFIRM_BOOKING', params: { ref: ref ? ref.ref : null } };
    if (/download.*invoice/i.test(t)) return { intent: 'DOWNLOAD_INVOICE', params: { ref: ref ? ref.ref : '' } };
    if (/invoice/i.test(t) && /(show|view|for|of)/i.test(t)) return { intent: 'VIEW_INVOICE', params: { ref: ref ? ref.ref : '' } };
    if (/(payment status|payment)/.test(t) && /(show|status|check)/i.test(t)) return { intent: 'BOOKING_STATUS', params: { ref: ref ? ref.ref : '' } };
    if (/(booking status|status of)/.test(t)) return { intent: 'BOOKING_STATUS', params: { ref: ref ? ref.ref : '' } };
    if (/(cost|spend|expensive|average trip|compare this month|last month)/.test(t)) return { intent: 'COST_ANALYSIS' };
    if (/(analytics|top destination|how many|travel usage|report)/.test(t)) return { intent: 'TRAVEL_ANALYTICS' };
    if (/(pending|approved|rejected|ticketed|cancelled)\s+requests?/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { status: statusFromText(t) } };
    if (/(hotel only|hotel-only|hotel request)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { travelType: 'hotel' } };
    if (/(flight only|flight-only|flight request)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { travelType: 'flight' } };
    if (/(confirmed booking|confirmed)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { status: 'TICKETED' } };
    if (/(rejected)/.test(t)) return { intent: 'SEARCH_REQUESTS', params: { status: 'REJECTED' } };
    if (/(delhi|mumbai|bangalore|chennai|hyderabad|kolkata|pune|goa|jaipur|ahmedabad)/i.test(t)) return { intent: 'SEARCH_REQUESTS' };
    if (/(find|search|show)/i.test(t) || ref) return { intent: 'SEARCH_REQUESTS' };
  }

  // Employee search intents (fall through for all roles, but employee-focused)
  if (/(flights?|fly|flying)/.test(t)) return { intent: 'SEARCH_FLIGHT' };
  if (/(hotels?|stay|accommodation|rooms?)/.test(t)) return { intent: 'SEARCH_HOTEL' };

  return { intent: 'UNKNOWN' };
}

function statusFromText(t) {
  if (/pending/.test(t)) return 'PENDING';
  if (/approved/.test(t)) return 'APPROVED';
  if (/rejected/.test(t)) return 'REJECTED';
  if (/ticket|confirmed/.test(t)) return 'TICKETED';
  if (/cancelled|cancel/.test(t)) return 'CANCELLED';
  return 'ALL';
}

/* ------------------------------------------------------------------ */
/* Intent handlers                                                     */
/* ------------------------------------------------------------------ */

async function handleEmployeeIntent(user, session, intent, params, text) {
  const mode = session.mode;

  switch (intent) {
    case 'SET_MODE': {
      session.mode = params.mode;
      const label = { flight: 'flights only', hotel: 'hotels only', flight_hotel: 'both flight and hotel' }[params.mode];
      // If a flight is already selected and the employee now says "flight only", show the summary immediately.
      if (params.mode === 'flight' && session.tripPlan && session.tripPlan.flight && !session.tripPlan.hotel) {
        session.tripPlan.travelType = 'flight';
        return ok(`Sure — flights only. Here is your trip summary with ${session.tripPlan.flight.airline} ${session.tripPlan.flight.flightNumber} selected:`, {
          intent,
          view: buildTripSummaryView(session),
          actions: [{ label: 'Create Travel Request', command: 'create_request', variant: 'primary' }, { label: 'Start Over', command: 'reset', variant: 'secondary' }],
        });
      }
      return ok(`Sure. I'll search ${label}.`, {
        intent,
        quickReplies: params.mode === 'hotel'
          ? ['Find hotels in Delhi', 'Find hotels under ₹5,000']
          : ['Find flights from Mumbai to Delhi', 'Find the cheapest flight to Bangalore'],
      });
    }

    case 'SEARCH_FLIGHT': {
      const cities = extractCities(text);
      let from = params.from;
      let to = params.to;
      if (!from || !to) {
        if (cities.length >= 2) [from, to] = cities.slice(0, 2);
        else if (cities.length === 1) to = cities[0];
      }
      if (!from || !to) {
        return ok('Fill in the flight search form — or just type it, e.g. "Find flights from Mumbai to Delhi":', {
          intent,
          view: { type: 'form', form: 'flight' },
        });
      }
      const date = params.date || extractDate(text) || dateKeyOffset(1);
      const stops = params.stops !== undefined && params.stops !== null ? params.stops : (/non-?stop|direct/.test(text) ? 0 : null);
      const budget = params.budget || extractBudget(text);
      const timePref = findTimePref(text);
      const { items } = await searchFlightsTool(user, { from, to, date, stops, budget, timePref });
      session.flightResults = items;
      const analysis = priceAnalysis(items);
      if (!items.length) {
        return ok(`I couldn't find any ${stops === 0 ? 'non-stop ' : ''}flights from ${from} to ${to} on ${date}${budget ? ` under ₹${budget.toLocaleString('en-IN')}` : ''}. Try a different date or route.`, { intent });
      }
      const analysisView = analysis
        ? {
            type: 'price_analysis',
            cheapest: analysis.cheapest,
            average: analysis.average,
            recommended: analysis.recommended ? { id: analysis.recommended.id, airline: analysis.recommended.airline, flightNumber: analysis.recommended.flightNumber, price: analysis.recommended.price, stops: analysis.recommended.stops, durationMinutes: analysis.recommended.durationMinutes } : null,
            reason: `The cheapest option is ₹${analysis.cheapest.toLocaleString('en-IN')}. I recommend the ₹${analysis.recommended ? analysis.recommended.price.toLocaleString('en-IN') : '—'} option because it offers the best balance of price and travel time.`,
          }
        : null;
      return ok(`I found ${items.length} flight${items.length === 1 ? '' : 's'} from ${from} to ${to} on ${date}. Select one to continue.`, {
        intent,
        view: { type: 'flights', flights: items, analysis: analysisView },
        actions: [],
        quickReplies: ['Which is cheapest?', 'Compare prices'],
      });
    }

    case 'SELECT_FLIGHT': {
      const flight = (session.flightResults || []).find((f) => String(f.id) === String(params.id));
      if (!flight) return ok("That flight is no longer in the current results. Please search again.", { intent });
      session.tripPlan = { ...(session.tripPlan || {}), flight, hotel: null, travelType: mode };
      // If the plan calls for a hotel (or mode is flight_hotel), move to hotel search.
      if (mode === 'flight_hotel' || (session.tripPlan && session.tripPlan.hotelNeeded)) {
        const city = flight.to;
        const checkIn = session.tripPlan?.travelDate || dateKeyOffset(1);
        const checkOut = session.tripPlan?.returnDate || dateKeyOffset(3);
        const items = await searchHotelsTool(user, { city, checkIn, checkOut });
        session.hotelResults = items;
        session.tripPlan.travelType = 'flight_hotel';
        const analysis = hotelAnalysis(items);
        if (!items.length) {
          return ok(`No hotels available in ${city} for those dates. You can still submit a flight-only request or choose different dates.`, { intent, view: { type: 'text' } });
        }
        return ok(`Great — ${flight.airline} ${flight.flightNumber} selected (₹${flight.price.toLocaleString('en-IN')}). Do you need a hotel in ${city}? Here are options for ${checkIn} → ${checkOut}:`, {
          intent,
          view: { type: 'hotels', hotels: items, analysis },
          quickReplies: ['I only need a flight', 'Select the cheapest hotel'],
        });
      }
      return ok(`${flight.airline} ${flight.flightNumber} selected (₹${flight.price.toLocaleString('en-IN')}). Here is your trip summary — add a business purpose comment if you like, then create the request.`, {
        intent,
        view: buildTripSummaryView(session),
        actions: [{ label: 'Create Travel Request', command: 'create_request', variant: 'primary' }, { label: 'Start Over', command: 'reset', variant: 'secondary' }],
      });
    }

    case 'SEARCH_HOTEL': {
      const cities = extractCities(text);
      const city = params.city || (cities.length ? cities[0] : session.tripPlan?.flight?.to || session.tripPlan?.destination) || null;
      if (!city) {
        return ok('Fill in the hotel search form — or just type it, e.g. "Find hotels in Delhi":', {
          intent,
          view: { type: 'form', form: 'hotel' },
        });
      }
      const checkIn = params.checkIn || session.tripPlan?.travelDate || extractDate(text) || dateKeyOffset(1);
      const checkOut = params.checkOut || session.tripPlan?.returnDate || dateKeyOffset(3);
      session.tripPlan = { ...(session.tripPlan || {}), hotelCheckIn: checkIn, hotelCheckOut: checkOut };
      const budget = params.budget || extractBudget(text);
      const items = await searchHotelsTool(user, { city, checkIn, checkOut, budget });
      session.hotelResults = items;
      const analysis = hotelAnalysis(items);
      if (!items.length) {
        return ok(`I couldn't find hotels in ${city}${budget ? ` under ₹${budget.toLocaleString('en-IN')}` : ''} for ${checkIn} → ${checkOut}. Try different dates or a higher budget.`, { intent });
      }
      return ok(`I found ${items.length} hotel${items.length === 1 ? '' : 's'} in ${city} for ${checkIn} → ${checkOut} (${analysis ? analysis.nights : 2} night${analysis && analysis.nights === 1 ? '' : 's'}). Select one to continue.`, {
        intent,
        view: { type: 'hotels', hotels: items, analysis },
        quickReplies: ['Which is cheapest?', 'Is this within company policy?'],
      });
    }

    case 'SELECT_HOTEL': {
      const hotel = (session.hotelResults || []).find((h) => String(h.id) === String(params.id));
      if (!hotel) return ok("That hotel is no longer in the current results. Please search again.", { intent });
      const travelType = mode === 'hotel' ? 'hotel' : 'flight_hotel';
      session.tripPlan = { ...(session.tripPlan || {}), hotel, travelType };
      return ok(`${hotel.name} selected (${hotel.pricePerNight ? `₹${hotel.pricePerNight.toLocaleString('en-IN')}/night` : ''}). Here is your trip summary — add a business purpose comment if you like, then create the request.`, {
        intent,
        view: buildTripSummaryView(session),
        actions: [{ label: 'Create Travel Request', command: 'create_request', variant: 'primary' }, { label: 'Start Over', command: 'reset', variant: 'secondary' }],
      });
    }

    case 'PLAN_TRIP': {
      // Structured form submission (plan_form) — params carry the details.
      if (params && (params.from || params.to || params.date)) {
        const plan = {
          purpose: params.purpose || null,
          origin: params.from || null,
          destination: params.to || null,
          travelDate: params.date || null,
          returnDate: params.returnDate || null,
          mode: params.mode || 'flight',
          hotelNeeded: params.mode === 'hotel' || params.mode === 'flight_hotel',
        };
        return runPlannedSearch(user, session, plan);
      }
      // Natural-language trip description.
      const plan = extractTripPlan(text);
      if (!plan.origin || !plan.destination || !plan.travelDate) {
        session.wizard = { step: 'origin', plan: { ...plan, mode: plan.hotelNeeded ? 'flight_hotel' : 'flight', purpose: plan.purpose || undefined } };
        const missing = [];
        if (!plan.origin) missing.push('your departure city');
        if (!plan.destination) missing.push('your destination');
        if (!plan.travelDate) missing.push('the travel date');
        return ok(`I've got your plan so far: ${plan.purpose || 'business trip'} in ${plan.destination || '—'}${plan.travelDate ? ` on ${plan.travelDate}` : ''}. What is ${missing.join(' and ')}?`, {
          intent,
          view: { type: 'trip_plan', plan: summarizePlan(plan), missing },
        });
      }
      plan.mode = plan.hotelNeeded ? 'flight_hotel' : 'flight';
      return runPlannedSearch(user, session, plan);
    }

    case 'PLAN_TRIP_SHORT': {
      // Start the guided wizard; the date is captured when the user answers the date question.
      session.wizard = { step: 'origin', plan: { destination: params.destination || null, purpose: extractPurpose(text) || undefined } };
      return ok('I can help with that. Where are you travelling from?', { intent, quickReplies: ['Mumbai', 'Delhi', 'Bangalore', 'Pune'] });
    }

    case 'PLAN_TRIP_HELP': {
      return ok("Let's plan your trip. Fill in the details below — or just describe it, e.g. \"client meeting in Delhi on 27 August from Mumbai\":", {
        intent,
        view: { type: 'form', form: 'plan' },
      });
    }

    case 'PRICE_ANALYSIS': {
      if (session.flightResults && session.flightResults.length) {
        const analysis = priceAnalysis(session.flightResults);
        if (analysis) {
          return ok(analysis.reason, {
            intent,
            view: { type: 'price_analysis', cheapest: analysis.cheapest, average: analysis.average, recommended: { id: analysis.recommended.id, airline: analysis.recommended.airline, flightNumber: analysis.recommended.flightNumber, price: analysis.recommended.price, stops: analysis.recommended.stops, durationMinutes: analysis.recommended.durationMinutes } },
            quickReplies: ['Is this within company policy?'],
          });
        }
      }
      if (session.hotelResults && session.hotelResults.length) {
        const analysis = hotelAnalysis(session.hotelResults);
        if (analysis) {
          return ok(`The cheapest hotel is ₹${analysis.cheapest.toLocaleString('en-IN')}/night (average ₹${analysis.average.toLocaleString('en-IN')}). I recommend ${analysis.recommended ? analysis.recommended.name : 'the cheapest option'} for the best balance of rate and rating.`, { intent, view: { type: 'price_analysis', cheapest: analysis.cheapest, average: analysis.average, recommended: { id: analysis.recommended.id, name: analysis.recommended.name, price: analysis.recommended.pricePerNight } } });
        }
      }
      return ok("I need some search results first. Try \"Find flights from Mumbai to Delhi\" or \"Find hotels in Delhi\".", { intent });
    }

    case 'COMPARE_PRICES': {
      if (session.flightResults && session.flightResults.length) {
        return handleEmployeeIntent(user, session, 'PRICE_ANALYSIS', params, text);
      }
      return ok("I need search results first. Try \"Find flights from Mumbai to Delhi\".", { intent });
    }

    case 'POLICY_CHECK': {
      if (session.flightResults && session.flightResults.length) {
        const items = session.flightResults;
        const compliant = items.filter((f) => !f.policy || (f.policy.classAllowed && f.policy.underBudget));
        const msg = compliant.length === items.length
          ? `All ${items.length} flights shown comply with your corporate policy.`
          : `${items.length - compliant.length} of ${items.length} flights exceed your corporate policy (${items[0]?.policy?.flightBudget ? `flight budget ₹${items[0].policy.flightBudget.toLocaleString('en-IN')}` : 'class or budget limit'}). A policy-violating request cannot be submitted without compliant options.`;
        return ok(msg, { intent });
      }
      if (session.hotelResults && session.hotelResults.length) {
        const items = session.hotelResults;
        const compliant = items.filter((h) => !h.policy || (h.policy.starsAllowed && h.policy.underBudget));
        const msg = compliant.length === items.length
          ? `All ${items.length} hotels shown comply with your corporate policy.`
          : `${items.length - compliant.length} of ${items.length} hotels exceed your corporate policy (${items[0]?.policy?.hotelBudgetPerNight ? `hotel limit ₹${items[0].policy.hotelBudgetPerNight.toLocaleString('en-IN')}/night` : 'star or budget limit'}).`;
        return ok(msg, { intent });
      }
      return ok('I need search results first to check them against your corporate policy.', { intent });
    }

    case 'MY_REQUESTS': {
      const status = params.statusFilter || statusFromText(` ${text.toLowerCase()} `);
      const items = await getMyRequestsTool(user, { status });
      if (!items.length) {
        return ok(status === 'ALL' ? "You don't have any travel requests yet." : `You have no ${status.toLowerCase()} travel requests.`, { intent });
      }
      return ok(status === 'REJECTED'
        ? 'Here are your rejected requests and the reasons:'
        : `Here ${items.length === 1 ? 'is' : 'are'} your travel request${items.length === 1 ? '' : 's'}:`, {
        intent,
        view: { type: 'requests', items },
      });
    }

    case 'MY_TICKET': {
      const { request, booking } = await getMyLatestTicketed(user);
      if (!request || !booking) {
        return ok("You don't have a ticketed booking yet. A final ticket is generated only after the Travel Administrator completes the booking.", { intent });
      }
      return ok(`Your ticket for ${request.requestId} (PNR ${booking.pnr}) is ready.`, {
        intent,
        view: { type: 'ticket', booking: booking.toObject(), travelRequest: request },
        actions: [{ label: 'View Ticket', link: `/employee/ticket/${booking._id}`, variant: 'primary' }],
      });
    }

    case 'MY_INVOICE': {
      const { request, booking } = await getMyLatestTicketed(user);
      if (!request || !booking) {
        return ok("You don't have an invoice yet. An invoice is generated only after the final booking is confirmed.", { intent });
      }
      const invoice = buildInvoice(request, booking);
      return ok(`Here is your invoice ${invoice.invoiceNumber}.`, { intent, view: { type: 'invoice', invoice } });
    }

    case 'CREATE_REQUEST': {
      const plan = session.tripPlan;
      if (!plan || (!plan.flight && !plan.hotel)) {
        return ok("I need a flight or hotel selected first. Search and select one, then I'll create the request.", { intent });
      }
      const travelType = plan.travelType || (plan.flight && plan.hotel ? 'flight_hotel' : plan.flight ? 'flight' : 'hotel');
      const comment = plan.purpose || '';
      try {
        const request = await createTravelRequest(user, {
          travelType,
          flightId: plan.flight ? plan.flight.id : null,
          hotelId: plan.hotel ? plan.hotel.id : null,
          travelDate: plan.travelDate || (plan.hotel ? plan.hotelCheckIn : dateKeyOffset(1)),
          returnDate: plan.returnDate || (plan.hotel ? plan.hotelCheckOut : null),
          checkIn: plan.hotelCheckIn || plan.travelDate,
          checkOut: plan.hotelCheckOut || plan.returnDate,
          passengers: 1,
          rooms: 1,
          employeeComment: comment,
        });
        session.tripPlan = null;
        session.flightResults = [];
        session.hotelResults = [];
        await audit.log({ user, action: `ASSISTANT_${intent}`, entity: 'TravelRequest', entityId: request.requestId, details: { travelType } });
        return ok(`Travel request ${request.requestId} has been submitted to your Manager for approval.`, {
          intent,
          view: { type: 'result', ok: true, message: `Request ${request.requestId} · ${travelTypeLabel(travelType)} · ₹${request.totalAmount.toLocaleString('en-IN')}` },
          actions: [{ label: 'View My Requests', command: 'my requests', variant: 'primary' }],
        });
      } catch (err) {
        return ok(`I couldn't create the travel request: ${err.message || 'please try again.'}`, { intent, view: { type: 'result', ok: false, message: err.message || 'Request creation failed.' } });
      }
    }

    default:
      return null;
  }
}

function summarizePlan(plan) {
  return {
    purpose: plan.purpose || 'Business trip',
    origin: plan.origin || null,
    destination: plan.destination || null,
    travelDate: plan.travelDate || null,
    returnDate: plan.returnDate || null,
    hotelNeeded: plan.hotelNeeded ? 'Required' : 'Not required',
  };
}

function extractTripPlan(text) {
  const cities = extractCities(text);
  const purpose = extractPurpose(text);
  const hotelNeeded = /need.*hotel|hotel.*needed|with hotel|hotel required|accommodation/i.test(text) && !/no hotel|without hotel|no accommodation/i.test(text);
  const noHotel = /no hotel|without hotel|don'?t need.*hotel|only.*flight/i.test(text);

  const originM = text.match(/(?:from|depart(?:ing)?\s+(?:from)?)\s+([A-Za-z]+)/i);
  const destM = text.match(/(?:to|meeting in|meeting at|visit(?:ing)?)\s+([A-Za-z]+)/i);
  const origin = originM && CITIES.includes(originM[1]) ? originM[1] : null;
  let destination = destM && CITIES.includes(destM[1]) ? destM[1] : null;
  if (!destination && cities.length === 2) destination = cities[1];
  if (!destination && cities.length === 1) destination = cities[0];

  const travelM = text.match(/(?:travel|fly|leave|depart).*?(?:on\s+)?((?:\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)|tomorrow|today|20\d{2}-\d{1,2}-\d{1,2}))/i);
  const returnM = text.match(/(?:return|come back|back).*?(?:on\s+)?((?:\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)|tomorrow|today|20\d{2}-\d{1,2}-\d{1,2}))/i);
  const meetingM = text.match(/(?:meeting|visit|conference|workshop|training).*?(?:on\s+)?((?:\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)|20\d{2}-\d{1,2}-\d{1,2}))/i);

  const travelDate = travelM ? extractDate(travelM[1]) : (meetingM ? extractDate(meetingM[1]) : extractDate(text));
  const returnDate = returnM ? extractDate(returnM[1]) : null;

  return {
    purpose,
    origin,
    destination,
    travelDate,
    returnDate,
    hotelNeeded: hotelNeeded && !noHotel,
  };
}

function buildTripSummaryView(session) {
  const plan = session.tripPlan || {};
  const flight = plan.flight;
  const hotel = plan.hotel;
  const travelType = plan.travelType || (flight && hotel ? 'flight_hotel' : flight ? 'flight' : 'hotel');
  const flightCost = flight ? flight.price : 0;
  const nights = hotel ? (hotel.nights || 2) : 0;
  const hotelCost = hotel ? (hotel.totalPrice || hotel.pricePerNight * nights) : 0;
  return {
    type: 'trip_summary',
    origin: flight ? flight.from : (hotel ? hotel.city : null),
    destination: flight ? flight.to : (hotel ? hotel.city : null),
    travelType: travelTypeLabel(travelType),
    travelDate: plan.travelDate || plan.hotelCheckIn || null,
    returnDate: plan.returnDate || plan.hotelCheckOut || null,
    flight: flight ? { airline: flight.airline, flightNumber: flight.flightNumber, price: flight.price } : null,
    hotel: hotel ? { name: hotel.name, totalPrice: hotel.totalPrice || hotel.pricePerNight * nights, nights } : null,
    flightCost,
    hotelCost,
    totalAmount: flightCost + hotelCost,
    purpose: plan.purpose || '',
  };
}

/** Runs the search implied by a trip plan (flight / hotel / both). */
async function runPlannedSearch(user, session, plan) {
  const mode = plan.mode || (plan.hotelNeeded ? 'flight_hotel' : 'flight');
  const travelType = mode === 'hotel' ? 'hotel' : mode === 'flight_hotel' ? 'flight_hotel' : 'flight';
  session.tripPlan = { ...plan, mode, travelType, flight: null, hotel: null };

  if (travelType === 'hotel') {
    if (!plan.destination) {
      session.wizard = { step: 'origin', plan };
      return ok('Which city would you like to stay in?', { intent: 'PLAN_TRIP', quickReplies: ['Delhi', 'Mumbai', 'Bangalore', 'Pune'] });
    }
    const checkIn = plan.travelDate || dateKeyOffset(1);
    const checkOut = plan.returnDate || dateKeyOffset(3);
    const items = await searchHotelsTool(user, { city: plan.destination, checkIn, checkOut });
    session.hotelResults = items;
    if (!items.length) {
      return ok(`I couldn't find hotels in ${plan.destination} for ${checkIn} → ${checkOut}. Try different dates or a different city.`, { intent: 'PLAN_TRIP' });
    }
    return ok(`Here are hotels in ${plan.destination} for ${checkIn} → ${checkOut} (${plan.purpose || 'your trip'}). Select one to continue:`, {
      intent: 'PLAN_TRIP',
      view: { type: 'trip_plan', plan: summarizePlan({ ...plan, hotelNeeded: true }), hotels: items, analysis: hotelAnalysis(items) },
      quickReplies: ['Which is cheapest?'],
    });
  }

  const missing = [];
  if (!plan.origin) missing.push('your departure city');
  if (!plan.destination) missing.push('your destination');
  if (!plan.travelDate) missing.push('the travel date');
  if (missing.length) {
    session.wizard = { step: 'origin', plan };
    return ok(`I've got your plan so far: ${plan.purpose || 'business trip'} in ${plan.destination || '—'}${plan.travelDate ? ` on ${plan.travelDate}` : ''}. What is ${missing.join(' and ')}?`, {
      intent: 'PLAN_TRIP',
      view: { type: 'trip_plan', plan: summarizePlan(plan), missing },
    });
  }

  const { items } = await searchFlightsTool(user, { from: plan.origin, to: plan.destination, date: plan.travelDate, returnDate: plan.returnDate });
  session.flightResults = items;
  const analysis = priceAnalysis(items);
  if (!items.length) {
    return ok(`I couldn't find flights from ${plan.origin} to ${plan.destination} on ${plan.travelDate}. Try a different date or route.`, { intent: 'PLAN_TRIP' });
  }
  return ok(`Here's your trip plan — ${plan.purpose || 'business trip'} in ${plan.destination} on ${plan.travelDate}. I found ${items.length} flight${items.length === 1 ? '' : 's'} from ${plan.origin} to ${plan.destination}. Select a flight to continue.`, {
    intent: 'PLAN_TRIP',
    view: { type: 'trip_plan', plan: summarizePlan(plan), flights: items, analysis },
    quickReplies: ['Which is cheapest?'],
  });
}

/* ---------- manager handlers ---------- */
async function handleManagerIntent(user, session, intent, params, text) {
  // Defense in depth: approve/reject/booking flows require manager or admin role.
  if (['APPROVE_SUBMIT', 'REJECT_SUBMIT', 'APPROVE_REQUEST', 'REJECT_REQUEST'].includes(intent) && !['manager', 'admin'].includes(user.role)) {
    return deniedReply(user, 'approve');
  }
  switch (intent) {
    case 'SEARCH_REQUESTS': {
      const filters = { ...params };
      const cities = extractCities(text);
      const ref = extractRequestRef(text);
      if (ref) filters.search = ref.ref;
      else if (cities.length) filters.search = cities[0];
      else if (/(find|search|show)/i.test(text)) {
        const nameM = text.match(/(?:find|search|show|for)\s+([A-Za-z][A-Za-z']*)/i);
        const STOPWORDS = ['pending', 'approved', 'rejected', 'ticketed', 'cancelled', 'all', 'requests', 'request', 'trips', 'trip', 'upcoming', 'next', 'show', 'latest', 'team', 'travel'];
        if (nameM && !CITIES.includes(nameM[1]) && !STOPWORDS.includes(nameM[1].toLowerCase())) filters.search = nameM[1].replace(/'s$/i, '');
      }
      const date = extractDate(text);
      if (date && /next week|week|month/.test(text)) {
        const d = new Date(`${date}T00:00:00`);
        filters.dateFrom = date;
        const end = new Date(d);
        end.setDate(end.getDate() + 7);
        filters.dateTo = toDateKey(end);
      }
      const items = await searchRequestsTool(user.role, filters);
      if (!items.length) {
        return ok('No requests match those criteria.', { intent });
      }
      return ok(`Found ${items.length} request${items.length === 1 ? '' : 's'}:`, {
        intent,
        view: { type: 'requests', items },
      });
    }

    case 'REQUEST_DETAIL': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      if (user.role === 'employee' && !request.employeeId.equals(user._id)) {
        return ok('You can only view your own travel requests.', { intent, view: { type: 'error' } });
      }
      return ok(`Here are the details for ${request.requestId}:`, { intent, view: { type: 'request_detail', request: request.toObject() } });
    }

    case 'APPROVE_REQUEST': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      if (request.status !== 'PENDING') {
        return ok(`Request ${request.requestId} is ${request.status} — only pending requests can be approved.`, { intent });
      }
      session.pending = { type: 'approve', requestId: request._id.toString(), ref: request.requestId };
      return ok(`Approval confirmation for ${request.requestId}.`, {
        intent,
        view: {
          type: 'confirmation',
          kind: 'approve',
          title: 'Approval Confirmation',
          subtitle: `Request ${request.requestId} · ${request.employeeName} · ${request.travelType === 'hotel' ? request.to : `${request.from} → ${request.to}`}`,
          rows: [
            ['Request', request.requestId],
            ['Employee', request.employeeName],
            ['Destination', request.travelType === 'hotel' ? request.to : `${request.from} → ${request.to}`],
            ['Travel Type', travelTypeLabel(request.travelType)],
            ['Travel Date', new Date(request.travelDate).toLocaleDateString('en-IN')],
            ['Estimated Cost', `₹${request.totalAmount.toLocaleString('en-IN')}`],
          ],
          commentRequired: false,
        },
        actions: [{ label: 'Submit Approval', command: `approve_submit ${request.requestId}`, variant: 'success', needsComment: true }, { label: 'Cancel', command: 'cancel', variant: 'secondary' }],
      });
    }

    case 'APPROVE_SUBMIT': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      try {
        const updated = await approveRequest(user, request._id, params.comment);
        session.pending = null;
        await audit.log({ user, action: `ASSISTANT_${intent}`, entity: 'TravelRequest', entityId: updated.requestId, details: { decision: 'approve', comment: params.comment || '' } });
        return ok(`Request ${updated.requestId} has been approved. The employee has been notified.`, {
          intent,
          view: { type: 'result', ok: true, message: `${updated.requestId} · Approved · ₹${updated.totalAmount.toLocaleString('en-IN')}` },
          quickReplies: ['Show pending requests'],
        });
      } catch (err) {
        return ok(`I couldn't approve ${request.requestId}: ${err.message || 'please try again.'}`, { intent, view: { type: 'result', ok: false, message: err.message || 'Approval failed.' } });
      }
    }

    case 'REJECT_REQUEST': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      if (request.status !== 'PENDING') {
        return ok(`Request ${request.requestId} is ${request.status} — only pending requests can be rejected.`, { intent });
      }
      session.pending = { type: 'reject', requestId: request._id.toString(), ref: request.requestId };
      return ok(`Rejection for ${request.requestId} requires a reason. Please provide a comment for rejecting this request.`, {
        intent,
        view: {
          type: 'confirmation',
          kind: 'reject',
          title: 'Reject Request',
          subtitle: `Request ${request.requestId} · ${request.employeeName}`,
          rows: [
            ['Request', request.requestId],
            ['Employee', request.employeeName],
            ['Destination', request.travelType === 'hotel' ? request.to : `${request.from} → ${request.to}`],
            ['Estimated Cost', `₹${request.totalAmount.toLocaleString('en-IN')}`],
          ],
          commentRequired: true,
        },
        actions: [{ label: 'Submit Rejection', command: `reject_submit ${request.requestId}`, variant: 'danger', needsComment: true }, { label: 'Cancel', command: 'cancel', variant: 'secondary' }],
      });
    }

    case 'REJECT_SUBMIT': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      if (!params.comment) {
        return ok('A comment is required when rejecting a request. Please provide a reason.', { intent, view: { type: 'result', ok: false, message: 'Please provide a reason for rejection.' } });
      }
      try {
        const updated = await rejectRequest(user, request._id, params.comment);
        session.pending = null;
        await audit.log({ user, action: `ASSISTANT_${intent}`, entity: 'TravelRequest', entityId: updated.requestId, details: { decision: 'reject', comment: params.comment } });
        return ok(`Request ${updated.requestId} has been rejected. The employee has been notified with your reason.`, {
          intent,
          view: { type: 'result', ok: true, message: `${updated.requestId} · Rejected` },
        });
      } catch (err) {
        return ok(`I couldn't reject ${request.requestId}: ${err.message || 'please try again.'}`, { intent });
      }
    }

    case 'TEAM_SUMMARY': {
      const summary = await getTeamSummary();
      return ok('Here is your team travel summary:', {
        intent,
        view: {
          type: 'analytics',
          title: 'Team Travel Summary',
          rows: [
            ['Pending', summary.counts.PENDING],
            ['Approved', summary.counts.APPROVED],
            ['Rejected', summary.counts.REJECTED],
            ['Ticketed', summary.counts.TICKETED],
            ['Upcoming', summary.counts.upcoming],
          ],
          highlights: summary.topDestinations.map((d) => `${d.destination} — ${d.count} trip${d.count === 1 ? '' : 's'}`),
          highlightLabel: 'Top Destinations',
        },
      });
    }

    case 'UPCOMING_TRAVEL': {
      const items = await searchRequestsTool(user.role, { upcoming: true });
      if (!items.length) return ok('No upcoming team travel in the next few weeks.', { intent });
      return ok(`Here are the upcoming trips (${items.length} shown):`, { intent, view: { type: 'requests', items } });
    }

    default:
      return null;
  }
}

/* ---------- admin handlers ---------- */
async function handleAdminIntent(user, session, intent, params, text) {
  switch (intent) {
    case 'READY_FOR_BOOKING': {
      const items = await searchRequestsTool(user.role, { status: 'APPROVED', limit: 10 });
      const ready = items.filter((r) => r.status === 'APPROVED');
      if (!ready.length) return ok('There are no requests ready for final booking right now.', { intent });
      return ok(`Here are the requests ready for booking (${ready.length}):`, {
        intent,
        view: { type: 'requests', items: ready },
      });
    }

    case 'SEARCH_REQUESTS': {
      const filters = { ...params };
      const ref = extractRequestRef(text);
      const cities = extractCities(text);
      if (ref) filters.search = ref.ref;
      else if (cities.length) filters.search = cities[0];
      const items = await searchRequestsTool(user.role, filters);
      if (!items.length) return ok('No requests match those criteria.', { intent });
      return ok(`Found ${items.length} request${items.length === 1 ? '' : 's'}:`, { intent, view: { type: 'requests', items } });
    }

    case 'REQUEST_DETAIL':
    case 'BOOKING_STATUS': {
      const ref = params.ref || (extractRequestRef(text) || {}).ref;
      const request = ref ? await findRequestByRef(ref) : await TravelRequest.findOne({}).sort({ createdAt: -1 });
      if (!request) return ok("I couldn't find that request.", { intent });
      return ok(`Here are the booking details for ${request.requestId}:`, {
        intent,
        view: { type: 'request_detail', request: request.toObject() },
        actions: request.status === 'APPROVED'
          ? [{ label: 'Confirm Booking', command: `booking ${request.requestId}`, variant: 'primary' }]
          : [],
      });
    }

    case 'CONFIRM_BOOKING': {
      if (!params.ref) {
        return ok("Which request would you like to book? For example: \"confirm booking TRV-10004\".", { intent, quickReplies: ['Show requests ready for booking'] });
      }
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      if (!['APPROVED', 'READY_FOR_TICKETING'].includes(request.status)) {
        return ok(`Request ${request.requestId} is ${request.status} — only approved requests can be booked.`, { intent });
      }
      session.pending = { type: 'booking', requestId: request._id.toString(), ref: request.requestId };
      return ok(`Final booking confirmation for ${request.requestId}.`, {
        intent,
        view: {
          type: 'confirmation',
          kind: 'booking',
          title: 'Final Booking Confirmation',
          subtitle: `${request.employeeName} · ${request.requestId}`,
          rows: [
            ['Employee', request.employeeName],
            ['Request', request.requestId],
            ['Destination', request.travelType === 'hotel' ? request.to : `${request.from} → ${request.to}`],
            ['Travel Type', travelTypeLabel(request.travelType)],
            ['Total', `₹${request.totalAmount.toLocaleString('en-IN')}`],
            ['Manager', 'Approved'],
            ['Payment', request.paymentStatus === 'paid' ? 'Paid' : 'Pending'],
          ],
          commentRequired: false,
        },
        actions: [{ label: 'Confirm Booking', command: `booking_submit ${request.requestId}`, variant: 'primary', needsComment: true }, { label: 'Cancel', command: 'cancel', variant: 'secondary' }],
      });
    }

    case 'BOOKING_SUBMIT': {
      const request = await findRequestByRef(params.ref);
      if (!request) return ok(`I couldn't find request ${params.ref}.`, { intent });
      try {
        const result = await confirmBooking(request, user, params.comment);
        if (!result.success) {
          return ok(`I couldn't complete the booking because the booking service is temporarily unavailable. No booking was created.`, { intent, view: { type: 'result', ok: false, message: result.message } });
        }
        session.pending = null;
        await audit.log({ user, action: `ASSISTANT_${intent}`, entity: 'TravelRequest', entityId: request.requestId, details: { bookingReference: result.bookingReference, pnr: result.pnr, invoiceNumber: result.invoiceNumber } });
        return ok(`Booking confirmed. Booking ID: ${result.bookingReference}, PNR: ${result.pnr}. The ticket has been issued and invoice ${result.invoiceNumber} generated.`, {
          intent,
          view: { type: 'result', ok: true, message: `Booking ID: ${result.bookingReference} · Ticket: Issued · Invoice: ${result.invoiceNumber}` },
          actions: [{ label: 'View Invoice', command: `view_invoice ${request.requestId}`, variant: 'primary' }],
        });
      } catch (err) {
        return ok(`I couldn't complete the booking: ${err.message || 'please try again.'} No booking was created.`, { intent, view: { type: 'result', ok: false, message: err.message || 'Booking failed.' } });
      }
    }

    case 'VIEW_INVOICE': {
      const ref = params.ref || (extractRequestRef(text) || {}).ref;
      const request = ref ? await findRequestByRef(ref) : await TravelRequest.findOne({ status: 'TICKETED' }).sort({ createdAt: -1 });
      if (!request) return ok("I couldn't find that request.", { intent });
      if (request.status !== 'TICKETED') return ok(`Invoice is available only after the final booking — ${request.requestId} is ${request.status}.`, { intent });
      const booking = await Booking.findOne({ travelRequestId: request._id, status: 'confirmed' });
      const invoice = buildInvoice(request, booking);
      return ok(`Here is invoice ${invoice.invoiceNumber} for ${request.requestId}.`, {
        intent,
        view: { type: 'invoice', invoice },
        actions: [{ label: 'Download Invoice', command: `download_invoice ${request.requestId}`, variant: 'primary' }],
      });
    }

    case 'DOWNLOAD_INVOICE': {
      const ref = params.ref || (extractRequestRef(text) || {}).ref;
      const request = ref ? await findRequestByRef(ref) : await TravelRequest.findOne({ status: 'TICKETED' }).sort({ createdAt: -1 });
      if (!request) return ok("I couldn't find that request.", { intent });
      if (request.status !== 'TICKETED') return ok(`Invoice is available only after the final booking — ${request.requestId} is ${request.status}.`, { intent });
      const booking = await Booking.findOne({ travelRequestId: request._id, status: 'confirmed' });
      const invoice = buildInvoice(request, booking);
      await audit.log({ user, action: 'ASSISTANT_DOWNLOAD_INVOICE', entity: 'TravelRequest', entityId: request.requestId, details: { invoiceNumber: invoice.invoiceNumber } });
      return ok(`Downloading invoice ${invoice.invoiceNumber} for ${request.requestId}…`, {
        intent,
        view: { type: 'invoice', invoice },
        actions: [{ label: 'Download PDF', type: 'download_invoice', requestId: String(request._id), variant: 'primary' }],
      });
    }

    case 'SHOW_INVOICES': {
      const items = await searchRequestsTool(user.role, { status: 'TICKETED' });
      if (!items.length) return ok('No ticketed bookings yet, so no invoices are available.', { intent });
      return ok(`Here are the ticketed bookings (invoices available):`, { intent, view: { type: 'requests', items } });
    }

    case 'TRAVEL_ANALYTICS': {
      const a = await getTravelAnalytics();
      return ok('Here is your corporate travel analytics summary:', {
        intent,
        view: {
          type: 'analytics',
          title: 'Corporate Travel Analytics',
          rows: [
            ['Total Requests', a.counts.total],
            ['Pending', a.counts.PENDING],
            ['Approved', a.counts.APPROVED],
            ['Rejected', a.counts.REJECTED],
            ['Confirmed Bookings', a.bookings.confirmed],
            ['Cancelled', a.bookings.cancelled],
            ['Total Spend', `₹${a.totalSpend.toLocaleString('en-IN')}`],
            ['Average Trip Cost', `₹${a.averageTripCost.toLocaleString('en-IN')}`],
          ],
          highlights: a.topDestinations.map((d) => `${d.destination} — ${d.count} trip${d.count === 1 ? '' : 's'}`),
          highlightLabel: 'Top Destinations',
          travelTypes: a.travelTypes,
        },
      });
    }

    case 'COST_ANALYSIS': {
      const lastMonth = /last month/.test(text);
      const d = new Date();
      const monthKey = lastMonth
        ? `${d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()}-${String(d.getMonth() === 0 ? 12 : d.getMonth()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const c = await getCostAnalysis(monthKey);
      const compare = /compare/.test(text);
      return ok(`Corporate travel cost analysis for ${monthKey}:`, {
        intent,
        view: {
          type: 'cost_analysis',
          month: monthKey,
          rows: [
            ['Flights', `₹${c.flights.toLocaleString('en-IN')}`],
            ['Hotels', `₹${c.hotels.toLocaleString('en-IN')}`],
            ['Taxes', `₹${c.taxes.toLocaleString('en-IN')}`],
            ['Total', `₹${c.total.toLocaleString('en-IN')}`],
            ['Average Trip', `₹${c.averageTripCost.toLocaleString('en-IN')}`],
          ],
          topDestination: c.topDestination,
          previousMonthTotal: compare ? c.previousMonthTotal : null,
        },
      });
    }

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */
async function handleMessage(user, message, sessionId) {
  const text = String(message || '').trim();
  if (!text) return ok("Please type a message.", { intent: 'EMPTY' });

  const session = getSession(user._id, sessionId);
  session.lastActive = Date.now();
  session.history = [...(session.history || []).slice(-10), { role: 'user', text: text.slice(0, 300) }];

  // 1. Commands / explicit messages
  const cmd = parseCommand(text);
  if (cmd) {
    if (cmd.intent === 'HELP') {
      return ok(ROLE_HELP[user.role], { intent: 'HELP', quickReplies: roleQuickLabels(user.role) });
    }
    if (cmd.intent === 'RESET') {
      session.tripPlan = null;
      session.flightResults = [];
      session.hotelResults = [];
      session.pending = null;
      session.wizard = null;
      return ok('Alright, let\'s start over. How can I help?', { intent: 'RESET', quickReplies: roleQuickLabels(user.role) });
    }
    if (cmd.intent === 'CONFIRM_PENDING' && session.pending) {
      const pending = session.pending;
      if (pending.type === 'approve') return executeDecision(user, session, pending, 'approve', '');
      if (pending.type === 'reject') return ok('Please provide a reason for rejecting this request first. Type the reason as a message.', { intent: 'REJECT_REQUEST' });
      if (pending.type === 'booking') return executeDecision(user, session, pending, 'booking', '');
      return ok('Nothing is waiting for confirmation.', { intent: 'GENERIC' });
    }
    if (cmd.intent === 'CANCEL_PENDING') {
      session.pending = null;
      return ok('Cancelled — no action was taken.', { intent: 'CANCEL_PENDING' });
    }
    if (cmd.intent === 'APPROVE_SUBMIT' || cmd.intent === 'REJECT_SUBMIT') {
      if (!['manager', 'admin'].includes(user.role)) return deniedReply(user, 'approve');
      return handleManagerIntent(user, session, cmd.intent, cmd.params, text);
    }
    if (['BOOKING_SUBMIT', 'CONFIRM_BOOKING', 'DOWNLOAD_INVOICE', 'SHOW_INVOICES', 'BOOKING_STATUS'].includes(cmd.intent)) {
      if (user.role !== 'admin') return deniedReply(user, 'admin_only');
      return handleAdminIntent(user, session, cmd.intent, cmd.params, text);
    }
    if (cmd.intent === 'SELECT_FLIGHT') return handleEmployeeIntent(user, session, 'SELECT_FLIGHT', cmd.params, text);
    if (cmd.intent === 'SELECT_HOTEL') return handleEmployeeIntent(user, session, 'SELECT_HOTEL', cmd.params, text);
    if (cmd.intent === 'CREATE_REQUEST') return handleEmployeeIntent(user, session, 'CREATE_REQUEST', cmd.params, text);
    if (cmd.intent === 'VIEW_INVOICE') {
      if (user.role === 'admin') return handleAdminIntent(user, session, 'VIEW_INVOICE', cmd.params, text);
      if (user.role === 'employee') {
        const own = cmd.params.ref ? await findRequestByRef(cmd.params.ref) : (await getMyLatestTicketed(user))?.request;
        if (!own) return ok('You don\'t have an invoice yet. An invoice is generated only after the final booking is confirmed.', { intent: 'MY_INVOICE' });
        if (!own.employeeId.equals(user._id)) return deniedReply(user, 'invoice');
        if (own.status !== 'TICKETED') return ok(`Invoice is available only after the final booking — ${own.requestId} is ${own.status}.`, { intent: 'MY_INVOICE' });
        const booking = await Booking.findOne({ travelRequestId: own._id, status: 'confirmed' });
        const invoice = buildInvoice(own, booking);
        return ok(`Here is your invoice ${invoice.invoiceNumber}.`, { intent: 'MY_INVOICE', view: { type: 'invoice', invoice } });
      }
      return deniedReply(user, 'invoice');
    }
    if (cmd.intent === 'DOWNLOAD_INVOICE') {
      if (user.role !== 'admin') return deniedReply(user, 'download_invoice');
      return handleAdminIntent(user, session, 'DOWNLOAD_INVOICE', cmd.params, text);
    }
    if (cmd.intent === 'VIEW_TICKET') {
      if (user.role === 'employee' && cmd.params.ref) {
        const req = await findRequestByRef(cmd.params.ref);
        if (!req) return ok("I couldn't find that request.", { intent: 'MY_TICKET' });
        if (!req.employeeId.equals(user._id)) return deniedReply(user, 'ticket');
        const booking = await Booking.findOne({ travelRequestId: req._id, status: 'confirmed' });
        if (!booking) return ok(`Request ${req.requestId} has not been ticketed yet.`, { intent: 'MY_TICKET' });
        return ok(`Your ticket for ${req.requestId} (PNR ${booking.pnr}) is ready.`, {
          intent: 'MY_TICKET',
          view: { type: 'ticket', booking: booking.toObject(), travelRequest: req },
          actions: [{ label: 'View Ticket', link: `/employee/ticket/${booking._id}`, variant: 'primary' }],
        });
      }
      if (user.role === 'employee') return handleEmployeeIntent(user, session, 'MY_TICKET', {}, text);
      return handleManagerIntent(user, session, 'REQUEST_DETAIL', { ref: cmd.params.ref || '' }, text);
    }
    if (cmd.intent === 'REQUEST_DETAIL') return handleManagerIntent(user, session, 'REQUEST_DETAIL', cmd.params, text);
    if (cmd.intent === 'MY_REQUESTS') return handleEmployeeIntent(user, session, 'MY_REQUESTS', {}, text);
    if (cmd.intent === 'SEARCH_FLIGHT') return handleEmployeeIntent(user, session, 'SEARCH_FLIGHT', cmd.params || { from: null, to: null }, text);
    if (cmd.intent === 'SEARCH_HOTEL') return handleEmployeeIntent(user, session, 'SEARCH_HOTEL', cmd.params || {}, text);
    if (cmd.intent === 'COMPARE_PRICES') return handleEmployeeIntent(user, session, 'COMPARE_PRICES', {}, text);
    if (cmd.intent === 'PLAN_TRIP_HELP') return handleEmployeeIntent(user, session, 'PLAN_TRIP_HELP', {}, text);
    if (cmd.intent === 'PLAN_TRIP') return handleEmployeeIntent(user, session, 'PLAN_TRIP', cmd.params, text);
    if (cmd.intent === 'SEARCH_REQUESTS') {
      if (user.role === 'admin') return handleAdminIntent(user, session, 'SEARCH_REQUESTS', {}, text);
      if (user.role === 'manager') return handleManagerIntent(user, session, 'SEARCH_REQUESTS', {}, text);
      return deniedReply(user, 'search_all');
    }
    if (cmd.intent === 'BOOKING_STATUS') {
      if (user.role !== 'admin') return deniedReply(user, 'booking_status');
      return handleAdminIntent(user, session, 'BOOKING_STATUS', {}, text);
    }
    if (cmd.intent === 'SHOW_INVOICES') {
      if (user.role !== 'admin') return deniedReply(user, 'invoice');
      return handleAdminIntent(user, session, 'SHOW_INVOICES', {}, text);
    }
  }

  // 2. Guided trip-planning wizard — conversational fill-in ("25 August", "Delhi"...)
  if (session.wizard) {
    const wizardReply = await handleWizardStep(user, session, text);
    if (wizardReply) return wizardReply;
  }

  // 3. If a pending action is awaiting a comment (reject), treat the message as the reason
  if (session.pending && session.pending.type === 'reject' && session.pending.awaitingReason) {
    session.pending.comment = text;
    session.pending.awaitingReason = false;
    return ok(`Rejection reason noted: "${text}". Reply 'confirm' to reject ${session.pending.ref}, or 'cancel' to abort.`, { intent: 'REJECT_REQUEST', pending: true });
  }

  // 4. Role-aware intent classification
  const { intent, params = {} } = classify(user, text);

  // Small talk — normal conversational chat must never hit the unknown fallback.
  if (intent === 'GREETING') return greetingReply(user);
  if (intent === 'HOW_ARE_YOU') return ok("I'm ready to help with your corporate travel needs. What would you like to do?", { intent, quickReplies: roleQuickLabels(user.role) });
  if (intent === 'THANKS') return ok("You're welcome! 😊 Let me know if you need anything else.", { intent, quickReplies: roleQuickLabels(user.role) });
  if (intent === 'GOODBYE') return ok('Goodbye! Safe travels. ✈️', { intent });

  if (intent === 'DENIED_EMPLOYEE') {
    return ok("You don't have permission to approve travel requests. Manager approval is required.", { intent: 'PERMISSION_DENIED', view: { type: 'error' } });
  }
  if (intent === 'DENIED_MANAGER') {
    return ok('Payment processing is an Admin-only action. The request must be completed by an authorized Admin.', { intent: 'PERMISSION_DENIED', view: { type: 'error' } });
  }

  let response = null;
  if (user.role === 'employee') {
    response = await handleEmployeeIntent(user, session, intent, params, text);
    if (!response && intent === 'SEARCH_REQUESTS') return deniedReply(user, 'search_all');
  } else if (user.role === 'manager') {
    response = await handleManagerIntent(user, session, intent, params, text);
    if (!response && ['MY_REQUESTS', 'MY_TICKET', 'MY_INVOICE', 'CREATE_REQUEST', 'SEARCH_FLIGHT', 'SEARCH_HOTEL', 'PRICE_ANALYSIS', 'SET_MODE', 'PLAN_TRIP', 'SELECT_FLIGHT', 'SELECT_HOTEL', 'COMPARE_PRICES'].includes(intent)) {
      return deniedReply(user, intent.toLowerCase());
    }
  } else if (user.role === 'admin') {
    response = await handleAdminIntent(user, session, intent, params, text);
  }

  if (response) return response;

  // 4. Fallback
  return ok(ROLE_FALLBACK[user.role], { intent: 'UNKNOWN', quickReplies: ROLE_QUICK_ACTIONS[user.role].map((a) => a.label) });
}

async function executeDecision(user, session, pending, type, comment) {
  try {
    if (type === 'approve') {
      const request = await TravelRequest.findById(pending.requestId);
      if (!request) return ok('That request no longer exists.', { intent: 'APPROVE_REQUEST' });
      const updated = await approveRequest(user, request._id, comment);
      session.pending = null;
      await audit.log({ user, action: 'ASSISTANT_APPROVE_REQUEST', entity: 'TravelRequest', entityId: updated.requestId, details: { decision: 'approve' } });
      return ok(`Request ${updated.requestId} has been approved. The employee has been notified.`, { intent: 'APPROVE_REQUEST', view: { type: 'result', ok: true, message: `${updated.requestId} · Approved` } });
    }
    if (type === 'booking') {
      const request = await TravelRequest.findById(pending.requestId);
      if (!request) return ok('That request no longer exists.', { intent: 'CONFIRM_BOOKING' });
      const result = await confirmBooking(request, user, comment);
      if (!result.success) {
        return ok(`I couldn't complete the booking because the booking service is temporarily unavailable. No booking was created.`, { intent: 'CONFIRM_BOOKING', view: { type: 'result', ok: false, message: result.message } });
      }
      session.pending = null;
      await audit.log({ user, action: 'ASSISTANT_CONFIRM_BOOKING', entity: 'TravelRequest', entityId: request.requestId, details: { bookingReference: result.bookingReference, pnr: result.pnr } });
      return ok(`Booking confirmed. Booking ID: ${result.bookingReference}, PNR: ${result.pnr}.`, { intent: 'CONFIRM_BOOKING', view: { type: 'result', ok: true, message: `Booking ID: ${result.bookingReference} · Ticket: Issued` } });
    }
    return ok('Nothing to confirm.', { intent: 'GENERIC' });
  } catch (err) {
    return ok(`I couldn't complete that action: ${err.message || 'please try again.'}`, { intent: 'GENERIC', view: { type: 'result', ok: false, message: err.message || 'Action failed.' } });
  }
}

function deniedReply(user, action) {
  const map = {
    confirm_booking: 'Only the Travel Administrator can confirm final bookings.',
    download_invoice: 'Only the Travel Administrator can download invoices.',
    invoice: 'Invoices are managed by the Travel Administrator.',
    ticket: 'You can only view your own tickets.',
    search_all: 'You can only view your own travel data.',
    booking_status: 'Only the Travel Administrator can view booking status across the company.',
    admin_only: 'This action is Admin-only. The request must be completed by an authorized Admin.',
    approve: "You don't have permission to approve travel requests. Manager approval is required.",
  };
  return ok(map[action] || "You don't have permission to perform this action.", { intent: 'PERMISSION_DENIED', view: { type: 'error' } });
}

const roleQuickLabels = (role) => ROLE_QUICK_ACTIONS[role]?.map((a) => a.label) || [];

function greetingReply(user) {
  const greet = GREETING_REPLY[user.role] || GREETING_REPLY.employee;
  return ok(greet(firstName(user)), { intent: 'GREETING', quickReplies: roleQuickLabels(user.role) });
}

function getWelcome(user) {
  return { welcome: ROLE_WELCOME[user.role], quickActions: ROLE_QUICK_ACTIONS[user.role], role: user.role };
}

module.exports = { handleMessage, getWelcome, _sessions: sessions };
