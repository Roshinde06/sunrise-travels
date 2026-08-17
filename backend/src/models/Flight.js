const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema(
  {
    airline: { type: String, required: true },
    flightNumber: { type: String, required: true },
    from: { type: String, required: true }, // city name
    fromCode: { type: String, required: true },
    to: { type: String, required: true },
    toCode: { type: String, required: true },
    departureDate: { type: Date, required: true },
    departureTime: { type: String, required: true }, // HH:mm
    arrivalTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    stops: { type: Number, default: 0 },
    travelClass: { type: String, enum: ['Economy', 'Premium Economy', 'Business'], required: true },
    price: { type: Number, required: true, min: 0 }, // per passenger
    availableSeats: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

flightSchema.index({ from: 1, to: 1, departureDate: 1, travelClass: 1 });

module.exports = mongoose.model('Flight', flightSchema);
