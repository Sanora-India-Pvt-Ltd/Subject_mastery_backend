const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    uploadReelMedia,
    createReel,
    getReels,
    getUserReels
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

// Debug: Log registered routes
console.log('📋 Reel routes registered:');
console.log('  POST   /api/reels/upload-media (protected)');
console.log('  POST   /api/reels/create (protected)');
console.log('  GET    /api/reels?contentType=education|fun&page=1&limit=10');
console.log('  GET    /api/reels/user/:id?page=1&limit=10');

module.exports = router;

