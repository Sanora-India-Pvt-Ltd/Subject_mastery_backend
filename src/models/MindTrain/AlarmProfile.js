const mongoose = require('mongoose');

/**
 * AlarmProfile Model
 * 
 * Stores alarm profile configurations for MindTrain feature.
 * Each profile defines when and how alarms should be triggered.
 * 
 * Features:
 * - YouTube URL-based alarm content
 * - Flexible scheduling (fixed time or dynamic)
 * - Sync tracking and health monitoring
 * - Multi-device support
 */

const alarmProfileSchema = new mongoose.Schema({
    // Unique identifier (timestamp-based from client)
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Alarm content
    youtubeUrl: {
        type: String,
        required: true,
        trim: true
    },

    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: '',
        trim: true
    },

    // Alarm scheduling configuration
    alarmsPerDay: {
        type: Number,
        required: true,
        min: 1,
        max: 24
    },

    selectedDaysPerWeek: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.length > 0 && 
                       v.every(day => day >= 1 && day <= 7);
            },
            message: 'selectedDaysPerWeek must be an array of numbers between 1 (Monday) and 7 (Sunday)'
        }
    },

    startTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
        trim: true
    },

    endTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
        trim: true
    },

    isFixedTime: {
        type: Boolean,
        required: true,
        default: false
    },

    fixedTime: {
        type: String,
        default: null,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
        trim: true
    },

    specificDates: {
        type: [String],
        default: null
    },

    // Active status - only one active profile per user
    isActive: {
        type: Boolean,
        required: true,
        default: false,
        index: true
    },

    // NEW FIELDS - Sync Metadata
    lastSyncTimestamp: {
        type: Date,
        default: null,
        index: true
    },

    lastSyncSource: {
        type: String,
        enum: ['local', 'workmanager', 'fcm', 'manual'],
        default: null
    },

    syncHealthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },

    lastSyncStatus: {
        type: String,
        enum: ['success', 'pending', 'failed', 'timeout'],
        default: 'pending'
    },

    nextSyncCheckTime: {
        type: Date,
        default: null,
        index: true
    },

    // Track which devices have synced this profile
    deviceSyncStatus: [{
        deviceId: {
            type: String,
            required: true
        },
        lastSyncAt: {
            type: Date,
            default: Date.now
        },
        syncStatus: {
            type: String,
            enum: ['success', 'pending', 'failed', 'timeout'],
            default: 'pending'
        },
        lastError: {
            type: String,
            default: null
        }
    }]
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better query performance
// Unique index on id for fast lookups
alarmProfileSchema.index({ id: 1 }, { unique: true });

// Index on userId for user-specific queries
alarmProfileSchema.index({ userId: 1 });

// Index on isActive for filtering active profiles
alarmProfileSchema.index({ isActive: 1 });

// Index on lastSyncTimestamp for sync queries
alarmProfileSchema.index({ lastSyncTimestamp: 1 });

// Index on nextSyncCheckTime for scheduled sync checks
alarmProfileSchema.index({ nextSyncCheckTime: 1 });

// Compound index for fetching active profiles with sync info
alarmProfileSchema.index({ userId: 1, isActive: 1, lastSyncTimestamp: 1 });

// Compound index for scheduled sync checks
alarmProfileSchema.index({ userId: 1, nextSyncCheckTime: 1 });

module.exports = mongoose.model('AlarmProfile', alarmProfileSchema);

