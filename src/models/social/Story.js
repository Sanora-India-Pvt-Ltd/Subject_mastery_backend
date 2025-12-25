const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Index removed - covered by compound index { userId: 1, createdAt: -1 }
    },
    media: {
        url: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true,
            enum: ['image', 'video']
        },
        format: {
            type: String,
            required: false
        }
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true // This adds createdAt and updatedAt automatically
});

// Index for better query performance
storySchema.index({ userId: 1, createdAt: -1 }); // For user stories queries

// TTL index - MongoDB will auto-delete documents when expiresAt date is reached
// expireAfterSeconds: 0 means delete exactly when expiresAt is reached
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Story', storySchema);

