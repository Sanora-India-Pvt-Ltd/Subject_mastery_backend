const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');

// User Signup (with OTP verification)
const signup = async (req, res) => {
    try {
        const { email, password, confirmPassword, firstName, lastName, phoneNumber, gender, name, verificationToken, otp } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName || !phoneNumber || !gender) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, first name, last name, phone number, and gender are required'
            });
        }

        // Validate password length (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Validate password confirmation
        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and confirm password do not match'
            });
        }

        // Validate gender
        const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
        if (!validGenders.includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Gender must be one of: Male, Female, Other, Prefer not to say'
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

        // Normalize phone number for verification
        let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
        }

        // Check if phone number is already taken
        const existingPhoneUser = await User.findOne({ phoneNumber: normalizedPhone });
        if (existingPhoneUser) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered'
            });
        }

        // OTP verification is MANDATORY for signup - both email and phone
        const { emailVerificationToken, phoneVerificationToken } = req.body;
        
        if (!emailVerificationToken && !phoneVerificationToken) {
            return res.status(400).json({
                success: false,
                message: 'Both email and phone OTP verification are required for signup. Please verify your email using /api/auth/send-otp-signup and /api/auth/verify-otp-signup, and verify your phone using /api/auth/send-phone-otp-signup and /api/auth/verify-phone-otp-signup'
            });
        }

        // Verify email verification token
        if (!emailVerificationToken) {
            return res.status(400).json({
                success: false,
                message: 'Email verification is required. Please verify your email using /api/auth/send-otp-signup and /api/auth/verify-otp-signup'
            });
        }

        // Verify phone verification token
        if (!phoneVerificationToken) {
            return res.status(400).json({
                success: false,
                message: 'Phone verification is required. Please verify your phone using /api/auth/send-phone-otp-signup and /api/auth/verify-phone-otp-signup'
            });
        }

        const jwt = require('jsonwebtoken');
        
        // Verify email token
        let emailDecoded;
        try {
            emailDecoded = jwt.verify(emailVerificationToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired email verification token. Please verify your email OTP again.'
            });
        }
        
        // Validate email token
        if (emailDecoded.purpose !== 'otp_verification' || 
            emailDecoded.verificationType !== 'email' ||
            !emailDecoded.forSignup ||
            emailDecoded.email !== email.toLowerCase()) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email verification token. Email does not match or token is invalid.'
            });
        }

        // Verify phone token
        let phoneDecoded;
        try {
            phoneDecoded = jwt.verify(phoneVerificationToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired phone verification token. Please verify your phone OTP again.'
            });
        }
        
        // Validate phone token
        if (phoneDecoded.purpose !== 'otp_verification' || 
            phoneDecoded.verificationType !== 'phone' ||
            !phoneDecoded.forSignup ||
            phoneDecoded.phone !== normalizedPhone) {
            return res.status(401).json({
                success: false,
                message: 'Invalid phone verification token. Phone number does not match or token is invalid.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (use normalized phone number)
        const user = await User.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            phoneNumber: normalizedPhone,
            gender,
            name: name || `${firstName} ${lastName}`.trim()
        });

        // Generate JWT token
        const token = generateToken({ id: user._id, email: user.email });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    gender: user.gender,
                    name: user.name
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in user signup',
            error: error.message
        });
    }
};

// User Login
const login = async (req, res) => {
    try {
        const { email, phoneNumber, password } = req.body;

        // Validate input - must have either email or phoneNumber, and password
        if ((!email && !phoneNumber) || !password) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number, and password are required'
            });
        }

        // Find user by email or phone number
        let user;
        if (email) {
            user = await User.findOne({ email: email.toLowerCase() });
        } else if (phoneNumber) {
            user = await User.findOne({ phoneNumber });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email/phone number or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email/phone number or password'
            });
        }

        // Generate JWT token
        const token = generateToken({ id: user._id, email: user.email });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    gender: user.gender,
                    name: user.name,
                    profileImage: user.profileImage
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in user login',
            error: error.message
        });
    }
};

// Forgot Password - Send OTP (accepts email or phone)
const sendOTPForPasswordReset = async (req, res) => {
    try {
        const { email, phone } = req.body;

        // Must provide either email or phone
        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number is required'
            });
        }

        // Find user by email or phone (check if user exists first)
        let user;
        if (email) {
            // Normalize email to lowercase
            const normalizedEmail = email.toLowerCase().trim();
            user = await User.findOne({ email: normalizedEmail });
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found with this email address'
                });
            }
        } else if (phone) {
            // Normalize phone number for consistent lookup
            let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
            if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = '+' + normalizedPhone;
            }
            
            // Try to find user with normalized phone number
            user = await User.findOne({ phoneNumber: normalizedPhone });
            
            // Also try with original format in case it's stored differently
            if (!user) {
                user = await User.findOne({ phoneNumber: phone });
            }
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found with this phone number'
                });
            }
        }

        // If email provided, send OTP via email
        if (email) {
            const { createOTPRecord } = require('../services/otpService');
            const emailService = require('../../services/emailService');
            
            // Create OTP record (using 'password_reset' as userType)
            const { otpRecord, plainOTP } = await createOTPRecord(email.toLowerCase(), 'password_reset');
            
            // Send email
            const emailSent = await emailService.sendOTPEmail(email.toLowerCase(), plainOTP);
            
            if (!emailSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP email'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully to your email',
                data: {
                    email: email.toLowerCase(),
                    expiresAt: otpRecord.expiresAt
                }
            });
        }

        // If phone provided, send OTP via Twilio (user already verified above)
        if (phone) {
            const twilio = require('twilio');
            
            // Check if Twilio is configured
            if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
                return res.status(500).json({
                    success: false,
                    message: 'Twilio is not configured for phone OTP'
                });
            }

            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const twilioServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

            // Normalize phone number (already normalized above, but ensure consistency)
            let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
            if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = '+' + normalizedPhone;
            }

            // Create verification via Twilio Verify (only if user exists)
            const verification = await twilioClient.verify.services(twilioServiceSid)
                .verifications
                .create({ to: normalizedPhone, channel: 'sms' });

            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully to your phone',
                data: {
                    phone: normalizedPhone,
                    sid: verification.sid,
                    status: verification.status
                }
            });
        }

    } catch (error) {
        console.error('Send OTP for password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending OTP',
            error: error.message
        });
    }
};

// Forgot Password - Verify OTP
const verifyOTPForPasswordReset = async (req, res) => {
    try {
        const { email, phone, otp } = req.body;

        // Must provide either email or phone, and OTP
        if ((!email && !phone) || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number, and OTP code are required'
            });
        }

        let user;
        let verificationResult = { valid: false };

        // If email provided, verify using email OTP service
        if (email) {
            user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found with this email'
                });
            }

            const { validateOTP } = require('../services/otpService');
            verificationResult = await validateOTP(email.toLowerCase(), 'password_reset', otp);
        }

        // If phone provided, verify using Twilio
        if (phone) {
            user = await User.findOne({ phoneNumber: phone });
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found with this phone number'
                });
            }

            const twilio = require('twilio');
            
            if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
                return res.status(500).json({
                    success: false,
                    message: 'Twilio is not configured'
                });
            }

            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            const twilioServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

            // Normalize phone number
            let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
            if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = '+' + normalizedPhone;
            }

            // Verify with Twilio
            const check = await twilioClient.verify.services(twilioServiceSid)
                .verificationChecks
                .create({ to: normalizedPhone, code: otp });

            verificationResult.valid = (check.status === 'approved');
            if (!verificationResult.valid) {
                verificationResult.message = 'Invalid or expired code';
            }
        }

        // Check verification result
        if (!verificationResult.valid) {
            return res.status(400).json({
                success: false,
                message: verificationResult.message || 'Invalid or expired OTP',
                remainingAttempts: verificationResult.remainingAttempts
            });
        }

        // Create verification token for password reset (valid for 15 minutes)
        const jwt = require('jsonwebtoken');
        const verificationToken = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                phoneNumber: user.phoneNumber,
                purpose: 'password_reset'
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully. You can now reset your password.',
            data: {
                verificationToken,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Verify OTP for password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP',
            error: error.message
        });
    }
};

// Forgot Password - Reset Password
const resetPassword = async (req, res) => {
    try {
        const { verificationToken, password, confirmPassword } = req.body;

        // Validate input
        if (!verificationToken || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Verification token, password, and confirm password are required'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Validate password match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and confirm password do not match'
            });
        }

        // Verify the verification token
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
            decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired verification token. Please request a new OTP.'
            });
        }

        // Check if token is for password reset
        if (decoded.purpose !== 'password_reset') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token purpose'
            });
        }

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

module.exports = {
    signup,
    login,
    sendOTPForPasswordReset,
    verifyOTPForPasswordReset,
    resetPassword
};

