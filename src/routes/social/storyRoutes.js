const express = require('express');
const { protect } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const {
    createStory,
    getUserStories,
    getAllFriendsStories,
    uploadStoryMedia
} = require('../../controllers/social/storyController');

const router = express.Router();

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
    if (err) {
        console.error('[StoryRoutes] Multer error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large',
                error: 'File size exceeds the maximum limit of 20MB'
            });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected file field',
                error: `Unexpected field name. Use 'media' as the field name for file uploads.`
            });
        }
        
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Failed to process file upload'
        });
    }
    next();
};

// Upload media for stories (Option A: Upload first, then create story)
// POST /api/stories/upload-media
router.post('/upload-media', protect, upload.single('media'), handleMulterError, uploadStoryMedia);

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

