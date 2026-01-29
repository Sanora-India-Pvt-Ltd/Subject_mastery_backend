const alarmProfileService = require('../../services/MindTrain/alarmProfileService');

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

        // Validate required fields
        const { id, userId, youtubeUrl, title, alarmsPerDay, selectedDaysPerWeek, startTime, endTime, isActive } = profileData;

        if (!id || !userId || !youtubeUrl || !title || !alarmsPerDay || !selectedDaysPerWeek || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                errors: {
                    ...(!id && { id: 'id is required' }),
                    ...(!userId && { userId: 'userId is required' }),
                    ...(!youtubeUrl && { youtubeUrl: 'youtubeUrl is required' }),
                    ...(!title && { title: 'title is required' }),
                    ...(!alarmsPerDay && { alarmsPerDay: 'alarmsPerDay is required' }),
                    ...(!selectedDaysPerWeek && { selectedDaysPerWeek: 'selectedDaysPerWeek is required' }),
                    ...(!startTime && { startTime: 'startTime is required' }),
                    ...(!endTime && { endTime: 'endTime is required' })
                }
            });
        }

        // Validate userId matches authenticated user
        const authenticatedUserId = req.userId.toString();
        const requestUserId = userId.toString();
        
        if (authenticatedUserId !== requestUserId) {
            return res.status(400).json({
                success: false,
                message: 'userId in request body must match authenticated user'
            });
        }

        // Ensure isActive is true for new profile (as per requirement)
        profileData.isActive = true;

        // Create/update alarm profile
        const result = await alarmProfileService.createOrUpdateAlarmProfile({
            ...profileData,
            userId: authenticatedUserId
        });

        // Prepare response
        const response = {
            success: true,
            message: 'Alarm profile created successfully',
            data: {
                createdProfile: {
                    id: result.profile.id,
                    userId: result.profile.userId.toString(),
                    youtubeUrl: result.profile.youtubeUrl,
                    title: result.profile.title,
                    description: result.profile.description || '',
                    alarmsPerDay: result.profile.alarmsPerDay,
                    selectedDaysPerWeek: result.profile.selectedDaysPerWeek,
                    startTime: result.profile.startTime,
                    endTime: result.profile.endTime,
                    isFixedTime: result.profile.isFixedTime,
                    fixedTime: result.profile.fixedTime || null,
                    specificDates: result.profile.specificDates || null,
                    isActive: result.profile.isActive,
                    createdAt: result.profile.createdAt.toISOString(),
                    updatedAt: result.profile.updatedAt.toISOString(),
                    _id: result.profile._id.toString()
                },
                deactivatedProfiles: result.deactivatedProfiles.map(profile => ({
                    id: profile.id,
                    title: profile.title,
                    _id: profile._id.toString(),
                    isActive: profile.isActive
                })),
                deactivatedCount: result.deactivatedCount
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

        // Get all alarm profiles for the user
        const result = await alarmProfileService.getUserAlarmProfiles(req.userId);

        // Format profiles for response
        const formatProfile = (profile) => ({
            id: profile.id,
            userId: profile.userId.toString(),
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
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
            _id: profile._id.toString()
        });

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

module.exports = {
    createAlarmProfile,
    getAlarmProfiles
};

