const alarmProfileService = require('../../services/MindTrain/alarmProfileService');
const AlarmProfile = require('../../models/MindTrain/AlarmProfile');
const FCMSchedule = require('../../models/MindTrain/FCMSchedule');
const NotificationLog = require('../../models/MindTrain/NotificationLog');
const { getMindTrainConnection } = require('../../config/dbMindTrain');
const mongoose = require('mongoose');

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

        // Ensure isActive is true for new profile (as per requirement)
        profileData.isActive = true;

        // Create/update alarm profile (userId comes from JWT authentication)
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
    // Get MindTrain connection for transaction
    const mindTrainConnection = getMindTrainConnection();
    if (!mindTrainConnection) {
        return res.status(500).json({
            success: false,
            message: 'Database connection not available',
            code: 'DATABASE_ERROR'
        });
    }

    const session = await mindTrainConnection.startSession();
    session.startTransaction();

    try {
        const { profileId } = req.params;
        const userId = req.userId; // From JWT middleware

        // Validate authentication
        if (!userId) {
            await session.abortTransaction();
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Validate profileId
        if (!profileId) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Profile ID is required',
                code: 'PROFILE_ID_REQUIRED'
            });
        }

        console.log(`[Delete] User: ${userId}, Profile: ${profileId}`);

        // Step 1: Verify ownership and get profile
        const profile = await AlarmProfile.findOne({
            id: profileId,
            userId: userId,
        }).session(session);

        if (!profile) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Profile not found',
                code: 'PROFILE_NOT_FOUND'
            });
        }

        console.log(`[Delete] Found profile: ${profile.title}`);

        // Step 2: Check if has active alarms TODAY
        // Note: AlarmTrigger model doesn't exist in this codebase, so we skip this check
        // If you have scheduled alarms stored elsewhere, add that check here
        // For now, we'll allow deletion regardless of active alarms

        // Step 3: Delete FCM Schedule
        const fcmDeleted = await FCMSchedule.deleteOne(
            { activeProfileId: profileId },
            { session }
        );

        console.log(`[Delete] FCM schedule deleted: ${fcmDeleted.deletedCount}`);

        // Step 4: Delete notification logs
        const notifDeleted = await NotificationLog.deleteMany(
            { 'data.profileId': profileId },
            { session }
        );

        console.log(`[Delete] Notifications deleted: ${notifDeleted.deletedCount}`);

        // Step 5: Delete the profile
        await AlarmProfile.deleteOne(
            { id: profileId, userId: userId },
            { session }
        );

        console.log(`[Delete] Profile deleted`);

        // Step 6: Handle active profile transition
        let remainingCount = 0;
        let fcmDisabled = false;

        if (profile.isActive) {
            // Count remaining profiles (excluding the one we just deleted)
            remainingCount = await AlarmProfile.countDocuments({
                userId: userId,
            }).session(session);

            console.log(`[Delete] Remaining profiles: ${remainingCount}`);

            if (remainingCount === 0) {
                // Disable FCM if no profiles left
                // Note: We already deleted the FCM schedule above, but check for any remaining
                const remainingFCM = await FCMSchedule.countDocuments({
                    userId: userId
                }).session(session);

                if (remainingFCM > 0) {
                    await FCMSchedule.updateMany(
                        { userId: userId },
                        { isEnabled: false },
                        { session }
                    );
                }

                fcmDisabled = true;
                console.log(`[Delete] FCM disabled (no profiles left)`);
            } else {
                // Activate next profile
                const nextProfile = await AlarmProfile.findOne({
                    userId: userId,
                }).session(session);

                if (nextProfile && !nextProfile.isActive) {
                    nextProfile.isActive = true;
                    nextProfile.lastSyncTimestamp = new Date();
                    await nextProfile.save({ session });

                    console.log(`[Delete] Activated next profile: ${nextProfile.id}`);
                }
            }
        }

        await session.commitTransaction();
        session.endSession();
        console.log(`[Delete] ✅ Transaction committed`);

        res.status(200).json({
            success: true,
            message: 'Profile deleted successfully',
            data: {
                deletedProfileId: profileId,
                cascadeCleanup: {
                    fcmScheduleDeleted: fcmDeleted.deletedCount > 0,
                    notificationLogsDeleted: notifDeleted.deletedCount,
                    remainingProfiles: remainingCount,
                    fcmDisabled: fcmDisabled,
                },
            },
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('[Delete] Error:', error.message);
        console.error('[Delete] Stack:', error.stack);

        res.status(500).json({
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

