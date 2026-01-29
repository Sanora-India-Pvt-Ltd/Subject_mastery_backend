const express = require('express');
const { protect } = require('../../middleware/auth');
const { sendFCMNotifications, fcmCallback } = require('../../controllers/MindTrain/fcmNotification.controller');

const router = express.Router();

/**
 * POST /api/mindtrain/fcm-notifications/send
 * Server-side endpoint to trigger FCM notification sends (internal/admin)
 * TODO: Add admin/service authentication middleware
 */
router.post('/send', protect, sendFCMNotifications);

/**
 * POST /api/mindtrain/fcm-notifications/callback
 * FCM delivery status webhook callback
 * TODO: Add Firebase Admin SDK authentication middleware
 */
router.post('/callback', fcmCallback);

module.exports = router;

