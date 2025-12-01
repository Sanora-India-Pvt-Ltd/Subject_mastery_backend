const express = require('express');
const { googleAuth, googleCallback, checkEmailExists } = require('../controllers/googleAuthController');

const router = express.Router();

// Check if email exists
router.post('/check-email', checkEmailExists);

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;
