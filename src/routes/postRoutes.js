const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
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
} = require('../controllers/postController');

const router = express.Router();

// Create a new post with optional file uploads (combined upload + create)
// POST /api/posts/create
// Supports: single file (upload.single('media')) or multiple files (upload.array('media', 10))
// Body: { caption: string (optional), media: file(s) }
router.post('/create', protect, upload.array('media', 10), createPost);

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

// Add a comment to a post (text only)
// POST /api/posts/:id/comment
router.post('/:id/comment', protect, addComment);

// Delete a comment from a post
// DELETE /api/posts/:id/comment/:commentId
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
console.log('  POST   /api/posts/:id/comment (protected)');
console.log('  POST   /api/posts/:id/report (protected)');
console.log('  DELETE /api/posts/:id/comment/:commentId (protected)');
console.log('  DELETE /api/posts/:id (protected)');

module.exports = router;

