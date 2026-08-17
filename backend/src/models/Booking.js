const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    travelRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TravelRequest', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pnr: { type: String, required: true, unique: true },
    bookingReference: { type: String, required: true, unique: true },
    airline: { type: String, default: '' },
    flightNumber: { type: String, default: '' },
    flightFrom: { type: String, default: '' },
    flightTo: { type: String, default: '' },
    flightDate: { type: Date, default: null },
    flightDepartureTime: { type: String, default: '' },
    flightArrivalTime: { type: String, default: '' },
    travelClass: { type: String, default: '' },
    hotelName: { type: String, default: '' },
    hotelCity: { type: String, default: '' },
    hotelStarRating: { type: Number, default: 0 },
    hotelRoomType: { type: String, default: '' },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    ticketedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ employeeId: 1 });
bookingSchema.index({ travelRequestId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
