const asyncHandler = require('../utils/asyncHandler');
const { handleMessage, getWelcome } = require('../services/assistantService');
const audit = require('../services/auditService');

/**
 * GET /api/assistant/start — role-specific welcome + quick actions.
 * The role is always derived from the authenticated JWT, never from the client.
 */
const start = asyncHandler(async (req, res) => {
  const data = getWelcome(req.user);
  await audit.log({ user: req.user, action: 'ASSISTANT_STARTED', entity: 'Assistant', details: { role: req.user.role } });
  res.json({ success: true, ...data });
});

/**
 * POST /api/assistant/chat — the chatbot endpoint.
 * Body: { message, sessionId }
 * The backend determines the role from the authenticated user and only exposes
 * tools permitted for that role. Never trust a role sent by the frontend.
 *
 * Errors are deliberately sanitized: the real error is logged to the terminal
 * (so the 502/500 root cause is visible in the backend log) while the client
 * receives a friendly, non-leaking message.
 */
const chat = asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !String(message).trim()) {
    return res.json({ success: true, ...(await handleMessage(req.user, '', sessionId)) });
  }
  let result;
  try {
    result = await handleMessage(req.user, String(message), sessionId);
  } catch (err) {
    console.error('[assistant] chat handler failed for role=%s message=%j', req.user.role, String(message).slice(0, 120));
    console.error(err instanceof Error ? err.stack : err);
    return res.status(500).json({
      success: false,
      message: 'The Travel Assistant service is temporarily unavailable. Please try again in a moment.',
    });
  }
  res.json({ success: true, ...result });
});

module.exports = { start, chat };
