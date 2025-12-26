const express = require('express');
const { protect } = require('../../middleware/auth');
const s3Upload = require('../../middleware/s3Upload');
const diskUpload = require('../../middleware/upload'); // For videos (needs local file for transcoding)
const {
    createPost,
    getAllPosts,
    getMyPosts,
    getUserPosts,
    toggleLikePost,
    deletePost,
    addComment,
    deleteComment,
    reportPost
} = require('../../controllers/social/postController');

const router = express.Router();

// Create a new post with optional file uploads (combined upload + create)
// POST /api/posts/create
// Uses diskStorage for videos (needed for transcoding), s3Upload for images
// Supports: single file or multiple files (upload.array('media', 10))
// Body: { caption: string (optional), media: file(s) }
// Note: Videos use diskStorage so they can be transcoded, then uploaded to S3
router.post('/create', protect, diskUpload.array('media', 10), createPost);

// Get all posts (for feed) - pagination supported
// GET /api/posts/all?page=1&limit=10
router.get('/all', getAllPosts);

// Get posts for the currently authenticated user - pagination supported
// GET /api/posts/me?page=1&limit=10
router.get('/me', protect, getMyPosts);

// Get posts by user ID - pagination supported
// GET /api/posts/user/:id?page=1&limit=10
router.get('/user/:id', getUserPosts);

// Like/Unlike a post (toggle)
// POST /api/posts/:id/like
router.post('/:id/like', protect, toggleLikePost);

// Add a comment to a post (text only) or reply to a comment
// POST /api/posts/:id/comment
// Body: { text: string, parentCommentId?: string (optional - if provided, adds as reply) }
router.post('/:id/comment', protect, addComment);

// Delete a comment from a post or a reply to a comment
// DELETE /api/posts/:id/comment/:commentId
// Query: ?replyId=xxx (optional - if provided, deletes the reply instead of top-level comment)
router.delete('/:id/comment/:commentId', protect, deleteComment);

// Report a post
// POST /api/posts/:id/report
router.post('/:id/report', protect, reportPost);

// Delete a post (only by owner)
// DELETE /api/posts/:id
router.delete('/:id', protect, deletePost);

// Debug: Log all registered routes
console.log('📋 Post routes registered:');
console.log('  POST   /api/posts/create (protected, supports file uploads)');
console.log('  GET    /api/posts/all');
console.log('  GET    /api/posts/me (protected)');
console.log('  GET    /api/posts/user/:id');
console.log('  POST   /api/posts/:id/like (protected)');
console.log('    POST   /api/posts/:id/comment (protected, supports nested replies via parentCommentId)');
  console.log('  POST   /api/posts/:id/report (protected)');
  console.log('  DELETE /api/posts/:id/comment/:commentId (protected, supports reply deletion via ?replyId=xxx)');
console.log('  DELETE /api/posts/:id (protected)');

module.exports = router;

