const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const bcrypt = require('bcryptjs');
const TravelRequest = require('../models/TravelRequest');
const Booking = require('../models/Booking');
const User = require('../models/User');
const TravelPolicy = require('../models/TravelPolicy');
const AuditLog = require('../models/AuditLog');
const audit = require('../services/auditService');

/** GET /api/admin/dashboard — the five required Project Sunrise metrics + extras. */
const dashboard = asyncHandler(async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayBookings, pendingApprovals, cancelledCount, spendAgg, cityAgg, approvedForTicketing, ticketedCount, failedCount, recentCancellations, recentActivity] =
    await Promise.all([
      Booking.countDocuments({ status: 'confirmed', ticketedAt: { $gte: todayStart } }),
      TravelRequest.countDocuments({ status: 'PENDING' }),
      TravelRequest.countDocuments({ status: 'CANCELLED' }),
      TravelRequest.aggregate([{ $match: { status: 'TICKETED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      TravelRequest.aggregate([
        { $match: { status: 'TICKETED' } },
        { $group: { _id: '$to', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
      TravelRequest.countDocuments({ status: 'APPROVED' }),
      TravelRequest.countDocuments({ status: 'TICKETED' }),
      TravelRequest.countDocuments({ failedBookingAttempts: { $gt: 0 } }),
      TravelRequest.find({ status: 'CANCELLED' }).sort({ updatedAt: -1 }).limit(5),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(10),
    ]);

  const travelSpend = spendAgg.length ? spendAgg[0].total : 0;

  res.json({
    success: true,
    metrics: {
      todayBookings,
      pendingApprovals,
      cancelledBookings: cancelledCount,
      travelSpend,
      mostTravelledCity: cityAgg.length ? cityAgg[0]._id : '—',
      approvedForTicketing,
      ticketedBookings: ticketedCount,
      failedBookingAttempts: failedCount,
    },
    recentCancellations,
    recentActivity,
  });
});

/** GET /api/admin/bookings — all travel requests with filters + pagination. */
const bookings = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status && status !== 'ALL') query.status = status;
  if (search) {
    query.$or = [
      { requestId: { $regex: search, $options: 'i' } },
      { employeeName: { $regex: search, $options: 'i' } },
      { from: { $regex: search, $options: 'i' } },
      { to: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await TravelRequest.countDocuments(query);
  const requests = await TravelRequest.find(query)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  res.json({ success: true, requests, total, page: Number(page), limit: Number(limit) });
});

/** GET /api/admin/travel-spend — spend breakdown by month, city, class. */
const travelSpend = asyncHandler(async (_req, res) => {
  const [byMonth, byCity, byClass, totalAgg] = await Promise.all([
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$travelDate' } },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED' } },
      { $group: { _id: '$to', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED' } },
      { $group: { _id: '$flightSnapshot.travelClass', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    TravelRequest.aggregate([{ $match: { status: 'TICKETED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    total: totalAgg.length ? totalAgg[0].total : 0,
    totalBookings: totalAgg.length ? totalAgg[0].count : 0,
    byMonth,
    byCity,
    byClass,
  });
});

/** GET /api/admin/analytics — status distribution + per-day bookings + top cities. */
const analytics = asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [byStatus, perDay, byCity, byDesignation] = await Promise.all([
    TravelRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TravelRequest.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: { $in: ['TICKETED', 'APPROVED', 'PENDING'] } } },
      { $group: { _id: '$to', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED' } },
      { $group: { _id: '$employeeDesignation', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  res.json({ success: true, byStatus, perDay, byCity, byDesignation });
});

/** GET /api/admin/audit-logs */
const auditLogs = asyncHandler(async (req, res) => {
  const { action, search } = req.query;
  const query = {};
  if (action && action !== 'ALL') query.action = action;
  if (search) {
    query.$or = [
      { userName: { $regex: search, $options: 'i' } },
      { entityId: { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
    ];
  }
  const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, logs });
});

// ---------------- Employees ----------------

const listEmployees = asyncHandler(async (_req, res) => {
  const users = await User.find({}).sort({ createdAt: 1 });
  const policies = await TravelPolicy.find({});
  const policyMap = {};
  policies.forEach((p) => {
    policyMap[p._id.toString()] = p;
  });
  res.json({
    success: true,
    employees: users.map((u) => ({ ...u.toSafeJSON(), policy: u.policyId ? policyMap[u.policyId.toString()] : null })),
  });
});

const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, password, role, designation, department } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'name, email and password are required.');
  if (!['employee', 'manager', 'admin'].includes(role)) throw new ApiError(400, 'Invalid role.');

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'A user with this email already exists.');

  const policy = designation
    ? await TravelPolicy.findOne({
        designationKey: designation.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        isActive: true,
      })
    : null;

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    designation: designation || '',
    department: department || '',
    policyId: policy ? policy._id : null,
  });

  await audit.log({
    user: req.user,
    action: 'EMPLOYEE_CREATED',
    entity: 'User',
    entityId: user.email,
    details: { role, designation },
  });

  res.status(201).json({ success: true, user: user.toSafeJSON() });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const { name, role, designation, department, status, policyId } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (designation !== undefined) user.designation = designation;
  if (department !== undefined) user.department = department;
  if (status !== undefined) user.status = status;
  if (policyId !== undefined) user.policyId = policyId || null;

  await user.save();

  await audit.log({
    user: req.user,
    action: 'EMPLOYEE_UPDATED',
    entity: 'User',
    entityId: user.email,
    details: { role, designation, status },
  });

  res.json({ success: true, user: user.toSafeJSON() });
});

// ---------------- Policies ----------------

const listPolicies = asyncHandler(async (_req, res) => {
  const policies = await TravelPolicy.find({}).sort({ maximumHotelStars: 1 });
  res.json({ success: true, policies });
});

const createPolicy = asyncHandler(async (req, res) => {
  const { designation, allowedFlightClasses, maximumHotelStars, flightBudget, hotelBudgetPerNight, description } = req.body;
  if (!designation || !allowedFlightClasses || !allowedFlightClasses.length) {
    throw new ApiError(400, 'designation and allowedFlightClasses are required.');
  }

  const designationKey = designation.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const policy = await TravelPolicy.create({
    designation,
    designationKey,
    allowedFlightClasses,
    maximumHotelStars: Number(maximumHotelStars) || 2,
    flightBudget: Number(flightBudget) || 0,
    hotelBudgetPerNight: Number(hotelBudgetPerNight) || 0,
    description: description || '',
  });

  await audit.log({
    user: req.user,
    action: 'POLICY_CREATED',
    entity: 'TravelPolicy',
    entityId: designation,
    details: { allowedFlightClasses, maximumHotelStars, flightBudget, hotelBudgetPerNight },
  });

  res.status(201).json({ success: true, policy });
});

const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await TravelPolicy.findById(req.params.id);
  if (!policy) throw new ApiError(404, 'Policy not found.');

  const { designation, allowedFlightClasses, maximumHotelStars, flightBudget, hotelBudgetPerNight, description, isActive } = req.body;
  if (designation !== undefined) {
    policy.designation = designation;
    policy.designationKey = designation.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  if (allowedFlightClasses !== undefined) policy.allowedFlightClasses = allowedFlightClasses;
  if (maximumHotelStars !== undefined) policy.maximumHotelStars = Number(maximumHotelStars);
  if (flightBudget !== undefined) policy.flightBudget = Number(flightBudget);
  if (hotelBudgetPerNight !== undefined) policy.hotelBudgetPerNight = Number(hotelBudgetPerNight);
  if (description !== undefined) policy.description = description;
  if (isActive !== undefined) policy.isActive = Boolean(isActive);

  await policy.save();

  await audit.log({
    user: req.user,
    action: 'POLICY_UPDATED',
    entity: 'TravelPolicy',
    entityId: policy.designation,
    details: { allowedFlightClasses, maximumHotelStars, flightBudget, hotelBudgetPerNight },
  });

  res.json({ success: true, policy });
});

/** Soft delete via PUT is handled by updatePolicy ({ isActive: false }).
 *  Hard delete permanently removes the policy; any users still assigned to it
 *  are detached (policyId → null) so the system never points at a missing policy.
 */
const deletePolicy = asyncHandler(async (req, res) => {
  const policy = await TravelPolicy.findById(req.params.id);
  if (!policy) throw new ApiError(404, 'Policy not found.');

  const usersOnPolicy = await User.countDocuments({ policyId: policy._id });
  await User.updateMany({ policyId: policy._id }, { $set: { policyId: null } });
  await policy.deleteOne();

  await audit.log({
    user: req.user,
    action: 'POLICY_DELETED',
    entity: 'TravelPolicy',
    entityId: policy.designation,
    details: { usersDetached: usersOnPolicy },
  });

  res.json({
    success: true,
    message: `Policy deleted${usersOnPolicy ? ` — ${usersOnPolicy} user(s) were detached from this policy.` : '.'}`,
    usersDetached: usersOnPolicy,
  });
});

module.exports = {
  dashboard,
  bookings,
  travelSpend,
  analytics,
  auditLogs,
  listEmployees,
  createEmployee,
  updateEmployee,
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
};
