const { emitNotification } = require('../notification/notificationEmitter');
const { getIO } = require('../../socket/socketServer');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const mongoose = require('mongoose');

/**
 * MindTrain Notification Service
 * 
 * Uses the unified notification system with IN_APP and PUSH channels:
 * - IN_APP: Real-time delivery via Socket.IO when app is open
 * - PUSH: FCM push notification when app is closed
 * 
 * Also emits custom mindtrain:sync_notification event for real-time sync handling.
 */

/**
 * Send MindTrain sync notification to a user
 * 
 * @param {Object} params
 * @param {string|ObjectId} params.userId - User ID
 * @param {string} params.profileId - Active alarm profile ID
 * @param {string} params.notificationType - 'morning' | 'evening'
 * @param {string} params.scheduleId - FCM schedule ID (optional)
 * 
 * @returns {Promise<Object>} Result with delivery method and status
 */
const sendMindTrainNotification = async ({ userId, profileId, notificationType, scheduleId = null }) => {
    try {
        // Validate inputs
        if (!userId || !profileId || !notificationType) {
            throw new Error('userId, profileId, and notificationType are required');
        }

        if (!['morning', 'evening'].includes(notificationType)) {
            throw new Error('notificationType must be "morning" or "evening"');
        }

        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        // Prepare notification message
        const title = 'MindTrain Sync';
        const message = `Checking alarm schedule (${notificationType})`;

        // Prepare notification payload data
        const notificationPayload = {
            profileId: profileId,
            notificationType: notificationType,
            scheduleId: scheduleId,
            timestamp: new Date().toISOString(),
            syncSource: 'fcm'
        };

        // Emit notification using unified notification system with both IN_APP and PUSH channels
        try {
            await emitNotification({
                recipientType: 'USER',
                recipientId: userIdObjectId,
                category: 'MINDTRAIN',
                type: 'MINDTRAIN_SYNC_TRIGGER',
                title: title,
                message: message,
                channels: ['IN_APP', 'PUSH'],
                entity: {
                    type: 'ALARM_PROFILE',
                    id: profileId
                },
                payload: notificationPayload,
                priority: 'HIGH'
            });
        } catch (notifError) {
            // Don't break the API if notification fails
            console.error('[MindTrainNotification] Failed to emit notification:', notifError);
        }

        // Also emit custom mindtrain:sync_notification event for real-time sync handling
        try {
            const io = getIO();
            if (io) {
                const userRoom = `user:${userIdObjectId.toString()}`;
                io.to(userRoom).emit('mindtrain:sync_notification', {
                    ...notificationPayload,
                    title: title,
                    body: message
                });
            }
        } catch (socketError) {
            // Socket emission failure is not critical
            console.warn('[MindTrainNotification] Failed to emit socket event:', socketError);
        }

        // Log notification to MindTrain-specific NotificationLog
        await logNotification({
            userId: userIdObjectId,
            notificationType,
            profileId,
            deliveryMethod: 'unified',
            status: 'sent',
            notificationData: {
                title: title,
                body: message,
                data: notificationPayload
            }
        });

        console.log(`[MindTrainNotification] ✅ Notification sent to user ${userIdObjectId} (${notificationType})`);

        return {
            success: true,
            deliveryMethod: 'unified',
            message: 'Notification sent via IN_APP and PUSH channels',
            channels: ['IN_APP', 'PUSH']
        };

    } catch (error) {
        console.error('[MindTrainNotification] Error:', error);
        
        // Log error
        try {
            await logNotification({
                userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
                notificationType,
                profileId,
                deliveryMethod: 'error',
                status: 'failed',
                error: error.message
            });
        } catch (logError) {
            console.error('[MindTrainNotification] Failed to log error:', logError);
        }

        return {
            success: false,
            deliveryMethod: 'none',
            message: 'Notification failed',
            error: error.message
        };
    }
};


/**
 * Log notification to database
 * 
 * @param {Object} params
 * @param {ObjectId} params.userId - User ID
 * @param {string} params.notificationType - 'morning' | 'evening'
 * @param {string} params.profileId - Profile ID
 * @param {string} params.deliveryMethod - 'unified' | 'error'
 * @param {string} params.status - 'delivered' | 'sent' | 'failed'
 * @param {Object} params.notificationData - Notification payload
 * @param {string} params.error - Error message (optional)
 */
const logNotification = async ({ userId, notificationType, profileId, deliveryMethod, status, notificationData, error = null }) => {
    try {
        // Generate unique notification ID
        const notificationId = `mindtrain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const logEntry = {
            userId: userId,
            notificationId: notificationId,
            type: 'sync_trigger',
            sentAt: new Date(),
            status: status === 'delivered' ? 'delivered' : status === 'sent' ? 'sent' : 'failed',
            title: notificationData.title,
            body: notificationData.body,
            data: {
                profileId: profileId,
                syncSource: notificationData.data?.syncSource || 'fcm',
                notificationType: notificationType
            },
            deliveryError: error || null,
            deviceId: deliveryMethod === 'unified' ? 'unified_inapp_push' : deliveryMethod
        };

        await NotificationLog.create(logEntry);

    } catch (logError) {
        console.error('[MindTrainNotification] Failed to log notification:', logError);
        // Don't throw - logging failure shouldn't break notification flow
    }
};

module.exports = {
    sendMindTrainNotification
};
