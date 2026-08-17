const PDFDocument = require('pdfkit');

const COMPANY = 'Sunrise Travels Pvt. Ltd.';
const COMPANY_TAGLINE = 'Corporate Travel Booking Platform';

const inrText = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Builds the invoice object from the travel request (and optional booking).
 * Charges come from the actual fare data stored on the request; the stored
 * invoiceDetails (created at booking time) are preferred when present.
 */
function buildInvoice(travelRequest, booking = null) {
  const stored = travelRequest.invoiceDetails || {};
  const isHotelOnly = travelRequest.travelType === 'hotel';
  const isFlightOnly = travelRequest.travelType === 'flight';

  const flightCharges = stored.flightCharges ?? travelRequest.flightCost ?? 0;
  const hotelCharges = stored.hotelCharges ?? travelRequest.hotelCost ?? 0;
  const taxes = stored.taxes ?? Math.round((flightCharges + hotelCharges) * 0.05);
  const serviceCharges = stored.serviceCharges ?? 0;
  const otherCharges = stored.otherCharges ?? 0;
  const totalAmount = stored.totalAmount ?? flightCharges + hotelCharges + taxes + serviceCharges + otherCharges;

  return {
    invoiceNumber: stored.invoiceNumber || `INV-${String(travelRequest._id).slice(-6).toUpperCase()}`,
    invoiceDate: stored.invoiceDate || new Date(),
    company: COMPANY,
    companyTagline: COMPANY_TAGLINE,

    employeeName: travelRequest.employeeName,
    employeeId: travelRequest.employeeId,
    department: travelRequest.employeeDepartment || '',
    designation: travelRequest.employeeDesignation || '',

    requestId: travelRequest.requestId,
    bookingReference: (booking && booking.bookingReference) || (travelRequest.bookingDetails && travelRequest.bookingDetails.bookingReference) || '',
    pnr: (booking && booking.pnr) || (travelRequest.bookingDetails && travelRequest.bookingDetails.pnr) || '',
    travelType: travelRequest.travelType,

    flight: isHotelOnly
      ? null
      : {
          airline: travelRequest.flightSnapshot.airline || '',
          flightNumber: travelRequest.flightSnapshot.flightNumber || '',
          from: travelRequest.flightSnapshot.from || travelRequest.from || '',
          to: travelRequest.flightSnapshot.to || travelRequest.to || '',
          travelDate: travelRequest.travelDate,
          departureTime: travelRequest.flightSnapshot.departureTime || '',
          arrivalTime: travelRequest.flightSnapshot.arrivalTime || '',
          travelClass: travelRequest.flightSnapshot.travelClass || '',
          passengers: travelRequest.passengers,
        },
    hotel: isFlightOnly
      ? null
      : {
          name: travelRequest.hotelSnapshot.name || '',
          city: travelRequest.hotelSnapshot.city || '',
          location: travelRequest.hotelSnapshot.location || '',
          roomType: travelRequest.hotelSnapshot.roomType || '',
          checkIn: travelRequest.travelDate,
          checkOut: travelRequest.returnDate,
          rooms: travelRequest.rooms,
          nights: travelRequest.nights,
        },

    flightCharges,
    hotelCharges,
    taxes,
    serviceCharges,
    otherCharges,
    totalAmount,

    paymentStatus: stored.paymentStatus || travelRequest.paymentStatus || 'pending',
    paymentDate: stored.paymentDate || (travelRequest.paymentStatus === 'paid' ? travelRequest.updatedAt : null),
    bookingStatus: stored.bookingStatus || travelRequest.bookingStatus || 'none',
  };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Generates a professional single-page invoice PDF buffer. */
function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    const gray = '#6b7280';
    const brand = '#0f766e';
    const dark = '#111827';

    // ---- Header band ----
    doc.rect(0, 0, doc.page.width, 78).fill('#0f766e');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('SUNRISE TRAVELS', 50, 24);
    doc.font('Helvetica').fontSize(9).fillColor('#d1fae5').text('Corporate Travel Booking Platform', 50, 46);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('CORPORATE TRAVEL INVOICE', 50, 58);
    doc.font('Helvetica').fontSize(10).fillColor('#ffffff').text('INVOICE', { align: 'right' });
    doc.text(`No: ${invoice.invoiceNumber}`, 50, 24, { align: 'right' });
    doc.text(`Date: ${fmtDate(invoice.invoiceDate)}`, 50, 38, { align: 'right' });

    let y = 100;

    // ---- Bill to / reference ----
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(11).text('Bill To', 50, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(invoice.employeeName || '—', 50, y + 18);
    doc.text(`Employee ID: ${invoice.employeeId || '—'}`, 50, y + 34);
    if (invoice.department) doc.text(`Department: ${invoice.department}`, 50, y + 50);
    if (invoice.designation) doc.text(`Designation: ${invoice.designation}`, 50, y + 66);

    doc.font('Helvetica-Bold').fontSize(11).text('Reference', 50 + W / 2, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Travel Request: ${invoice.requestId}`, 50 + W / 2, y + 18);
    doc.text(`Booking ID: ${invoice.bookingReference || '—'}`, 50 + W / 2, y + 34);
    doc.text(`PNR / Ticket: ${invoice.pnr || '—'}`, 50 + W / 2, y + 50);
    doc.text(
      `Travel Type: ${{ flight: 'Flight Only', hotel: 'Hotel Only', flight_hotel: 'Flight + Hotel' }[invoice.travelType] || invoice.travelType}`,
      50 + W / 2,
      y + 66
    );

    y += 96;

    // ---- Travel details ----
    if (invoice.flight) {
      doc.fillColor(brand).font('Helvetica-Bold').fontSize(10).text('FLIGHT DETAILS', 50, y);
      doc.font('Helvetica').fontSize(9.5).fillColor(dark);
      doc.text(
        `${invoice.flight.airline} ${invoice.flight.flightNumber} (${invoice.flight.travelClass}) — ${invoice.flight.from} → ${invoice.flight.to}`,
        50,
        y + 16
      );
      doc.fontSize(9).fillColor(gray);
      doc.text(
        `${fmtDate(invoice.flight.travelDate)} · ${invoice.flight.departureTime || '—'} – ${invoice.flight.arrivalTime || '—'} · ${invoice.flight.passengers} passenger(s)`,
        50,
        y + 30
      );
      y += 50;
    }

    if (invoice.hotel) {
      doc.fillColor(brand).font('Helvetica-Bold').fontSize(10).text('HOTEL DETAILS', 50, y);
      doc.font('Helvetica').fontSize(9.5).fillColor(dark);
      doc.text(`${invoice.hotel.name} — ${invoice.hotel.roomType} room`, 50, y + 16);
      doc.fontSize(9).fillColor(gray);
      doc.text(
        `${invoice.hotel.city} · Check-in ${fmtDate(invoice.hotel.checkIn)} → Check-out ${fmtDate(invoice.hotel.checkOut)} · ${invoice.hotel.rooms} room(s) × ${invoice.hotel.nights} night(s)`,
        50,
        y + 30
      );
      y += 50;
    }

    // ---- Charges table ----
    const tableTop = y + 10;
    doc.rect(50, tableTop, W, 22).fill('#f3f4f6');
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(9.5);
    doc.text('CHARGE', 60, tableTop + 7);
    doc.text('AMOUNT', 50 + W - 110, tableTop + 7, { width: 90, align: 'right' });

    const rows = [];
    if (invoice.travelType !== 'hotel') rows.push(['Flight Charges', invoice.flightCharges]);
    if (invoice.travelType !== 'flight') rows.push(['Hotel Charges', invoice.hotelCharges]);
    rows.push(['Taxes (GST 5%)', invoice.taxes]);
    if (invoice.serviceCharges > 0) rows.push(['Service Charges', invoice.serviceCharges]);
    if (invoice.otherCharges > 0) rows.push(['Other Charges', invoice.otherCharges]);

    let ry = tableTop + 22;
    doc.font('Helvetica').fontSize(9.5);
    rows.forEach(([label, amount], i) => {
      if (i % 2 === 1) doc.rect(50, ry, W, 20).fill('#f9fafb');
      doc.fillColor(dark).text(label, 60, ry + 6);
      doc.text(inrText(amount), 50 + W - 110, ry + 6, { width: 90, align: 'right' });
      ry += 20;
    });

    // Total
    doc.rect(50, ry, W, 24).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL AMOUNT', 60, ry + 6);
    doc.text(inrText(invoice.totalAmount), 50 + W - 110, ry + 6, { width: 90, align: 'right' });
    ry += 40;

    // ---- Payment & booking status ----
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(9.5).text('PAYMENT STATUS', 50, ry);
    doc.font('Helvetica').fontSize(9.5);
    doc.text(invoice.paymentStatus === 'paid' ? 'Paid' : 'Pending', 50, ry + 14);
    if (invoice.paymentDate) doc.text(`Payment date: ${fmtDate(invoice.paymentDate)}`, 50, ry + 28);

    doc.font('Helvetica-Bold').fontSize(9.5).text('BOOKING STATUS', 50 + W / 2, ry);
    doc.font('Helvetica').fontSize(9.5);
    doc.text(invoice.bookingStatus === 'confirmed' ? 'Confirmed' : invoice.bookingStatus || '—', 50 + W / 2, ry + 14);

    ry += 56;

    // ---- Footer ----
    doc.moveTo(50, ry).lineTo(50 + W, ry).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.fillColor(gray).fontSize(8.5).text(
      'This is a system-generated invoice for corporate travel booked through the Sunrise Travel platform. For queries, contact the Travel Administration desk.',
      50,
      ry + 12,
      { width: W, align: 'center' }
    );

    doc.end();
  });
}

module.exports = { buildInvoice, generateInvoicePdf, COMPANY };
