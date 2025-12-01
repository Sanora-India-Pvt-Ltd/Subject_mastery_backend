const passport = require('../middleware/passport');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Doctor = require('../models/Doctor');

// Generate JWT Token
const generateToken = (user, userType) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            userType: userType,
            name: user.name,
            isGoogleOAuth: user.googleId ? true : false
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Initiate Google OAuth
const googleAuth = (req, res, next) => {
    const userType = req.query.userType || 'student'; // Default to student if not specified
    
    if (!['student', 'doctor'].includes(userType)) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_user_type`);
    }
    
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: userType // Pass user type to the callback
    })(req, res, next);
};

// Google OAuth Callback
const googleCallback = (req, res, next) => {
    passport.authenticate('google', (err, user) => {
        if (err || !user) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }
        
        // Get user type from state parameter or user email
        let userType = req.query.state || 
                      (user.email.includes('doctor') ? 'doctor' : 'student');
        
        // Generate JWT token
        const token = generateToken(user, userType);
        
        // Redirect to frontend with token and user info
        const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('userType', userType);
        redirectUrl.searchParams.append('name', encodeURIComponent(user.name));
        redirectUrl.searchParams.append('email', user.email);
        
        res.redirect(redirectUrl.toString());
    })(req, res, next);
};

// Check if email exists
const checkEmailExists = async (req, res) => {
    try {
        const { email } = req.body;
        
        const student = await Student.findOne({ email });
        const doctor = await Doctor.findOne({ email });
        
        const exists = !!(student || doctor);
        
        res.json({
            success: true,
            exists: exists,
            data: {
                email,
                hasGoogleAccount: !!(student?.googleId || doctor?.googleId)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking email',
            error: error.message
        });
    }
};

module.exports = {
    googleAuth,
    googleCallback,
    checkEmailExists
};