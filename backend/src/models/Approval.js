const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema(
  {
    travelRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TravelRequest', required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approverName: { type: String, default: '' },
    action: { type: String, enum: ['approve', 'reject'], required: true },
    reason: { type: String, default: '' }, // required when rejecting
    decidedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

approvalSchema.index({ travelRequestId: 1 });

module.exports = mongoose.model('Approval', approvalSchema);
