const express = require('express');
const { getInvoice, downloadInvoice } = require('../controllers/invoiceController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.get('/:id', authenticate, getInvoice);
router.get('/:id/download', authenticate, downloadInvoice);

module.exports = router;
