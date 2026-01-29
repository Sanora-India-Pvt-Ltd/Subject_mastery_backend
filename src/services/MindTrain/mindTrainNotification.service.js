const mongoose = require('mongoose');
const { emitNotificationSync } = require('../notification/notificationEmitter');
const { NOTIFICATION_CATEGORY_ENUM } = require('../../constants/notificationCategories');

/**
 * MindTrain Notification Service
 *
 * Thin wrapper around the global notification emitter that:
 * - Normalizes MindTrain event payloads
 * - Ensures consistent category/type/title/message structure
 *
 * This does NOT know about HTTP or Express – safe to use from controllers,
 * middleware, workers, or other services.
 */

/**
 * Map an arbitrary MindTrain event to a notification payload
 *
 * @param {Object} event
 * @param {string|ObjectId} event.userId - Recipient user ID
 * @param {string} event.eventType - MindTrain event identifier (e.g. 'SESSION_COMPLETED')
 * @param {string} [event.title] - Optional custom title
 * @param {string} [event.message] - Optional custom message
 * @param {Object} [event.entity] - Optional { type, id } reference for deep-linking
 * @param {Object} [event.payload] - Optional extra metadata for frontend
 * @param {string} [event.priority] - 'LOW' | 'NORMAL' | 'HIGH'
 * @param {Array<string>} [event.channels] - e.g. ['IN_APP'], ['IN_APP', 'PUSH']
 */
const mapMindTrainEventToNotification = (event) => {
    if (!event || !event.userId || !event.eventType) {
        throw new Error('MindTrain event must include userId and eventType');
    }

    const recipientId = mongoose.Types.ObjectId.isValid(event.userId)
        ? event.userId
        : new mongoose.Types.ObjectId(event.userId);

    const normalizedType = String(event.eventType).startsWith('MINDTRAIN_')
        ? String(event.eventType)
        : `MINDTRAIN_${String(event.eventType).toUpperCase()}`;

    const title = (event.title || 'MindTrain update').trim();
    const message = (event.message || 'You have a new MindTrain update.').trim();

    const notificationPayload = {
        recipientId,
        recipientType: 'USER',
        category: NOTIFICATION_CATEGORY_ENUM.MINDTRAIN,
        type: normalizedType,
        title,
        message,
        entity: event.entity || undefined,
        payload: event.payload || {},
        priority: event.priority || 'NORMAL',
        channels: event.channels && event.channels.length > 0
            ? event.channels
            : ['IN_APP']
    };

    return notificationPayload;
};

/**
 * Public API: emit a MindTrain notification for a user
 *
 * Fire-and-forget by default (does not throw).
 *
 * @param {Object} event - See mapMindTrainEventToNotification
 */
const notifyMindTrainEvent = async (event) => {
    try {
        const notificationPayload = mapMindTrainEventToNotification(event);
        emitNotificationSync(notificationPayload);
    } catch (error) {
        // Never throw – MindTrain notifications must not break business flows
        console.error('❌ MindTrain notification emission failed (silently handled):', {
            error: error.message,
            eventSummary: event ? {
                userId: event.userId,
                eventType: event.eventType
            } : null
        });
    }
};

module.exports = {
    mapMindTrainEventToNotification,
    notifyMindTrainEvent
};





