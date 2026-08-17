const AuditLog = require('../models/AuditLog');

async function log({
  user = null,
  action,
  entity = '',
  entityId = '',
  oldStatus = '',
  newStatus = '',
  details = {},
}) {
  try {
    await AuditLog.create({
      userId: user ? user._id : null,
      userName: user ? user.name : 'system',
      role: user ? user.role : 'system',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      oldStatus,
      newStatus,
      details,
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { log };
