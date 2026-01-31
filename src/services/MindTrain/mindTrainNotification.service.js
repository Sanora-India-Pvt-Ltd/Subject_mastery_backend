const { emitNotification } = require('../notification/notificationEmitter');
const { getIO } = require('../../socket/socketServer');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const User = require('../../models/authorization/User');
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

/**
 * Send MindTrain sync notification to ALL users (broadcast)
 * 
 * @param {Object} params
 * @param {string} params.profileId - Active alarm profile ID (optional for broadcast)
 * @param {string} params.notificationType - 'morning' | 'evening'
 * @param {string} params.scheduleId - FCM schedule ID (optional)
 * 
 * @returns {Promise<Object>} Result with delivery method and status
 */
const broadcastMindTrainNotification = async ({ profileId = null, notificationType, scheduleId = null }) => {
    try {
        // Validate inputs
        if (!notificationType) {
            throw new Error('notificationType is required');
        }

        if (!['morning', 'evening'].includes(notificationType)) {
            throw new Error('notificationType must be "morning" or "evening"');
        }

        // Prepare notification message
        const title = 'MindTrain Sync';
        const message = `Checking alarm schedule (${notificationType})`;

        // Prepare notification payload data
        const notificationPayload = {
            profileId: profileId,
            notificationType: notificationType,
            scheduleId: scheduleId,
            timestamp: new Date().toISOString(),
            syncSource: 'fcm',
            broadcast: true
        };

        // Broadcast via Socket.IO to all connected users
        let socketBroadcastCount = 0;
        try {
            const io = getIO();
            if (io) {
                // Broadcast to all connected sockets
                io.emit('mindtrain:sync_notification', {
                    ...notificationPayload,
                    title: title,
                    body: message
                });
                
                // Also broadcast unified notification event to all
                io.emit('notification', {
                    id: `broadcast_${Date.now()}`,
                    title: title,
                    message: message,
                    category: 'MINDTRAIN',
                    type: 'MINDTRAIN_SYNC_TRIGGER',
                    createdAt: new Date(),
                    entity: profileId ? {
                        type: 'ALARM_PROFILE',
                        id: profileId
                    } : null,
                    payload: notificationPayload,
                    broadcast: true
                });

                // Get count of connected sockets (approximate)
                const sockets = await io.fetchSockets();
                socketBroadcastCount = sockets.length;
                
                console.log(`[MindTrainNotification] 📢 Broadcasted to ${socketBroadcastCount} connected sockets`);
            }
        } catch (socketError) {
            console.warn('[MindTrainNotification] Failed to broadcast socket event:', socketError);
        }

        // Send FCM push notifications to all users via unified notification system
        let processedCount = 0;
        let failedCount = 0;
        const batchSize = 500;

        try {
            // Get all users in batches
            let userSkip = 0;
            let hasMoreUsers = true;

            while (hasMoreUsers) {
                const users = await User.find({})
                    .select('_id')
                    .skip(userSkip)
                    .limit(batchSize)
                    .lean();

                if (users.length === 0) {
                    hasMoreUsers = false;
                } else {
                    // Process batch in parallel
                    const batchPromises = users.map(async (user) => {
                        try {
                            await emitNotification({
                                recipientType: 'USER',
                                recipientId: user._id,
                                category: 'MINDTRAIN',
                                type: 'MINDTRAIN_SYNC_TRIGGER',
                                title: title,
                                message: message,
                                channels: ['IN_APP', 'PUSH'],
                                entity: profileId ? {
                                    type: 'ALARM_PROFILE',
                                    id: profileId
                                } : undefined,
                                payload: notificationPayload,
                                priority: 'HIGH',
                                _broadcast: true,
                                _broadcastScope: 'USERS',
                                _createdBy: 'SYSTEM'
                            });
                            return { success: true };
                        } catch (error) {
                            console.error(`[MindTrainNotification] Failed for user ${user._id}:`, error.message);
                            return { success: false, error: error.message };
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    batchResults.forEach(result => {
                        if (result.success) {
                            processedCount++;
                        } else {
                            failedCount++;
                        }
                    });

                    userSkip += batchSize;
                    if (users.length < batchSize) {
                        hasMoreUsers = false;
                    }
                }
            }

            console.log(`[MindTrainNotification] 📦 Processed ${processedCount} users, ${failedCount} failed`);
        } catch (fcmError) {
            console.error('[MindTrainNotification] Failed to send FCM notifications:', fcmError);
        }

        console.log(`[MindTrainNotification] ✅ Broadcast completed: ${socketBroadcastCount} sockets, ${processedCount} FCM notifications`);

        return {
            success: true,
            deliveryMethod: 'broadcast',
            message: 'Notification broadcasted to all users',
            channels: ['IN_APP', 'PUSH'],
            stats: {
                socketBroadcastCount,
                fcmProcessedCount: processedCount,
                fcmFailedCount: failedCount
            }
        };

    } catch (error) {
        console.error('[MindTrainNotification] Broadcast error:', error);
        return {
            success: false,
            deliveryMethod: 'none',
            message: 'Broadcast failed',
            error: error.message
        };
    }
};

module.exports = {
    sendMindTrainNotification,
    broadcastMindTrainNotification
};
