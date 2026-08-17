const mongoose = require('mongoose');

const travelPolicySchema = new mongoose.Schema(
  {
    designation: { type: String, required: true, trim: true },
    designationKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // e.g. ['Economy'] or ['Economy', 'Premium Economy'] or ['Business']
    allowedFlightClasses: { type: [String], required: true },
    maximumHotelStars: { type: Number, required: true, min: 1, max: 5 },
    flightBudget: { type: Number, required: true, min: 0 }, // max per passenger
    hotelBudgetPerNight: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TravelPolicy', travelPolicySchema);
