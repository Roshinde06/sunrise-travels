const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const TravelRequest = require('../models/TravelRequest');
const { nextSequence } = require('../models/Counter');
const { notify } = require('./notificationService');
const audit = require('./auditService');

const FAILURE_RATE = parseFloat(process.env.BOOKING_FAILURE_RATE || '0.2');

/** Simulates a call to an external airline/hotel booking API. */
function simulateExternalBookingApi() {
  return new Promise((resolve, reject) => {
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      if (Math.random() < FAILURE_RATE) {
        reject(new Error('External booking API returned an error (simulated provider outage).'));
      } else {
        resolve({ ok: true });
      }
    }, delay);
  });
}

function generatePnr() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pnr = '';
  for (let i = 0; i < 6; i += 1) pnr += chars[Math.floor(Math.random() * chars.length)];
  return pnr;
}

/** Assigns a plausible seat for the ticket (simulated cabin assignment). */
function assignSeat(travelClass) {
  const rows = travelClass === 'Business' ? randInt(1, 8) : randInt(10, 40);
  const letters = ['A', 'C', 'D', 'F'];
  return `${rows}${letters[Math.floor(Math.random() * letters.length)]}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TAX_RATE = 0.05; // GST on travel charges (derived from the actual fare data)

/**
 * Final booking / ticketing. Performed by the Travel Administrator.
 * State machine: APPROVED -> READY_FOR_TICKETING -> TICKETED
 * On simulated failure the request returns to APPROVED and can be retried —
 * a failed booking is NEVER marked Ticketed.
 *
 * `comment` is the optional admin note shown in the comment history.
 */
async function confirmBooking(travelRequest, adminUser, comment = '') {
  if (!['APPROVED', 'READY_FOR_TICKETING'].includes(travelRequest.status)) {
    const err = new Error(`Cannot ticket a request with status "${travelRequest.status}". Only Approved requests can be ticketed.`);
    err.statusCode = 409;
    throw err;
  }

  const adminNote = String(comment || '').trim();
  const previousStatus = travelRequest.status;

  // Mark as in-progress
  travelRequest.status = 'READY_FOR_TICKETING';
  travelRequest.lastTicketingAttemptAt = new Date();
  await travelRequest.save();
  await audit.log({
    user: adminUser,
    action: 'TICKETING_INITIATED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: previousStatus,
    newStatus: 'READY_FOR_TICKETING',
  });

  // Re-check availability of the selected inventory
  const flight = travelRequest.flightId ? await Flight.findById(travelRequest.flightId) : null;
  const hotel = travelRequest.hotelId ? await Hotel.findById(travelRequest.hotelId) : null;
  if (flight && flight.availableSeats < travelRequest.passengers) {
    return handleBookingFailure(travelRequest, adminUser, 'Selected flight is no longer available. Please search again.');
  }
  if (hotel && hotel.availableRooms < travelRequest.rooms) {
    return handleBookingFailure(travelRequest, adminUser, 'Selected hotel is no longer available. Please select another hotel.');
  }

  // Simulate external booking API
  try {
    await simulateExternalBookingApi();
  } catch (err) {
    return handleBookingFailure(travelRequest, adminUser, err.message);
  }

  // Success path
  const pnr = generatePnr();
  const bookingReference = `BK-${await nextSequence('booking')}`;
  const invoiceNumber = `INV-${await nextSequence('invoice')}`;
  const seat = assignSeat(travelRequest.flightSnapshot.travelClass || 'Economy');
  const now = new Date();

  // Commit inventory
  if (flight) {
    flight.availableSeats -= travelRequest.passengers;
    await flight.save();
  }
  if (hotel) {
    hotel.availableRooms -= travelRequest.rooms;
    await hotel.save();
  }

  const booking = await Booking.create({
    travelRequestId: travelRequest._id,
    employeeId: travelRequest.employeeId,
    pnr,
    bookingReference,
    airline: travelRequest.flightSnapshot.airline || '',
    flightNumber: travelRequest.flightSnapshot.flightNumber || '',
    flightFrom: travelRequest.flightSnapshot.from || '',
    flightTo: travelRequest.flightSnapshot.to || '',
    flightDate: travelRequest.flightId ? travelRequest.travelDate : null,
    flightDepartureTime: travelRequest.flightSnapshot.departureTime || '',
    flightArrivalTime: travelRequest.flightSnapshot.arrivalTime || '',
    travelClass: travelRequest.flightSnapshot.travelClass || '',
    seat,
    hotelName: travelRequest.hotelSnapshot.name || '',
    hotelCity: travelRequest.hotelSnapshot.city || '',
    hotelStarRating: travelRequest.hotelSnapshot.starRating || 0,
    hotelRoomType: travelRequest.hotelSnapshot.roomType || '',
    hotelCheckIn: travelRequest.hotelId ? travelRequest.travelDate : null,
    hotelCheckOut: travelRequest.hotelId ? travelRequest.returnDate : null,
    flightCost: travelRequest.flightCost,
    hotelCost: travelRequest.hotelCost,
    totalAmount: travelRequest.totalAmount,
    status: 'confirmed',
    ticketedAt: now,
  });

  // Taxes are derived from the real fare data (5% GST on travel charges).
  const taxes = Math.round((travelRequest.flightCost + travelRequest.hotelCost) * TAX_RATE);

  travelRequest.status = 'TICKETED';
  travelRequest.bookingFailureMessage = '';
  travelRequest.failedBookingAttempts = 0;
  travelRequest.bookingStatus = 'confirmed';
  travelRequest.paymentStatus = 'paid';
  travelRequest.adminDecision = 'approve';
  travelRequest.adminComment = adminNote || 'Booking approved and payment processed.';
  travelRequest.adminId = adminUser._id;
  travelRequest.adminDecisionAt = now;
  travelRequest.comments.push({
    userId: adminUser._id,
    role: 'admin',
    comment: adminNote || 'Booking approved and payment processed.',
    action: 'booked',
    createdAt: now,
  });
  travelRequest.ticketDetails = {
    pnr,
    bookingReference,
    ticketNumber: pnr,
    seat,
    airline: travelRequest.flightSnapshot.airline || '',
    flightNumber: travelRequest.flightSnapshot.flightNumber || '',
    from: travelRequest.flightSnapshot.from || '',
    to: travelRequest.flightSnapshot.to || '',
    travelDate: travelRequest.travelDate,
    departureTime: travelRequest.flightSnapshot.departureTime || '',
    arrivalTime: travelRequest.flightSnapshot.arrivalTime || '',
    travelClass: travelRequest.flightSnapshot.travelClass || '',
    fare: travelRequest.totalAmount,
    issuedAt: now,
  };
  travelRequest.invoiceDetails = {
    invoiceNumber,
    invoiceDate: now,
    flightCharges: travelRequest.flightCost,
    hotelCharges: travelRequest.hotelCost,
    taxes,
    serviceCharges: 0,
    otherCharges: 0,
    totalAmount: travelRequest.flightCost + travelRequest.hotelCost + taxes,
    paymentStatus: 'paid',
    paymentDate: now,
    bookingStatus: 'confirmed',
  };
  travelRequest.bookingDetails = {
    pnr,
    bookingReference,
    bookedAt: now,
  };
  await travelRequest.save();

  await audit.log({
    user: adminUser,
    action: 'BOOKING_CONFIRMED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'READY_FOR_TICKETING',
    newStatus: 'TICKETED',
    details: { pnr, bookingReference, invoiceNumber, adminNote },
  });

  await notify(travelRequest.employeeId, {
    type: 'success',
    title: 'Travel Booking Confirmed',
    message: `Your travel request ${travelRequest.requestId} has been ticketed. PNR: ${pnr}. View your final ticket and invoice.`,
    link: `/employee/ticket/${booking._id}`,
  });

  return { success: true, booking, pnr, bookingReference, invoiceNumber, travelRequest };
}

async function handleBookingFailure(travelRequest, adminUser, message) {
  travelRequest.status = 'APPROVED';
  travelRequest.failedBookingAttempts += 1;
  travelRequest.bookingFailureMessage = message;
  await travelRequest.save();

  await audit.log({
    user: adminUser,
    action: 'TICKETING_FAILED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'READY_FOR_TICKETING',
    newStatus: 'APPROVED',
    details: { message },
  });

  return {
    success: false,
    message,
    travelRequest,
  };
}

/**
 * Cancellation. Business rule: only TICKETED bookings can be cancelled.
 * Inventory (seats/rooms) is released back on cancellation.
 */
async function cancelBooking(travelRequest, actor, reason = '') {
  if (travelRequest.status !== 'TICKETED') {
    const err = new Error(`Only Ticketed bookings can be cancelled (current status: ${travelRequest.status}).`);
    err.statusCode = 409;
    throw err;
  }

  const booking = await Booking.findOne({ travelRequestId: travelRequest._id, status: 'confirmed' });
  if (!booking) {
    const err = new Error('No confirmed booking found for this request.');
    err.statusCode = 404;
    throw err;
  }

  const flight = await Flight.findById(travelRequest.flightId);
  const hotel = await Hotel.findById(travelRequest.hotelId);
  if (flight) {
    flight.availableSeats += travelRequest.passengers;
    await flight.save();
  }
  if (hotel) {
    hotel.availableRooms += travelRequest.rooms;
    await hotel.save();
  }

  travelRequest.status = 'CANCELLED';
  travelRequest.cancelledReason = reason;
  travelRequest.cancelledBy = actor.name;
  travelRequest.bookingStatus = 'cancelled';
  travelRequest.paymentStatus = 'refunded';
  await travelRequest.save();

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();

  await audit.log({
    user: actor,
    action: 'BOOKING_CANCELLED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'TICKETED',
    newStatus: 'CANCELLED',
    details: { reason, bookingReference: booking.bookingReference, pnr: booking.pnr },
  });

  await notify(travelRequest.employeeId, {
    type: 'warning',
    title: 'Booking Cancelled',
    message: `Your booking ${travelRequest.requestId} (PNR: ${booking.pnr}) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    link: `/employee/my-trips`,
  });

  return { success: true, travelRequest, booking };
}

module.exports = { confirmBooking, cancelBooking, generatePnr };
