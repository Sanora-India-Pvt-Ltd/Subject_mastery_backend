const { getIO } = require('../../socket/socketServer');
const { sendPushNotification } = require('../notification/pushNotification.service');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const mongoose = require('mongoose');

/**
 * MindTrain Notification Service
 * 
 * Hybrid notification system:
 * - Checks WebSocket connection first (real-time when app is open)
 * - Falls back to FCM push notification (when app is closed)
 * 
 * This ensures instant delivery when possible, reliable delivery always.
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

        // Prepare notification data
        const notificationData = {
            type: 'sync_trigger',
            title: 'MindTrain Sync',
            body: `Checking alarm schedule (${notificationType})`,
            data: {
                userId: userIdObjectId.toString(),
                syncSource: 'fcm',
                profileId: profileId,
                notificationType: notificationType,
                timestamp: new Date().toISOString()
            }
        };

        // Step 1: Try WebSocket first (real-time delivery)
        const wsDelivered = await tryWebSocketDelivery(userIdObjectId, notificationData);

        if (wsDelivered.success) {
            console.log(`[MindTrainNotification] ✅ WebSocket delivery to user ${userIdObjectId}`);
            
            // Log notification
            await logNotification({
                userId: userIdObjectId,
                notificationType,
                profileId,
                deliveryMethod: 'websocket',
                status: 'delivered',
                notificationData
            });

            return {
                success: true,
                deliveryMethod: 'websocket',
                message: 'Notification sent via WebSocket',
                ...wsDelivered
            };
        }

        // Step 2: Fallback to FCM push notification
        console.log(`[MindTrainNotification] WebSocket not available, using FCM for user ${userIdObjectId}`);
        
        const fcmResult = await sendPushNotification({
            recipientId: userIdObjectId,
            recipientType: 'USER',
            title: notificationData.title,
            body: notificationData.body,
            data: notificationData.data
        });

        // Log notification
        await logNotification({
            userId: userIdObjectId,
            notificationType,
            profileId,
            deliveryMethod: 'fcm',
            status: fcmResult.success ? 'sent' : 'failed',
            notificationData,
            fcmResult
        });

        if (fcmResult.success) {
            console.log(`[MindTrainNotification] ✅ FCM delivery to user ${userIdObjectId} (${fcmResult.sentCount} devices)`);
            return {
                success: true,
                deliveryMethod: 'fcm',
                message: 'Notification sent via FCM',
                sentCount: fcmResult.sentCount,
                failedCount: fcmResult.failedCount
            };
        } else {
            console.warn(`[MindTrainNotification] ⚠️ FCM delivery failed for user ${userIdObjectId}: ${fcmResult.reason}`);
            return {
                success: false,
                deliveryMethod: 'fcm',
                message: 'FCM delivery failed',
                reason: fcmResult.reason
            };
        }

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
 * Try to deliver notification via WebSocket
 * 
 * @param {ObjectId} userId - User ID
 * @param {Object} notificationData - Notification payload
 * @returns {Promise<Object>} Delivery result
 */
const tryWebSocketDelivery = async (userId, notificationData) => {
    try {
        let io;
        try {
            io = getIO();
        } catch (error) {
            // Socket.IO not initialized yet
            return {
                success: false,
                reason: 'Socket.IO not initialized'
            };
        }
        
        if (!io) {
            return {
                success: false,
                reason: 'Socket.IO not available'
            };
        }

        // Check if user has active WebSocket connection
        const userRoom = `user:${userId.toString()}`;
        const socketsInRoom = await io.in(userRoom).fetchSockets();

        if (socketsInRoom.length === 0) {
            return {
                success: false,
                reason: 'No active WebSocket connection'
            };
        }

        // Emit notification to user's room
        io.to(userRoom).emit('mindtrain:sync_notification', {
            ...notificationData.data,
            title: notificationData.title,
            body: notificationData.body,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            connectedSockets: socketsInRoom.length
        };

    } catch (error) {
        console.error('[MindTrainNotification] WebSocket delivery error:', error);
        return {
            success: false,
            reason: error.message
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
 * @param {string} params.deliveryMethod - 'websocket' | 'fcm' | 'error'
 * @param {string} params.status - 'delivered' | 'sent' | 'failed'
 * @param {Object} params.notificationData - Notification payload
 * @param {Object} params.fcmResult - FCM result (optional)
 * @param {string} params.error - Error message (optional)
 */
const logNotification = async ({ userId, notificationType, profileId, deliveryMethod, status, notificationData, fcmResult = null, error = null }) => {
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
                syncSource: notificationData.data.syncSource,
                notificationType: notificationType
            },
            deliveryError: error || (fcmResult && !fcmResult.success ? fcmResult.reason : null),
            deviceId: deliveryMethod === 'websocket' ? 'websocket' : 'fcm'
        };

        // Add delivery metadata
        if (deliveryMethod === 'fcm' && fcmResult) {
            logEntry.deliveryRetries = fcmResult.failedCount || 0;
        }

        await NotificationLog.create(logEntry);

    } catch (logError) {
        console.error('[MindTrainNotification] Failed to log notification:', logError);
        // Don't throw - logging failure shouldn't break notification flow
    }
};

module.exports = {
    sendMindTrainNotification,
    tryWebSocketDelivery
};
