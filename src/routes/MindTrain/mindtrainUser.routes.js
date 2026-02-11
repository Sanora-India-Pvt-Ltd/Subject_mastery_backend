const express = require('express');
const { protect } = require('../../middleware/auth');
const {
    getMindTrainUser,
    updateAlarmProfile,
    activateProfile,
    deleteAlarmProfile,
    updateFCMSchedule,
    addNotificationLog,
    addSyncHealthLog
} = require('../../controllers/MindTrain/mindtrainUser.controller');

const router = express.Router();

/**
 * MindTrain User Routes - Unified Nested Schema API
 * 
 * Hybrid API Approach:
 * - Single GET endpoint for all data (reduces 4 calls to 1)
 * - Specific endpoints for each operation (clearer, easier to test)
 * 
 * All routes require authentication (JWT)
 */

/**
 * GET /api/mindtrain/user/:userId
 * Get complete user data (all-in-one)
 * Returns: alarmProfiles, fcmSchedule, notificationLogs, syncHealthLogs, metadata
 * Frontend computes health status and statistics from this data
 */
router.get('/user/:userId', protect, getMindTrainUser);

/**
 * PUT /api/mindtrain/user/:userId/profile/:profileId
 * Update alarm profile
 * Updates specific profile fields using array filters
 */
router.put('/user/:userId/profile/:profileId', protect, updateAlarmProfile);

/**
 * PATCH /api/mindtrain/user/:userId/profile/:profileId/activate
 * Activate profile
 * Sets specified profile as active (isActive = true)
 * Automatically deactivates all other profiles (isActive = false)
 * Updates fcmSchedule.activeProfileId
 * Atomic operation (all-or-nothing)
 */
router.patch('/user/:userId/profile/:profileId/activate', protect, activateProfile);

/**
 * DELETE /api/mindtrain/user/:userId/profile/:profileId
 * Delete alarm profile
 * Removes profile from alarmProfiles array
 * If deleted profile was active, clears fcmSchedule.activeProfileId
 */
router.delete('/user/:userId/profile/:profileId', protect, deleteAlarmProfile);

/**
 * PUT /api/mindtrain/user/:userId/fcm-schedule
 * Update FCM schedule
 * Updates fcmSchedule object
 * Supports partial updates
 */
router.put('/user/:userId/fcm-schedule', protect, updateFCMSchedule);

/**
 * POST /api/mindtrain/user/:userId/notification
 * Add notification log
 * Adds to notificationLogs array (auto-rotates to max 100)
 */
router.post('/user/:userId/notification', protect, addNotificationLog);

/**
 * POST /api/mindtrain/user/:userId/health
 * Add sync health report
 * Adds to syncHealthLogs array (auto-rotates to max 50)
 */
router.post('/user/:userId/health', protect, addSyncHealthLog);

module.exports = router;

