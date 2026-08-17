const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const TravelRequest = require('../models/TravelRequest');
const Booking = require('../models/Booking');
const { buildInvoice, generateInvoicePdf } = require('../services/invoiceService');

/**
 * GET /api/invoices/:id — invoice data for a travel request.
 * Access: admin (any), employee (own only). Managers cannot view financial data.
 */
const getInvoice = asyncHandler(async (req, res) => {
  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');

  if (req.user.role === 'employee' && !travelRequest.employeeId.equals(req.user._id)) {
    throw new ApiError(403, 'You can only view your own invoices.');
  }
  if (req.user.role === 'manager') {
    throw new ApiError(403, 'Managers cannot view financial information. Contact the Travel Administrator.');
  }

  if (travelRequest.status !== 'TICKETED') {
    throw new ApiError(409, 'An invoice is generated only after the final booking is confirmed.');
  }

  const booking = await Booking.findOne({ travelRequestId: travelRequest._id, status: 'confirmed' });
  const invoice = buildInvoice(travelRequest, booking);

  res.json({ success: true, invoice, booking, travelRequest });
});

/**
 * GET /api/invoices/:id/download — PDF invoice (admin only).
 */
const downloadInvoice = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the Travel Administrator can download invoices.');
  }

  const travelRequest = await TravelRequest.findById(req.params.id);
  if (!travelRequest) throw new ApiError(404, 'Travel request not found.');
  if (travelRequest.status !== 'TICKETED') {
    throw new ApiError(409, 'An invoice is generated only after the final booking is confirmed.');
  }

  const booking = await Booking.findOne({ travelRequestId: travelRequest._id, status: 'confirmed' });
  const invoice = buildInvoice(travelRequest, booking);

  let pdf;
  try {
    pdf = await generateInvoicePdf(invoice);
  } catch (err) {
    throw new ApiError(500, 'Could not generate the invoice PDF. Please try again.');
  }

  const filename = `invoice-${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdf);
});

module.exports = { getInvoice, downloadInvoice };
