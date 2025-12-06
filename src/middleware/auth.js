const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');

// Generate Access Token (short-lived - 15 minutes)
const generateAccessToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '15m' } // Short-lived access token
    );
};

// Generate Refresh Token (long-lived - 30 days)
const generateRefreshToken = () => {
    return crypto.randomBytes(40).toString('hex'); // Secure random token
};

// Legacy function for backward compatibility (now generates access token)
const generateToken = (payload) => {
    return generateAccessToken(payload);
};

const protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed'
            });
        }
    } catch (error) {
        next(error);
    }
};

// Verify refresh token
const verifyRefreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Find user by refresh token
        const user = await User.findOne({ refreshToken });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

module.exports = {
    generateToken,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    protect
};