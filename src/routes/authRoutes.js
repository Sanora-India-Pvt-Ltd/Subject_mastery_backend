const express = require('express');
const { signup, login, sendOTPForPasswordReset, verifyOTPForPasswordReset, resetPassword } = require('../controllers/authController');
const { sendOTP, sendOTPForSignup, verifyOTP, verifyOTPForSignup, sendPhoneOTPForSignup, verifyPhoneOTPForSignup, signin } = require('../middleware/authController');
const { limitOTPRequests, limitVerifyRequests } = require('../middleware/rateLimiter');

const router = express.Router();

// Unified signup and login
router.post('/signup', signup);
router.post('/login', login);

// OTP for existing users (login/password reset)
router.post('/send-otp', limitOTPRequests, sendOTP);
router.post('/verify-otp', limitVerifyRequests, verifyOTP);
router.post('/signin', signin);

// OTP for signup (new users)
router.post('/send-otp-signup', limitOTPRequests, sendOTPForSignup);
router.post('/verify-otp-signup', limitVerifyRequests, verifyOTPForSignup);
router.post('/send-phone-otp-signup', limitOTPRequests, sendPhoneOTPForSignup);
router.post('/verify-phone-otp-signup', limitVerifyRequests, verifyPhoneOTPForSignup);

// Forgot Password flow
router.post('/forgot-password/send-otp', limitOTPRequests, sendOTPForPasswordReset);
router.post('/forgot-password/verify-otp', limitVerifyRequests, verifyOTPForPasswordReset);
router.post('/forgot-password/reset', resetPassword);

// Debug: Log all registered routes
console.log('📋 Auth routes registered:');
console.log('  POST /api/auth/signup');
console.log('  POST /api/auth/login');
console.log('  POST /api/auth/send-otp');
console.log('  POST /api/auth/verify-otp');
console.log('  POST /api/auth/signin');
console.log('  POST /api/auth/send-otp-signup');
console.log('  POST /api/auth/verify-otp-signup');
console.log('  POST /api/auth/send-phone-otp-signup');
console.log('  POST /api/auth/verify-phone-otp-signup');
console.log('  POST /api/auth/forgot-password/send-otp');
console.log('  POST /api/auth/forgot-password/verify-otp');
console.log('  POST /api/auth/forgot-password/reset');

module.exports = router;