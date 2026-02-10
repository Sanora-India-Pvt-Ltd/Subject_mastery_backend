const FCMScheduleServiceAdapter = require('./adapters/fcmScheduleServiceAdapter');
const mindtrainUserService = require('./mindtrainUser.service');
const logger = require('../../utils/logger');
const metrics = require('../../utils/metrics');
const transformers = require('../../utils/transformers');

/**
 * FCM Schedule Service
 * 
 * Wrapper service that delegates to FCMScheduleServiceAdapter.
 * Maintains backward compatibility with existing controllers.
 * 
 * NOTE: This service now uses the unified MindTrainUser model via adapters.
 * The adapter handles transformation between old and new formats.
 */

// Initialize adapter
const adapter = new FCMScheduleServiceAdapter(
    mindtrainUserService,
    logger,
    metrics,
    transformers
);

/**
 * Calculate next notification times based on timezone and current time
 * 
 * @param {string} morningTime - Morning notification time (HH:mm format)
 * @param {string} eveningTime - Evening notification time (HH:mm format)
 * @param {string} timezone - Timezone (e.g., 'Asia/Kolkata', 'UTC')
 * @returns {Object} Object with nextMorningNotification and nextEveningNotification dates
 */
const calculateNextNotificationTimes = (morningTime, eveningTime, timezone = 'UTC') => {
    return adapter.calculateNextNotificationTimes(morningTime, eveningTime, timezone);
};

/**
 * Create or update FCM schedule for a user
 * 
 * @param {Object} scheduleData - FCM schedule data
 * @param {string|ObjectId} scheduleData.userId - User ID
 * @param {string} scheduleData.activeProfileId - Active alarm profile ID
 * @param {string} scheduleData.morningNotificationTime - Morning time (HH:mm)
 * @param {string} scheduleData.eveningNotificationTime - Evening time (HH:mm)
 * @param {string} scheduleData.timezone - Timezone
 * @returns {Promise<Object>} Created/updated FCM schedule
 */
const createOrUpdateFCMSchedule = async (scheduleData) => {
    return adapter.createOrUpdateFCMSchedule(scheduleData);
};

/**
 * Get FCM schedule for a user
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} FCM schedule or null
 */
const getFCMSchedule = async (userId) => {
    return adapter.getFCMSchedule(userId);
};

/**
 * Update FCM schedule last sent time
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} notificationType - 'morning' or 'evening'
 * @returns {Promise<Object>} Updated schedule
 */
const updateLastSentTime = async (userId, notificationType) => {
    return adapter.updateLastSentTime(userId, notificationType);
};

/**
 * Get all users with enabled FCM schedules that need notifications
 * 
 * @param {string} notificationType - 'morning' or 'evening'
 * @param {Date} currentTime - Current time for comparison
 * @param {number} windowMinutes - Time window in minutes (default: 15)
 * @returns {Promise<Array>} Array of FCM schedules
 */
const getSchedulesForNotification = async (notificationType, currentTime = new Date(), windowMinutes = 15) => {
    return adapter.getSchedulesForNotification(notificationType, currentTime, windowMinutes);
};

module.exports = {
    createOrUpdateFCMSchedule,
    getFCMSchedule,
    updateLastSentTime,
    getSchedulesForNotification,
    calculateNextNotificationTimes
};
