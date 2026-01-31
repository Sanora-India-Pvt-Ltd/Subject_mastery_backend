const fcmScheduleService = require('../../services/MindTrain/fcmScheduleService');
const alarmProfileService = require('../../services/MindTrain/alarmProfileService');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const crypto = require('crypto');

/**
 * POST /api/mindtrain/fcm-notifications/send
 * 
 * Server-side endpoint to trigger FCM notification sends (internal/admin)
 * 
 * Authentication: Required (Admin or Service Auth)
 * 
 * Request Body:
 * {
 *   "type": "scheduled_sync_trigger",
 *   "targetUsers": "all_with_active_profiles",
 *   "notificationType": "morning", // "morning" | "evening"
 *   "batchSize": 1000
 * }
 */
const sendFCMNotifications = async (req, res) => {
    try {
        // TODO: Add admin/service authentication check
        // For now, we'll allow authenticated users (should be restricted to admin/service)
        
        const { type, targetUsers, notificationType, batchSize = 1000 } = req.body || {};

        // Validate request
        if (type !== 'scheduled_sync_trigger') {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification type',
                code: 'INVALID_TYPE'
            });
        }

        if (targetUsers !== 'all_with_active_profiles') {
            return res.status(400).json({
                success: false,
                message: 'Invalid targetUsers value',
                code: 'INVALID_TARGET_USERS'
            });
        }

        if (!['morning', 'evening'].includes(notificationType)) {
            return res.status(400).json({
                success: false,
                message: 'notificationType must be "morning" or "evening"',
                code: 'INVALID_NOTIFICATION_TYPE'
            });
        }

        // Get schedules that need notifications
        const schedules = await fcmScheduleService.getSchedulesForNotification(
            notificationType,
            new Date(),
            15 // 15 minute window
        );

        const targetUserCount = schedules.length;
        const estimatedTime = Math.ceil(targetUserCount / batchSize) * 5; // 5 seconds per batch

        // Generate job ID
        const jobId = `fcm_batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // TODO: Queue the actual FCM sending job
        // For now, we'll just return the job info
        // In production, this would queue a background job

        return res.status(202).json({
            success: true,
            message: 'Notification job queued',
            data: {
                jobId,
                targetUserCount,
                batchSize,
                estimatedTime: `${estimatedTime}s`,
                status: 'queued'
            }
        });
    } catch (error) {
        console.error('Send FCM notifications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to queue notification job',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: 'FCM_SEND_ERROR'
        });
    }
};

/**
 * POST /api/mindtrain/fcm-notifications/callback
 * 
 * FCM delivery status webhook callback
 * 
 * Authentication: Required (Firebase Admin SDK)
 * 
 * Request Body:
 * {
 *   "notificationIds": ["notif_001", "notif_002"],
 *   "status": "delivered",
 *   "deliveredAt": "2025-01-29T14:00:00Z",
 *   "failedIds": ["notif_003"],
 *   "failureReason": "InvalidToken"
 * }
 */
const fcmCallback = async (req, res) => {
    try {
        // TODO: Add Firebase Admin SDK authentication check
        // For now, we'll process the callback
        
        const { notificationIds, status, deliveredAt, failedIds, failureReason } = req.body || {};

        // Validate request
        if (!notificationIds || !Array.isArray(notificationIds)) {
            return res.status(400).json({
                success: false,
                message: 'notificationIds array is required',
                code: 'MISSING_NOTIFICATION_IDS'
            });
        }

        // Update notification logs for delivered notifications
        if (notificationIds.length > 0 && status === 'delivered') {
            await NotificationLog.updateMany(
                { notificationId: { $in: notificationIds } },
                {
                    $set: {
                        status: 'delivered',
                        deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
                        updatedAt: new Date()
                    }
                }
            );
        }

        // Update notification logs for failed notifications
        if (failedIds && Array.isArray(failedIds) && failedIds.length > 0) {
            await NotificationLog.updateMany(
                { notificationId: { $in: failedIds } },
                {
                    $set: {
                        status: 'failed',
                        failedAt: new Date(),
                        deliveryError: failureReason || 'Unknown error',
                        deliveryRetries: { $inc: 1 },
                        updatedAt: new Date()
                    }
                }
            );
        }

        // TODO: Update deviceSyncStatus in AlarmProfile
        // TODO: Update SyncHealthLog for users
        // TODO: Add failed notifications to retry queue

        return res.status(200).json({
            success: true,
            message: 'Delivery status recorded'
        });
    } catch (error) {
        console.error('FCM callback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process callback',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: 'FCM_CALLBACK_ERROR'
        });
    }
};

/**
 * POST /api/mindtrain/fcm-notifications/test
 * 
 * Test endpoint to manually trigger a notification for a specific user.
 * Useful for testing WebSocket and FCM delivery.
 * 
 * Authentication: Not required (for testing purposes)
 * 
 * Request Body:
 * {
 *   "userId": "user_id_here", // Required
 *   "profileId": "profile_id_here", // Required
 *   "notificationType": "morning" // "morning" | "evening"
 * }
 */
const testNotification = async (req, res) => {
    try {
        const { userId, profileId, notificationType = 'morning' } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required',
                code: 'USER_ID_REQUIRED'
            });
        }

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'profileId is required',
                code: 'PROFILE_ID_REQUIRED'
            });
        }

        if (!['morning', 'evening'].includes(notificationType)) {
            return res.status(400).json({
                success: false,
                message: 'notificationType must be "morning" or "evening"',
                code: 'INVALID_NOTIFICATION_TYPE'
            });
        }

        console.log(`[TestNotification] Sending test notification to user ${userId}`);

        // Import notification service
        const { sendMindTrainNotification } = require('../../services/MindTrain/mindTrainNotification.service');

        // Send notification
        const result = await sendMindTrainNotification({
            userId: userId,
            profileId: profileId,
            notificationType: notificationType
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Test notification sent successfully',
                data: {
                    userId: userId,
                    profileId: profileId,
                    notificationType: notificationType,
                    deliveryMethod: result.deliveryMethod,
                    sentCount: result.sentCount || 1,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Failed to send test notification',
                code: 'NOTIFICATION_FAILED',
                error: result.message || result.reason,
                data: {
                    userId: userId,
                    profileId: profileId,
                    notificationType: notificationType
                }
            });
        }

    } catch (error) {
        console.error('Test notification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            code: 'TEST_NOTIFICATION_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    sendFCMNotifications,
    fcmCallback,
    testNotification
};

