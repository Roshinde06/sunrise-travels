const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const User = require('../models/User');
const { getPolicyForUser } = require('../services/policyService');
const audit = require('../services/auditService');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (user.status !== 'active') throw new ApiError(403, 'Your account has been deactivated.');

  const token = signToken(user);
  const policy = await getPolicyForUser(user);

  await audit.log({
    user,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.email,
  });

  res.json({ success: true, token, user: user.toSafeJSON(), policy });
});

const logout = asyncHandler(async (req, res) => {
  // Stateless JWT — client discards the token. Logged for audit completeness.
  await audit.log({ user: req.user, action: 'LOGOUT', entity: 'User', entityId: req.user.email });
  res.json({ success: true, message: 'Logged out.' });
});

const me = asyncHandler(async (req, res) => {
  const policy = await getPolicyForUser(req.user);
  res.json({ success: true, user: req.user.toSafeJSON(), policy });
});

module.exports = { login, logout, me };
