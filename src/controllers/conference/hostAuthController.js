const Host = require('../../models/conference/Host');
const { generateAccessToken, generateRefreshToken } = require('../../middleware/hostAuth');
const {
    signupEntity,
    loginEntity,
    getProfileEntity,
    updateProfileEntity,
    refreshTokenEntity,
    logoutEntity
} = require('../../services/conferenceAuthService');

// Host Signup
const signup = async (req, res) => {
    try {
        const result = await signupEntity({
            entityType: 'host',
            Model: Host,
            generateAccessToken,
            generateRefreshToken,
            body: req.body,
            userAgent: req.headers['user-agent']
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Host signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create host account',
            error: error.message
        });
    }
};

// Host Login
const login = async (req, res) => {
    try {
        const result = await loginEntity({
            entityType: 'host',
            Model: Host,
            generateAccessToken,
            generateRefreshToken,
            body: req.body,
            userAgent: req.headers['user-agent']
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Host login error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to login',
            error: error.message
        });
    }
};

// Get Host Profile
const getProfile = async (req, res) => {
    try {
        const result = await getProfileEntity({ entityType: 'host', req });
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Get host profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

// Update Host Profile
const updateProfile = async (req, res) => {
    try {
        const result = await updateProfileEntity({ entityType: 'host', req });
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Update host profile error:', error);
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
            entityType: 'host',
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
        const result = await logoutEntity({ entityType: 'host', req });
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

