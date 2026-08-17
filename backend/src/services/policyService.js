const TravelPolicy = require('../models/TravelPolicy');

/**
 * Corporate Travel Policy Engine.
 * Validates a selected flight and/or hotel against the employee's policy band:
 *   - allowed flight class
 *   - flight budget per passenger
 *   - maximum hotel star category
 *   - hotel budget per night
 *   - real availability (seats / rooms)
 *
 * Either `flight` or `hotel` may be null for flight-only / hotel-only requests;
 * only the provided components are validated.
 *
 * Returns { passed, reasons, flightViolations, hotelViolations, details }.
 */
function validateTrip({ policy, flight = null, hotel = null, passengers = 1, rooms = 1, nights = 1 }) {
  const reasons = [];
  const flightViolations = [];
  const hotelViolations = [];
  const details = {
    designation: policy.designation,
    allowedFlightClasses: policy.allowedFlightClasses,
    maximumHotelStars: policy.maximumHotelStars,
    flightBudget: policy.flightBudget,
    hotelBudgetPerNight: policy.hotelBudgetPerNight,
  };

  // 1. Flight class check
  if (flight && !policy.allowedFlightClasses.includes(flight.travelClass)) {
    const reason =
      `${flight.travelClass} class is not allowed for your designation. Allowed: ${policy.allowedFlightClasses.join(', ')}`;
    reasons.push(reason);
    flightViolations.push(reason);
  }

  // 2. Flight budget check (per passenger)
  if (flight && flight.price > policy.flightBudget) {
    const reason =
      `Flight fare of ₹${flight.price.toLocaleString('en-IN')} exceeds your flight budget of ₹${policy.flightBudget.toLocaleString('en-IN')} per passenger.`;
    reasons.push(reason);
    flightViolations.push(reason);
  }

  // 3. Hotel star check
  if (hotel && hotel.starRating > policy.maximumHotelStars) {
    const reason =
      `${hotel.starRating}-star hotels are not allowed for your designation. Maximum allowed: ${policy.maximumHotelStars}-star.`;
    reasons.push(reason);
    hotelViolations.push(reason);
  }

  // 4. Hotel budget check (per night)
  if (hotel && hotel.pricePerNight > policy.hotelBudgetPerNight) {
    const reason =
      `Hotel rate of ₹${hotel.pricePerNight.toLocaleString('en-IN')}/night exceeds your hotel budget of ₹${policy.hotelBudgetPerNight.toLocaleString('en-IN')}/night.`;
    reasons.push(reason);
    hotelViolations.push(reason);
  }

  // 5. Real availability
  if (flight && flight.availableSeats < passengers) {
    const reason =
      `Only ${flight.availableSeats} seat(s) left on flight ${flight.airline} ${flight.flightNumber}. Please select another flight.`;
    reasons.push(reason);
    flightViolations.push(reason);
  }
  if (hotel && hotel.availableRooms < rooms) {
    const reason = `Only ${hotel.availableRooms} room(s) available at ${hotel.name}. Please select another hotel.`;
    reasons.push(reason);
    hotelViolations.push(reason);
  }

  details.checked = {
    ...(flight
      ? { flightClass: flight.travelClass, flightPrice: flight.price }
      : { flight: null }),
    ...(hotel
      ? { hotelStars: hotel.starRating, hotelPricePerNight: hotel.pricePerNight }
      : { hotel: null }),
    passengers,
    rooms,
    nights,
  };
  if (flight) {
    details.flightBudgetUsed = policy.flightBudget ? Math.round((flight.price / policy.flightBudget) * 100) : 0;
  }
  if (hotel) {
    details.hotelBudgetUsed = policy.hotelBudgetPerNight ? Math.round((hotel.pricePerNight / policy.hotelBudgetPerNight) * 100) : 0;
  }

  return {
    passed: reasons.length === 0,
    reasons,
    flightViolations,
    hotelViolations,
    details,
  };
}

/** Find the policy applicable to a user (by explicit policyId, else designation match). */
async function getPolicyForUser(user) {
  if (user.policyId) {
    const policy = await TravelPolicy.findById(user.policyId);
    if (policy && policy.isActive) return policy;
  }
  const designationKey = (user.designation || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!designationKey) return null;
  return TravelPolicy.findOne({ designationKey, isActive: true });
}

module.exports = { validateTrip, getPolicyForUser };
