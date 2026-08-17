const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const TravelRequest = require('../models/TravelRequest');
const Approval = require('../models/Approval');
const { approveRequest, rejectRequest } = require('../services/approvalService');

/** GET /api/approvals/pending — manager: requests waiting for approval. */
const pending = asyncHandler(async (_req, res) => {
  const requests = await TravelRequest.find({ status: 'PENDING' }).sort({ createdAt: 1 });
  res.json({ success: true, requests });
});

/** GET /api/manager/dashboard — manager stats. */
const managerDashboard = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingApprovals, approvedToday, rejectedToday, totalRequests, recent] = await Promise.all([
    TravelRequest.countDocuments({ status: 'PENDING' }),
    TravelRequest.countDocuments({ status: 'APPROVED', updatedAt: { $gte: todayStart } }),
    TravelRequest.countDocuments({ status: 'REJECTED', updatedAt: { $gte: todayStart } }),
    TravelRequest.countDocuments({}),
    TravelRequest.find({}).sort({ createdAt: -1 }).limit(10),
  ]);

  const history = await Approval.find({ approverId: req.user._id })
    .populate('travelRequestId')
    .sort({ decidedAt: -1 })
    .limit(20);

  res.json({
    success: true,
    stats: { pendingApprovals, approvedToday, rejectedToday, totalRequests },
    recent,
    history,
  });
});

/** GET /api/approvals/:id — manager reviews one pending request. */
const getById = asyncHandler(async (req, res) => {
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  res.json({ success: true, travelRequest });
});

/**
 * POST /api/approvals/:id/approve
 * Business rule: a user cannot approve their own request (managers cannot be the requester).
 * An optional manager comment (reason) is stored and shown in the comment history.
 */
const approve = asyncHandler(async (req, res) => {
  const comment = String((req.body && (req.body.reason || req.body.comment)) || '').trim();
  const travelRequest = await approveRequest(req.user, req.params.id, comment);
  res.json({ success: true, travelRequest });
});

/**
 * POST /api/approvals/:id/reject — rejection comment is required.
 */
const reject = asyncHandler(async (req, res) => {
  const comment = String((req.body && (req.body.reason || req.body.comment)) || '').trim();
  const travelRequest = await rejectRequest(req.user, req.params.id, comment);
  res.json({ success: true, travelRequest });
});

module.exports = { pending, managerDashboard, getById, approve, reject };
