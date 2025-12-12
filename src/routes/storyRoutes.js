const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    createStory,
    getUserStories,
    getAllFriendsStories,
    uploadStoryMedia
} = require('../controllers/storyController');

const router = express.Router();

// Upload media for stories (Option A: Upload first, then create story)
// POST /api/stories/upload-media
router.post('/upload-media', protect, upload.single('media'), uploadStoryMedia);

// Create a new story (requires media URLs from upload-media endpoint)
// POST /api/stories/create
router.post('/create', protect, createStory);

// Get all stories from friends (grouped by user)
// GET /api/stories/all
router.get('/all', protect, getAllFriendsStories);

// Get stories for a specific user
// GET /api/stories/user/:id
router.get('/user/:id', getUserStories);

// Debug: Log all registered routes
console.log('📋 Story routes registered:');
console.log('  POST   /api/stories/upload-media (protected)');
console.log('  POST   /api/stories/create (protected)');
console.log('  GET    /api/stories/all (protected)');
console.log('  GET    /api/stories/user/:id');

module.exports = router;

