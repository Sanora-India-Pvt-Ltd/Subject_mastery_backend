const { emitNotification } = require('../notification/notificationEmitter');
const { getIO } = require('../../socket/socketServer');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const User = require('../../models/authorization/User');
const mongoose = require('mongoose');

/**
 * MindTrain Notification Service
 * 
 * Broadcast-only notification system using unified notification system with IN_APP and PUSH channels:
 * - IN_APP: Real-time delivery via Socket.IO when app is open
 * - PUSH: FCM push notification when app is closed
 * 
 * Also emits custom mindtrain:sync_notification event for real-time sync handling.
 */

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
    broadcastMindTrainNotification
};
