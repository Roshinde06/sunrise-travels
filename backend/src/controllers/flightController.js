const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Flight = require('../models/Flight');
const { searchFlights } = require('../services/flightService');

const search = asyncHandler(async (req, res) => {
  const { from, to, departureDate, returnDate, passengers, travelClass } = req.query;
  if (!from || !to) throw new ApiError(400, 'Please provide From and To cities.');
  if (!departureDate) throw new ApiError(400, 'Please provide a departure date.');

  const result = await searchFlights({
    from,
    to,
    departureDate,
    returnDate,
    passengers: passengers ? Number(passengers) : 1,
    travelClass,
  });

  res.json({
    success: true,
    query: { from, to, departureDate, returnDate, passengers: Number(passengers || 1), travelClass },
    outbound: result.outbound,
    return: result.return,
  });
});

const getById = asyncHandler(async (req, res) => {
  const flight = await Flight.findById(req.params.id);
  if (!flight) throw new ApiError(404, 'Flight not found.');
  res.json({ success: true, flight });
});

module.exports = { search, getById };
