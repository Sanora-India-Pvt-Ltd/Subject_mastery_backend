const mongoose = require('mongoose');

/**
 * NotificationLog Model
 * 
 * Tracks FCM notification delivery status and lifecycle.
 * Used for monitoring sync trigger notifications and other alarm-related notifications.
 * 
 * Features:
 * - Notification lifecycle tracking (scheduled, sent, delivered, opened, failed)
 * - Delivery retry logic
 * - Device and FCM token tracking
 * - Metadata for sync triggers and alarm events
 */

const notificationLogSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Unique notification identifier
    notificationId: {
        type: String,
        unique: true,
        index: true,
        required: true,
        trim: true
    },

    // Notification type
    type: {
        type: String,
        enum: ['sync_trigger', 'alarm_missed', 'schedule_update', 'system_alert'],
        default: 'sync_trigger',
        index: true
    },

    // Timing - notification lifecycle
    scheduledTime: {
        type: Date,
        index: true
    },

    sentAt: {
        type: Date,
        default: null
    },

    deliveredAt: {
        type: Date,
        default: null
    },

    openedAt: {
        type: Date,
        default: null
    },

    failedAt: {
        type: Date,
        default: null
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'opened', 'failed', 'bounced'],
        default: 'pending',
        index: true
    },

    deliveryError: {
        type: String,
        default: null,
        trim: true
    },

    deliveryRetries: {
        type: Number,
        default: 0,
        min: 0
    },

    // Content
    title: {
        type: String,
        default: null,
        trim: true
    },

    body: {
        type: String,
        default: null,
        trim: true
    },

    // Notification data payload
    data: {
        profileId: {
            type: String,
            default: null
        },
        syncSource: {
            type: String,
            default: null
        },
        reason: {
            type: String,
            default: null
        }
    },

    // Device info
    deviceId: {
        type: String,
        default: null,
        index: true,
        trim: true
    },

    fcmToken: {
        type: String,
        default: null,
        trim: true
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
// Compound index for push notification scheduling
notificationLogSchema.index({ status: 1, scheduledTime: 1 });

// Index for user notification history
notificationLogSchema.index({ userId: 1, createdAt: -1 });

// Index for notification type queries
notificationLogSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Index for failed notifications (for retry logic)
notificationLogSchema.index({ status: 1, deliveryRetries: 1, createdAt: 1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);

