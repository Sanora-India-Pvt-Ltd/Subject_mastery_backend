const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Index removed - covered by compound index { userId: 1, createdAt: -1 }
    },
    caption: {
        type: String,
        default: '',
        maxlength: 2200 // Instagram-style caption limit
    },
    media: [{
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
    }],
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
            maxlength: 1000
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
postSchema.index({ userId: 1, createdAt: -1 }); // For user posts queries
postSchema.index({ createdAt: -1 }); // For all posts feed queries

// Virtual for like count (sum of all reactions)
postSchema.virtual('likeCount').get(function() {
    if (!this.likes || !Array.isArray(this.likes)) return 0;
    return this.likes.reduce((total, reactionArray) => total + (reactionArray ? reactionArray.length : 0), 0);
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
    return this.comments ? this.comments.length : 0;
});

// Ensure virtuals are included in JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);

