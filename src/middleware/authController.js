const emailService = require('../../services/emailService');
const { createOTPRecord, validateOTP } = require('../../services/otpService');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Send OTP (for existing users - login/password reset)
const sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Check if user exists
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email'
            });
        }
        
        // Create OTP record (using 'user' as userType for unified system)
        const { otpRecord, plainOTP } = await createOTPRecord(email, 'user');
        
        // Send email
        const emailSent = await emailService.sendOTPEmail(email, plainOTP);
        
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            data: {
                email,
                expiresAt: otpRecord.expiresAt,
                // Don't send OTP in response for security
            }
        });
        
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending OTP',
            error: error.message
        });
    }
};

// Send OTP for Signup (doesn't require user to exist)
const sendOTPForSignup = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }
        
        // Create OTP record for signup
        const { otpRecord, plainOTP } = await createOTPRecord(email, 'signup');
        
        // Send email
        const emailSent = await emailService.sendOTPEmail(email, plainOTP);
        
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your email',
            data: {
                email,
                expiresAt: otpRecord.expiresAt
            }
        });
        
    } catch (error) {
        console.error('Send OTP for signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending OTP',
            error: error.message
        });
    }
};

// Verify OTP (for existing users)
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        // Validate OTP (using 'user' as userType for unified system)
        const result = await validateOTP(email, 'user', otp);
        
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message,
                remainingAttempts: result.remainingAttempts
            });
        }
        
        // Create verification token (short-lived, 10 minutes)
        const verificationToken = jwt.sign(
            { 
                email, 
                purpose: 'otp_verification' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
        
        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                verificationToken,
                email
            }
        });
        
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP',
            error: error.message
        });
    }
};

// Verify OTP for Signup
const verifyOTPForSignup = async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        // Validate OTP for signup
        const result = await validateOTP(email, 'signup', otp);
        
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message,
                remainingAttempts: result.remainingAttempts
            });
        }
        
        // Create verification token (short-lived, 20 minutes - allows time to fill form)
        const verificationToken = jwt.sign(
            { 
                email, 
                purpose: 'otp_verification',
                forSignup: true,
                verificationType: 'email'
            },
            process.env.JWT_SECRET,
            { expiresIn: '20m' }
        );
        
        res.status(200).json({
            success: true,
            message: 'Email OTP verified successfully. You can now complete signup.',
            data: {
                emailVerificationToken: verificationToken,
                email
            }
        });
        
    } catch (error) {
        console.error('Verify OTP for signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP',
            error: error.message
        });
    }
};

// Send Phone OTP for Signup
const sendPhoneOTPForSignup = async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Normalize phone number
        let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
        }

        // Check if phone number is already taken
        const existingUser = await User.findOne({ phoneNumber: normalizedPhone });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        // Check if Twilio is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'Twilio is not configured for phone OTP'
            });
        }

        const twilio = require('twilio');
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const twilioServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

        // Create verification via Twilio Verify
        const verification = await twilioClient.verify.services(twilioServiceSid)
            .verifications
            .create({ to: normalizedPhone, channel: 'sms' });

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your phone',
            data: {
                phone: normalizedPhone,
                sid: verification.sid,
                status: verification.status
            }
        });
        
    } catch (error) {
        console.error('Send phone OTP for signup error:', error);
        
        // Provide more helpful error messages
        let errorMessage = error.message || 'Failed to send OTP';
        if (error.message && error.message.includes('Invalid parameter `To`')) {
            errorMessage = 'Invalid phone number format. Please ensure the phone number is in E.164 format (e.g., +1234567890) with country code.';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            hint: 'Phone number must be in E.164 format: +[country code][subscriber number]'
        });
    }
};

// Verify Phone OTP for Signup
const verifyPhoneOTPForSignup = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP code are required'
            });
        }

        // Normalize phone number
        let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
        }

        // Check if phone number is already taken
        const existingUser = await User.findOne({ phoneNumber: normalizedPhone });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        // Check if Twilio is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'Twilio is not configured'
            });
        }

        const twilio = require('twilio');
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const twilioServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

        // Verify with Twilio
        const check = await twilioClient.verify.services(twilioServiceSid)
            .verificationChecks
            .create({ to: normalizedPhone, code: otp });

        if (check.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP code'
            });
        }

        // Create phone verification token (short-lived, 20 minutes)
        const phoneVerificationToken = jwt.sign(
            {
                phone: normalizedPhone,
                purpose: 'otp_verification',
                forSignup: true,
                verificationType: 'phone'
            },
            process.env.JWT_SECRET,
            { expiresIn: '20m' }
        );

        res.status(200).json({
            success: true,
            message: 'Phone OTP verified successfully. You can now complete signup.',
            data: {
                phoneVerificationToken,
                phone: normalizedPhone
            }
        });
        
    } catch (error) {
        console.error('Verify phone OTP for signup error:', error);
        
        // Provide more helpful error messages
        let errorMessage = error.message || 'Failed to verify OTP';
        if (error.message && error.message.includes('Invalid parameter `To`')) {
            errorMessage = 'Invalid phone number format. Please ensure the phone number is in E.164 format (e.g., +1234567890) with country code.';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            hint: 'Phone number must be in E.164 format: +[country code][subscriber number]'
        });
    }
};

// Sign in with JWT
const signin = async (req, res) => {
    try {
        const { verificationToken, password } = req.body;
        
        // Verify the verification token
        let decoded;
        try {
            decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }
        
        // Check if token is for OTP verification
        if (decoded.purpose !== 'otp_verification') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token purpose'
            });
        }
        
        const { email } = decoded;
        
        // Find user
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }
        
        // Generate JWT token (long-lived for session, 7 days)
        const sessionToken = jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                purpose: 'session' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(200).json({
            success: true,
            message: 'Signin successful',
            data: {
                token: sessionToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name
                }
            }
        });
        
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            success: false,
            message: 'Error signing in',
            error: error.message
        });
    }
};

module.exports = {
    sendOTP,
    sendOTPForSignup,
    verifyOTP,
    verifyOTPForSignup,
    sendPhoneOTPForSignup,
    verifyPhoneOTPForSignup,
    signin
};
