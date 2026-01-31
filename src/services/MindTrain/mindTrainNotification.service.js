const { getIO } = require('../../socket/socketServer');

/**
 * MindTrain Notification Service
 * 
 * Broadcast-only notification system via Socket.IO:
 * - Real-time delivery to all connected users via Socket.IO
 * - No per-user notifications or database records
 * - No Redis/queue required
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

        console.log(`[MindTrainNotification] ✅ Broadcast completed: ${socketBroadcastCount} connected sockets`);

        return {
            success: true,
            deliveryMethod: 'broadcast',
            message: 'Notification broadcasted to all connected users',
            channels: ['IN_APP'],
            stats: {
                socketBroadcastCount
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
