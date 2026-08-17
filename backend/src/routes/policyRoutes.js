const express = require('express');
const { validate, list } = require('../controllers/policyController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.post('/validate', authenticate, validate);
router.get('/', authenticate, list);

module.exports = router;
