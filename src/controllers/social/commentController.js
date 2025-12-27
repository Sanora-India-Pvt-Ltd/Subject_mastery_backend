const Comment = require('../../models/social/Comment');
const Post = require('../../models/social/Post');
const { Reel } = require('../../models/social/Reel');
const mongoose = require('mongoose');

// Add a comment to a post or reel
const addComment = async (req, res) => {
    try {
        const user = req.user; // From protect middleware
        const { contentId, contentType, text } = req.body;

        // Validate contentId
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID'
            });
        }

        // Validate contentType
        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel"'
            });
        }

        // Validate comment text
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment text is required'
            });
        }

        // Validate text length based on content type
        const maxLength = contentType === 'reel' ? 500 : 1000;
        if (text.length > maxLength) {
            return res.status(400).json({
                success: false,
                message: `Comment text must be ${maxLength} characters or less for ${contentType}s`
            });
        }

        // Verify that the post/reel exists
        let content;
        const contentObjectId = new mongoose.Types.ObjectId(contentId);
        
        if (contentType === 'post') {
            content = await Post.findById(contentObjectId);
        } else {
            content = await Reel.findById(contentObjectId);
        }

        if (!content) {
            console.error(`[Comment Controller] ${contentType} not found:`, {
                contentId,
                contentType,
                isValidObjectId: mongoose.Types.ObjectId.isValid(contentId),
                userId: user._id
            });
            return res.status(404).json({
                success: false,
                message: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} not found`
            });
        }

        // Get or create comment document for this post/reel
        const commentDoc = await Comment.getOrCreateCommentDoc(contentId, contentType);

        // Add the comment
        const newComment = await commentDoc.addComment(user._id, text);

        // Populate user info
        await commentDoc.populate('comments.userId', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Find the newly added comment in the populated document
        const addedComment = commentDoc.comments.id(newComment._id);
        const commentUserInfo = addedComment.userId._id ? {
            id: addedComment.userId._id.toString(),
            firstName: addedComment.userId.profile?.name?.first || '',
            lastName: addedComment.userId.profile?.name?.last || '',
            name: addedComment.userId.profile?.name?.full || '',
            profileImage: addedComment.userId.profile?.profileImage
        } : null;

        return res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: {
                comment: {
                    id: addedComment._id.toString(),
                    userId: addedComment.userId._id ? addedComment.userId._id.toString() : addedComment.userId.toString(),
                    user: commentUserInfo,
                    text: addedComment.text,
                    replies: [],
                    replyCount: 0,
                    createdAt: addedComment.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Add comment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add comment',
            error: error.message
        });
    }
};

// Add a reply to a comment
const addReply = async (req, res) => {
    try {
        const user = req.user;
        const { commentId } = req.params;
        const { contentId, contentType, text } = req.body;

        // Validate IDs
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID'
            });
        }

        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel"'
            });
        }

        if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid comment ID'
            });
        }

        // Validate reply text
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Reply text is required'
            });
        }

        if (text.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Reply text must be 1000 characters or less'
            });
        }

        // Get comment document for this post/reel
        const commentDoc = await Comment.getOrCreateCommentDoc(contentId, contentType);

        // Add the reply using the instance method
        const reply = await commentDoc.addReply(commentId, user._id, text);

        // Populate user info
        await commentDoc.populate('comments.replies.userId', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Find the comment and the newly added reply
        const comment = commentDoc.comments.id(commentId);
        const newReply = comment.replies.id(reply._id);

        const replyUserInfo = newReply.userId._id ? {
            id: newReply.userId._id.toString(),
            firstName: newReply.userId.profile?.name?.first || '',
            lastName: newReply.userId.profile?.name?.last || '',
            name: newReply.userId.profile?.name?.full || '',
            profileImage: newReply.userId.profile?.profileImage
        } : null;

        return res.status(201).json({
            success: true,
            message: 'Reply added successfully',
            data: {
                reply: {
                    id: newReply._id.toString(),
                    userId: newReply.userId._id ? newReply.userId._id.toString() : newReply.userId.toString(),
                    user: replyUserInfo,
                    text: newReply.text,
                    createdAt: newReply.createdAt
                },
                comment: {
                    id: comment._id.toString(),
                    replyCount: comment.replies ? comment.replies.length : 0
                }
            }
        });

    } catch (error) {
        console.error('Add reply error:', error);
        return res.status(500).json({
            success: false,
            message: error.message === 'Comment not found' ? 'Comment not found' : 'Failed to add reply',
            error: error.message
        });
    }
};

// Get comments for a post or reel (using path parameters)
const getComments = async (req, res) => {
    try {
        const { contentId, contentType } = req.params;
        const { page = 1, limit = 15, sortBy = 'createdAt', sortOrder = -1 } = req.query;

        // Validate contentId
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID'
            });
        }

        // Validate contentType
        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel"'
            });
        }

        // Verify that the post/reel exists
        let content;
        if (contentType === 'post') {
            content = await Post.findById(contentId);
        } else {
            content = await Reel.findById(contentId);
        }

        if (!content) {
            return res.status(404).json({
                success: false,
                message: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} not found`
            });
        }

        // Get comments using the static method
        const comments = await Comment.getCommentsByContent(contentId, contentType, {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy: sortBy,
            sortOrder: parseInt(sortOrder)
        });

        // Format comments for response
        const formattedComments = comments.map(comment => {
            const commentUserInfo = comment.userId._id ? {
                id: comment.userId._id.toString(),
                firstName: comment.userId.profile?.name?.first || '',
                lastName: comment.userId.profile?.name?.last || '',
                name: comment.userId.profile?.name?.full || '',
                profileImage: comment.userId.profile?.profileImage
            } : null;

            // Format replies
            const formattedReplies = (comment.replies || []).map(reply => {
                const replyUserInfo = reply.userId._id ? {
                    id: reply.userId._id.toString(),
                    firstName: reply.userId.profile?.name?.first || '',
                    lastName: reply.userId.profile?.name?.last || '',
                    name: reply.userId.profile?.name?.full || '',
                    profileImage: reply.userId.profile?.profileImage
                } : null;

                return {
                    id: reply._id.toString(),
                    userId: reply.userId._id ? reply.userId._id.toString() : reply.userId.toString(),
                    user: replyUserInfo,
                    text: reply.text,
                    createdAt: reply.createdAt
                };
            });

            return {
                id: comment._id.toString(),
                userId: comment.userId._id ? comment.userId._id.toString() : comment.userId.toString(),
                user: commentUserInfo,
                text: comment.text,
                replies: formattedReplies,
                replyCount: comment.replyCount || formattedReplies.length,
                createdAt: comment.createdAt
            };
        });

        // Get total count for pagination
        const commentDoc = await Comment.findOne({ contentId, contentType }).lean();
        const totalComments = commentDoc && commentDoc.comments ? commentDoc.comments.length : 0;

        return res.status(200).json({
            success: true,
            message: 'Comments retrieved successfully',
            data: {
                comments: formattedComments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalComments,
                    pages: Math.ceil(totalComments / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get comments error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve comments',
            error: error.message
        });
    }
};

// Get comments for a post or reel (using query parameters - separate API endpoint)
const getCommentsByQuery = async (req, res) => {
    try {
        const { contentId, contentType, page = 1, limit = 15, sortBy = 'createdAt', sortOrder = -1 } = req.query;

        // Validate contentId
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID. Please provide contentId as query parameter.'
            });
        }

        // Validate contentType
        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel". Please provide contentType as query parameter.'
            });
        }

        // Verify that the post/reel exists
        let content;
        if (contentType === 'post') {
            content = await Post.findById(contentId);
        } else {
            content = await Reel.findById(contentId);
        }

        if (!content) {
            return res.status(404).json({
                success: false,
                message: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} not found`
            });
        }

        // Get comments using the static method
        const comments = await Comment.getCommentsByContent(contentId, contentType, {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy: sortBy,
            sortOrder: parseInt(sortOrder)
        });

        // Format comments for response
        const formattedComments = comments.map(comment => {
            const commentUserInfo = comment.userId._id ? {
                id: comment.userId._id.toString(),
                firstName: comment.userId.profile?.name?.first || '',
                lastName: comment.userId.profile?.name?.last || '',
                name: comment.userId.profile?.name?.full || '',
                profileImage: comment.userId.profile?.profileImage
            } : null;

            // Format replies
            const formattedReplies = (comment.replies || []).map(reply => {
                const replyUserInfo = reply.userId._id ? {
                    id: reply.userId._id.toString(),
                    firstName: reply.userId.profile?.name?.first || '',
                    lastName: reply.userId.profile?.name?.last || '',
                    name: reply.userId.profile?.name?.full || '',
                    profileImage: reply.userId.profile?.profileImage
                } : null;

                return {
                    id: reply._id.toString(),
                    userId: reply.userId._id ? reply.userId._id.toString() : reply.userId.toString(),
                    user: replyUserInfo,
                    text: reply.text,
                    createdAt: reply.createdAt
                };
            });

            return {
                id: comment._id.toString(),
                userId: comment.userId._id ? comment.userId._id.toString() : comment.userId.toString(),
                user: commentUserInfo,
                text: comment.text,
                replies: formattedReplies,
                replyCount: comment.replyCount || formattedReplies.length,
                createdAt: comment.createdAt
            };
        });

        // Get total count for pagination
        const commentDoc = await Comment.findOne({ contentId, contentType }).lean();
        const totalComments = commentDoc && commentDoc.comments ? commentDoc.comments.length : 0;

        return res.status(200).json({
            success: true,
            message: 'Comments retrieved successfully',
            data: {
                contentId: contentId,
                contentType: contentType,
                comments: formattedComments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalComments,
                    pages: Math.ceil(totalComments / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get comments by query error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve comments',
            error: error.message
        });
    }
};

// Get replies for a specific comment
const getReplies = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { contentId, contentType, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 1 } = req.query;

        // Validate IDs
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID'
            });
        }

        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel"'
            });
        }

        if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid comment ID'
            });
        }

        // Get replies using the static method
        const replies = await Comment.getRepliesByComment(contentId, contentType, commentId, {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy: sortBy,
            sortOrder: parseInt(sortOrder)
        });

        // Format replies for response
        const formattedReplies = replies.map(reply => {
            const replyUserInfo = reply.user && reply.user._id ? {
                id: reply.user._id.toString(),
                firstName: reply.user.profile?.name?.first || '',
                lastName: reply.user.profile?.name?.last || '',
                name: reply.user.profile?.name?.full || '',
                profileImage: reply.user.profile?.profileImage
            } : null;

            return {
                id: reply._id.toString(),
                userId: reply.userId.toString(),
                user: replyUserInfo,
                text: reply.text,
                createdAt: reply.createdAt
            };
        });

        // Get total reply count
        const commentDoc = await Comment.findOne({ contentId, contentType }).lean();
        let totalReplies = 0;
        if (commentDoc && commentDoc.comments) {
            const comment = commentDoc.comments.find(c => c._id.toString() === commentId);
            totalReplies = comment && comment.replies ? comment.replies.length : 0;
        }

        return res.status(200).json({
            success: true,
            message: 'Replies retrieved successfully',
            data: {
                replies: formattedReplies,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalReplies,
                    pages: Math.ceil(totalReplies / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get replies error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve replies',
            error: error.message
        });
    }
};

// Delete a comment
const deleteComment = async (req, res) => {
    try {
        const user = req.user;
        const { commentId } = req.params;
        const { contentId, contentType } = req.query;

        // Validate IDs
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID (provide as query parameter: ?contentId=xxx&contentType=post)'
            });
        }

        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel" (provide as query parameter: ?contentId=xxx&contentType=post)'
            });
        }

        if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid comment ID'
            });
        }

        // Find the comment document
        const commentDoc = await Comment.findOne({ contentId, contentType });

        if (!commentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Comment document not found'
            });
        }

        // Find the comment
        const comment = commentDoc.comments.id(commentId);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user owns the comment or the content
        const isOwner = comment.userId.toString() === user._id.toString();

        // Check if user owns the post/reel
        let isContentOwner = false;
        if (contentType === 'post') {
            const post = await Post.findById(contentId);
            isContentOwner = post && post.userId.toString() === user._id.toString();
        } else {
            const reel = await Reel.findById(contentId);
            isContentOwner = reel && reel.userId.toString() === user._id.toString();
        }

        if (!isOwner && !isContentOwner) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this comment'
            });
        }

        // Delete the comment (this will also remove all replies)
        await commentDoc.removeComment(commentId);

        return res.status(200).json({
            success: true,
            message: 'Comment deleted successfully'
        });

    } catch (error) {
        console.error('Delete comment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete comment',
            error: error.message
        });
    }
};

// Delete a reply
const deleteReply = async (req, res) => {
    try {
        const user = req.user;
        const { commentId, replyId } = req.params;
        const { contentId, contentType } = req.query;

        // Validate IDs
        if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid content ID (provide as query parameter: ?contentId=xxx&contentType=post)'
            });
        }

        if (!contentType || !['post', 'reel'].includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: 'contentType must be either "post" or "reel" (provide as query parameter: ?contentId=xxx&contentType=post)'
            });
        }

        if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid comment ID'
            });
        }

        if (!replyId || !mongoose.Types.ObjectId.isValid(replyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reply ID'
            });
        }

        // Find the comment document
        const commentDoc = await Comment.findOne({ contentId, contentType });

        if (!commentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Comment document not found'
            });
        }

        // Find the comment
        const comment = commentDoc.comments.id(commentId);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Find the reply
        const reply = comment.replies.id(replyId);

        if (!reply) {
            return res.status(404).json({
                success: false,
                message: 'Reply not found'
            });
        }

        // Check if user owns the reply or the content
        const isOwner = reply.userId.toString() === user._id.toString();
        const isCommentOwner = comment.userId.toString() === user._id.toString();

        // Check if user owns the post/reel
        let isContentOwner = false;
        if (contentType === 'post') {
            const post = await Post.findById(contentId);
            isContentOwner = post && post.userId.toString() === user._id.toString();
        } else {
            const reel = await Reel.findById(contentId);
            isContentOwner = reel && reel.userId.toString() === user._id.toString();
        }

        if (!isOwner && !isCommentOwner && !isContentOwner) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this reply'
            });
        }

        // Remove the reply using the instance method
        await commentDoc.removeReply(commentId, replyId);

        return res.status(200).json({
            success: true,
            message: 'Reply deleted successfully'
        });

    } catch (error) {
        console.error('Delete reply error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete reply',
            error: error.message
        });
    }
};

module.exports = {
    addComment,
    addReply,
    getComments,
    getCommentsByQuery,
    getReplies,
    deleteComment,
    deleteReply
};
