const express = require('express');
const { body } = require('express-validator');
const {
  dashboard,
  bookings,
  rejectRequest,
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
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', dashboard);
router.get('/bookings', bookings);
router.post('/requests/:id/reject', rejectRequest);
router.get('/travel-spend', travelSpend);
router.get('/analytics', analytics);
router.get('/audit-logs', auditLogs);

router.get('/employees', listEmployees);
router.post(
  '/employees',
  [
    body('name').notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('role').isIn(['employee', 'manager', 'admin']).withMessage('Invalid role.'),
  ],
  validate,
  createEmployee
);
router.patch('/employees/:id', updateEmployee);

router.get('/policies', listPolicies);
router.post('/policies', createPolicy);
router.put('/policies/:id', updatePolicy);
router.delete('/policies/:id', deletePolicy);

module.exports = router;
