const express = require('express');
const { body } = require('express-validator');
const { create, list, getById } = require('../controllers/travelRequestController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [
    body('flightId').notEmpty().withMessage('flightId is required.'),
    body('hotelId').notEmpty().withMessage('hotelId is required.'),
    body('travelDate').notEmpty().withMessage('travelDate is required.'),
  ],
  validate,
  create
);

router.get('/', authenticate, list);
router.get('/:id', authenticate, getById);

module.exports = router;
