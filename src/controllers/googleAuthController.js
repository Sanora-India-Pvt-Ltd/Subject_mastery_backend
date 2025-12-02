const passport = require('../middleware/passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            name: user.name,
            isGoogleOAuth: user.googleId ? true : false
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Initiate Google OAuth
const googleAuth = (req, res, next) => {
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })(req, res, next);
};

// Google OAuth Callback
const googleCallback = (req, res, next) => {
    passport.authenticate('google', (err, user) => {
        if (err || !user) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }
        
        // Generate JWT token
        const token = generateToken(user);
        
        // Redirect to frontend with token and user info
        const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
        redirectUrl.searchParams.append('token', token);
        redirectUrl.searchParams.append('name', encodeURIComponent(user.name));
        redirectUrl.searchParams.append('email', user.email);
        
        res.redirect(redirectUrl.toString());
    })(req, res, next);
};

// Check if email exists
const checkEmailExists = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        
        res.json({
            success: true,
            exists: !!user,
            data: {
                email,
                hasGoogleAccount: !!user?.googleId
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