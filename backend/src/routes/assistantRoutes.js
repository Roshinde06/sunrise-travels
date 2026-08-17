const express = require('express');
const { start, chat } = require('../controllers/assistantController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Both endpoints require a valid JWT; the role is resolved server-side.
router.get('/start', authenticate, start);
router.post('/chat', authenticate, chat);

module.exports = router;
