const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },
    role: { type: String, default: '' },
    action: { type: String, required: true },
    entity: { type: String, default: '' }, // TravelRequest | Booking | User | TravelPolicy ...
    entityId: { type: String, default: '' },
    oldStatus: { type: String, default: '' },
    newStatus: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
