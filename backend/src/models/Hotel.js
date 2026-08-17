const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    location: { type: String, default: '' },
    starRating: { type: Number, required: true, min: 1, max: 5 },
    roomType: { type: String, required: true }, // Standard / Deluxe / Suite / Premium
    pricePerNight: { type: Number, required: true, min: 0 },
    amenities: { type: [String], default: [] },
    availableRooms: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' }, // photo URL (mock provider)
  },
  { timestamps: true }
);

hotelSchema.index({ city: 1, starRating: 1 });

module.exports = mongoose.model('Hotel', hotelSchema);
