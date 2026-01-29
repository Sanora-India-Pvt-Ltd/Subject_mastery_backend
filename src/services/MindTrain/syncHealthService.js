const SyncHealthLog = require('../../models/MindTrain/SyncHealthLog');
const AlarmProfile = require('../../models/MindTrain/AlarmProfile');
const mongoose = require('mongoose');

/**
 * Sync Health Service
 * 
 * Handles sync health tracking and analysis:
 * - Record sync health logs
 * - Calculate health scores
 * - Detect sync patterns and issues
 * - Generate recommendations
 */

/**
 * Calculate health score based on sync metrics
 * 
 * @param {Object} metrics - Sync metrics
 * @param {Date} metrics.lastWorkManagerCheck - Last WorkManager check time
 * @param {string} metrics.workManagerStatus - WorkManager status
 * @param {Date} metrics.lastFCMReceived - Last FCM received time
 * @param {string} metrics.fcmStatus - FCM status
 * @param {number} metrics.missedAlarmsCount - Number of missed alarms
 * @param {boolean} metrics.dozeMode - Device in doze mode
 * @param {string} metrics.networkConnectivity - Network connectivity status
 * @returns {number} Health score (0-100)
 */
const calculateHealthScore = (metrics) => {
    let score = 100; // Base score

    const {
        workManagerStatus,
        fcmStatus,
        missedAlarmsCount = 0,
        dozeMode = false,
        networkConnectivity
    } = metrics;

    // WorkManager status penalties
    if (workManagerStatus === 'failed') {
        score -= 15;
    } else if (workManagerStatus === 'timeout') {
        score -= 10;
    } else if (workManagerStatus === 'cancelled') {
        score -= 5;
    }

    // FCM status penalties
    if (fcmStatus === 'failed') {
        score -= 20;
    } else if (fcmStatus === 'not_received') {
        score -= 15;
    } else if (fcmStatus === 'pending') {
        score -= 5;
    }

    // Missed alarms penalty (10 points per missed alarm, max 30 points)
    const missedAlarmsPenalty = Math.min(missedAlarmsCount * 10, 30);
    score -= missedAlarmsPenalty;

    // Device state penalties
    if (dozeMode) {
        score -= 5;
    }

    if (networkConnectivity === 'none') {
        score -= 5;
    } else if (networkConnectivity === 'mobile') {
        score -= 2;
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Get health status label based on score
 * 
 * @param {number} score - Health score
 * @returns {string} Status label
 */
const getHealthStatus = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
};

/**
 * Generate recommendations based on sync health
 * 
 * @param {Object} healthData - Health data including score and metrics
 * @returns {Array<string>} Array of recommendation messages
 */
const generateRecommendations = (healthData) => {
    const recommendations = [];
    const { score, workManagerStatus, fcmStatus, missedAlarmsCount, dozeMode } = healthData;

    if (score < 70) {
        recommendations.push('Sync health is below optimal. Please check your device settings.');
    }

    if (workManagerStatus === 'failed' || workManagerStatus === 'timeout') {
        recommendations.push('WorkManager is experiencing issues. FCM notifications will be used as fallback.');
    }

    if (fcmStatus === 'failed' || fcmStatus === 'not_received') {
        recommendations.push('FCM notifications are not being received. Please check your internet connection.');
    }

    if (missedAlarmsCount > 0) {
        recommendations.push(`${missedAlarmsCount} alarm(s) were missed. Consider checking device battery optimization settings.`);
    }

    if (dozeMode) {
        recommendations.push('Device is in doze mode. This may affect alarm reliability.');
    }

    return recommendations;
};

/**
 * Record sync health log
 * 
 * @param {Object} healthData - Health data
 * @param {string|ObjectId} healthData.userId - User ID
 * @param {string} healthData.deviceId - Device ID
 * @param {Object} healthData.deviceState - Device state
 * @param {Object} healthData.syncMetrics - Sync metrics
 * @returns {Promise<Object>} Created sync health log
 */
const recordSyncHealth = async (healthData) => {
    const { userId, deviceId, deviceState = {}, syncMetrics = {} } = healthData;

    if (!userId || !deviceId) {
        throw new Error('userId and deviceId are required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    // Calculate health score
    const healthScore = calculateHealthScore({
        workManagerStatus: syncMetrics.lastWorkManagerStatus,
        fcmStatus: syncMetrics.lastFCMStatus,
        missedAlarmsCount: syncMetrics.missedAlarmsCount || 0,
        dozeMode: deviceState.dozeMode || false,
        networkConnectivity: deviceState.networkConnectivity
    });

    // Prepare sync health log data
    const logData = {
        userId: userIdObjectId,
        deviceId: String(deviceId).trim(),
        reportedAt: new Date(),
        lastWorkManagerCheck: syncMetrics.lastWorkManagerCheck 
            ? new Date(syncMetrics.lastWorkManagerCheck) 
            : null,
        workManagerStatus: syncMetrics.lastWorkManagerStatus || 'not_ran',
        lastFCMReceived: syncMetrics.lastFCMReceived 
            ? new Date(syncMetrics.lastFCMReceived) 
            : null,
        fcmStatus: syncMetrics.lastFCMStatus || 'not_received',
        missedAlarmsCount: syncMetrics.missedAlarmsCount || 0,
        missedAlarmsReason: syncMetrics.missedAlarmsReason || null,
        dozeMode: deviceState.dozeMode || false,
        batteryLevel: deviceState.batteryLevel || null,
        networkConnectivity: deviceState.networkConnectivity || null,
        healthScore,
        appVersion: deviceState.appVersion || null,
        osVersion: deviceState.osVersion || null,
        notes: deviceState.notes || null
    };

    const syncHealthLog = await SyncHealthLog.create(logData);

    // Update alarm profile sync health score if active profile exists
    const activeProfile = await AlarmProfile.findOne({
        userId: userIdObjectId,
        isActive: true
    });

    if (activeProfile) {
        await AlarmProfile.findByIdAndUpdate(
            activeProfile._id,
            {
                $set: {
                    syncHealthScore: healthScore,
                    lastSyncStatus: healthScore >= 70 ? 'success' : 'failed',
                    updatedAt: new Date()
                }
            }
        );
    }

    return {
        log: syncHealthLog,
        healthScore,
        status: getHealthStatus(healthScore),
        recommendations: generateRecommendations({
            score: healthScore,
            workManagerStatus: syncMetrics.lastWorkManagerStatus,
            fcmStatus: syncMetrics.lastFCMStatus,
            missedAlarmsCount: syncMetrics.missedAlarmsCount || 0,
            dozeMode: deviceState.dozeMode || false
        })
    };
};

/**
 * Get recent sync health logs for a user
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {number} limit - Number of logs to retrieve (default: 10)
 * @returns {Promise<Array>} Array of sync health logs
 */
const getRecentSyncHealthLogs = async (userId, limit = 10) => {
    if (!userId) {
        throw new Error('userId is required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    return await SyncHealthLog.find({ userId: userIdObjectId })
        .sort({ reportedAt: -1 })
        .limit(limit)
        .lean();
};

/**
 * Detect sync patterns and issues
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Pattern analysis results
 */
const detectSyncPatterns = async (userId) => {
    if (!userId) {
        throw new Error('userId is required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    // Get last 7 days of health logs
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLogs = await SyncHealthLog.find({
        userId: userIdObjectId,
        reportedAt: { $gte: sevenDaysAgo }
    })
        .sort({ reportedAt: -1 })
        .lean();

    if (recentLogs.length === 0) {
        return {
            pattern: 'insufficient_data',
            issues: [],
            recommendations: []
        };
    }

    // Analyze patterns
    const workManagerFailures = recentLogs.filter(
        log => log.workManagerStatus === 'failed' || log.workManagerStatus === 'timeout'
    ).length;

    const fcmFailures = recentLogs.filter(
        log => log.fcmStatus === 'failed' || log.fcmStatus === 'not_received'
    ).length;

    const bothFailing = recentLogs.filter(
        log => (log.workManagerStatus === 'failed' || log.workManagerStatus === 'timeout') &&
               (log.fcmStatus === 'failed' || log.fcmStatus === 'not_received')
    ).length;

    const issues = [];
    const recommendations = [];

    if (workManagerFailures >= 3) {
        issues.push('WorkManager consistently failing');
        recommendations.push('Consider increasing FCM notification frequency');
    }

    if (fcmFailures >= 2) {
        issues.push('FCM notifications not being delivered');
        recommendations.push('Check device FCM token and network connectivity');
    }

    if (bothFailing > 0) {
        issues.push('Both sync mechanisms failing');
        recommendations.push('URGENT: User sync is completely failing - manual intervention required');
    }

    return {
        pattern: issues.length > 0 ? 'degraded' : 'healthy',
        issues,
        recommendations,
        stats: {
            totalLogs: recentLogs.length,
            workManagerFailures,
            fcmFailures,
            bothFailing
        }
    };
};

module.exports = {
    recordSyncHealth,
    calculateHealthScore,
    getHealthStatus,
    generateRecommendations,
    getRecentSyncHealthLogs,
    detectSyncPatterns
};

