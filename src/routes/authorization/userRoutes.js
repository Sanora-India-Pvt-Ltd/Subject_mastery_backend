const express = require('express');
const { protect } = require('../../middleware/auth');
const {
    // Profile updates
    updateProfile,
    updateProfileVisibility,

    // User search
    searchUsers,

    // Education & Workplace (ID-based, not index-based)
    removeEducationEntry,
    removeWorkplaceEntry,

    // Blocking
    blockUser,
    unblockUser,
    listBlockedUsers,

    // Profile retrieval
    getUserProfileById,

    // Phone OTP
    sendOTPForPhoneUpdate,
    verifyOTPAndUpdatePhone
} = require('../../controllers/authorization/userController');

const { limitOTPRequests, limitVerifyRequests } = require('../../middleware/rateLimiter');

const router = express.Router();

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================
router.use(protect);

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * GET /api/user/search
 * Search users by name with privacy/blocking checks
 */
router.get('/search', searchUsers);

/**
 * GET /api/user/:userId/profile
 * Get user profile by ID (with privacy checks)
 */
router.get('/:userId/profile', getUserProfileById);

/**
 * PUT /api/user/profile
 * Update user profile (all profile data)
 * Body: { firstName, lastName, name, dob, gender, bio, currentCity, 
 *         hometown, relationshipStatus, workplace, education, coverPhoto, pronouns }
 */
router.put('/profile', updateProfile);

/**
 * PUT /api/user/profile/visibility
 * Update profile visibility (public/private)
 * Body: { visibility: 'public' | 'private' }
 */
router.put('/profile/visibility', updateProfileVisibility);

// ============================================================================
// PHONE MANAGEMENT
// ============================================================================

/**
 * POST /api/user/phone/send-otp
 * Send OTP for phone number update
 * Body: { phoneNumber: '+1234567890' }
 */
router.post('/phone/send-otp', limitOTPRequests, sendOTPForPhoneUpdate);

/**
 * POST /api/user/phone/verify-otp
 * Verify OTP and update phone number
 * Body: { phoneNumber: '+1234567890', otp: '123456' }
 */
router.post('/phone/verify-otp', limitVerifyRequests, verifyOTPAndUpdatePhone);

// ============================================================================
// EDUCATION MANAGEMENT
// ============================================================================

/**
 * DELETE /api/user/education/:educationId
 * Remove education entry by ID (not index)
 * 
 * ⚠️ BREAKING CHANGE FROM PREVIOUS VERSION:
 * Previously: DELETE /api/user/education/0  (index-based)
 * Now: DELETE /api/user/education/507f1f77bcf86cd799439011  (ID-based)
 * 
 * Migration:
 * - Get education._id from the education object
 * - Pass that _id in the URL instead of array index
 * 
 * Example:
 * const user = await fetchUserProfile();
 * const educationId = user.professional.education[0]._id;  // Get _id
 * await fetch(`/api/user/education/${educationId}`, { method: 'DELETE' });
 */
router.delete('/education/:educationId', removeEducationEntry);

// ============================================================================
// WORKPLACE MANAGEMENT
// ============================================================================

/**
 * DELETE /api/user/workplace/:workplaceId
 * Remove workplace entry by ID (not index)
 * 
 * ⚠️ BREAKING CHANGE FROM PREVIOUS VERSION:
 * Previously: DELETE /api/user/workplace/1  (index-based)
 * Now: DELETE /api/user/workplace/507f1f77bcf86cd799439011  (ID-based)
 * 
 * Migration:
 * - Get workplace._id from the workplace object
 * - Pass that _id in the URL instead of array index
 * 
 * Example:
 * const user = await fetchUserProfile();
 * const workplaceId = user.professional.workplace[0]._id;  // Get _id
 * await fetch(`/api/user/workplace/${workplaceId}`, { method: 'DELETE' });
 */
router.delete('/workplace/:workplaceId', removeWorkplaceEntry);

// ============================================================================
// BLOCKING & PRIVACY
// ============================================================================

/**
 * POST /api/user/block/:blockedUserId
 * Block a user
 * 
 * Adds user to social.blockedUsers
 * Removes user from social.friends (if they were friends)
 * Cancels any pending friend requests
 */
router.post('/block/:blockedUserId', blockUser);

/**
 * DELETE /api/user/block/:blockedUserId
 * Unblock a user
 * 
 * Removes user from social.blockedUsers
 */
router.delete('/block/:blockedUserId', unblockUser);

/**
 * GET /api/user/blocked
 * Get list of all blocked users
 */
router.get('/blocked', listBlockedUsers);

// ============================================================================
// ROUTE SUMMARY & DEBUG
// ============================================================================

console.log('📋 User Routes Registered:');
console.log('');
console.log('📖 PROFILE MANAGEMENT');
console.log('  GET    /api/user/search                       - Search users by name');
console.log('  GET    /api/user/:userId/profile              - Get user profile');
console.log('  PUT    /api/user/profile                      - Update all profile data');
console.log('  PUT    /api/user/profile/visibility           - Update profile visibility');
console.log('');
console.log('📱 PHONE MANAGEMENT');
console.log('  POST   /api/user/phone/send-otp               - Send OTP for phone update');
console.log('  POST   /api/user/phone/verify-otp             - Verify OTP & update phone');
console.log('');
console.log('🎓 EDUCATION (ID-BASED)');
console.log('  DELETE /api/user/education/:educationId       - Remove education by _id');
console.log('  ⚠️  Changed from index-based to ID-based');
console.log('  Example: DELETE /api/user/education/507f1f77bcf86cd799439011');
console.log('');
console.log('💼 WORKPLACE (ID-BASED)');
console.log('  DELETE /api/user/workplace/:workplaceId       - Remove workplace by _id');
console.log('  ⚠️  Changed from index-based to ID-based');
console.log('  Example: DELETE /api/user/workplace/507f1f77bcf86cd799439011');
console.log('');
console.log('🚫 BLOCKING & PRIVACY');
console.log('  POST   /api/user/block/:blockedUserId         - Block a user');
console.log('  DELETE /api/user/block/:blockedUserId         - Unblock a user');
console.log('  GET    /api/user/blocked                      - List blocked users');
console.log('');

module.exports = router;