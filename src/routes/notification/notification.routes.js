const express = require('express');
const router = express.Router();
const { flexibleAuth } = require('../../middleware/flexibleAuth.middleware');
const {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} = require('../../controllers/notification/notification.controller');
const {
    registerDeviceToken,
    unregisterDeviceToken
} = require('../../controllers/notification/deviceToken.controller');
const {
    getPreferences,
    updatePreference
} = require('../../controllers/notification/notificationPreference.controller');

/**
 * Notification Routes
 * 
 * All routes use flexibleAuth to support both USER and UNIVERSITY tokens.
 * No role guards needed - both user types can access their own notifications.
 */

// Get user's notifications (paginated)
// GET /api/notifications?page=1&limit=20&unreadOnly=false
router.get('/', flexibleAuth, getMyNotifications);

// Get unread notification count
// GET /api/notifications/unread-count
router.get('/unread-count', flexibleAuth, getUnreadCount);

// Mark a single notification as read
// POST /api/notifications/:id/read
router.post('/:id/read', flexibleAuth, markAsRead);

// Mark all notifications as read
// POST /api/notifications/read-all
router.post('/read-all', flexibleAuth, markAllAsRead);

// Register device token for push notifications
// POST /api/notifications/device-token
router.post('/device-token', flexibleAuth, registerDeviceToken);

// Unregister device token
// DELETE /api/notifications/device-token/:token
router.delete('/device-token/:token', flexibleAuth, unregisterDeviceToken);

// Get notification preferences
// GET /api/notifications/preferences
router.get('/preferences', flexibleAuth, getPreferences);

// Update notification preference
// PUT /api/notifications/preferences
router.put('/preferences', flexibleAuth, updatePreference);

module.exports = router;
