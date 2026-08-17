const express = require('express');

const authRoutes = require('./authRoutes');
const flightRoutes = require('./flightRoutes');
const hotelRoutes = require('./hotelRoutes');
const policyRoutes = require('./policyRoutes');
const travelRequestRoutes = require('./travelRequestRoutes');
const approvalRoutes = require('./approvalRoutes');
const ticketingRoutes = require('./ticketingRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/flights', flightRoutes);
router.use('/hotels', hotelRoutes);
router.use('/policy', policyRoutes);
router.use('/policies', policyRoutes);
router.use('/travel-requests', travelRequestRoutes);
router.use('/approvals', approvalRoutes);
router.use('/ticketing', ticketingRoutes);
// Spec paths: POST /api/bookings/:id/confirm, GET /api/bookings/:id/ticket, POST /api/bookings/:id/cancel
router.use('/', ticketingRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
