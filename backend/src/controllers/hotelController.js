const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const Hotel = require('../models/Hotel');
const { searchHotels } = require('../services/hotelService');

const search = asyncHandler(async (req, res) => {
  const { city, checkIn, checkOut, guests, rooms, stars } = req.query;
  if (!city) throw new ApiError(400, 'Please provide a city.');
  if (!checkIn || !checkOut) throw new ApiError(400, 'Please provide check-in and check-out dates.');

  const hotels = await searchHotels({
    city,
    checkIn,
    checkOut,
    guests: guests ? Number(guests) : 1,
    rooms: rooms ? Number(rooms) : 1,
    stars,
  });

  res.json({
    success: true,
    query: { city, checkIn, checkOut, guests: Number(guests || 1), rooms: Number(rooms || 1), stars },
    hotels,
  });
});

const getById = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);
  if (!hotel) throw new ApiError(404, 'Hotel not found.');
  res.json({ success: true, hotel });
});

module.exports = { search, getById };
