const ApiError = require('../utils/ApiError');
const TravelRequest = require('../models/TravelRequest');
const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const { notify } = require('./notificationService');
const audit = require('./auditService');

/**
 * Manager approves a PENDING travel request. Optional comment is stored
 * on the request and in the comment history. A user cannot approve their own request.
 */
async function approveRequest(user, requestId, comment = '') {
  const commentText = String(comment || '').trim();
  const travelRequest = await TravelRequest.findById(requestId);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (travelRequest.status !== 'PENDING') {
    throw new ApiError(409, `Only Pending requests can be approved (current status: ${travelRequest.status}).`);
  }
  if (travelRequest.employeeId.equals(user._id)) {
    throw new ApiError(403, 'You cannot approve your own travel request.');
  }

  travelRequest.status = 'APPROVED';
  travelRequest.managerDecision = 'approve';
  travelRequest.managerComment = commentText || 'Approved';
  travelRequest.managerId = user._id;
  travelRequest.managerDecisionAt = new Date();
  travelRequest.comments.push({
    userId: user._id,
    role: 'manager',
    comment: commentText || 'Approved',
    action: 'approved',
    createdAt: new Date(),
  });
  await travelRequest.save();

  await Approval.create({
    travelRequestId: travelRequest._id,
    approverId: user._id,
    approverName: user.name,
    action: 'approve',
    reason: commentText || 'Approved',
    decidedAt: new Date(),
  });

  await audit.log({
    user,
    action: 'REQUEST_APPROVED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'PENDING',
    newStatus: 'APPROVED',
    details: commentText ? { comment: commentText } : {},
  });

  await notify(travelRequest.employeeId, {
    type: 'success',
    title: 'Travel Request Approved',
    message: `Your travel request ${travelRequest.requestId} has been approved. Your booking is now being processed for final ticketing.`,
    link: '/employee/my-trips',
  });

  return travelRequest;
}

/**
 * Manager rejects a PENDING travel request. A rejection comment is REQUIRED.
 */
async function rejectRequest(user, requestId, comment = '') {
  const commentText = String(comment || '').trim();
  if (!commentText) throw new ApiError(400, 'A comment is required when rejecting a request.');

  const travelRequest = await TravelRequest.findById(requestId);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (travelRequest.status !== 'PENDING') {
    throw new ApiError(409, `Only Pending requests can be rejected (current status: ${travelRequest.status}).`);
  }
  if (travelRequest.employeeId.equals(user._id)) {
    throw new ApiError(403, 'You cannot reject your own travel request.');
  }

  travelRequest.status = 'REJECTED';
  travelRequest.managerDecision = 'reject';
  travelRequest.managerComment = commentText;
  travelRequest.managerId = user._id;
  travelRequest.managerDecisionAt = new Date();
  travelRequest.comments.push({
    userId: user._id,
    role: 'manager',
    comment: commentText,
    action: 'rejected',
    createdAt: new Date(),
  });
  await travelRequest.save();

  await Approval.create({
    travelRequestId: travelRequest._id,
    approverId: user._id,
    approverName: user.name,
    action: 'reject',
    reason: commentText,
    decidedAt: new Date(),
  });

  await audit.log({
    user,
    action: 'REQUEST_REJECTED',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'PENDING',
    newStatus: 'REJECTED',
    details: { reason: commentText },
  });

  await notify(travelRequest.employeeId, {
    type: 'danger',
    title: 'Travel Request Rejected',
    message: `Your travel request ${travelRequest.requestId} was rejected. Reason: ${commentText}`,
    link: '/employee/my-trips',
  });

  return travelRequest;
}

/**
 * Admin rejects an APPROVED (manager-approved) request before final booking.
 * An admin comment is REQUIRED. Stores adminDecision/adminComment/adminId/adminDecisionAt.
 */
async function adminRejectRequest(user, requestId, comment = '') {
  const commentText = String(comment || '').trim();
  if (!commentText) throw new ApiError(400, 'A comment is required when rejecting a request.');

  const travelRequest = await TravelRequest.findById(requestId);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (!['APPROVED', 'READY_FOR_TICKETING'].includes(travelRequest.status)) {
    throw new ApiError(409, `Only approved requests can be rejected by the administrator (current status: ${travelRequest.status}).`);
  }

  travelRequest.status = 'REJECTED';
  travelRequest.adminDecision = 'reject';
  travelRequest.adminComment = commentText;
  travelRequest.adminId = user._id;
  travelRequest.adminDecisionAt = new Date();
  travelRequest.comments.push({
    userId: user._id,
    role: 'admin',
    comment: commentText,
    action: 'rejected',
    createdAt: new Date(),
  });
  await travelRequest.save();

  await audit.log({
    user,
    action: 'REQUEST_REJECTED_BY_ADMIN',
    entity: 'TravelRequest',
    entityId: travelRequest.requestId,
    oldStatus: 'APPROVED',
    newStatus: 'REJECTED',
    details: { comment: commentText },
  });

  await Notification.create({
    userId: travelRequest.employeeId,
    type: 'danger',
    title: 'Travel Request Rejected',
    message: `Your travel request ${travelRequest.requestId} was rejected by the Travel Administrator. Reason: ${commentText}`,
    link: '/employee/my-trips',
  });

  return travelRequest;
}

module.exports = { approveRequest, rejectRequest, adminRejectRequest };
