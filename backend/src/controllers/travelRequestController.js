const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const TravelRequest = require('../models/TravelRequest');
const { createTravelRequest } = require('../services/travelRequestService');

/**
 * POST /api/travel-requests — Employee submits a request.
 * travelType: 'flight' (flight only) | 'hotel' (hotel only) | 'flight_hotel' (both).
 * All business logic (per-type validation + policy engine) lives in travelRequestService,
 * which is also used by the Travel Assistant.
 */
const create = asyncHandler(async (req, res) => {
  const travelRequest = await createTravelRequest(req.user, req.body);
  res.status(201).json({ success: true, travelRequest });
});

/**
 * GET /api/travel-requests — role-aware listing.
 * employee: own requests only. manager/admin: all requests (with filters).
 * Query params: search, status, travelType, dateFrom, dateTo
 * search matches: requestId, employee name, destination, employee email, employee ID.
 */
const list = asyncHandler(async (req, res) => {
  const { status, search, travelType, dateFrom, dateTo } = req.query;
  const query = {};

  if (req.user.role === 'employee') {
    query.employeeId = req.user._id;
  }

  if (status && status !== 'ALL') query.status = status;
  if (travelType && travelType !== 'ALL') query.travelType = travelType;

  if (dateFrom || dateTo) {
    query.travelDate = {};
    if (dateFrom) query.travelDate.$gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) query.travelDate.$lte = new Date(`${dateTo}T23:59:59`);
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const or = [
      { requestId: { $regex: term, $options: 'i' } },
      { employeeName: { $regex: term, $options: 'i' } },
      { from: { $regex: term, $options: 'i' } },
      { to: { $regex: term, $options: 'i' } },
    ];
    if (mongoose.isValidObjectId(term)) or.push({ employeeId: term });
    const users = await User.find({ email: { $regex: term, $options: 'i' } }).select('_id');
    if (users.length) or.push({ employeeId: { $in: users.map((u) => u._id) } });
    query.$or = or;
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
