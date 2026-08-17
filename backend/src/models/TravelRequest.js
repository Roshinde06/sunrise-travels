const mongoose = require('mongoose');

const TRAVEL_REQUEST_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'READY_FOR_TICKETING',
  'TICKETED',
  'REJECTED',
  'CANCELLED',
];

const TRAVEL_TYPES = ['flight', 'hotel', 'flight_hotel'];

// Comment history entry: employee / manager / admin comments attached to a request.
const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, enum: ['employee', 'manager', 'admin'], default: 'employee' },
    comment: { type: String, default: '' },
    action: { type: String, default: '' }, // e.g. submitted / approved / rejected / booked
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const travelRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true }, // TRV-10001

    // Travel type: flight only / hotel only / both
    travelType: { type: String, enum: TRAVEL_TYPES, default: 'flight_hotel' },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeName: { type: String, required: true },
    employeeDesignation: { type: String, default: '' },
    employeeDepartment: { type: String, default: '' },

    // Employee's business purpose / comment (required from the requester)
    employeeComment: { type: String, default: '' },

    // Selected travel (hotel-only requests have no flightId; flight-only have no hotelId)
    flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', default: null },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    travelDate: { type: Date, required: true }, // flight date, or hotel check-in for hotel-only
    returnDate: { type: Date, default: null }, // return flight date, or hotel check-out for hotel-only
    passengers: { type: Number, default: 1, min: 1 },
    rooms: { type: Number, default: 1, min: 1 },
    nights: { type: Number, default: 1 },

    // Snapshot of what was selected (stable even if flight/hotel change later)
    flightSnapshot: {
      airline: String,
      flightNumber: String,
      from: String,
      fromCode: String,
      to: String,
      toCode: String,
      departureTime: String,
      arrivalTime: String,
      travelClass: String,
      price: Number,
    },
    hotelSnapshot: {
      name: String,
      city: String,
      location: String,
      starRating: Number,
      roomType: String,
      pricePerNight: Number,
    },

    // Costs
    flightCost: { type: Number, default: 0 }, // price * passengers (0 for hotel-only)
    hotelCost: { type: Number, default: 0 }, // perNight * nights * rooms (0 for flight-only)
    totalAmount: { type: Number, required: true },

    // Policy result (server-validated at submission)
    policyStatus: { type: String, enum: ['passed', 'failed', 'not_checked'], default: 'not_checked' },
    policyMessage: { type: String, default: '' },
    policyDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: { type: String, enum: TRAVEL_REQUEST_STATUSES, default: 'DRAFT' },

    // ---------- Approval / decision trail ----------
    managerDecision: { type: String, enum: ['approve', 'reject', null], default: null },
    managerComment: { type: String, default: '' },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    managerDecisionAt: { type: Date, default: null },

    adminDecision: { type: String, enum: ['approve', 'reject', null], default: null },
    adminComment: { type: String, default: '' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminDecisionAt: { type: Date, default: null },

    // Comment history (employee -> manager -> admin), never overwritten
    comments: { type: [commentSchema], default: [] },

    // ---------- Booking / payment / ticket / invoice ----------
    bookingStatus: { type: String, enum: ['none', 'confirmed', 'cancelled'], default: 'none' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    bookingDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    ticketDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    invoiceDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Ticketing failure handling
    failedBookingAttempts: { type: Number, default: 0 },
    bookingFailureMessage: { type: String, default: '' },
    lastTicketingAttemptAt: { type: Date, default: null },

    cancelledReason: { type: String, default: '' },
    cancelledBy: { type: String, default: '' },
  },
  { timestamps: true }
);

travelRequestSchema.index({ employeeId: 1, status: 1 });
travelRequestSchema.index({ status: 1, createdAt: 1 });
travelRequestSchema.index({ travelType: 1 });
travelRequestSchema.index({ bookingStatus: 1, paymentStatus: 1 });

module.exports = mongoose.model('TravelRequest', travelRequestSchema);
module.exports.TRAVEL_REQUEST_STATUSES = TRAVEL_REQUEST_STATUSES;
module.exports.TRAVEL_TYPES = TRAVEL_TYPES;
