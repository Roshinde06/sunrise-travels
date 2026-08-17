const express = require('express');
const { body } = require('express-validator');
const { login, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
