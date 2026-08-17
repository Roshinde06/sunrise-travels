const Flight = require('../models/Flight');

/**
 * Search flights.
 * Query: from, to, departureDate (YYYY-MM-DD), returnDate (optional), passengers, travelClass (optional)
 * Returns { outbound: [...], return: [...] } — return leg searched when returnDate is provided.
 */
async function searchFlights({ from, to, departureDate, returnDate, passengers = 1, travelClass }) {
  const buildQuery = (origin, dest, date) => {
    const q = { from: origin, to: dest };
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      q.departureDate = { $gte: start, $lt: end };
    }
    if (travelClass && travelClass !== 'All') q.travelClass = travelClass;
    if (passengers && passengers > 0) q.availableSeats = { $gte: passengers };
    return q;
  };

  const outbound = await Flight.find(buildQuery(from, to, departureDate)).sort({ departureTime: 1 });

  let returnLeg = [];
  if (returnDate) {
    returnLeg = await Flight.find(buildQuery(to, from, returnDate)).sort({ departureTime: 1 });
  }

  return { outbound, return: returnLeg };
}

module.exports = { searchFlights };
