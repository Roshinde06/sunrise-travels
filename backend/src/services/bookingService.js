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

/**
 * Final booking / ticketing. Performed by the Travel Administrator.
 * State machine: APPROVED -> READY_FOR_TICKETING -> TICKETED
 * On simulated failure the request returns to APPROVED and can be retried —
 * a failed booking is NEVER marked Ticketed.
 */
async function confirmBooking(travelRequest, adminUser) {
  if (!['APPROVED', 'READY_FOR_TICKETING'].includes(travelRequest.status)) {
    const err = new Error(`Cannot ticket a request with status "${travelRequest.status}". Only Approved requests can be ticketed.`);
    err.statusCode = 409;
    throw err;
  }

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
  const flight = await Flight.findById(travelRequest.flightId);
  const hotel = await Hotel.findById(travelRequest.hotelId);
  if (!flight || flight.availableSeats < travelRequest.passengers) {
    return handleBookingFailure(travelRequest, adminUser, 'Selected flight is no longer available. Please search again.');
  }
  if (!hotel || hotel.availableRooms < travelRequest.rooms) {
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

  // Commit inventory
  flight.availableSeats -= travelRequest.passengers;
  await flight.save();
  hotel.availableRooms -= travelRequest.rooms;
  await hotel.save();

  const booking = await Booking.create({
    travelRequestId: travelRequest._id,
    employeeId: travelRequest.employeeId,
    pnr,
    bookingReference,
    airline: travelRequest.flightSnapshot.airline,
    flightNumber: travelRequest.flightSnapshot.flightNumber,
    flightFrom: travelRequest.flightSnapshot.from,
    flightTo: travelRequest.flightSnapshot.to,
    flightDate: travelRequest.travelDate,
    flightDepartureTime: travelRequest.flightSnapshot.departureTime,
    flightArrivalTime: travelRequest.flightSnapshot.arrivalTime,
    travelClass: travelRequest.flightSnapshot.travelClass,
    hotelName: travelRequest.hotelSnapshot.name,
    hotelCity: travelRequest.hotelSnapshot.city,
    hotelStarRating: travelRequest.hotelSnapshot.starRating,
    hotelRoomType: travelRequest.hotelSnapshot.roomType,
    totalAmount: travelRequest.totalAmount,
    status: 'confirmed',
    ticketedAt: new Date(),
  });

  travelRequest.status = 'TICKETED';
  travelRequest.bookingFailureMessage = '';
  travelRequest.failedBookingAttempts = 0;
  await travelRequest.save();

  await audit.log({
    user: adminUser,
    action: 'BOOKING_CONFIRMED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'READY_FOR_TICKETING',
    newStatus: 'TICKETED',
    details: { pnr, bookingReference },
  });

  await notify(travelRequest.employeeId, {
    type: 'success',
    title: 'Travel Booking Confirmed',
    message: `Your travel request ${travelRequest.requestId} has been ticketed. PNR: ${pnr}. View your final ticket.`,
    link: `/employee/ticket/${booking._id}`,
  });

  return { success: true, booking, pnr, bookingReference, travelRequest };
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
