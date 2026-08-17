const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const TravelRequest = require('../models/TravelRequest');
const { nextSequence } = require('../models/Counter');
const { validateTrip, getPolicyForUser } = require('../services/policyService');
const { computeNights } = require('../services/hotelService');
const { notifyManagers } = require('../services/notificationService');
const audit = require('../services/auditService');

/**
 * POST /api/travel-requests — Employee submits a request.
 * The policy engine runs SERVER-SIDE here; a policy-violating request is rejected
 * and can never enter the PENDING queue.
 */
const create = asyncHandler(async (req, res) => {
  const { flightId, hotelId, travelDate, returnDate, passengers = 1, rooms = 1 } = req.body;

  if (!flightId || !hotelId || !travelDate) {
    throw new ApiError(400, 'flightId, hotelId and travelDate are required.');
  }
  if (req.user.role === 'employee' && req.user.status !== 'active') {
    throw new ApiError(403, 'Account is not active.');
  }

  const [flight, hotel, policy] = await Promise.all([
    Flight.findById(flightId),
    Hotel.findById(hotelId),
    getPolicyForUser(req.user),
  ]);

  if (!flight) throw new ApiError(404, 'Selected flight is no longer available. Please search again.');
  if (!hotel) throw new ApiError(404, 'Selected hotel is no longer available. Please select another hotel.');
  if (!policy) throw new ApiError(409, 'No travel policy is configured for your designation. Please contact the administrator.');

  const nights = computeNights(travelDate, returnDate);
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
      user: req.user,
      action: 'POLICY_VALIDATION_FAILED',
      entity: 'TravelRequest',
      details: { flightId, hotelId, reasons: result.reasons },
    });
    throw new ApiError(400, 'This travel option violates company policy.', {
      policy: { passed: false, reasons: result.reasons, details: result.details },
    });
  }

  const flightCost = flight.price * numPassengers;
  const hotelCost = hotel.pricePerNight * nights * numRooms;
  const totalAmount = flightCost + hotelCost;

  const seq = await nextSequence('travelRequest');
  const requestId = `TRV-${seq}`;

  const travelRequest = await TravelRequest.create({
    requestId,
    employeeId: req.user._id,
    employeeName: req.user.name,
    employeeDesignation: req.user.designation,
    flightId: flight._id,
    hotelId: hotel._id,
    from: flight.from,
    to: flight.to,
    travelDate: new Date(`${travelDate}T00:00:00`),
    returnDate: returnDate ? new Date(`${returnDate}T00:00:00`) : null,
    passengers: numPassengers,
    rooms: numRooms,
    nights,
    flightSnapshot: {
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
    },
    hotelSnapshot: {
      name: hotel.name,
      city: hotel.city,
      starRating: hotel.starRating,
      roomType: hotel.roomType,
      pricePerNight: hotel.pricePerNight,
    },
    flightCost,
    hotelCost,
    totalAmount,
    policyStatus: 'passed',
    policyMessage: 'Complies with company travel policy.',
    policyDetails: result.details,
    status: 'PENDING',
  });

  await audit.log({
    user: req.user,
    action: 'REQUEST_SUBMITTED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'DRAFT',
    newStatus: 'PENDING',
    details: { totalAmount },
  });

  await notifyManagers({
    type: 'info',
    title: 'New Travel Approval Request',
    message: `${req.user.name} submitted a travel request — ${flight.from} → ${flight.to} on ${new Date(travelRequest.travelDate).toLocaleDateString('en-IN')}. Amount: ₹${totalAmount.toLocaleString('en-IN')}. Please review.`,
    link: '/manager/approvals',
  });

  res.status(201).json({ success: true, travelRequest });
});

/**
 * GET /api/travel-requests — role-aware listing.
 * employee: own requests only. manager/admin: all requests (with filters).
 */
const list = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const query = {};

  if (req.user.role === 'employee') {
    query.employeeId = req.user._id;
  }

  if (status && status !== 'ALL') query.status = status;
  if (search) {
    query.$or = [
      { requestId: { $regex: search, $options: 'i' } },
      { from: { $regex: search, $options: 'i' } },
      { to: { $regex: search, $options: 'i' } },
    ];
  }

  const requests = await TravelRequest.find(query).sort({ createdAt: -1 });
  res.json({ success: true, requests });
});

/**
 * GET /api/travel-requests/:id — owner, manager, or admin only.
 */
const getById = asyncHandler(async (req, res) => {
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');

  if (req.user.role === 'employee' && !travelRequest.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You can only view your own travel requests.');
  }

  res.json({ success: true, travelRequest });
});

module.exports = { create, list, getById };
