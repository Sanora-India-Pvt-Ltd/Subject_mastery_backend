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
    // Array of arrays for likes - each sub-array represents a reaction type:
    // 0: happy, 1: sad, 2: angry, 3: hug, 4: wow, 5: like
    likes: {
        type: [[{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]],
        default: [[], [], [], [], [], []]  // Initialize with 6 empty arrays
    }
    // Comments are now stored in a separate Comment collection for scalability
}, {
    timestamps: true
});

// Indexes for better query performance
postSchema.index({ userId: 1, createdAt: -1 }); // For user posts queries
postSchema.index({ createdAt: -1 }); // For all posts feed queries

// Instance method to get comment count (includes replies)
postSchema.methods.getCommentCount = async function() {
    const Comment = mongoose.model('Comment');
    const commentDoc = await Comment.findOne({ 
        contentId: this._id, 
        contentType: 'post' 
    }).lean();
    
    if (!commentDoc || !commentDoc.comments) {
        return 0;
    }
    
    // Count top-level comments
    const topLevelCount = commentDoc.comments.length;
    
    // Count all replies
    const replyCount = commentDoc.comments.reduce((sum, comment) => {
        return sum + (comment.replies ? comment.replies.length : 0);
    }, 0);
    
    return topLevelCount + replyCount;
};

// Ensure virtuals are included in JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);

