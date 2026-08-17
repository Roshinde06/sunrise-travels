const express = require('express');
const { search, getById } = require('../controllers/hotelController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.get('/search', authenticate, search);
router.get('/:id', authenticate, getById);

module.exports = router;
