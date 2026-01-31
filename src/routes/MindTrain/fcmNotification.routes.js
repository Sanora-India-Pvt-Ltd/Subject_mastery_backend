const express = require('express');
const { protect } = require('../../middleware/auth');
const { sendFCMNotifications, fcmCallback, testNotification } = require('../../controllers/MindTrain/fcmNotification.controller');

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

/**
 * POST /api/mindtrain/fcm-notifications/test
 * Test endpoint to manually trigger a notification for testing
 * Authentication: Required (JWT)
 */
router.post('/test', protect, testNotification);

module.exports = router;

