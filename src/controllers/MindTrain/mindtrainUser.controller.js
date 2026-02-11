const mindtrainUserService = require('../../services/MindTrain/mindtrainUser.service');
const mongoose = require('mongoose');

/**
 * MindTrain User Controller
 * 
 * Handles HTTP requests for the unified MindTrainUser API endpoints.
 * Implements the hybrid API approach: single GET endpoint + specific operation endpoints.
 */

/**
 * PUT /api/mindtrain/user/:userId/profile/:profileId
 * 
 * Update alarm profile
 * Request body: Partial profile updates
 * Updates specific profile using array filters
 * Auto-updates metadata
 * 
 * Authentication: Required (JWT)
 */
const updateAlarmProfile = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId, profileId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only update their own profiles
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only update your own profiles'
            });
        }

        const userId = paramUserId || authenticatedUserId;
        const updates = req.body || {};

        // Validate profileId
        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID is required'
            });
        }

        // Check if user exists
        let user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if profile exists
        if (!user.alarmProfiles || !user.alarmProfiles.some(p => p.id === profileId)) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        // Don't allow updating id
        delete updates.id;
        delete updates.createdAt;

        // Update profile
        const updatedUser = await mindtrainUserService.updateAlarmProfile(userId, profileId, updates);

        // Find the updated profile
        const updatedProfile = updatedUser.alarmProfiles.find(p => p.id === profileId);

        return res.status(200).json({
            success: true,
            message: 'Alarm profile updated successfully',
            data: {
                profile: updatedProfile
            }
        });
    } catch (error) {
        console.error('Update alarm profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update alarm profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PATCH /api/mindtrain/user/:userId/profile/:profileId/activate
 * 
 * Activate profile
 * Sets specified profile as active (isActive = true)
 * Automatically deactivates all other profiles (isActive = false)
 * Updates fcmSchedule.activeProfileId
 * Atomic operation (all-or-nothing)
 * 
 * Authentication: Required (JWT)
 */
const activateProfile = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId, profileId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only activate their own profiles
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only activate your own profiles'
            });
        }

        const userId = paramUserId || authenticatedUserId;

        // Validate profileId
        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID is required'
            });
        }

        // Check if user exists
        let user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if profile exists
        if (!user.alarmProfiles || !user.alarmProfiles.some(p => p.id === profileId)) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        // Activate profile (atomic operation)
        const updatedUser = await mindtrainUserService.activateProfile(userId, profileId);

        // Find the activated profile
        const activatedProfile = updatedUser.alarmProfiles.find(p => p.id === profileId);

        return res.status(200).json({
            success: true,
            message: 'Profile activated successfully',
            data: {
                profile: activatedProfile,
                fcmSchedule: updatedUser.fcmSchedule
            }
        });
    } catch (error) {
        console.error('Activate profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to activate profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/mindtrain/user/:userId/profile/:profileId
 * 
 * Delete alarm profile
 * Removes profile from alarmProfiles array
 * If deleted profile was active, clears fcmSchedule.activeProfileId
 * Auto-updates metadata
 * 
 * Authentication: Required (JWT)
 */
const deleteAlarmProfile = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId, profileId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only delete their own profiles
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only delete your own profiles'
            });
        }

        const userId = paramUserId || authenticatedUserId;

        // Validate profileId
        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID is required'
            });
        }

        // Check if user exists
        const user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if profile exists
        if (!user.alarmProfiles || !user.alarmProfiles.some(p => p.id === profileId)) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        // Delete profile
        const updatedUser = await mindtrainUserService.deleteAlarmProfile(userId, profileId);

        return res.status(200).json({
            success: true,
            message: 'Profile deleted successfully',
            data: {
                deletedProfileId: profileId,
                remainingProfiles: updatedUser.alarmProfiles.length
            }
        });
    } catch (error) {
        console.error('Delete alarm profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete alarm profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/mindtrain/user/:userId/fcm-schedule
 * 
 * Update FCM schedule
 * Request body: Partial FCM schedule updates
 * Updates fcmSchedule object
 * Supports partial updates
 * 
 * Authentication: Required (JWT)
 */
const updateFCMSchedule = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only update their own FCM schedule
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only update your own FCM schedule'
            });
        }

        const userId = paramUserId || authenticatedUserId;
        const fcmUpdates = req.body || {};

        // Ensure user exists
        let user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(userId);
        }

        // Don't allow updating createdAt
        delete fcmUpdates.createdAt;

        // Update FCM schedule
        const updatedUser = await mindtrainUserService.updateFCMSchedule(userId, fcmUpdates);

        return res.status(200).json({
            success: true,
            message: 'FCM schedule updated successfully',
            data: {
                fcmSchedule: updatedUser.fcmSchedule
            }
        });
    } catch (error) {
        console.error('Update FCM schedule error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update FCM schedule',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/mindtrain/user/:userId/notification
 * 
 * Add notification log
 * Request body: Notification log data
 * Adds to notificationLogs array (auto-rotates to max 100)
 * Auto-updates metadata
 * 
 * Authentication: Required (JWT)
 */
const addNotificationLog = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only add notifications for themselves
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only add notifications for yourself'
            });
        }

        const userId = paramUserId || authenticatedUserId;
        const notificationData = req.body || {};

        // Validate required fields
        if (!notificationData.notificationId) {
            return res.status(400).json({
                success: false,
                message: 'notificationId is required'
            });
        }

        // Ensure user exists
        let user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(userId);
        }

        // Check if notification with same id already exists
        if (user.notificationLogs && user.notificationLogs.some(n => n.notificationId === notificationData.notificationId)) {
            return res.status(400).json({
                success: false,
                message: 'Notification with this id already exists',
                code: 'NOTIFICATION_EXISTS'
            });
        }

        // Add notification log
        const updatedUser = await mindtrainUserService.addNotificationLog(userId, notificationData);

        // Find the added notification
        const addedNotification = updatedUser.notificationLogs.find(n => n.notificationId === notificationData.notificationId);

        return res.status(201).json({
            success: true,
            message: 'Notification log added successfully',
            data: {
                notification: addedNotification
            }
        });
    } catch (error) {
        console.error('Add notification log error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add notification log',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/mindtrain/user/:userId/health
 * 
 * Add sync health report
 * Request body: Sync health log data
 * Adds to syncHealthLogs array (auto-rotates to max 50)
 * Auto-updates metadata
 * 
 * Authentication: Required (JWT)
 */
const addSyncHealthLog = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { userId: paramUserId } = req.params;
        const authenticatedUserId = req.userId.toString();

        // Validate that user can only add health logs for themselves
        if (paramUserId && paramUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You can only add health logs for yourself'
            });
        }

        const userId = paramUserId || authenticatedUserId;
        const healthLogData = req.body || {};

        // Validate required fields
        if (!healthLogData.deviceId) {
            return res.status(400).json({
                success: false,
                message: 'deviceId is required'
            });
        }

        // Ensure user exists
        let user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(userId);
        }

        // Add sync health log
        const updatedUser = await mindtrainUserService.addSyncHealthLog(userId, healthLogData);

        // Find the added health log (most recent one)
        const addedHealthLog = updatedUser.syncHealthLogs
            .sort((a, b) => b.reportedAt - a.reportedAt)[0];

        return res.status(201).json({
            success: true,
            message: 'Sync health log added successfully',
            data: {
                healthLog: addedHealthLog
            }
        });
    } catch (error) {
        console.error('Add sync health log error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add sync health log',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    updateAlarmProfile,
    activateProfile,
    deleteAlarmProfile,
    updateFCMSchedule,
    addNotificationLog,
    addSyncHealthLog
};

