const express = require('express');
const router = express.Router();
const { flexibleAuth } = require('../../middleware/flexibleAuth.middleware');
const { adminGuard } = require('../../middleware/adminGuard');
const { sendBroadcast } = require('../../controllers/notification/broadcast.controller');

/**
 * Admin Notification Routes
 * 
 * These routes require admin or system authentication.
 * Regular users and universities cannot access these endpoints.
 */

// Send broadcast notification
// POST /api/admin/notifications/broadcast
router.post('/notifications/broadcast', flexibleAuth, adminGuard, sendBroadcast);

module.exports = router;
