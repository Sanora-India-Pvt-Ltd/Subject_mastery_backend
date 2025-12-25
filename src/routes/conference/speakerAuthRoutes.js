const express = require('express');
const router = express.Router();
const {
    signup,
    login,
    getProfile,
    updateProfile,
    refreshToken,
    logout
} = require('../../controllers/conference/speakerAuthController');
const { protect, verifyRefreshToken } = require('../../middleware/speakerAuth');

router.post('/signup', signup);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/refresh-token', verifyRefreshToken, refreshToken);
router.post('/logout', protect, logout);

module.exports = router;

