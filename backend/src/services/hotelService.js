const Hotel = require('../models/Hotel');

/**
 * Search hotels.
 * Query: city, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD), guests, rooms, stars (optional filter)
 * Computes nights from checkIn/checkOut and total price.
 */
async function searchHotels({ city, checkIn, checkOut, guests = 1, rooms = 1, stars }) {
  const q = {};
  if (city) q.city = city;
  if (stars && stars !== 'Any') q.starRating = Number(stars);
  if (rooms && rooms > 0) q.availableRooms = { $gte: Number(rooms) };

  const hotels = await Hotel.find(q).sort({ starRating: -1, pricePerNight: 1 });

  const nights = computeNights(checkIn, checkOut);

  return hotels.map((hotel) => ({
    ...hotel.toObject(),
    nights,
    totalPrice: hotel.pricePerNight * nights * Number(rooms || 1),
  }));
}

function computeNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const inDate = new Date(`${checkIn}T00:00:00`);
  const outDate = new Date(`${checkOut}T00:00:00`);
  const diff = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

module.exports = { searchHotels, computeNights };
