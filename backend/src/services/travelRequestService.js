const ApiError = require('../utils/ApiError');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const TravelRequest = require('../models/TravelRequest');
const { nextSequence } = require('../models/Counter');
const { validateTrip, getPolicyForUser } = require('./policyService');
const { computeNights } = require('./hotelService');
const { notifyManagers } = require('./notificationService');
const audit = require('./auditService');

/** Readable travel type label for notifications. */
function travelTypeLabel(type) {
  return { flight: 'flight-only', hotel: 'hotel-only', flight_hotel: 'flight + hotel' }[type] || type;
}

/**
 * Core business logic for creating a travel request.
 * Shared by the REST controller and the Travel Assistant so the chatbot can
 * NEVER bypass the policy engine or the PENDING approval workflow.
 *
 * @param {object} user — authenticated Mongoose user (employee)
 * @param {object} payload — { travelType, flightId, hotelId, travelDate, returnDate, checkIn, checkOut, passengers, rooms, employeeComment }
 * @returns {Promise<object>} created TravelRequest document
 */
async function createTravelRequest(user, payload = {}) {
  const {
    travelType = 'flight_hotel',
    flightId,
    hotelId,
    travelDate,
    returnDate,
    checkIn,
    checkOut,
    passengers = 1,
    rooms = 1,
    employeeComment = '',
  } = payload;

  if (!['flight', 'hotel', 'flight_hotel'].includes(travelType)) {
    throw new ApiError(400, 'travelType must be one of: flight, hotel, flight_hotel.');
  }
  if (user.role === 'employee' && user.status !== 'active') {
    throw new ApiError(403, 'Account is not active.');
  }

  const needsFlight = travelType !== 'hotel';
  const needsHotel = travelType !== 'flight';

  // -------- Per-type validation --------
  if (needsFlight && !flightId) throw new ApiError(400, 'Please select a flight.');
  if (needsHotel && !hotelId) throw new ApiError(400, 'Please select a hotel.');
  if (needsFlight && !travelDate) throw new ApiError(400, 'Please provide the travel date.');

  // Hotel-only requests carry dates as checkIn / checkOut
  const startDate = travelType === 'hotel' ? checkIn || travelDate : travelDate;
  const endDate = travelType === 'hotel' ? checkOut || returnDate : returnDate;
  if (needsHotel && !startDate) throw new ApiError(400, 'Please provide the hotel check-in date.');
  if (needsHotel && !endDate) throw new ApiError(400, 'Please provide the hotel check-out date.');

  const [flight, hotel, policy] = await Promise.all([
    needsFlight ? Flight.findById(flightId) : Promise.resolve(null),
    needsHotel ? Hotel.findById(hotelId) : Promise.resolve(null),
    getPolicyForUser(user),
  ]);

  if (needsFlight && !flight) throw new ApiError(404, 'Selected flight is no longer available. Please search again.');
  if (needsHotel && !hotel) throw new ApiError(404, 'Selected hotel is no longer available. Please select another hotel.');
  if (!policy) throw new ApiError(409, 'No travel policy is configured for your designation. Please contact the administrator.');

  const nights = computeNights(startDate, endDate);
  const numPassengers = Number(passengers) || 1;
  const numRooms = Number(rooms) || 1;

  // Mandatory policy validation before submission (business rule #4)
  const result = validateTrip({
    policy,
    flight,
    hotel,
    passengers: numPassengers,
    rooms: numRooms,
    nights,
  });

  if (!result.passed) {
    await audit.log({
      user,
      action: 'POLICY_VALIDATION_FAILED',
      entity: 'TravelRequest',
      details: { flightId, hotelId, travelType, reasons: result.reasons },
    });
    throw new ApiError(400, 'This travel option violates company policy.', {
      policy: { passed: false, reasons: result.reasons, details: result.details },
    });
  }

  const flightCost = flight ? flight.price * numPassengers : 0;
  const hotelCost = hotel ? hotel.pricePerNight * nights * numRooms : 0;
  const totalAmount = flightCost + hotelCost;

  const seq = await nextSequence('travelRequest');
  const requestId = `TRV-${seq}`;

  const comments = [];
  const employeeCommentText = String(employeeComment || '').trim();
  if (employeeCommentText) {
    comments.push({
      userId: user._id,
      role: 'employee',
      comment: employeeCommentText,
      action: 'submitted',
      createdAt: new Date(),
    });
  }

  const travelRequest = await TravelRequest.create({
    requestId,
    travelType,
    employeeId: user._id,
    employeeName: user.name,
    employeeDesignation: user.designation,
    employeeDepartment: user.department,
    employeeComment: employeeCommentText,
    flightId: flight ? flight._id : null,
    hotelId: hotel ? hotel._id : null,
    from: flight ? flight.from : '',
    to: flight ? flight.to : (hotel ? hotel.city : ''),
    travelDate: new Date(`${startDate}T00:00:00`),
    returnDate: endDate ? new Date(`${endDate}T00:00:00`) : null,
    passengers: numPassengers,
    rooms: numRooms,
    nights,
    flightSnapshot: flight
      ? {
          airline: flight.airline,
          flightNumber: flight.flightNumber,
          from: flight.from,
          fromCode: flight.fromCode,
          to: flight.to,
          toCode: flight.toCode,
          departureTime: flight.departureTime,
          arrivalTime: flight.arrivalTime,
          travelClass: flight.travelClass,
          price: flight.price,
        }
      : {},
    hotelSnapshot: hotel
      ? {
          name: hotel.name,
          city: hotel.city,
          location: hotel.location,
          starRating: hotel.starRating,
          roomType: hotel.roomType,
          pricePerNight: hotel.pricePerNight,
        }
      : {},
    flightCost,
    hotelCost,
    totalAmount,
    policyStatus: 'passed',
    policyMessage: 'Complies with company travel policy.',
    policyDetails: result.details,
    comments,
    status: 'PENDING',
  });

  await audit.log({
    user,
    action: 'REQUEST_SUBMITTED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'DRAFT',
    newStatus: 'PENDING',
    details: { travelType, totalAmount },
  });

  const routeLabel = travelType === 'hotel' ? travelRequest.to : `${travelRequest.from} → ${travelRequest.to}`;
  await notifyManagers({
    type: 'info',
    title: 'New Travel Approval Request',
    message: `${user.name} submitted a ${travelTypeLabel(travelType)} request — ${routeLabel} on ${new Date(travelRequest.travelDate).toLocaleDateString('en-IN')}. Amount: ₹${totalAmount.toLocaleString('en-IN')}. Please review.`,
    link: '/manager/approvals',
  });

  return travelRequest;
}

module.exports = { createTravelRequest, travelTypeLabel };
