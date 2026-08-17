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

const travelRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true }, // TRV-10001
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeName: { type: String, required: true },
    employeeDesignation: { type: String, default: '' },

    // Selected travel
    flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    travelDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    passengers: { type: Number, default: 1, min: 1 },
    rooms: { type: Number, default: 1, min: 1 },

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
      starRating: Number,
      roomType: String,
      pricePerNight: Number,
    },

    // Costs
    flightCost: { type: Number, required: true }, // price * passengers
    hotelCost: { type: Number, required: true }, // perNight * nights * rooms
    totalAmount: { type: Number, required: true },
    nights: { type: Number, default: 1 },

    // Policy result (server-validated at submission)
    policyStatus: { type: String, enum: ['passed', 'failed', 'not_checked'], default: 'not_checked' },
    policyMessage: { type: String, default: '' },
    policyDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: { type: String, enum: TRAVEL_REQUEST_STATUSES, default: 'DRAFT' },

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

module.exports = mongoose.model('TravelRequest', travelRequestSchema);
module.exports.TRAVEL_REQUEST_STATUSES = TRAVEL_REQUEST_STATUSES;
