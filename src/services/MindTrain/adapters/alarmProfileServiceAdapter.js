/**
 * Alarm Profile Service Adapter
 * 
 * Adapter that bridges old API format and new unified MindTrainUser model.
 * Maintains 100% backward compatibility with existing controllers.
 * 
 * Responsibilities:
 * 1. Validate input (old format)
 * 2. Transform old → new format
 * 3. Call core service methods
 * 4. Transform response new → old format
 * 5. Handle errors and map to appropriate HTTP responses
 */

const mindtrainUserService = require('../mindtrainUser.service');
const logger = require('../../../utils/logger').child({ component: 'AlarmProfileServiceAdapter' });
const metrics = require('../../../utils/metrics');
const { transformOldProfileToNew, transformNewProfileToOld, ResponseFormatter } = require('../../../utils/transformers');
const {
    ProfileCreationError,
    ProfileNotFoundError,
    ValidationError,
    UserNotFoundError
} = require('../../../utils/errors');

class AlarmProfileServiceAdapter {
    constructor(service = mindtrainUserService, log = logger, metric = metrics, transformer = { transformOldProfileToNew, transformNewProfileToOld }) {
        this.service = service;
        this.logger = log;
        this.metrics = metric;
        this.transformOldToNew = transformer.transformOldProfileToNew;
        this.transformNewToOld = transformer.transformNewProfileToOld;
    }

    /**
     * Get all alarm profiles for a user, separated by active/inactive status
     * Returns old format: { activeProfiles, inactiveProfiles, totalActive, totalInactive, totalProfiles }
     * 
     * @param {string|ObjectId} userId - User ID
     * @returns {Promise<Object>} Object with activeProfiles and inactiveProfiles arrays
     */
    async getAlarmProfiles(userId) {
        const operationLogger = this.logger.child({ operation: 'getAlarmProfiles', userId });
        
        return await this.metrics.record('adapter_alarm_profiles_get', async () => {
            try {
                if (!userId) {
                    throw new ValidationError('userId is required');
                }

                operationLogger.debug('Getting alarm profiles');

                // Get unified user data
                let user = await this.service.getMindTrainUser(userId);
                
                // If user doesn't exist, return empty result (backward compatible)
                if (!user) {
                    operationLogger.debug('User not found, returning empty profiles');
                    return {
                        activeProfiles: [],
                        inactiveProfiles: [],
                        totalActive: 0,
                        totalInactive: 0,
                        totalProfiles: 0
                    };
                }

                // Ensure userId is a string for transformation
                // Use user.userId from the unified model if userId parameter is not provided
                const effectiveUserId = userId || user.userId;
                const userIdString = effectiveUserId ? (typeof effectiveUserId === 'object' && effectiveUserId.toString ? effectiveUserId.toString() : String(effectiveUserId)) : null;
                
                if (!userIdString) {
                    operationLogger.warn('No userId available for transformation');
                    throw new ValidationError('userId is required for profile transformation');
                }
                
                // Transform to old format
                const activeProfiles = (user.alarmProfiles || [])
                    .filter(p => p.isActive === true)
                    .map(profile => this.transformNewToOld(profile, userIdString));

                const inactiveProfiles = (user.alarmProfiles || [])
                    .filter(p => p.isActive === false)
                    .map(profile => this.transformNewToOld(profile, userIdString));

                const result = {
                    activeProfiles,
                    inactiveProfiles,
                    totalActive: activeProfiles.length,
                    totalInactive: inactiveProfiles.length,
                    totalProfiles: (user.alarmProfiles || []).length
                };

                operationLogger.info('Alarm profiles retrieved', { 
                    total: result.totalProfiles,
                    active: result.totalActive 
                });

                return result;
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                }
                operationLogger.error('Error getting alarm profiles', error, { userId });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'get' });
    }

    /**
     * Get active alarm profile for a user
     * Returns old format profile or null
     * 
     * @param {string|ObjectId} userId - User ID
     * @returns {Promise<Object|null>} Active alarm profile or null
     */
    async getActiveAlarmProfile(userId) {
        const operationLogger = this.logger.child({ operation: 'getActiveAlarmProfile', userId });
        
        return await this.metrics.record('adapter_alarm_profile_active_get', async () => {
            try {
                if (!userId) {
                    throw new ValidationError('userId is required');
                }

                operationLogger.debug('Getting active alarm profile');

                const user = await this.service.getMindTrainUser(userId);
                if (!user || !user.alarmProfiles) {
                    return null;
                }

                const activeProfile = user.alarmProfiles.find(p => p.isActive === true);
                if (!activeProfile) {
                    return null;
                }

                return this.transformNewToOld(activeProfile, userId);
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                }
                operationLogger.error('Error getting active alarm profile', error, { userId });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'getActive' });
    }

    /**
     * Create or update an alarm profile
     * If isActive is true, deactivates all other profiles for the user
     * Returns old format: { profile, deactivatedProfiles, deactivatedCount }
     * 
     * @param {Object} profileData - Alarm profile data (old format)
     * @returns {Promise<Object>} Created/updated profile and list of deactivated profiles
     */
    async createOrUpdateAlarmProfile(profileData) {
        const operationLogger = this.logger.child({ 
            operation: 'createOrUpdateAlarmProfile', 
            userId: profileData?.userId,
            profileId: profileData?.id
        });
        
        return await this.metrics.record('adapter_alarm_profile_create_update', async () => {
            try {
                // Validate input
                this.validateProfileData(profileData);

                const { userId, id, isActive, ...otherFields } = profileData;

                operationLogger.debug('Creating or updating alarm profile', { profileId: id });

                // Ensure user exists
                let user = await this.service.getMindTrainUser(userId);
                if (!user) {
                    operationLogger.debug('User not found, creating new user');
                    user = await this.service.createMindTrainUser(userId);
                }

                // Check if profile already exists
                const existingProfile = user.alarmProfiles?.find(p => p.id === String(id).trim());

                let updatedUser;
                let deactivatedProfiles = [];

                if (existingProfile) {
                    // Update existing profile
                    operationLogger.debug('Updating existing profile');
                    
                    // Transform old format to new format for update
                    const updates = {
                        ...otherFields,
                        isActive: isActive === true
                    };

                    updatedUser = await this.service.updateAlarmProfile(userId, id, updates);
                } else {
                    // Create new profile
                    operationLogger.debug('Creating new profile');
                    
                    // Transform old format to new format
                    const newProfileData = this.transformOldToNew(profileData);
                    updatedUser = await this.service.addAlarmProfile(userId, newProfileData);
                }

                // If this profile is being set as active, deactivate all others
                if (isActive === true) {
                    operationLogger.debug('Activating profile and deactivating others');
                    updatedUser = await this.service.activateProfile(userId, id);
                    
                    // Get deactivated profiles for response
                    const allProfiles = updatedUser.alarmProfiles || [];
                    deactivatedProfiles = allProfiles
                        .filter(p => p.id !== String(id).trim() && !p.isActive)
                        .map(profile => ({
                            id: profile.id,
                            title: profile.title,
                            _id: null, // Not available in nested format
                            isActive: profile.isActive
                        }));
                }

                // Find the created/updated profile
                const profile = updatedUser.alarmProfiles.find(p => p.id === String(id).trim());
                if (!profile) {
                    throw new ProfileCreationError('Failed to create or update profile');
                }

                // Transform to old format
                const oldFormatProfile = this.transformNewToOld(profile, userId);

                operationLogger.info('Profile created/updated successfully', { profileId: id });

                return {
                    profile: oldFormatProfile,
                    deactivatedProfiles,
                    deactivatedCount: deactivatedProfiles.length
                };
            } catch (error) {
                if (error instanceof ValidationError || error instanceof ProfileCreationError) {
                    throw error;
                }
                operationLogger.error('Error creating or updating alarm profile', error, { 
                    userId: profileData?.userId,
                    profileId: profileData?.id
                });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'createOrUpdate' });
    }

    /**
     * Update active profile status
     * Atomic operation: activates specified profile and deactivates all others
     * 
     * @param {string|ObjectId} userId - User ID
     * @param {string} profileId - Profile ID
     * @param {boolean} isActive - Active status
     * @returns {Promise<Object>} Updated profile
     */
    async updateActiveProfile(userId, profileId, isActive) {
        const operationLogger = this.logger.child({ 
            operation: 'updateActiveProfile', 
            userId,
            profileId,
            isActive
        });
        
        return await this.metrics.record('adapter_alarm_profile_active_update', async () => {
            try {
                if (!userId || !profileId) {
                    throw new ValidationError('userId and profileId are required');
                }

                if (isActive === true) {
                    operationLogger.debug('Activating profile');
                    const updatedUser = await this.service.activateProfile(userId, profileId);
                    const profile = updatedUser.alarmProfiles.find(p => p.id === profileId);
                    if (!profile) {
                        throw new ProfileNotFoundError(profileId);
                    }
                    return this.transformNewToOld(profile, userId);
                } else {
                    operationLogger.debug('Deactivating profile');
                    const updatedUser = await this.service.updateAlarmProfile(userId, profileId, { isActive: false });
                    const profile = updatedUser.alarmProfiles.find(p => p.id === profileId);
                    if (!profile) {
                        throw new ProfileNotFoundError(profileId);
                    }
                    return this.transformNewToOld(profile, userId);
                }
            } catch (error) {
                if (error instanceof ValidationError || error instanceof ProfileNotFoundError) {
                    throw error;
                }
                operationLogger.error('Error updating active profile', error, { userId, profileId });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'updateActive' });
    }

    /**
     * Delete an alarm profile
     * 
     * @param {string|ObjectId} userId - User ID
     * @param {string} profileId - Profile ID to delete
     * @returns {Promise<Object>} Deleted profile info
     */
    async deleteAlarmProfile(userId, profileId) {
        const operationLogger = this.logger.child({ 
            operation: 'deleteAlarmProfile', 
            userId,
            profileId
        });
        
        return await this.metrics.record('adapter_alarm_profile_delete', async () => {
            try {
                if (!userId || !profileId) {
                    throw new ValidationError('userId and profileId are required');
                }

                operationLogger.debug('Deleting alarm profile');

                // Get profile before deletion to return info
                const user = await this.service.getMindTrainUser(userId);
                if (!user) {
                    throw new UserNotFoundError(userId);
                }

                const profile = user.alarmProfiles?.find(p => p.id === profileId);
                if (!profile) {
                    throw new ProfileNotFoundError(profileId);
                }

                // Delete the profile
                await this.service.deleteAlarmProfile(userId, profileId);

                operationLogger.info('Profile deleted successfully', { profileId });

                return {
                    deletedProfileId: profileId,
                    wasActive: profile.isActive || false
                };
            } catch (error) {
                if (error instanceof ValidationError || error instanceof ProfileNotFoundError || error instanceof UserNotFoundError) {
                    throw error;
                }
                operationLogger.error('Error deleting alarm profile', error, { userId, profileId });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'delete' });
    }

    /**
     * Update sync metadata for an alarm profile
     * 
     * @param {string|ObjectId} userId - User ID
     * @param {string} profileId - Profile ID
     * @param {Object} syncData - Sync metadata
     * @returns {Promise<Object>} Updated profile
     */
    async updateSyncMetadata(userId, profileId, syncData) {
        const operationLogger = this.logger.child({ 
            operation: 'updateSyncMetadata', 
            userId,
            profileId
        });
        
        return await this.metrics.record('adapter_alarm_profile_sync_update', async () => {
            try {
                if (!userId || !profileId) {
                    throw new ValidationError('userId and profileId are required');
                }

                operationLogger.debug('Updating sync metadata');

                const updatedUser = await this.service.updateAlarmProfile(userId, profileId, syncData);
                const profile = updatedUser.alarmProfiles.find(p => p.id === profileId);
                if (!profile) {
                    throw new ProfileNotFoundError(profileId);
                }

                return this.transformNewToOld(profile, userId);
            } catch (error) {
                if (error instanceof ValidationError || error instanceof ProfileNotFoundError) {
                    throw error;
                }
                operationLogger.error('Error updating sync metadata', error, { userId, profileId });
                throw error;
            }
        }, { adapter: 'alarmProfile', operation: 'updateSync' });
    }

    /**
     * Validate profile data
     * @private
     */
    validateProfileData(profileData) {
        if (!profileData) {
            throw new ValidationError('profileData is required');
        }

        const { userId, id, youtubeUrl, title, alarmsPerDay, selectedDaysPerWeek, startTime, endTime } = profileData;

        if (!userId) {
            throw new ValidationError('userId is required');
        }
        if (!id) {
            throw new ValidationError('id is required');
        }
        if (!youtubeUrl) {
            throw new ValidationError('youtubeUrl is required');
        }
        if (!title) {
            throw new ValidationError('title is required');
        }
        if (!alarmsPerDay) {
            throw new ValidationError('alarmsPerDay is required');
        }
        if (!selectedDaysPerWeek || !Array.isArray(selectedDaysPerWeek) || selectedDaysPerWeek.length === 0) {
            throw new ValidationError('selectedDaysPerWeek is required and must be a non-empty array');
        }
        if (!startTime) {
            throw new ValidationError('startTime is required');
        }
        if (!endTime) {
            throw new ValidationError('endTime is required');
        }
    }
}

module.exports = AlarmProfileServiceAdapter;

