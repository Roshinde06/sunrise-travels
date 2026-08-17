const asyncHandler = require('../utils/asyncHandler');
const Notification = require('../models/Notification');
const { markRead } = require('../services/notificationService');

const listMine = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
  res.json({ success: true, notifications, unread });
});

const markOneRead = asyncHandler(async (req, res) => {
  const notification = await markRead(req.user._id, req.params.id);
  res.json({ success: true, notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = { listMine, markOneRead, markAllRead };
