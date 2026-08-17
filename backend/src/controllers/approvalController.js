const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const TravelRequest = require('../models/TravelRequest');
const Approval = require('../models/Approval');
const { notify } = require('../services/notificationService');
const audit = require('../services/auditService');

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
 */
const approve = asyncHandler(async (req, res) => {
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (travelRequest.status !== 'PENDING') {
    throw new ApiError(409, `Only Pending requests can be approved (current status: ${travelRequest.status}).`);
  }
  if (travelRequest.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You cannot approve your own travel request.');
  }

  travelRequest.status = 'APPROVED';
  await travelRequest.save();

  await Approval.create({
    travelRequestId: travelRequest._id,
    approverId: req.user._id,
    approverName: req.user.name,
    action: 'approve',
    reason: 'Approved',
    decidedAt: new Date(),
  });

  await audit.log({
    user: req.user,
    action: 'REQUEST_APPROVED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'PENDING',
    newStatus: 'APPROVED',
  });

  await notify(travelRequest.employeeId, {
    type: 'success',
    title: 'Travel Request Approved',
    message: `Your travel request ${travelRequest.requestId} has been approved. Your booking is now being processed for final ticketing.`,
    link: '/employee/my-trips',
  });

  res.json({ success: true, travelRequest });
});

/**
 * POST /api/approvals/:id/reject — rejection reason is required.
 */
const reject = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) throw new ApiError(400, 'A rejection reason is required.');

  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (travelRequest.status !== 'PENDING') {
    throw new ApiError(409, `Only Pending requests can be rejected (current status: ${travelRequest.status}).`);
  }
  if (travelRequest.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You cannot reject your own travel request.');
  }

  travelRequest.status = 'REJECTED';
  await travelRequest.save();

  await Approval.create({
    travelRequestId: travelRequest._id,
    approverId: req.user._id,
    approverName: req.user.name,
    action: 'reject',
    reason: reason.trim(),
    decidedAt: new Date(),
  });

  await audit.log({
    user: req.user,
    action: 'REQUEST_REJECTED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'PENDING',
    newStatus: 'REJECTED',
    details: { reason: reason.trim() },
  });

  await notify(travelRequest.employeeId, {
    type: 'danger',
    title: 'Travel Request Rejected',
    message: `Your travel request ${travelRequest.requestId} was rejected. Reason: ${reason.trim()}`,
    link: '/employee/my-trips',
  });

  res.json({ success: true, travelRequest });
});

module.exports = { pending, managerDashboard, getById, approve, reject };
