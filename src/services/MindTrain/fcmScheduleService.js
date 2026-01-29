const FCMSchedule = require('../../models/MindTrain/FCMSchedule');
const mongoose = require('mongoose');

/**
 * FCM Schedule Service
 * 
 * Handles FCM notification scheduling logic:
 * - Create/update FCM schedules
 * - Calculate next notification times based on timezone
 * - Manage notification timing
 */

/**
 * Calculate next notification times based on timezone and current time
 * 
 * @param {string} morningTime - Morning notification time (HH:mm format)
 * @param {string} eveningTime - Evening notification time (HH:mm format)
 * @param {string} timezone - Timezone (e.g., 'Asia/Kolkata', 'UTC')
 * @returns {Object} Object with nextMorningNotification and nextEveningNotification dates
 */
const calculateNextNotificationTimes = (morningTime, eveningTime, timezone = 'UTC') => {
    const now = new Date();
    
    // Parse time strings (HH:mm format)
    const [morningHour, morningMin] = morningTime.split(':').map(Number);
    const [eveningHour, eveningMin] = eveningTime.split(':').map(Number);

    // Create dates for today's notifications in the specified timezone
    // Note: This is a simplified calculation. For production, use a library like moment-timezone
    const todayMorning = new Date(now);
    todayMorning.setUTCHours(morningHour, morningMin, 0, 0);
    
    const todayEvening = new Date(now);
    todayEvening.setUTCHours(eveningHour, eveningMin, 0, 0);

    // Calculate next morning notification
    let nextMorning = new Date(todayMorning);
    if (now >= todayMorning) {
        // If morning time has passed today, schedule for tomorrow
        nextMorning.setUTCDate(nextMorning.getUTCDate() + 1);
    }

    // Calculate next evening notification
    let nextEvening = new Date(todayEvening);
    if (now >= todayEvening) {
        // If evening time has passed today, schedule for tomorrow
        nextEvening.setUTCDate(nextEvening.getUTCDate() + 1);
    }

    return {
        nextMorningNotification: nextMorning,
        nextEveningNotification: nextEvening
    };
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
    const { userId, activeProfileId, morningNotificationTime, eveningNotificationTime, timezone } = scheduleData;

    if (!userId || !activeProfileId) {
        throw new Error('userId and activeProfileId are required');
    }

    if (!morningNotificationTime || !eveningNotificationTime) {
        throw new Error('morningNotificationTime and eveningNotificationTime are required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    // Calculate next notification times
    const { nextMorningNotification, nextEveningNotification } = calculateNextNotificationTimes(
        morningNotificationTime,
        eveningNotificationTime,
        timezone || 'UTC'
    );

    // Create or update FCM schedule
    const fcmSchedule = await FCMSchedule.findOneAndUpdate(
        { userId: userIdObjectId },
        {
            $set: {
                activeProfileId: String(activeProfileId).trim(),
                morningNotificationTime: String(morningNotificationTime).trim(),
                eveningNotificationTime: String(eveningNotificationTime).trim(),
                timezone: timezone || 'UTC',
                isEnabled: true,
                nextMorningNotification,
                nextEveningNotification,
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        {
            new: true,
            upsert: true,
            runValidators: true
        }
    );

    return fcmSchedule;
};

/**
 * Get FCM schedule for a user
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} FCM schedule or null
 */
const getFCMSchedule = async (userId) => {
    if (!userId) {
        throw new Error('userId is required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    return await FCMSchedule.findOne({ userId: userIdObjectId }).lean();
};

/**
 * Update FCM schedule last sent time
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} notificationType - 'morning' or 'evening'
 * @returns {Promise<Object>} Updated schedule
 */
const updateLastSentTime = async (userId, notificationType) => {
    if (!userId || !notificationType) {
        throw new Error('userId and notificationType are required');
    }

    if (!['morning', 'evening'].includes(notificationType)) {
        throw new Error('notificationType must be "morning" or "evening"');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    const updateFields = {
        lastSentAt: new Date(),
        updatedAt: new Date()
    };

    // Recalculate next notification time for the sent notification
    const schedule = await FCMSchedule.findOne({ userId: userIdObjectId });
    if (schedule) {
        const { nextMorningNotification, nextEveningNotification } = calculateNextNotificationTimes(
            schedule.morningNotificationTime,
            schedule.eveningNotificationTime,
            schedule.timezone
        );

        if (notificationType === 'morning') {
            updateFields.nextMorningNotification = nextMorningNotification;
        } else {
            updateFields.nextEveningNotification = nextEveningNotification;
        }
    }

    return await FCMSchedule.findOneAndUpdate(
        { userId: userIdObjectId },
        { $set: updateFields },
        { new: true, runValidators: true }
    );
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
    if (!['morning', 'evening'].includes(notificationType)) {
        throw new Error('notificationType must be "morning" or "evening"');
    }

    const windowStart = new Date(currentTime);
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    const windowEnd = new Date(currentTime);
    windowEnd.setMinutes(windowEnd.getMinutes() + windowMinutes);

    const fieldName = notificationType === 'morning' 
        ? 'nextMorningNotification' 
        : 'nextEveningNotification';

    return await FCMSchedule.find({
        isEnabled: true,
        [fieldName]: {
            $gte: windowStart,
            $lte: windowEnd
        }
    }).lean();
};

module.exports = {
    createOrUpdateFCMSchedule,
    getFCMSchedule,
    updateLastSentTime,
    getSchedulesForNotification,
    calculateNextNotificationTimes
};

