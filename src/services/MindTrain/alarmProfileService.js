const AlarmProfileServiceAdapter = require('./adapters/alarmProfileServiceAdapter');
const mindtrainUserService = require('./mindtrainUser.service');
const logger = require('../../utils/logger');
const metrics = require('../../utils/metrics');
const transformers = require('../../utils/transformers');

/**
 * Alarm Profile Service
 * 
 * Wrapper service that delegates to AlarmProfileServiceAdapter.
 * Maintains backward compatibility with existing controllers.
 * 
 * NOTE: This service now uses the unified MindTrainUser model via adapters.
 * The adapter handles transformation between old and new formats.
 */

// Initialize adapter
const adapter = new AlarmProfileServiceAdapter(
    mindtrainUserService,
    logger,
    metrics,
    transformers
);

/**
 * Create or update an alarm profile
 * If isActive is true, deactivates all other profiles for the user
 * 
 * @param {Object} profileData - Alarm profile data
 * @param {string|ObjectId} profileData.userId - User ID
 * @param {string} profileData.id - Profile ID
 * @returns {Promise<Object>} Created/updated profile and list of deactivated profiles
 */
const createOrUpdateAlarmProfile = async (profileData) => {
    return adapter.createOrUpdateAlarmProfile(profileData);
};

/**
 * Get all alarm profiles for a user, separated by active/inactive status
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Object with activeProfiles and inactiveProfiles arrays
 */
const getUserAlarmProfiles = async (userId) => {
    return adapter.getAlarmProfiles(userId);
};

/**
 * Get active alarm profile for a user
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Active alarm profile or null
 */
const getActiveAlarmProfile = async (userId) => {
    return adapter.getActiveAlarmProfile(userId);
};

/**
 * Update sync metadata for an alarm profile
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} profileId - Profile ID
 * @param {Object} syncData - Sync metadata
 * @returns {Promise<Object>} Updated profile
 */
const updateSyncMetadata = async (userId, profileId, syncData) => {
    return adapter.updateSyncMetadata(userId, profileId, syncData);
};

module.exports = {
    createOrUpdateAlarmProfile,
    getUserAlarmProfiles,
    getActiveAlarmProfile,
    updateSyncMetadata
};
