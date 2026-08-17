const express = require('express');
const { listMine, markOneRead, markAllRead } = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listMine);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markOneRead);

module.exports = router;
