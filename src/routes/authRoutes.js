const express = require('express');
const { sendOTP, verifyOTP, signin } = require('../middleware/authController');
const { limitOTPRequests, limitVerifyRequests } = require('../middleware/rateLimiter');

const router = express.Router();

// Send OTP with rate limiting
router.post('/send-otp', limitOTPRequests, sendOTP);

// Verify OTP with rate limiting
router.post('/verify-otp', limitVerifyRequests, verifyOTP);

// Sign in after OTP verification
router.post('/signin', signin);

module.exports = router;