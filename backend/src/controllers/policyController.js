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
 * Body: { flightId, hotelId, passengers, rooms, travelDate, returnDate }
 * Runs the Corporate Policy Engine against the logged-in employee's policy band.
 */
const validate = asyncHandler(async (req, res) => {
  const { flightId, hotelId, passengers = 1, rooms = 1, travelDate, returnDate } = req.body;

  if (!flightId || !hotelId) throw new ApiError(400, 'flightId and hotelId are required.');

  const [flight, hotel, policy] = await Promise.all([
    Flight.findById(flightId),
    Hotel.findById(hotelId),
    getPolicyForUser(req.user),
  ]);

  if (!flight) throw new ApiError(404, 'Selected flight is no longer available. Please search again.');
  if (!hotel) throw new ApiError(404, 'Selected hotel is no longer available. Please select another hotel.');
  if (!policy) throw new ApiError(409, 'No travel policy is configured for your designation. Please contact the administrator.');

  const nights = computeNights(travelDate, returnDate);
  const result = validateTrip({
    policy,
    flight,
    hotel,
    passengers: Number(passengers),
    rooms: Number(rooms),
    nights,
  });

  const costs = {
    flightCost: flight.price * Number(passengers),
    hotelCost: hotel.pricePerNight * nights * Number(rooms),
    total: flight.price * Number(passengers) + hotel.pricePerNight * nights * Number(rooms),
    nights,
  };

  if (!result.passed) {
    await audit.log({
      user: req.user,
      action: 'POLICY_VALIDATION_FAILED',
      entity: 'TravelRequest',
      details: { flightId, hotelId, reasons: result.reasons },
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
