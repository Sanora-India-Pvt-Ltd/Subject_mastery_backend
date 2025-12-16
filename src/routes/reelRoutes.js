const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    uploadReelMedia,
    createReel,
    getReels,
    getUserReels,
    toggleLikeReel,
    addComment,
    deleteComment,
    deleteReel,
    reportReel
} = require('../controllers/reelController');

const router = express.Router();

// Upload media for reels (video only)
// POST /api/reels/upload-media
router.post('/upload-media', protect, upload.single('media'), uploadReelMedia);

// Create a new reel with mandatory contentType
// POST /api/reels/create
router.post('/create', protect, createReel);

// Fetch reels by contentType (logical cluster)
// GET /api/reels?contentType=education&page=1&limit=10
router.get('/', getReels);

// Get reels by user ID - pagination supported
// GET /api/reels/user/:id?page=1&limit=10
router.get('/user/:id', getUserReels);

// Like/Unlike a reel (toggle)
// POST /api/reels/:id/like
router.post('/:id/like', protect, toggleLikeReel);

// Add a comment to a reel (text only)
// POST /api/reels/:id/comment
router.post('/:id/comment', protect, addComment);

// Delete a comment from a reel
// DELETE /api/reels/:id/comment/:commentId
router.delete('/:id/comment/:commentId', protect, deleteComment);

// Report a reel
// POST /api/reels/:id/report
router.post('/:id/report', protect, reportReel);

// Delete a reel (only by owner)
// DELETE /api/reels/:id
router.delete('/:id', protect, deleteReel);

// Debug: Log registered routes
console.log('📋 Reel routes registered:');
console.log('  POST   /api/reels/upload-media (protected)');
console.log('  POST   /api/reels/create (protected)');
console.log('  GET    /api/reels?contentType=education|fun&page=1&limit=10');
console.log('  GET    /api/reels/user/:id?page=1&limit=10');
console.log('  POST   /api/reels/:id/like (protected)');
console.log('  POST   /api/reels/:id/comment (protected)');
console.log('  POST   /api/reels/:id/report (protected)');
console.log('  DELETE /api/reels/:id/comment/:commentId (protected)');
console.log('  DELETE /api/reels/:id (protected)');

module.exports = router;

