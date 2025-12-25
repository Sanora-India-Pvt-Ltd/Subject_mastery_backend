const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    // Reference to the post or reel this comment document belongs to
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true, // One document per post/reel
        index: true
    },
    // Type of content: 'post' or 'reel'
    contentType: {
        type: String,
        required: true,
        enum: ['post', 'reel'],
        index: true
    },
    // Array of all comments for this post/reel
    // Each comment can have replies (array-in-array format)
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
        },
        // Replies stored as array-in-array format within each comment
        replies: [{
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
    }],
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for fetching comments by content
commentSchema.index({ contentId: 1, contentType: 1 });

// Virtual for total comment count (top-level comments only)
commentSchema.virtual('commentCount').get(function() {
    return this.comments ? this.comments.length : 0;
});

// Virtual for total engagement (all comments + all replies)
commentSchema.virtual('totalEngagement').get(function() {
    if (!this.comments) return 0;
    const topLevelCount = this.comments.length;
    const repliesCount = this.comments.reduce((sum, comment) => {
        return sum + (comment.replies ? comment.replies.length : 0);
    }, 0);
    return topLevelCount + repliesCount;
});

// Ensure virtuals are included in JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

// Static method to get or create comment document for a post/reel
commentSchema.statics.getOrCreateCommentDoc = async function(contentId, contentType) {
    let commentDoc = await this.findOne({ contentId, contentType });
    
    if (!commentDoc) {
        // Create new document for this post/reel
        commentDoc = await this.create({
            contentId: contentId,
            contentType: contentType,
            comments: []
        });
    }
    
    return commentDoc;
};

// Static method to get comments for a post/reel with pagination
commentSchema.statics.getCommentsByContent = async function(contentId, contentType, options = {}) {
    const {
        page = 1,
        limit = 15,
        sortBy = 'createdAt',
        sortOrder = -1
    } = options;

    const commentDoc = await this.findOne({ contentId, contentType })
        .populate('comments.userId', 'profile.name.first profile.name.last profile.name.full profile.profileImage')
        .populate('comments.replies.userId', 'profile.name.first profile.name.last profile.name.full profile.profileImage')
        .lean();

    if (!commentDoc || !commentDoc.comments || commentDoc.comments.length === 0) {
        return [];
    }

    // Sort comments
    const sortedComments = [...commentDoc.comments].sort((a, b) => {
        const aVal = a[sortBy] || a.createdAt;
        const bVal = b[sortBy] || b.createdAt;
        return sortOrder === -1 ? new Date(bVal) - new Date(aVal) : new Date(aVal) - new Date(bVal);
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedComments = sortedComments.slice(skip, skip + limit);

    // Format comments with limited replies (5 most recent per comment)
    return paginatedComments.map(comment => {
        const sortedReplies = (comment.replies || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        return {
            ...comment,
            replies: sortedReplies,
            replyCount: comment.replies ? comment.replies.length : 0
        };
    });
};

// Static method to get replies for a specific comment with pagination
commentSchema.statics.getRepliesByComment = async function(contentId, contentType, commentId, options = {}) {
    const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 1
    } = options;

    const commentDoc = await this.findOne({ contentId, contentType }).lean();
    
    if (!commentDoc || !commentDoc.comments) {
        return [];
    }

    // Find the specific comment
    const comment = commentDoc.comments.find(
        c => c._id.toString() === commentId.toString()
    );

    if (!comment || !comment.replies) {
        return [];
    }

    // Sort replies and apply pagination
    const sortedReplies = [...comment.replies].sort((a, b) => {
        const aVal = a[sortBy] || a.createdAt;
        const bVal = b[sortBy] || b.createdAt;
        return sortOrder === 1 ? new Date(aVal) - new Date(bVal) : new Date(bVal) - new Date(aVal);
    });

    const skip = (page - 1) * limit;
    const paginatedReplies = sortedReplies.slice(skip, skip + limit);

    // Populate userId for each reply
    const User = mongoose.model('User');
    const populatedReplies = await Promise.all(
        paginatedReplies.map(async (reply) => {
            const user = await User.findById(reply.userId)
                .select('profile.name.first profile.name.last profile.name.full profile.profileImage')
                .lean();
            return {
                ...reply,
                user: user
            };
        })
    );

    return populatedReplies;
};

// Instance method to add a comment
commentSchema.methods.addComment = async function(userId, text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Comment text is required');
    }

    if (text.length > 1000) {
        throw new Error('Comment text must be 1000 characters or less');
    }

    if (!this.comments) {
        this.comments = [];
    }

    this.comments.push({
        userId: userId,
        text: text.trim(),
        createdAt: new Date(),
        replies: []
    });

    this.updatedAt = new Date();
    await this.save();

    return this.comments[this.comments.length - 1];
};

// Instance method to add a reply to a comment
commentSchema.methods.addReply = async function(commentId, userId, text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Reply text is required');
    }

    if (text.length > 1000) {
        throw new Error('Reply text must be 1000 characters or less');
    }

    if (!this.comments) {
        throw new Error('Comment not found');
    }

    // Find the comment
    const comment = this.comments.id(commentId);
    if (!comment) {
        throw new Error('Comment not found');
    }

    // Initialize replies array if it doesn't exist
    if (!comment.replies) {
        comment.replies = [];
    }

    // Add the reply
    comment.replies.push({
        userId: userId,
        text: text.trim(),
        createdAt: new Date()
    });

    this.updatedAt = new Date();
    await this.save();

    return comment.replies[comment.replies.length - 1];
};

// Instance method to remove a comment
commentSchema.methods.removeComment = async function(commentId) {
    if (!this.comments) {
        return false;
    }

    const initialLength = this.comments.length;
    this.comments = this.comments.filter(
        comment => comment._id.toString() !== commentId.toString()
    );

    if (this.comments.length < initialLength) {
        this.updatedAt = new Date();
        await this.save();
        return true;
    }

    return false;
};

// Instance method to remove a reply
commentSchema.methods.removeReply = async function(commentId, replyId) {
    if (!this.comments) {
        return false;
    }

    const comment = this.comments.id(commentId);
    if (!comment || !comment.replies) {
        return false;
    }

    const initialLength = comment.replies.length;
    comment.replies = comment.replies.filter(
        reply => reply._id.toString() !== replyId.toString()
    );

    if (comment.replies.length < initialLength) {
        this.updatedAt = new Date();
        await this.save();
        return true;
    }

    return false;
};

module.exports = mongoose.model('Comment', commentSchema);
