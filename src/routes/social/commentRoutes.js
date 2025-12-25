const express = require('express');
const { protect } = require('../../middleware/auth');
const {
    addComment,
    addReply,
    getComments,
    getReplies,
    deleteComment,
    deleteReply
} = require('../../controllers/social/commentController');

const router = express.Router();

// Add a comment to a post or reel
// POST /api/comments
// Body: { contentId: string, contentType: 'post' | 'reel', text: string }
router.post('/', protect, addComment);

// Add a reply to a comment
// POST /api/comments/:commentId/reply
// Body: { contentId: string, contentType: 'post' | 'reel', text: string }
router.post('/:commentId/reply', protect, addReply);

// Get comments for a post or reel
// GET /api/comments/:contentType/:contentId?page=1&limit=15&sortBy=createdAt&sortOrder=-1
router.get('/:contentType/:contentId', getComments);

// Get replies for a specific comment
// GET /api/comments/:commentId/replies?contentId=xxx&contentType=post&page=1&limit=10&sortBy=createdAt&sortOrder=1
router.get('/:commentId/replies', getReplies);

// Delete a comment
// DELETE /api/comments/:commentId?contentId=xxx&contentType=post
router.delete('/:commentId', protect, deleteComment);

// Delete a reply
// DELETE /api/comments/:commentId/replies/:replyId?contentId=xxx&contentType=post
router.delete('/:commentId/replies/:replyId', protect, deleteReply);

// Debug: Log registered routes
console.log('📋 Comment routes registered:');
console.log('  POST   /api/comments (protected)');
console.log('  POST   /api/comments/:commentId/reply (protected)');
console.log('  GET    /api/comments/:contentType/:contentId');
console.log('  GET    /api/comments/:commentId/replies');
console.log('  DELETE /api/comments/:commentId (protected)');
console.log('  DELETE /api/comments/:commentId/replies/:replyId (protected)');

module.exports = router;

