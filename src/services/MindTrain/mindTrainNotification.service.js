const { getIO } = require('../../socket/socketServer');
const { sendPushNotification } = require('../notification/pushNotification.service');
const User = require('../../models/authorization/User');

/**
 * MindTrain Notification Service
 * 
 * Broadcast notification system via Socket.IO and FCM Push:
 * - Real-time delivery to all connected users via Socket.IO (IN_APP)
 * - Push notifications to all users via FCM (PUSH)
 * - No database notification records (broadcast only)
 * 
 * Emits custom mindtrain:sync_notification and unified notification events.
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

        // Send FCM push notifications to all users
        let pushProcessedCount = 0;
        let pushFailedCount = 0;
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
                            const pushResult = await sendPushNotification({
                                recipientId: user._id,
                                recipientType: 'USER',
                                title: title,
                                body: message,
                                data: {
                                    category: 'MINDTRAIN',
                                    type: 'MINDTRAIN_SYNC_TRIGGER',
                                    ...notificationPayload
                                }
                            });

                            if (pushResult.success && pushResult.sentCount > 0) {
                                return { success: true };
                            } else {
                                return { success: false, reason: pushResult.reason || 'No tokens' };
                            }
                        } catch (error) {
                            console.error(`[MindTrainNotification] Push failed for user ${user._id}:`, error.message);
                            return { success: false, error: error.message };
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    batchResults.forEach(result => {
                        if (result.success) {
                            pushProcessedCount++;
                        } else {
                            pushFailedCount++;
                        }
                    });

                    userSkip += batchSize;
                    if (users.length < batchSize) {
                        hasMoreUsers = false;
                    }
                }
            }

            console.log(`[MindTrainNotification] 📦 Push notifications: ${pushProcessedCount} sent, ${pushFailedCount} failed`);
        } catch (pushError) {
            console.error('[MindTrainNotification] Failed to send push notifications:', pushError);
        }

        console.log(`[MindTrainNotification] ✅ Broadcast completed: ${socketBroadcastCount} sockets, ${pushProcessedCount} push notifications`);

        return {
            success: true,
            deliveryMethod: 'broadcast',
            message: 'Notification broadcasted to all users',
            channels: ['IN_APP', 'PUSH'],
            stats: {
                socketBroadcastCount,
                pushProcessedCount,
                pushFailedCount
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
