const express = require('express');
const { pending, confirm, ticket, cancel } = require('../controllers/ticketingController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.get('/pending', authenticate, authorize('admin'), pending);
router.post('/bookings/:id/confirm', authenticate, authorize('admin'), confirm);
router.get('/bookings/:id/ticket', authenticate, ticket);
router.post('/bookings/:id/cancel', authenticate, cancel);

module.exports = router;
