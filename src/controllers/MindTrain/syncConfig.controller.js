const mindtrainUserService = require('../../services/MindTrain/mindtrainUser.service');

/**
 * PUT /api/mindtrain/alarm-profiles/sync-config
 * 
 * Create/update alarm profile and configure FCM schedule
 * 
 * Authentication: Required (JWT)
 * 
 * Request Body:
 * {
 *   "alarmProfile": { ... },
 *   "fcmConfig": { ... }
 * }
 */
const syncConfig = async (req, res) => {
    try {
        // Validate authentication
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const { alarmProfile, fcmConfig } = req.body || {};

        // Validate request body structure
        if (!alarmProfile) {
            return res.status(400).json({
                success: false,
                message: 'alarmProfile is required',
                code: 'MISSING_ALARM_PROFILE'
            });
        }

        if (!fcmConfig) {
            return res.status(400).json({
                success: false,
                message: 'fcmConfig is required',
                code: 'MISSING_FCM_CONFIG'
            });
        }

        // Get authenticated userId from JWT token (single source of truth)
        const authenticatedUserId = req.userId.toString();

        // Validate alarmProfile fields (userId not required - comes from JWT)
        const { id, youtubeUrl, title, alarmsPerDay, selectedDaysPerWeek, startTime, endTime, isActive } = alarmProfile;

        if (!id || !youtubeUrl || !title || !alarmsPerDay || !selectedDaysPerWeek || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Missing required alarmProfile fields',
                code: 'INVALID_ALARM_PROFILE'
            });
        }

        // Validate fcmConfig fields
        const { morningNotificationTime, eveningNotificationTime, timezone } = fcmConfig;

        if (!morningNotificationTime || !eveningNotificationTime) {
            return res.status(400).json({
                success: false,
                message: 'morningNotificationTime and eveningNotificationTime are required',
                code: 'INVALID_FCM_CONFIG'
            });
        }

        // Validate time format (HH:mm)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(morningNotificationTime) || !timeRegex.test(eveningNotificationTime)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid time format. Use HH:mm format (e.g., "08:00")',
                code: 'INVALID_TIME_FORMAT'
            });
        }

        // Validate timezone (basic validation)
        if (timezone && typeof timezone !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Invalid timezone format',
                code: 'INVALID_TIMEZONE'
            });
        }

        // Ensure user exists
        let user = await mindtrainUserService.getMindTrainUser(authenticatedUserId);
        if (!user) {
            user = await mindtrainUserService.createMindTrainUser(authenticatedUserId);
        }

        // Check if profile already exists
        const existingProfile = user.alarmProfiles?.find(p => p.id === id);
        let updatedUser;
        let profile;

        if (existingProfile) {
            // Update existing profile
            const updates = {
                youtubeUrl,
                title,
                alarmsPerDay,
                selectedDaysPerWeek,
                startTime,
                endTime,
                isActive: isActive !== undefined ? isActive : existingProfile.isActive
            };
            updatedUser = await mindtrainUserService.updateAlarmProfile(authenticatedUserId, id, updates);
            profile = updatedUser.alarmProfiles.find(p => p.id === id);
        } else {
            // Create new profile
            const profileToAdd = {
                ...alarmProfile,
                isActive: isActive !== undefined ? isActive : false
            };
            updatedUser = await mindtrainUserService.addAlarmProfile(authenticatedUserId, profileToAdd);
            profile = updatedUser.alarmProfiles.find(p => p.id === id);
        }

        // Activate profile if isActive is true
        if (isActive === true) {
            updatedUser = await mindtrainUserService.activateProfile(authenticatedUserId, id);
            profile = updatedUser.alarmProfiles.find(p => p.id === id);
        }

        // Update FCM schedule
        updatedUser = await mindtrainUserService.updateFCMSchedule(authenticatedUserId, {
            activeProfileId: id,
            morningNotificationTime,
            eveningNotificationTime,
            timezone: timezone || 'UTC',
            isEnabled: true
        });

        // Calculate next sync check time (1 hour from now)
        const nextSyncCheckTime = new Date();
        nextSyncCheckTime.setHours(nextSyncCheckTime.getHours() + 1);

        // Prepare response
        const response = {
            success: true,
            message: 'Profile and FCM schedule configured',
            data: {
                profile: {
                    id: profile.id,
                    userId: authenticatedUserId,
                    isActive: profile.isActive,
                    lastSyncTimestamp: profile.lastSyncTimestamp || null,
                    lastSyncSource: profile.lastSyncSource || null,
                    syncHealthScore: profile.syncHealthScore || 100,
                    nextSyncCheckTime: nextSyncCheckTime.toISOString()
                },
                fcmSchedule: {
                    userId: authenticatedUserId,
                    activeProfileId: updatedUser.fcmSchedule.activeProfileId,
                    morningNotificationTime: updatedUser.fcmSchedule.morningNotificationTime,
                    eveningNotificationTime: updatedUser.fcmSchedule.eveningNotificationTime,
                    timezone: updatedUser.fcmSchedule.timezone,
                    isEnabled: updatedUser.fcmSchedule.isEnabled
                }
            }
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Sync config error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to configure sync',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: 'SYNC_CONFIG_ERROR'
        });
    }
};

module.exports = {
    syncConfig
};

