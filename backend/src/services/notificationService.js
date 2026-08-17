const Notification = require('../models/Notification');
const User = require('../models/User');

async function notify(userId, { type = 'info', title, message = '', link = '' }) {
  return Notification.create({ userId, type, title, message, link });
}

/** Notify all active managers (used when a new approval request is submitted). */
async function notifyManagers({ type = 'info', title, message = '', link = '' }) {
  const managers = await User.find({ role: 'manager', status: 'active' }).select('_id');
  const docs = managers.map((m) => ({ userId: m._id, type, title, message, link }));
  if (docs.length) return Notification.insertMany(docs);
  return [];
}

async function markRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
  return notification;
}

module.exports = { notify, notifyManagers, markRead };
