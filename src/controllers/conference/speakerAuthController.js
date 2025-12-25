const Speaker = require('../../models/conference/Speaker');
const { generateAccessToken, generateRefreshToken } = require('../../middleware/speakerAuth');
const {
    signupEntity,
    loginEntity,
    getProfileEntity,
    updateProfileEntity,
    refreshTokenEntity,
    logoutEntity
} = require('../../services/conferenceAuthService');

// Speaker Signup
const signup = async (req, res) => {
    try {
        const result = await signupEntity({
            entityType: 'speaker',
            Model: Speaker,
            generateAccessToken,
            generateRefreshToken,
            body: req.body,
            userAgent: req.headers['user-agent']
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Speaker signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create speaker account',
            error: error.message
        });
    }
};

// Speaker Login
const login = async (req, res) => {
    try {
        const result = await loginEntity({
            entityType: 'speaker',
            Model: Speaker,
            generateAccessToken,
            generateRefreshToken,
            body: req.body,
            userAgent: req.headers['user-agent']
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Speaker login error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to login',
            error: error.message
        });
    }
};

// Get Speaker Profile
const getProfile = async (req, res) => {
    try {
        const result = await getProfileEntity({ entityType: 'speaker', req });
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Get speaker profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

// Update Speaker Profile
const updateProfile = async (req, res) => {
    try {
        const result = await updateProfileEntity({ entityType: 'speaker', req });
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Update speaker profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

// Refresh Token
const refreshToken = async (req, res) => {
    try {
        const result = await refreshTokenEntity({
            entityType: 'speaker',
            generateAccessToken,
            generateRefreshToken,
            req
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh token',
            error: error.message
        });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        const result = await logoutEntity({ entityType: 'speaker', req });
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to logout',
            error: error.message
        });
    }
};

module.exports = {
    signup,
    login,
    getProfile,
    updateProfile,
    refreshToken,
    logout
};

