const { sendOTPEmail } = require('../../services/emailService');
const { createOTPRecord, validateOTP } = require('../../services/otpService');
const Student = require('../models/Student');
const Doctor = require('../models/Doctor');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Send OTP
const sendOTP = async (req, res) => {
    try {
        const { email, userType } = req.body;
        
        // Validate user type
        if (!['student', 'doctor'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type. Must be "student" or "doctor"'
            });
        }
        
        // Check if user exists based on userType
        let user;
        if (userType === 'student') {
            user = await Student.findOne({ email });
        } else {
            user = await Doctor.findOne({ email });
        }
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `${userType} not found with this email`
            });
        }
        
        // Create OTP record
        const { otpRecord, plainOTP } = await createOTPRecord(email, userType);
        
        // Send email
        const emailSent = await sendOTPEmail(email, plainOTP);
        
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
                userType,
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

// Verify OTP
const verifyOTP = async (req, res) => {
    try {
        const { email, userType, otp } = req.body;
        
        // Validate OTP
        const result = await validateOTP(email, userType, otp);
        
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
                userType, 
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
                email,
                userType
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
        
        const { email, userType } = decoded;
        
        // Find user based on type
        let user;
        if (userType === 'student') {
            user = await Student.findOne({ email });
        } else {
            user = await Doctor.findOne({ email });
        }
        
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
                userType,
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
                    userType
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
    verifyOTP,
    signin
};
