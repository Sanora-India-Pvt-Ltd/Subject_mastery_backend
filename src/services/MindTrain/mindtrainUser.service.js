const MindTrainUser = require('../../models/MindTrain/MindTrainUser');
const mongoose = require('mongoose');
const { getMindTrainConnection } = require('../../config/dbMindTrain');
const logger = require('../../utils/logger').child({ component: 'MindTrainUserService' });
const metrics = require('../../utils/metrics');
const {
    UserNotFoundError,
    ProfileNotFoundError,
    ValidationError,
    DatabaseError,
    ConcurrencyError
} = require('../../utils/errors');
const config = require('../../config/mindtrain.config');

/**
 * MindTrain User Service
 * 
 * Handles all business logic for the unified MindTrainUser model.
 * Provides methods for managing alarm profiles, FCM schedules, notification logs, and sync health logs.
 * 
 * All operations use atomic MongoDB updates for data consistency.
 * Includes comprehensive error handling, logging, and metrics tracking.
 */

/**
 * Get complete user data (all-in-one)
 * Returns the complete nested document with all user data
 * Frontend computes health status and statistics from this data
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Complete MindTrainUser document or null if not found
 */
const getMindTrainUser = async (userId) => {
    const operationLogger = logger.child({ operation: 'getMindTrainUser', userId });
    
    return await metrics.record('mindtrain_user_get', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            operationLogger.debug('Fetching MindTrain user');

            const user = await MindTrainUser.findOne({ userId: userIdObjectId })
                .lean()
                .exec();

            if (!user) {
                operationLogger.debug('User not found');
                return null;
            }

            operationLogger.info('User retrieved successfully', {
                profilesCount: user.alarmProfiles?.length || 0,
                notificationsCount: user.notificationLogs?.length || 0
            });

            return user;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            operationLogger.error('Error getting MindTrain user', error, { userId });
            throw new DatabaseError('Failed to retrieve MindTrain user', error);
        }
    }, { operation: 'get' });
};

/**
 * Initialize a new MindTrainUser document
 * Creates a new document with default values
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Created MindTrainUser document
 */
const createMindTrainUser = async (userId) => {
    const operationLogger = logger.child({ operation: 'createMindTrainUser', userId });
    
    return await metrics.record('mindtrain_user_create', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            // Check if user already exists
            const existing = await MindTrainUser.findOne({ userId: userIdObjectId }).lean();
            if (existing) {
                operationLogger.warn('User already exists, returning existing user');
                return existing;
            }

            operationLogger.debug('Creating new MindTrain user');

            const user = new MindTrainUser({
                userId: userIdObjectId,
                alarmProfiles: [],
                fcmSchedule: {
                    morningNotificationTime: '08:00',
                    eveningNotificationTime: '20:00',
                    timezone: 'UTC',
                    isEnabled: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                notificationLogs: [],
                syncHealthLogs: [],
                metadata: {
                    totalAlarmProfiles: 0,
                    activeAlarmProfiles: 0,
                    totalNotifications: 0,
                    totalSyncHealthLogs: 0
                }
            });

            await user.save();
            
            operationLogger.info('MindTrain user created successfully');
            metrics.increment('mindtrain_user_created', 1);
            
            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            operationLogger.error('Error creating MindTrain user', error, { userId });
            throw new DatabaseError('Failed to create MindTrain user', error);
        }
    }, { operation: 'create' });
};

/**
 * Add a new alarm profile
 * Creates a new profile in the alarmProfiles array
 * Auto-updates metadata
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} profileData - Alarm profile data
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const addAlarmProfile = async (userId, profileData) => {
    const operationLogger = logger.child({ 
        operation: 'addAlarmProfile', 
        userId, 
        profileId: profileData?.id 
    });
    
    return await metrics.record('mindtrain_profile_add', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }
            if (!profileData || !profileData.id) {
                throw new ValidationError('profileData with id is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            // Check if profile with same id already exists
            const existingUser = await MindTrainUser.findOne({
                userId: userIdObjectId,
                'alarmProfiles.id': profileData.id
            }).lean();

            if (existingUser) {
                operationLogger.warn('Profile with same id already exists', { profileId: profileData.id });
                throw new ValidationError(`Profile with id '${profileData.id}' already exists`);
            }

            // Check profile limit
            const user = await MindTrainUser.findOne({ userId: userIdObjectId }).lean();
            if (user && user.alarmProfiles && user.alarmProfiles.length >= config.MAX_ALARM_PROFILES) {
                throw new ValidationError(`Maximum ${config.MAX_ALARM_PROFILES} alarm profiles allowed`);
            }

            operationLogger.debug('Adding alarm profile');

            const now = new Date();
            const newProfile = {
                ...profileData,
                createdAt: now,
                updatedAt: now
            };

            const updatedUser = await MindTrainUser.findOneAndUpdate(
                { userId: userIdObjectId },
                {
                    $push: { alarmProfiles: newProfile },
                    $set: {
                        'metadata.lastProfileUpdateAt': now,
                        updatedAt: now
                    }
                },
                { new: true, upsert: false }
            ).exec();

            if (!updatedUser) {
                throw new UserNotFoundError(userId);
            }

            // Metadata will be auto-calculated by pre-save middleware
            await updatedUser.save();

            operationLogger.info('Alarm profile added successfully', { profileId: profileData.id });
            metrics.increment('mindtrain_profile_added', 1);

            return updatedUser.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof UserNotFoundError) {
                throw error;
            }
            operationLogger.error('Error adding alarm profile', error, { userId, profileId: profileData?.id });
            throw new DatabaseError('Failed to add alarm profile', error);
        }
    }, { operation: 'add_profile' });
};

/**
 * Update an alarm profile
 * Updates specific profile fields using array filters
 * Supports partial updates (only update what's provided)
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} profileId - Profile ID
 * @param {Object} updates - Partial profile updates
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const updateAlarmProfile = async (userId, profileId, updates) => {
    const operationLogger = logger.child({ 
        operation: 'updateAlarmProfile', 
        userId, 
        profileId 
    });
    
    return await metrics.record('mindtrain_profile_update', async () => {
        try {
            if (!userId || !profileId) {
                throw new ValidationError('userId and profileId are required');
            }
            if (!updates || Object.keys(updates).length === 0) {
                throw new ValidationError('updates object is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            const updateFields = {};
            const now = new Date();

            // Build update object for array element
            Object.keys(updates).forEach(key => {
                if (key !== 'id' && key !== 'createdAt') {
                    updateFields[`alarmProfiles.$.${key}`] = updates[key];
                }
            });

            // Always update updatedAt
            updateFields['alarmProfiles.$.updatedAt'] = now;
            updateFields['metadata.lastProfileUpdateAt'] = now;
            updateFields['updatedAt'] = now;

            operationLogger.debug('Updating alarm profile');

            const user = await MindTrainUser.findOneAndUpdate(
                {
                    userId: userIdObjectId,
                    'alarmProfiles.id': profileId
                },
                { $set: updateFields },
                { new: true }
            ).exec();

            if (!user) {
                throw new ProfileNotFoundError(profileId);
            }

            // Metadata will be auto-calculated by pre-save middleware
            await user.save();

            operationLogger.info('Alarm profile updated successfully', { profileId });
            metrics.increment('mindtrain_profile_updated', 1);

            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof ProfileNotFoundError) {
                throw error;
            }
            operationLogger.error('Error updating alarm profile', error, { userId, profileId });
            throw new DatabaseError('Failed to update alarm profile', error);
        }
    }, { operation: 'update_profile' });
};

/**
 * Activate a profile
 * Sets specified profile as active (isActive = true)
 * Automatically deactivates all other profiles (isActive = false)
 * Updates fcmSchedule.activeProfileId
 * Atomic operation (all-or-nothing) using MongoDB transaction
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} profileId - Profile ID to activate
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const activateProfile = async (userId, profileId) => {
    const operationLogger = logger.child({ 
        operation: 'activateProfile', 
        userId, 
        profileId 
    });
    
    return await metrics.record('mindtrain_profile_activate', async () => {
        try {
            if (!userId || !profileId) {
                throw new ValidationError('userId and profileId are required');
            }

            const mindTrainConnection = getMindTrainConnection();
            if (!mindTrainConnection) {
                throw new DatabaseError('MindTrain database connection not initialized');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            const session = await mindTrainConnection.startSession();
            session.startTransaction();

            try {
                operationLogger.debug('Starting transaction to activate profile');

                // First, verify the profile exists
                const user = await MindTrainUser.findOne({
                    userId: userIdObjectId,
                    'alarmProfiles.id': profileId
                }).session(session).exec();

                if (!user) {
                    await session.abortTransaction();
                    session.endSession();
                    throw new ProfileNotFoundError(profileId);
                }

                const now = new Date();

                // Atomic operation: deactivate all profiles, activate the specified one, update FCM schedule
                // First, set all profiles to inactive
                await MindTrainUser.updateOne(
                    { userId: userIdObjectId },
                    {
                        $set: {
                            'alarmProfiles.$[].isActive': false
                        }
                    },
                    { session }
                ).exec();

                // Then, activate the target profile and update FCM schedule
                await MindTrainUser.findOneAndUpdate(
                    { userId: userIdObjectId },
                    {
                        $set: {
                            'alarmProfiles.$[elem].isActive': true,
                            'alarmProfiles.$[elem].updatedAt': now,
                            'fcmSchedule.activeProfileId': profileId,
                            'fcmSchedule.updatedAt': now,
                            'metadata.lastProfileUpdateAt': now,
                            updatedAt: now
                        }
                    },
                    {
                        arrayFilters: [{ 'elem.id': profileId }],
                        new: true,
                        session
                    }
                ).exec();

                await session.commitTransaction();
                session.endSession();

                operationLogger.info('Profile activated successfully', { profileId });

                // Fetch updated user
                const updatedUser = await MindTrainUser.findOne({ userId: userIdObjectId })
                    .lean()
                    .exec();

                metrics.increment('mindtrain_profile_activated', 1);
                return updatedUser;
            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        } catch (error) {
            if (error instanceof ValidationError || error instanceof ProfileNotFoundError || error instanceof DatabaseError) {
                throw error;
            }
            operationLogger.error('Error activating profile', error, { userId, profileId });
            throw new DatabaseError('Failed to activate profile', error);
        }
    }, { operation: 'activate_profile' });
};

/**
 * Delete an alarm profile
 * Removes profile from alarmProfiles array
 * If deleted profile was active, clears fcmSchedule.activeProfileId
 * Auto-updates metadata
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} profileId - Profile ID to delete
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const deleteAlarmProfile = async (userId, profileId) => {
    const operationLogger = logger.child({ 
        operation: 'deleteAlarmProfile', 
        userId, 
        profileId 
    });
    
    return await metrics.record('mindtrain_profile_delete', async () => {
        try {
            if (!userId || !profileId) {
                throw new ValidationError('userId and profileId are required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            // First, check if profile exists and if it's active
            const user = await MindTrainUser.findOne({
                userId: userIdObjectId,
                'alarmProfiles.id': profileId
            }).exec();

            if (!user) {
                throw new ProfileNotFoundError(profileId);
            }

            const profile = user.alarmProfiles.find(p => p.id === profileId);
            const wasActive = profile && profile.isActive;

            operationLogger.debug('Deleting alarm profile', { wasActive });

            const now = new Date();

            // Calculate metadata after deletion (before we delete)
            const remainingProfiles = user.alarmProfiles.filter(p => p.id !== profileId);
            const remainingActiveProfiles = remainingProfiles.filter(p => p.isActive);

            // Remove the profile and update metadata in one atomic operation
            const updateQuery = {
                $pull: { alarmProfiles: { id: profileId } },
                $set: {
                    'metadata.lastProfileUpdateAt': now,
                    'metadata.totalAlarmProfiles': remainingProfiles.length,
                    'metadata.activeAlarmProfiles': remainingActiveProfiles.length,
                    updatedAt: now
                }
            };

            // If deleted profile was active, clear activeProfileId
            if (wasActive) {
                updateQuery.$set['fcmSchedule.activeProfileId'] = null;
                updateQuery.$set['fcmSchedule.updatedAt'] = now;
            }

            const updatedUser = await MindTrainUser.findOneAndUpdate(
                { userId: userIdObjectId },
                updateQuery,
                { new: true }
            ).exec();

            if (!updatedUser) {
                throw new UserNotFoundError(userId);
            }

            // Try to save for any additional middleware, but don't fail if it errors
            // (deletion already succeeded, metadata already updated)
            try {
                await updatedUser.save();
            } catch (saveError) {
                operationLogger.warn('Save after deletion failed (non-critical)', { 
                    error: saveError.message, 
                    userId, 
                    profileId 
                });
                // Continue - deletion and metadata update already succeeded
            }

            operationLogger.info('Alarm profile deleted successfully', { profileId, wasActive });
            metrics.increment('mindtrain_profile_deleted', 1);

            return updatedUser.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof ProfileNotFoundError || error instanceof UserNotFoundError) {
                throw error;
            }
            operationLogger.error('Error deleting alarm profile', error, { userId, profileId });
            throw new DatabaseError('Failed to delete alarm profile', error);
        }
    }, { operation: 'delete_profile' });
};

/**
 * Update FCM schedule
 * Updates FCM schedule fields
 * Supports partial updates
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} fcmUpdates - Partial FCM schedule updates
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const updateFCMSchedule = async (userId, fcmUpdates) => {
    const operationLogger = logger.child({ 
        operation: 'updateFCMSchedule', 
        userId 
    });
    
    return await metrics.record('mindtrain_fcm_update', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }
            if (!fcmUpdates || Object.keys(fcmUpdates).length === 0) {
                throw new ValidationError('fcmUpdates object is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            const updateFields = {};
            const now = new Date();

            // Build update object for FCM schedule
            Object.keys(fcmUpdates).forEach(key => {
                if (key !== 'createdAt') {
                    updateFields[`fcmSchedule.${key}`] = fcmUpdates[key];
                }
            });

            // Always update updatedAt
            updateFields['fcmSchedule.updatedAt'] = now;
            updateFields['updatedAt'] = now;

            operationLogger.debug('Updating FCM schedule');

            const user = await MindTrainUser.findOneAndUpdate(
                { userId: userIdObjectId },
                { $set: updateFields },
                { new: true, upsert: false }
            ).exec();

            if (!user) {
                throw new UserNotFoundError(userId);
            }

            await user.save();

            operationLogger.info('FCM schedule updated successfully');
            metrics.increment('mindtrain_fcm_updated', 1);

            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof UserNotFoundError) {
                throw error;
            }
            operationLogger.error('Error updating FCM schedule', error, { userId });
            throw new DatabaseError('Failed to update FCM schedule', error);
        }
    }, { operation: 'update_fcm' });
};

/**
 * Add notification log
 * Adds to notificationLogs array (auto-rotates to max 100)
 * Auto-updates metadata
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} notificationData - Notification log data
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const addNotificationLog = async (userId, notificationData) => {
    const operationLogger = logger.child({ 
        operation: 'addNotificationLog', 
        userId,
        notificationId: notificationData?.notificationId
    });
    
    return await metrics.record('mindtrain_notification_add', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }
            if (!notificationData || !notificationData.notificationId) {
                throw new ValidationError('notificationData with notificationId is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            const now = new Date();
            const newNotification = {
                ...notificationData,
                createdAt: now,
                updatedAt: now
            };

            operationLogger.debug('Adding notification log');

            const user = await MindTrainUser.findOneAndUpdate(
                { userId: userIdObjectId },
                {
                    $push: { notificationLogs: newNotification },
                    $set: { updatedAt: now }
                },
                { new: true, upsert: false }
            ).exec();

            if (!user) {
                throw new UserNotFoundError(userId);
            }

            // Metadata and rotation will be handled by pre-save middleware
            await user.save();

            operationLogger.debug('Notification log added successfully');
            metrics.increment('mindtrain_notification_added', 1, { 
                status: notificationData.status || 'pending' 
            });

            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof UserNotFoundError) {
                throw error;
            }
            operationLogger.error('Error adding notification log', error, { userId });
            throw new DatabaseError('Failed to add notification log', error);
        }
    }, { operation: 'add_notification' });
};

/**
 * Add sync health log
 * Adds to syncHealthLogs array (auto-rotates to max 50)
 * Auto-updates metadata
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {Object} healthLogData - Sync health log data
 * @returns {Promise<Object>} Updated MindTrainUser document
 */
const addSyncHealthLog = async (userId, healthLogData) => {
    const operationLogger = logger.child({ 
        operation: 'addSyncHealthLog', 
        userId,
        deviceId: healthLogData?.deviceId
    });
    
    return await metrics.record('mindtrain_health_add', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }
            if (!healthLogData || !healthLogData.deviceId) {
                throw new ValidationError('healthLogData with deviceId is required');
            }

            const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
                ? new mongoose.Types.ObjectId(userId)
                : userId;

            const now = new Date();
            const newHealthLog = {
                ...healthLogData,
                reportedAt: healthLogData.reportedAt || now,
                createdAt: now,
                updatedAt: now
            };

            operationLogger.debug('Adding sync health log');

            const user = await MindTrainUser.findOneAndUpdate(
                { userId: userIdObjectId },
                {
                    $push: { syncHealthLogs: newHealthLog },
                    $set: { updatedAt: now }
                },
                { new: true, upsert: false }
            ).exec();

            if (!user) {
                throw new UserNotFoundError(userId);
            }

            // Metadata and rotation will be handled by pre-save middleware
            await user.save();

            operationLogger.debug('Sync health log added successfully', {
                healthScore: healthLogData.healthScore
            });
            metrics.increment('mindtrain_health_added', 1, {
                healthScore: healthLogData.healthScore || 100
            });

            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError || error instanceof UserNotFoundError) {
                throw error;
            }
            operationLogger.error('Error adding sync health log', error, { userId });
            throw new DatabaseError('Failed to add sync health log', error);
        }
    }, { operation: 'add_health' });
};

/**
 * Get failed notifications (helper method)
 * Filters from complete user data
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {number} hours - Number of hours to look back (default: 24)
 * @returns {Promise<Array>} Array of failed notifications
 */
const getFailedNotifications = async (userId, hours = 24) => {
    const operationLogger = logger.child({ 
        operation: 'getFailedNotifications', 
        userId,
        hours
    });
    
    return await metrics.record('mindtrain_notifications_failed_get', async () => {
        try {
            if (!userId) {
                throw new ValidationError('userId is required');
            }

            const user = await getMindTrainUser(userId);
            if (!user || !user.notificationLogs) {
                operationLogger.debug('No user or notification logs found');
                return [];
            }

            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            
            const failed = user.notificationLogs.filter(log => 
                log.status === 'failed' && 
                log.createdAt >= cutoffTime
            );

            operationLogger.debug('Retrieved failed notifications', { count: failed.length });
            return failed;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            operationLogger.error('Error getting failed notifications', error, { userId });
            throw new DatabaseError('Failed to get failed notifications', error);
        }
    }, { operation: 'get_failed_notifications' });
};

/**
 * Find users needing sync (admin/background job method)
 * Finds users with profiles that need sync based on nextSyncCheckTime
 * 
 * @param {number} limit - Maximum number of users to return (default: 100)
 * @returns {Promise<Array>} Array of user documents needing sync
 */
const findUsersNeedingSync = async (limit = 100) => {
    const operationLogger = logger.child({ 
        operation: 'findUsersNeedingSync', 
        limit
    });
    
    return await metrics.record('mindtrain_users_sync_find', async () => {
        try {
            const now = new Date();
            
            operationLogger.debug('Finding users needing sync');

            const users = await MindTrainUser.find({
                'alarmProfiles.nextSyncCheckTime': { $lte: now },
                'alarmProfiles.isActive': true
            })
            .limit(limit)
            .lean()
            .exec();

            operationLogger.info('Found users needing sync', { count: users.length });
            metrics.gauge('mindtrain_users_needing_sync', users.length);

            return users;
        } catch (error) {
            operationLogger.error('Error finding users needing sync', error);
            throw new DatabaseError('Failed to find users needing sync', error);
        }
    }, { operation: 'find_users_sync' });
};

/**
 * Update notification log status
 * Updates notification log in nested array by notificationId
 * 
 * @param {string} notificationId - Notification ID
 * @param {Object} updates - Status updates (status, deliveredAt, failedAt, deliveryError, etc.)
 * @returns {Promise<Object|null>} Updated user document or null if not found
 */
const updateNotificationLog = async (notificationId, updates) => {
    const operationLogger = logger.child({ 
        operation: 'updateNotificationLog', 
        notificationId
    });
    
    return await metrics.record('mindtrain_notification_update', async () => {
        try {
            if (!notificationId) {
                throw new ValidationError('notificationId is required');
            }

            const updateFields = {};
            const now = new Date();

            // Build update object for array element
            Object.keys(updates).forEach(key => {
                if (key !== 'notificationId' && key !== 'createdAt') {
                    updateFields[`notificationLogs.$.${key}`] = updates[key];
                }
            });

            // Always update updatedAt
            updateFields['notificationLogs.$.updatedAt'] = now;
            updateFields['updatedAt'] = now;

            operationLogger.debug('Updating notification log');

            const user = await MindTrainUser.findOneAndUpdate(
                {
                    'notificationLogs.notificationId': notificationId
                },
                { $set: updateFields },
                { new: true }
            ).exec();

            if (!user) {
                operationLogger.debug('Notification log not found');
                return null;
            }

            await user.save();

            operationLogger.info('Notification log updated successfully', { notificationId });
            metrics.increment('mindtrain_notification_updated', 1);

            return user.toObject();
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            operationLogger.error('Error updating notification log', error, { notificationId });
            throw new DatabaseError('Failed to update notification log', error);
        }
    }, { operation: 'update_notification' });
};

/**
 * Get users with FCM schedules that need notifications
 * Finds users with enabled FCM schedules and active profiles that match notification time window
 * 
 * @param {string} notificationType - 'morning' or 'evening'
 * @param {Date} currentTime - Current time for comparison (default: now)
 * @param {number} windowMinutes - Time window in minutes (default: 15)
 * @returns {Promise<Array>} Array of user documents with matching FCM schedules
 */
const getUsersForNotification = async (notificationType, currentTime = new Date(), windowMinutes = 15) => {
    const operationLogger = logger.child({ 
        operation: 'getUsersForNotification', 
        notificationType,
        windowMinutes
    });
    
    return await metrics.record('mindtrain_users_notification_find', async () => {
        try {
            if (!['morning', 'evening'].includes(notificationType)) {
                throw new ValidationError('notificationType must be "morning" or "evening"');
            }

            const windowStart = new Date(currentTime);
            const windowEnd = new Date(currentTime);
            windowEnd.setMinutes(windowEnd.getMinutes() + windowMinutes);

            operationLogger.debug('Finding users for notification', { 
                notificationType, 
                windowStart: windowStart.toISOString(),
                windowEnd: windowEnd.toISOString()
            });

            // Find users with:
            // 1. Enabled FCM schedule
            // 2. Active profile
            // 3. Notification time within window
            const timeField = notificationType === 'morning' 
                ? 'fcmSchedule.morningNotificationTime' 
                : 'fcmSchedule.eveningNotificationTime';

            // Query users with enabled schedules and active profiles
            const users = await MindTrainUser.find({
                'fcmSchedule.isEnabled': true,
                'alarmProfiles.isActive': true,
                'fcmSchedule.activeProfileId': { $exists: true, $ne: null }
            })
            .lean()
            .exec();

            // Filter users whose notification time is within the window
            // Note: This is a simplified check - in production, you'd want to calculate
            // actual next notification time based on timezone and current time
            const matchingUsers = users.filter(user => {
                if (!user.fcmSchedule || !user.fcmSchedule.isEnabled) return false;
                
                const notificationTime = notificationType === 'morning'
                    ? user.fcmSchedule.morningNotificationTime
                    : user.fcmSchedule.eveningNotificationTime;

                if (!notificationTime) return false;

                // Parse time (HH:mm format) and check if it's within window
                // This is simplified - in production, consider timezone and actual next notification time
                const [hours, minutes] = notificationTime.split(':').map(Number);
                const notificationDate = new Date(currentTime);
                notificationDate.setHours(hours, minutes, 0, 0);

                // Check if notification time is within window
                return notificationDate >= windowStart && notificationDate <= windowEnd;
            });

            operationLogger.info('Found users for notification', { 
                count: matchingUsers.length,
                notificationType 
            });
            metrics.gauge('mindtrain_users_for_notification', matchingUsers.length);

            return matchingUsers;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            operationLogger.error('Error finding users for notification', error);
            throw new DatabaseError('Failed to find users for notification', error);
        }
    }, { operation: 'get_users_notification' });
};

module.exports = {
    getMindTrainUser,
    createMindTrainUser,
    addAlarmProfile,
    updateAlarmProfile,
    activateProfile,
    deleteAlarmProfile,
    updateFCMSchedule,
    addNotificationLog,
    updateNotificationLog,
    addSyncHealthLog,
    getFailedNotifications,
    findUsersNeedingSync,
    getUsersForNotification
};

