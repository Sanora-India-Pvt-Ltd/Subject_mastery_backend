const mindtrainUserService = require('../../services/MindTrain/mindtrainUser.service');

/**
 * POST /api/mindtrain/create-alarm-profile
 * 
 * Creates a new alarm profile and automatically deactivates all other profiles for the same user.
 * 
 * Authentication: Required (JWT)
 */
const createAlarmProfile = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const profileData = req.body || {};

        // Get authenticated userId from JWT token (single source of truth)
        const authenticatedUserId = req.userId.toString();

        // Validate required fields (userId not required - comes from JWT)
        const { id, youtubeUrl, title, alarmsPerDay, selectedDaysPerWeek, startTime, endTime, isActive } = profileData;

        if (!id || !youtubeUrl || !title || !alarmsPerDay || !selectedDaysPerWeek || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                errors: {
                    ...(!id && { id: 'id is required' }),
                    ...(!youtubeUrl && { youtubeUrl: 'youtubeUrl is required' }),
                    ...(!title && { title: 'title is required' }),
                    ...(!alarmsPerDay && { alarmsPerDay: 'alarmsPerDay is required' }),
                    ...(!selectedDaysPerWeek && { selectedDaysPerWeek: 'selectedDaysPerWeek is required' }),
                    ...(!startTime && { startTime: 'startTime is required' }),
                    ...(!endTime && { endTime: 'endTime is required' })
                }
            });
        }

        // Ensure user exists
        let user = await mindtrainUserService.getMindTrainUser(authenticatedUserId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(authenticatedUserId);
        }

        // Check if profile with same id already exists
        if (user.alarmProfiles && user.alarmProfiles.some(p => p.id === id)) {
            return res.status(400).json({
                success: false,
                message: 'Profile with this id already exists',
                code: 'PROFILE_EXISTS'
            });
        }

        // Add profile (default isActive to false first, then activate)
        const profileToAdd = {
            ...profileData,
            isActive: false // Will be activated below
        };
        
        let updatedUser = await mindtrainUserService.addAlarmProfile(authenticatedUserId, profileToAdd);

        // Auto-activate this profile and deactivate all others (as per old endpoint behavior)
        updatedUser = await mindtrainUserService.activateProfile(authenticatedUserId, id);

        // Find the created profile
        const createdProfile = updatedUser.alarmProfiles.find(p => p.id === id);
        if (!createdProfile) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create profile'
            });
        }

        // Get deactivated profiles for response (all profiles except the created one)
        const deactivatedProfiles = (updatedUser.alarmProfiles || [])
            .filter(p => p.id !== id && !p.isActive)
            .map(profile => ({
                id: profile.id,
                title: profile.title,
                _id: null, // Not available in nested format
                isActive: profile.isActive
            }));

        // Prepare response in old format for backward compatibility
        const response = {
            success: true,
            message: 'Alarm profile created successfully',
            data: {
                createdProfile: {
                    id: createdProfile.id,
                    userId: authenticatedUserId,
                    youtubeUrl: createdProfile.youtubeUrl,
                    title: createdProfile.title,
                    description: createdProfile.description || '',
                    alarmsPerDay: createdProfile.alarmsPerDay,
                    selectedDaysPerWeek: createdProfile.selectedDaysPerWeek,
                    startTime: createdProfile.startTime,
                    endTime: createdProfile.endTime,
                    isFixedTime: createdProfile.isFixedTime,
                    fixedTime: createdProfile.fixedTime || null,
                    specificDates: createdProfile.specificDates || null,
                    isActive: createdProfile.isActive,
                    createdAt: createdProfile.createdAt ? (createdProfile.createdAt.toISOString ? createdProfile.createdAt.toISOString() : new Date(createdProfile.createdAt).toISOString()) : new Date().toISOString(),
                    updatedAt: createdProfile.updatedAt ? (createdProfile.updatedAt.toISOString ? createdProfile.updatedAt.toISOString() : new Date(createdProfile.updatedAt).toISOString()) : new Date().toISOString(),
                    _id: null // Not available in nested format
                },
                deactivatedProfiles: deactivatedProfiles,
                deactivatedCount: deactivatedProfiles.length
            }
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Create alarm profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create alarm profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/mindtrain/get-alarm-profiles
 * 
 * Retrieves all alarm profiles for the authenticated user, separated into active and inactive profiles.
 * 
 * Authentication: Required (JWT)
 */
const getAlarmProfiles = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Optional: Validate userId query parameter if provided
        const { userId: queryUserId } = req.query || {};
        if (queryUserId && queryUserId.toString() !== req.userId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'userId query parameter must match authenticated user'
            });
        }

        // Get user data with all profiles
        let user = await mindtrainUserService.getMindTrainUser(req.userId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(req.userId);
        }

        // Separate profiles into active and inactive
        const activeProfiles = (user.alarmProfiles || []).filter(p => p.isActive === true);
        const inactiveProfiles = (user.alarmProfiles || []).filter(p => p.isActive === false);
        
        const result = {
            activeProfiles,
            inactiveProfiles,
            totalActive: activeProfiles.length,
            totalInactive: inactiveProfiles.length,
            totalProfiles: (user.alarmProfiles || []).length
        };

        // Format profiles for response (nested profiles don't have userId or _id at profile level)
        const formatProfile = (profile) => {
            return {
                id: profile.id,
                userId: req.userId.toString(), // From authenticated user
                youtubeUrl: profile.youtubeUrl,
                title: profile.title,
                description: profile.description || '',
                alarmsPerDay: profile.alarmsPerDay,
                selectedDaysPerWeek: profile.selectedDaysPerWeek,
                startTime: profile.startTime,
                endTime: profile.endTime,
                isFixedTime: profile.isFixedTime,
                fixedTime: profile.fixedTime || null,
                specificDates: profile.specificDates || null,
                isActive: profile.isActive,
                createdAt: profile.createdAt ? (profile.createdAt.toISOString ? profile.createdAt.toISOString() : new Date(profile.createdAt).toISOString()) : new Date().toISOString(),
                updatedAt: profile.updatedAt ? (profile.updatedAt.toISOString ? profile.updatedAt.toISOString() : new Date(profile.updatedAt).toISOString()) : new Date().toISOString(),
                _id: null // Not available in nested format
            };
        };

        // Prepare response
        const response = {
            success: true,
            message: result.totalProfiles === 0 
                ? 'No alarm profiles found' 
                : 'Alarm profiles retrieved successfully',
            data: {
                activeProfiles: result.activeProfiles.map(formatProfile),
                inactiveProfiles: result.inactiveProfiles.map(formatProfile),
                totalActive: result.totalActive,
                totalInactive: result.totalInactive,
                totalProfiles: result.totalProfiles
            }
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Get alarm profiles error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve alarm profiles',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/mindtrain/alarm-profiles/:profileId
 * 
 * Deletes an alarm profile and performs cascade cleanup:
 * - Deletes FCM schedule associated with the profile
 * - Deletes notification logs for the profile
 * - Handles active profile transition (activates next profile or disables FCM)
 * 
 * Authentication: Required (JWT)
 */
const deleteAlarmProfile = async (req, res) => {
    try {
        const { profileId } = req.params;
        const userId = req.userId; // From JWT middleware

        // Validate authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Validate profileId
        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID is required',
                code: 'PROFILE_ID_REQUIRED'
            });
        }

        // Get user to check if profile exists and get profile info
        const user = await mindtrainUserService.getMindTrainUser(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        const profile = user.alarmProfiles?.find(p => p.id === profileId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found',
                code: 'PROFILE_NOT_FOUND'
            });
        }

        const wasActive = profile.isActive || false;

        // Delete the profile (service handles FCM schedule cleanup automatically)
        const updatedUser = await mindtrainUserService.deleteAlarmProfile(userId, profileId);

        // Get remaining profiles count
        const remainingCount = (updatedUser.alarmProfiles || []).length;

        // Check if FCM schedule was cleared (if deleted profile was active)
        const fcmScheduleCleared = wasActive && !updatedUser.fcmSchedule?.activeProfileId;

        return res.status(200).json({
            success: true,
            message: 'Profile deleted successfully',
            data: {
                deletedProfileId: profileId,
                cascadeCleanup: {
                    fcmScheduleDeleted: fcmScheduleCleared,
                    notificationLogsDeleted: 0, // Notification logs are in nested array, not separate collection
                    remainingProfiles: remainingCount,
                    fcmDisabled: fcmScheduleCleared && remainingCount === 0,
                },
            },
        });
    } catch (error) {
        console.error('[Delete] Error:', error.message);
        console.error('[Delete] Stack:', error.stack);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete profile',
            code: 'DELETE_FAILED',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    createAlarmProfile,
    getAlarmProfiles,
    deleteAlarmProfile
};

