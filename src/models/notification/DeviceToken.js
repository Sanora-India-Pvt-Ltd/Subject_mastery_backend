const mongoose = require('mongoose');

/**
 * Device Token Model
 * 
 * Stores FCM/APNs device tokens for push notifications.
 * Supports both USER and UNIVERSITY recipients.
 * 
 * Design:
 * - One user/university can have multiple tokens (multiple devices)
 * - Tokens are platform-specific (ANDROID, IOS, WEB)
 * - Invalid tokens are marked inactive (not deleted)
 * - Unique constraint on token to prevent duplicates
 */

const deviceTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    universityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'University',
        required: false,
        index: true
    },
    role: {
        type: String,
        enum: ['USER', 'UNIVERSITY'],
        required: true,
        index: true
    },
    platform: {
        type: String,
        enum: ['ANDROID', 'IOS', 'WEB'],
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
deviceTokenSchema.index({ userId: 1, isActive: 1 });
deviceTokenSchema.index({ universityId: 1, isActive: 1 });
deviceTokenSchema.index({ role: 1, isActive: 1 });

// Validation: At least one of userId or universityId must be present
deviceTokenSchema.pre('save', async function() {
    if (!this.userId && !this.universityId) {
        throw new Error('Either userId or universityId must be provided');
    }
    
    // Ensure role matches the ID type
    if (this.userId && this.role !== 'USER') {
        throw new Error('userId requires role to be USER');
    }
    if (this.universityId && this.role !== 'UNIVERSITY') {
        throw new Error('universityId requires role to be UNIVERSITY');
    }
    
    // Ensure exactly one ID is set
    if (this.userId && this.universityId) {
        throw new Error('Cannot set both userId and universityId');
    }
});

module.exports =
  mongoose.models.DeviceToken ||
  mongoose.model('DeviceToken', deviceTokenSchema);
