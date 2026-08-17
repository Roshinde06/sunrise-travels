/**
 * Project Sunrise — Database seed script.
 *
 *   npm run seed          -> upsert demo users/policies, regenerate mock flights/hotels and sample data
 *   npm run seed:reset    -> wipe ALL collections first, then seed
 *
 * Demo accounts:
 *   employee@travelcorp.com / Employee@123  (Rahul Sharma — Junior Executive)
 *   manager@travelcorp.com  / Manager@123   (Priya Mehta — Manager)
 *   admin@travelcorp.com    / Admin@123     (Amit Patil — Travel Administrator)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const TravelPolicy = require('../models/TravelPolicy');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const TravelRequest = require('../models/TravelRequest');
const Booking = require('../models/Booking');
const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');
const { generatePnr } = require('../services/bookingService');

const RESET = process.argv.includes('--reset');

// ---------- deterministic PRNG so mock data is stable across reseeds ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260817);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const roundTo = (n, step = 100) => Math.round(n / step) * step;

const CITIES = [
  { name: 'Mumbai', code: 'BOM' },
  { name: 'Delhi', code: 'DEL' },
  { name: 'Bangalore', code: 'BLR' },
  { name: 'Chennai', code: 'MAA' },
  { name: 'Hyderabad', code: 'HYD' },
  { name: 'Kolkata', code: 'CCU' },
  { name: 'Pune', code: 'PNQ' },
  { name: 'Goa', code: 'GOI' },
  { name: 'Jaipur', code: 'JAI' },
  { name: 'Ahmedabad', code: 'AMD' },
];

const ROUTES = [
  ['Mumbai', 'Delhi'],
  ['Delhi', 'Mumbai'],
  ['Mumbai', 'Bangalore'],
  ['Bangalore', 'Mumbai'],
  ['Delhi', 'Bangalore'],
  ['Bangalore', 'Delhi'],
  ['Mumbai', 'Hyderabad'],
  ['Hyderabad', 'Mumbai'],
  ['Mumbai', 'Goa'],
  ['Goa', 'Mumbai'],
  ['Delhi', 'Jaipur'],
  ['Jaipur', 'Delhi'],
  ['Bangalore', 'Chennai'],
  ['Chennai', 'Bangalore'],
  ['Delhi', 'Kolkata'],
  ['Kolkata', 'Delhi'],
  ['Pune', 'Delhi'],
  ['Delhi', 'Pune'],
  ['Mumbai', 'Pune'],
  ['Pune', 'Mumbai'],
  ['Hyderabad', 'Bangalore'],
  ['Bangalore', 'Hyderabad'],
  ['Delhi', 'Mumbai'],
  ['Goa', 'Mumbai'],
];

const AIRLINES = [
  { code: '6E', name: 'IndiGo' },
  { code: 'AI', name: 'Air India' },
  { code: 'UK', name: 'Vistara' },
  { code: 'SG', name: 'SpiceJet' },
  { code: 'QP', name: 'Akasa Air' },
];

const CLASS_META = {
  Economy: { multiplier: 1, times: ['06:30', '09:45', '14:05', '18:30'] },
  'Premium Economy': { multiplier: 1.9, times: ['07:15', '16:40', '20:15'] },
  Business: { multiplier: 3.6, times: ['08:00', '11:20', '19:45'] },
};

const dateOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---------- policies ----------
const POLICIES = [
  {
    designation: 'Junior Executive',
    designationKey: 'junior_executive',
    allowedFlightClasses: ['Economy'],
    maximumHotelStars: 2,
    flightBudget: 8000,
    hotelBudgetPerNight: 3000,
    description: 'Economy flights only, up to 2-star hotels.',
  },
  {
    designation: 'Manager',
    designationKey: 'manager',
    allowedFlightClasses: ['Economy', 'Premium Economy'],
    maximumHotelStars: 3,
    flightBudget: 12000,
    hotelBudgetPerNight: 5000,
    description: 'Economy / Premium Economy flights, up to 3-star hotels.',
  },
  {
    designation: 'Director',
    designationKey: 'director',
    allowedFlightClasses: ['Economy', 'Premium Economy', 'Business'],
    maximumHotelStars: 4,
    flightBudget: 20000,
    hotelBudgetPerNight: 10000,
    description: 'Up to Business class flights, up to 4-star hotels.',
  },
  {
    designation: 'VP',
    designationKey: 'vp',
    allowedFlightClasses: ['Business'],
    maximumHotelStars: 5,
    flightBudget: 30000,
    hotelBudgetPerNight: 15000,
    description: 'Business class flights, up to 5-star hotels.',
  },
];

// ---------- demo users ----------
const DEMO_USERS = [
  { name: 'Rahul Sharma', email: 'employee@travelcorp.com', password: 'Employee@123', role: 'employee', designation: 'Junior Executive', department: 'Sales' },
  { name: 'Priya Mehta', email: 'manager@travelcorp.com', password: 'Manager@123', role: 'manager', designation: 'Manager', department: 'Operations' },
  { name: 'Amit Patil', email: 'admin@travelcorp.com', password: 'Admin@123', role: 'admin', designation: 'Travel Administrator', department: 'Administration' },
  { name: 'Sita Rao', email: 'sita.rao@travelcorp.com', password: 'Sita@12345', role: 'employee', designation: 'Director', department: 'Marketing' },
  { name: 'Vikram Singh', email: 'vikram.singh@travelcorp.com', password: 'Vikram@12345', role: 'employee', designation: 'VP', department: 'Technology' },
  { name: 'Anjali Nair', email: 'anjali.nair@travelcorp.com', password: 'Anjali@12345', role: 'employee', designation: 'Senior Executive', department: 'Finance' },
  { name: 'Deepak Verma', email: 'deepak.verma@travelcorp.com', password: 'Deepak@12345', role: 'employee', designation: 'Manager', department: 'Human Resources' },
];

// ---------- hotels ----------
const HOTEL_TEMPLATES = [
  { stars: 2, names: ['Comfort Stay', 'City Lodge'], roomTypes: ['Standard'] },
  { stars: 3, names: ['Heritage Inn', 'Sunrise Residency'], roomTypes: ['Standard', 'Deluxe'] },
  { stars: 4, names: ['The Plaza', 'Business Grand'], roomTypes: ['Deluxe', 'Premium'] },
  { stars: 5, names: ['The Grand Palace', 'Royal Orchid'], roomTypes: ['Premium', 'Suite'] },
];

const AMENITIES = {
  2: ['Free Wi-Fi', 'Breakfast'],
  3: ['Free Wi-Fi', 'Breakfast', 'Airport Shuttle', 'Gym'],
  4: ['Free Wi-Fi', 'Breakfast', 'Airport Shuttle', 'Gym', 'Pool', 'Restaurant'],
  5: ['Free Wi-Fi', 'Breakfast', 'Airport Shuttle', 'Gym', 'Pool', 'Spa', 'Fine Dining', 'Concierge'],
};

const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?q=80&w=800&auto=format&fit=crop',
];

function buildHotels() {
  const hotels = [];
  for (const city of CITIES) {
    for (const template of HOTEL_TEMPLATES) {
      for (const name of template.names) {
        for (const roomType of template.roomTypes) {
          const priceRange =
            template.stars === 2 ? [1200, 2500] : template.stars === 3 ? [2200, 4500] : template.stars === 4 ? [4800, 9000] : [9500, 17500];
          hotels.push({
            name: `${name} ${city.name}`,
            city: city.name,
            location: `${city.name} City Center`,
            starRating: template.stars,
            roomType,
            pricePerNight: roundTo(randInt(priceRange[0], priceRange[1])),
            amenities: AMENITIES[template.stars],
            availableRooms: randInt(6, 20),
            image: HOTEL_IMAGES[hotels.length % HOTEL_IMAGES.length],
          });
        }
      }
    }
  }
  return hotels;
}

// ---------- flights ----------
function buildFlights(daysBack = 14, daysAhead = 45) {
  const flights = [];
  let flightNo = 100;
  for (const [from, to] of ROUTES) {
    const fromCity = CITIES.find((c) => c.name === from);
    const toCity = CITIES.find((c) => c.name === to);
    const baseDuration = randInt(75, 175);
    const baseFare = randInt(2800, 4800);

    for (const cls of Object.keys(CLASS_META)) {
      const meta = CLASS_META[cls];
      const airline = pick(AIRLINES);
      const price = roundTo(baseFare * meta.multiplier * (0.9 + rnd() * 0.35));
      for (let d = -daysBack; d < daysAhead; d += 1) {
        const date = dateOffset(d);
        const departureTime = pick(meta.times);
        const [hh, mm] = departureTime.split(':').map(Number);
        const total = hh * 60 + mm + baseDuration;
        const arrivalTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        flightNo += 1;
        flights.push({
          airline: airline.name,
          flightNumber: `${airline.code} ${flightNo}`,
          from,
          fromCode: fromCity.code,
          to,
          toCode: toCity.code,
          departureDate: date,
          departureTime,
          arrivalTime,
          durationMinutes: baseDuration,
          stops: cls === 'Economy' && rnd() < 0.15 ? 1 : 0,
          travelClass: cls,
          price,
          availableSeats: randInt(4, 24),
        });
      }
    }
  }
  return flights;
}

// ---------- sample travel requests ----------
async function buildSampleData({ policies, users, flights, hotels }) {
  const byKey = new Map();
  flights.forEach((f) => byKey.set(`${f.from}|${f.to}|${dateKey(f.departureDate)}|${f.travelClass}`, f));
  const hotelsByCity = {};
  hotels.forEach((h) => {
    hotelsByCity[h.city] = hotelsByCity[h.city] || [];
    hotelsByCity[h.city].push(h);
  });

  const findFlight = (from, to, days, cls) => byKey.get(`${from}|${to}|${dateKey(dateOffset(days))}|${cls}`);
  const findHotel = (city, stars, roomType) => (hotelsByCity[city] || []).find((h) => h.starRating === stars && h.roomType === roomType);

  const rahul = users.find((u) => u.email === 'employee@travelcorp.com');
  const sita = users.find((u) => u.email === 'sita.rao@travelcorp.com');
  const deepak = users.find((u) => u.email === 'deepak.verma@travelcorp.com');
  const anjali = users.find((u) => u.email === 'anjali.nair@travelcorp.com');
  const vikram = users.find((u) => u.email === 'vikram.singh@travelcorp.com');
  const priya = users.find((u) => u.email === 'manager@travelcorp.com');
  const amit = users.find((u) => u.email === 'admin@travelcorp.com');
  const managerPolicy = policies.find((p) => p.designationKey === 'manager');

  const spec = [
    // [user, from, to, days, cls, hotelStars, hotelRoom, status, {extras}]
    { user: rahul, from: 'Mumbai', to: 'Delhi', days: 3, cls: 'Economy', stars: 2, room: 'Standard', status: 'PENDING' },
    { user: sita, from: 'Mumbai', to: 'Delhi', days: 4, cls: 'Business', stars: 4, room: 'Deluxe', status: 'PENDING' },
    { user: deepak, from: 'Delhi', to: 'Bangalore', days: 6, cls: 'Premium Economy', stars: 3, room: 'Deluxe', status: 'PENDING' },
    { user: rahul, from: 'Bangalore', to: 'Mumbai', days: 7, cls: 'Economy', stars: 2, room: 'Standard', status: 'APPROVED' },
    { user: anjali, from: 'Mumbai', to: 'Pune', days: 2, cls: 'Premium Economy', stars: 3, room: 'Deluxe', status: 'APPROVED' },
    { user: rahul, from: 'Mumbai', to: 'Pune', days: 1, cls: 'Economy', stars: 2, room: 'Standard', status: 'TICKETED', ticketedToday: true },
    { user: anjali, from: 'Hyderabad', to: 'Bangalore', days: -4, cls: 'Economy', stars: 3, room: 'Standard', status: 'TICKETED' },
    { user: vikram, from: 'Delhi', to: 'Mumbai', days: -12, cls: 'Business', stars: 5, room: 'Premium', status: 'TICKETED' },
    { user: rahul, from: 'Delhi', to: 'Jaipur', days: 2, cls: 'Economy', stars: 2, room: 'Standard', status: 'REJECTED', reason: 'Travel dates are not approved for the requested business activity.' },
    { user: rahul, from: 'Goa', to: 'Mumbai', days: -9, cls: 'Economy', stars: 2, room: 'Standard', status: 'CANCELLED', reason: 'Trip cancelled due to change in project schedule.' },
  ];

  const created = [];
  let bookingSeq = 0;

  for (const s of spec) {
    const flight = findFlight(s.from, s.to, s.days, s.cls);
    const hotel = findHotel(s.to, s.stars, s.room);
    if (!flight || !hotel) {
      console.warn(`  [skip] no flight/hotel for ${s.user.name} ${s.from}->${s.to}`);
      continue;
    }

    const nights = 2;
    const passengers = 1;
    const rooms = 1;
    const flightCost = flight.price * passengers;
    const hotelCost = hotel.pricePerNight * nights * rooms;
    const totalAmount = flightCost + hotelCost;
    const requestId = `TRV-${10000 + created.length + 1}`;

    const req = await TravelRequest.create({
      requestId,
      employeeId: s.user._id,
      employeeName: s.user.name,
      employeeDesignation: s.user.designation,
      flightId: flight._id,
      hotelId: hotel._id,
      from: s.from,
      to: s.to,
      travelDate: dateOffset(s.days),
      returnDate: dateOffset(s.days + nights),
      passengers,
      rooms,
      nights,
      flightSnapshot: {
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        from: s.from,
        fromCode: flight.fromCode,
        to: s.to,
        toCode: flight.toCode,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        travelClass: flight.travelClass,
        price: flight.price,
      },
      hotelSnapshot: {
        name: hotel.name,
        city: hotel.city,
        starRating: hotel.starRating,
        roomType: hotel.roomType,
        pricePerNight: hotel.pricePerNight,
      },
      flightCost,
      hotelCost,
      totalAmount,
      policyStatus: 'passed',
      policyMessage: 'Complies with company travel policy.',
      policyDetails: { designation: s.user.designation },
      status: s.status,
      ...(s.status === 'CANCELLED' ? { cancelledReason: s.reason, cancelledBy: amit.name } : {}),
    });

    if (s.status === 'REJECTED') {
      await Approval.create({
        travelRequestId: req._id,
        approverId: priya._id,
        approverName: priya.name,
        action: 'reject',
        reason: s.reason,
        decidedAt: dateOffset(s.days === 2 ? -1 : -3),
      });
    }

    if (s.status === 'APPROVED') {
      await Approval.create({
        travelRequestId: req._id,
        approverId: priya._id,
        approverName: priya.name,
        action: 'approve',
        reason: 'Approved',
        decidedAt: new Date(),
      });
    }

    if (s.status === 'TICKETED' || s.status === 'CANCELLED') {
      const ticketedAt = s.ticketedToday ? new Date() : dateOffset(s.days + 1);
      bookingSeq += 1;
      const booking = await Booking.create({
        travelRequestId: req._id,
        employeeId: s.user._id,
        pnr: generatePnr(),
        bookingReference: `BK-${10000 + bookingSeq}`,
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        flightFrom: s.from,
        flightTo: s.to,
        flightDate: dateOffset(s.days),
        flightDepartureTime: flight.departureTime,
        flightArrivalTime: flight.arrivalTime,
        travelClass: flight.travelClass,
        hotelName: hotel.name,
        hotelCity: hotel.city,
        hotelStarRating: hotel.starRating,
        hotelRoomType: hotel.roomType,
        totalAmount,
        status: s.status === 'CANCELLED' ? 'cancelled' : 'confirmed',
        ticketedAt: s.status === 'CANCELLED' ? ticketedAt : ticketedAt,
        ...(s.status === 'CANCELLED' ? { cancelledAt: dateOffset(s.days + 2) } : {}),
      });

      if (s.status === 'TICKETED') {
        flight.availableSeats -= passengers;
        hotel.availableRooms -= rooms;
        await flight.save();
        await hotel.save();
      }
    }

    created.push(req);
  }

  // Keep counters ahead of sample IDs so new requests/bookings never collide
  await Counter.updateOne({ _id: 'travelRequest' }, { $set: { seq: 10000 + created.length } }, { upsert: true });
  await Counter.updateOne({ _id: 'booking' }, { $set: { seq: 10000 + bookingSeq } }, { upsert: true });

  return created;
}

// ---------- main ----------
async function main() {
  return seedAll();
}

async function seedAll() {
  await connectDB();

  if (RESET) {
    console.log('Resetting database...');
    await Promise.all([
      User.deleteMany({}),
      TravelPolicy.deleteMany({}),
      Flight.deleteMany({}),
      Hotel.deleteMany({}),
      TravelRequest.deleteMany({}),
      Booking.deleteMany({}),
      Approval.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      Counter.deleteMany({}),
    ]);
  } else {
    // Keep users/policies, regenerate derived mock data + sample activity
    await Promise.all([
      Flight.deleteMany({}),
      Hotel.deleteMany({}),
      TravelRequest.deleteMany({}),
      Booking.deleteMany({}),
      Approval.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  }

  // 1. Policies
  const policyDocs = [];
  for (const p of POLICIES) {
    const doc = await TravelPolicy.findOneAndUpdate({ designationKey: p.designationKey }, p, { upsert: true, new: true });
    policyDocs.push(doc);
  }
  console.log(`Seeded ${policyDocs.length} travel policies.`);

  // 2. Users
  const userDocs = [];
  for (const u of DEMO_USERS) {
    const policy = policyDocs.find((p) => p.designationKey === u.designation.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const doc = await User.findOneAndUpdate(
      { email: u.email },
      {
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
        designation: u.designation,
        department: u.department,
        policyId: policy ? policy._id : null,
        status: 'active',
      },
      { upsert: true, new: true }
    );
    userDocs.push(doc);
  }
  console.log(`Seeded ${userDocs.length} users.`);

  // 3. Flights
  const flightData = buildFlights();
  const flightDocs = await Flight.insertMany(flightData);
  console.log(`Seeded ${flightDocs.length} flight instances.`);

  // 4. Hotels
  const hotelData = buildHotels();
  const hotelDocs = await Hotel.insertMany(hotelData);
  console.log(`Seeded ${hotelDocs.length} hotels.`);

  // 5. Sample travel requests + bookings
  const sampleCount = await buildSampleData({
    policies: policyDocs,
    users: userDocs,
    flights: flightDocs,
    hotels: hotelDocs,
  });
  console.log(`Seeded ${sampleCount.length} sample travel requests.`);

  console.log('\nSeed complete. Demo accounts:');
  console.log('  employee@travelcorp.com / Employee@123  (Rahul Sharma — Junior Executive)');
  console.log('  manager@travelcorp.com  / Manager@123   (Priya Mehta — Manager)');
  console.log('  admin@travelcorp.com    / Admin@123     (Amit Patil — Travel Administrator)');
  return { policies: policyDocs.length, users: userDocs.length, flights: flightDocs.length, hotels: hotelDocs.length, sampleRequests: sampleCount.length };
}

module.exports = { main, seedAll, RESET };

if (require.main === module) {
  main()
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
