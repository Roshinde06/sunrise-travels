const TravelRequest = require('../models/TravelRequest');

const ACTIVE_STATUSES = ['PENDING', 'APPROVED', 'READY_FOR_TICKETING'];

/**
 * Team travel summary (manager dashboard style).
 * Returns counts by status, upcoming travel, and top destination.
 */
async function getTeamSummary() {
  const [byStatus, upcoming, topDest] = await Promise.all([
    TravelRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TravelRequest.find({
      status: { $in: [...ACTIVE_STATUSES, 'TICKETED'] },
      travelDate: { $gte: new Date() },
    })
      .sort({ travelDate: 1 })
      .limit(10),
    TravelRequest.aggregate([
      { $match: { status: { $in: [...ACTIVE_STATUSES, 'TICKETED'] } } },
      { $group: { _id: '$to', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, TICKETED: 0, CANCELLED: 0, READY_FOR_TICKETING: 0 };
  byStatus.forEach((s) => {
    if (counts[s._id] !== undefined) counts[s._id] = s.count;
  });
  counts.total = byStatus.reduce((sum, s) => sum + s.count, 0);
  counts.upcoming = upcoming.length;

  return {
    counts,
    upcoming,
    topDestinations: topDest.map((d) => ({ destination: d._id, count: d.count })),
  };
}

/**
 * Corporate travel analytics (admin).
 * Total/pending/approved/rejected/confirmed/cancelled counts, spend, average trip cost,
 * top destinations, travel type usage.
 */
async function getTravelAnalytics() {
  const [byStatus, spendAgg, typeAgg, topDest] = await Promise.all([
    TravelRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    TravelRequest.aggregate([{ $match: { status: 'TICKETED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
    TravelRequest.aggregate([{ $group: { _id: '$travelType', count: { $sum: 1 } } }]),
    TravelRequest.aggregate([
      { $match: { status: { $in: [...ACTIVE_STATUSES, 'TICKETED'] } } },
      { $group: { _id: '$to', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, TICKETED: 0, CANCELLED: 0, READY_FOR_TICKETING: 0, DRAFT: 0 };
  byStatus.forEach((s) => {
    if (counts[s._id] !== undefined) counts[s._id] = s.count;
  });
  counts.total = byStatus.reduce((sum, s) => sum + s.count, 0);

  const ticketed = spendAgg.length ? spendAgg[0] : { total: 0, count: 0 };

  return {
    counts,
    bookings: {
      confirmed: counts.TICKETED,
      cancelled: counts.CANCELLED,
    },
    totalSpend: ticketed.total,
    averageTripCost: ticketed.count ? Math.round(ticketed.total / ticketed.count) : 0,
    topDestinations: topDest.map((d) => ({ destination: d._id, count: d.count })),
    travelTypes: {
      flight: (typeAgg.find((t) => t._id === 'flight') || {}).count || 0,
      hotel: (typeAgg.find((t) => t._id === 'hotel') || {}).count || 0,
      flight_hotel: (typeAgg.find((t) => t._id === 'flight_hotel') || {}).count || 0,
    },
  };
}

/**
 * Cost analysis for a month (YYYY-MM, defaults to current month).
 * Uses real fare data stored on ticketed requests; taxes derived at booking time.
 */
async function getCostAnalysis(monthKey) {
  const now = new Date();
  const key = monthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const start = new Date(`${key}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [monthly, flightSpend, hotelSpend, taxSpend, topDest, allSpend] = await Promise.all([
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED', travelDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, flight: { $sum: '$flightCost' }, hotel: { $sum: '$hotelCost' }, count: { $sum: 1 } } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED', travelDate: { $gte: start, $lt: end }, travelType: { $ne: 'hotel' } } },
      { $group: { _id: null, total: { $sum: '$flightCost' } } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED', travelDate: { $gte: start, $lt: end }, travelType: { $ne: 'flight' } } },
      { $group: { _id: null, total: { $sum: '$hotelCost' } } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED', travelDate: { $gte: start, $lt: end }, 'invoiceDetails.taxes': { $exists: true } } },
      { $group: { _id: null, taxes: { $sum: '$invoiceDetails.taxes' }, service: { $sum: '$invoiceDetails.serviceCharges' } } },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED', travelDate: { $gte: start, $lt: end } } },
      { $group: { _id: '$to', total: { $sum: '$totalAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]),
    TravelRequest.aggregate([
      { $match: { status: 'TICKETED' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const m = monthly.length ? monthly[0] : { total: 0, flight: 0, hotel: 0, count: 0 };
  const t = taxSpend.length ? taxSpend[0] : { taxes: 0, service: 0 };
  // Taxes were stored per-request at booking time (5% GST on real fare data).
  const taxes = t.taxes || 0;
  const serviceCharges = t.service || 0;

  const all = allSpend.length ? allSpend[0] : { total: 0, count: 0 };
  const previousStart = new Date(start);
  previousStart.setMonth(previousStart.getMonth() - 1);
  const previousEnd = new Date(start);
  const prevAgg = await TravelRequest.aggregate([
    { $match: { status: 'TICKETED', travelDate: { $gte: previousStart, $lt: previousEnd } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const previousTotal = prevAgg.length ? prevAgg[0].total : 0;

  return {
    month: key,
    flights: flightSpend.length ? flightSpend[0].total : 0,
    hotels: hotelSpend.length ? hotelSpend[0].total : 0,
    taxes,
    serviceCharges,
    total: m.total + taxes + serviceCharges,
    tripCount: m.count,
    averageTripCost: m.count ? Math.round((m.total + taxes + serviceCharges) / m.count) : 0,
    topDestination: topDest.length ? topDest[0]._id : '—',
    overallAverage: all.count ? Math.round(all.total / all.count) : 0,
    previousMonthTotal: previousTotal,
  };
}

module.exports = { getTeamSummary, getTravelAnalytics, getCostAnalysis };
