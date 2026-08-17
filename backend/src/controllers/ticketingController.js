const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const TravelRequest = require('../models/TravelRequest');
const Booking = require('../models/Booking');
const { confirmBooking, cancelBooking } = require('../services/bookingService');

/** GET /api/ticketing/pending — admin: approved requests waiting for final booking. */
const pending = asyncHandler(async (_req, res) => {
  const requests = await TravelRequest.find({
    status: { $in: ['APPROVED', 'READY_FOR_TICKETING'] },
  }).sort({ updatedAt: 1 });
  res.json({ success: true, requests });
});

/** POST /api/bookings/:id/confirm — admin confirms final booking (simulated). */
const confirm = asyncHandler(async (req, res) => {
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');

  const comment = req.body && (req.body.comment || req.body.reason);
  const result = await confirmBooking(travelRequest, req.user, comment);
  if (!result.success) {
    return res.status(502).json({
      success: false,
      message: result.message,
      travelRequest: result.travelRequest,
    });
  }

  res.json({
    success: true,
    message: `Booking confirmed. PNR: ${result.pnr}, Reference: ${result.bookingReference}${result.invoiceNumber ? `, Invoice: ${result.invoiceNumber}` : ''}`,
    booking: result.booking,
    travelRequest: result.travelRequest,
  });
});

/**
 * GET /api/bookings/:id/ticket — final ticket view.
 * Accessible to the owning employee, managers, and admins.
 */
const ticket = asyncHandler(async (req, res) => {
  // Accept either the Booking id or the TravelRequest id
  let booking = await Booking.findById(req.params.id);
  if (!booking) booking = await Booking.findOne({ travelRequestId: req.params.id });
  if (!booking) throw new ApiError(404, 'Booking not found.');

  if (req.user.role === 'employee' && !booking.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You can only view your own tickets.');
  }

  const travelRequest = await TravelRequest.findById(booking.travelRequestId);
  res.json({ success: true, booking, travelRequest });
});

/**
 * POST /api/bookings/:id/cancel
 * Employee cancels own Ticketed booking; admin can cancel any Ticketed booking.
 */
const cancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');

  if (req.user.role === 'employee' && !travelRequest.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You can only cancel your own bookings.');
  }

  const result = await cancelBooking(travelRequest, req.user, (reason || '').trim());
  res.json({ success: true, ...result });
});

module.exports = { pending, confirm, ticket, cancel };
