const express = require('express');
const { create, list, getById } = require('../controllers/travelRequestController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Validation happens per travel type inside the controller (flight / hotel / both).
router.post('/', authenticate, create);
router.get('/', authenticate, list);
router.get('/:id', authenticate, getById);

module.exports = router;
