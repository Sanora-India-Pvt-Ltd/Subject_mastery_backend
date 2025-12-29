const express = require('express');
const router = express.Router();
const {
    signup,
    login,
    getProfile,
    updateProfile,
    refreshToken,
    logout,
    uploadProfileImage
} = require('../../controllers/conference/hostAuthController');
const { protect, verifyRefreshToken } = require('../../middleware/hostAuth');
const upload = require('../../middleware/s3Upload');

router.post('/signup', signup);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile-image', protect, upload.single('profileImage'), uploadProfileImage);
router.post('/refresh-token', verifyRefreshToken, refreshToken);
router.post('/logout', protect, logout);

module.exports = router;

