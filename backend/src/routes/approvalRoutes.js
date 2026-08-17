const express = require('express');
const { body } = require('express-validator');
const { pending, managerDashboard, getById, approve, reject } = require('../controllers/approvalController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.get('/pending', authenticate, authorize('manager', 'admin'), pending);
router.get('/stats', authenticate, authorize('manager', 'admin'), managerDashboard);
router.get('/:id', authenticate, authorize('manager', 'admin'), getById);

router.post(
  '/:id/approve',
  authenticate,
  authorize('manager', 'admin'),
  approve
);

router.post(
  '/:id/reject',
  authenticate,
  authorize('manager', 'admin'),
  [body('reason').notEmpty().withMessage('A rejection reason is required.')],
  validate,
  reject
);

module.exports = router;
