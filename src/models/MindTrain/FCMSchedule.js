const mongoose = require('mongoose');

/**
 * FCMSchedule Model
 * 
 * Manages FCM (Firebase Cloud Messaging) notification schedules for alarm profiles.
 * Tracks when morning and evening sync trigger notifications should be sent.
 * 
 * Features:
 * - Morning and evening notification timing
 * - Timezone support
 * - Delivery tracking and retry logic
 * - Next scheduled notification tracking
 */

const fcmScheduleSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Active alarm profile reference
    activeProfileId: {
        type: String,
        ref: 'AlarmProfile',
        required: true,
        index: true
    },

    // Notification timing
    morningNotificationTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
        default: '08:00',
        trim: true
    },

    eveningNotificationTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
        default: '20:00',
        trim: true
    },

    timezone: {
        type: String,
        default: 'UTC',
        index: true,
        trim: true
    },

    isEnabled: {
        type: Boolean,
        default: true,
        index: true
    },

    // Delivery tracking
    lastSentAt: {
        type: Date,
        default: null
    },

    nextMorningNotification: {
        type: Date,
        index: true
    },

    nextEveningNotification: {
        type: Date,
        index: true
    },

    // Metadata
    deliveryRetries: {
        type: Number,
        default: 0,
        min: 0
    },

    failureReason: {
        type: String,
        default: null,
        trim: true
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
// Compound index for scheduled morning push notifications
fcmScheduleSchema.index({ 
    isEnabled: 1, 
    nextMorningNotification: 1 
});

// Compound index for scheduled evening push notifications
fcmScheduleSchema.index({ 
    isEnabled: 1, 
    nextEveningNotification: 1 
});

// Unique constraint: one FCM schedule per user
fcmScheduleSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('FCMSchedule', fcmScheduleSchema);

