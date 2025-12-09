const express = require('express');
const { googleAuth, googleCallback, checkEmailExists } = require('../controllers/googleAuthController');

const router = express.Router();

const { googleLoginMobile } = require('../controllers/googleAuthController');

router.post('/google/mobile', googleLoginMobile);

// Check if email exists
router.post('/check-email', checkEmailExists);

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;
