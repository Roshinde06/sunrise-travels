const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const TravelPolicy = require('../models/TravelPolicy');
const { validateTrip, getPolicyForUser } = require('../services/policyService');
const { computeNights } = require('../services/hotelService');
const audit = require('../services/auditService');

/**
 * POST /api/policy/validate
 * Body: { travelType, flightId, hotelId, passengers, rooms, travelDate, returnDate, checkIn, checkOut }
 * Runs the Corporate Policy Engine against the logged-in employee's policy band.
 * flightId/hotelId are optional depending on travelType (flight only / hotel only / both).
 */
const validate = asyncHandler(async (req, res) => {
  const { travelType = 'flight_hotel', flightId, hotelId, passengers = 1, rooms = 1, travelDate, returnDate, checkIn, checkOut } = req.body;

  const needsFlight = travelType !== 'hotel';
  const needsHotel = travelType !== 'flight';
  if (needsFlight && !flightId) throw new ApiError(400, 'flightId is required for this travel type.');
  if (needsHotel && !hotelId) throw new ApiError(400, 'hotelId is required for this travel type.');

  // Hotel-only requests carry their dates as checkIn/checkOut; map to travelDate/returnDate.
  const startDate = travelType === 'hotel' ? checkIn : travelDate;
  const endDate = travelType === 'hotel' ? checkOut : returnDate;

  const [flight, hotel, policy] = await Promise.all([
    needsFlight ? Flight.findById(flightId) : Promise.resolve(null),
    needsHotel ? Hotel.findById(hotelId) : Promise.resolve(null),
    getPolicyForUser(req.user),
  ]);

  if (needsFlight && !flight) throw new ApiError(404, 'Selected flight is no longer available. Please search again.');
  if (needsHotel && !hotel) throw new ApiError(404, 'Selected hotel is no longer available. Please select another hotel.');
  if (!policy) throw new ApiError(409, 'No travel policy is configured for your designation. Please contact the administrator.');

  const nights = computeNights(startDate, endDate);
  const result = validateTrip({
    policy,
    flight,
    hotel,
    passengers: Number(passengers),
    rooms: Number(rooms),
    nights,
  });

  const numPassengers = Number(passengers) || 1;
  const numRooms = Number(rooms) || 1;
  const costs = {
    flightCost: flight ? flight.price * numPassengers : 0,
    hotelCost: hotel ? hotel.pricePerNight * nights * numRooms : 0,
    total: (flight ? flight.price * numPassengers : 0) + (hotel ? hotel.pricePerNight * nights * numRooms : 0),
    nights,
  };

  if (!result.passed) {
    await audit.log({
      user: req.user,
      action: 'POLICY_VALIDATION_FAILED',
      entity: 'TravelRequest',
      details: { flightId, hotelId, travelType, reasons: result.reasons },
    });
  }

  res.json({
    success: true,
    passed: result.passed,
    reasons: result.reasons,
    flightViolations: result.flightViolations,
    hotelViolations: result.hotelViolations,
    details: result.details,
    costs,
  });
});

const list = asyncHandler(async (_req, res) => {
  const policies = await TravelPolicy.find({ isActive: true }).sort({ maximumHotelStars: 1 });
  res.json({ success: true, policies });
});

module.exports = { validate, list };
