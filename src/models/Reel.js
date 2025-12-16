const mongoose = require('mongoose');

const ALLOWED_CONTENT_TYPES = ['education', 'fun'];
const ALLOWED_VISIBILITY = ['public', 'followers', 'private'];

const reelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
        thumbnailUrl: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            required: true,
            enum: ['video']
        },
        format: String,
        duration: Number,
        dimensions: {
            width: Number,
            height: Number
        },
        size: Number // in bytes
    },
    caption: {
        type: String,
        default: '',
        maxlength: 2200
    },
    contentType: {
        type: String,
        required: true,
        enum: ALLOWED_CONTENT_TYPES
    },
    visibility: {
        type: String,
        enum: ALLOWED_VISIBILITY,
        default: 'public'
    },
    views: {
        type: Number,
        default: 0
    },
    // Likes structure: [happy[], sad[], angry[], hug[], wow[], like[]]
    // Each sub-array contains only userIds for that reaction type
    likes: {
        type: [[mongoose.Schema.Types.ObjectId]],
        default: [[], [], [], [], [], []], // [happy, sad, angry, hug, wow, like]
        ref: 'User'
    },
    comments: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        text: {
            type: String,
            required: true,
            maxlength: 500
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
reelSchema.index({ contentType: 1, createdAt: -1 }); // For contentType feed queries
reelSchema.index({ userId: 1, createdAt: -1 }); // For user reels queries

// Virtual for like count (sum of all reactions)
reelSchema.virtual('likeCount').get(function() {
    if (!this.likes || !Array.isArray(this.likes)) return 0;
    return this.likes.reduce((total, reactionArray) => total + (reactionArray ? reactionArray.length : 0), 0);
});

// Virtual for comment count
reelSchema.virtual('commentCount').get(function() {
    return this.comments ? this.comments.length : 0;
});

reelSchema.set('toJSON', { virtuals: true });
reelSchema.set('toObject', { virtuals: true });

module.exports = {
    Reel: mongoose.model('Reel', reelSchema),
    ALLOWED_CONTENT_TYPES
};

