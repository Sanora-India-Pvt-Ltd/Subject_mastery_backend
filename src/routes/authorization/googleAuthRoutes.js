const express = require('express');
const { googleAuth, googleCallback, checkEmailExists } = require('../../controllers/authorization/googleAuthController');

const router = express.Router();

const { googleLoginMobile } = require('../../controllers/authorization/googleAuthController');

router.post('/google/mobile', googleLoginMobile);

// Check if email exists
router.post('/check-email', checkEmailExists);

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;
