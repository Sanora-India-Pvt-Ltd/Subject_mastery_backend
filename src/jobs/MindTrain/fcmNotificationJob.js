const cron = require('node-cron');
const fcmScheduleService = require('../../services/MindTrain/fcmScheduleService');
const { sendMindTrainNotification } = require('../../services/MindTrain/mindTrainNotification.service');

/**
 * FCM Notification Cron Job
 * 
 * Runs every 5 minutes to check for users due to receive notifications.
 * Uses hybrid delivery: WebSocket first (real-time), FCM fallback (reliable).
 * 
 * Schedule: */5 * * * * (every 5 minutes)
 */

let job = null;
let isRunning = false;

/**
 * Check and send notifications for a specific type (morning or evening)
 */
const processNotifications = async (notificationType) => {
    try {
        const currentTime = new Date();
        console.log(`[FCMJob] Checking ${notificationType} notifications at ${currentTime.toISOString()}`);

        // Get schedules due for notification (15-minute window)
        const schedules = await fcmScheduleService.getSchedulesForNotification(
            notificationType,
            currentTime,
            15 // 15-minute window
        );

        console.log(`[FCMJob] Found ${schedules.length} schedules due for ${notificationType} notifications`);

        if (schedules.length === 0) {
            return {
                processed: 0,
                sent: 0,
                failed: 0
            };
        }

        let sentCount = 0;
        let failedCount = 0;

        // Process each schedule
        for (const schedule of schedules) {
            try {
                const result = await sendMindTrainNotification({
                    userId: schedule.userId,
                    profileId: schedule.activeProfileId,
                    notificationType: notificationType,
                    scheduleId: schedule._id?.toString()
                });

                if (result.success) {
                    sentCount++;
                    
                    // Update schedule last sent time
                    await fcmScheduleService.updateLastSentTime(
                        schedule.userId,
                        notificationType
                    );

                    console.log(`[FCMJob] ✅ ${notificationType} notification sent to user ${schedule.userId} via ${result.deliveryMethod}`);
                } else {
                    failedCount++;
                    console.warn(`[FCMJob] ⚠️ Failed to send ${notificationType} notification to user ${schedule.userId}: ${result.message || result.reason}`);
                }

            } catch (error) {
                failedCount++;
                console.error(`[FCMJob] Error processing ${notificationType} notification for user ${schedule.userId}:`, error.message);
            }
        }

        return {
            processed: schedules.length,
            sent: sentCount,
            failed: failedCount
        };

    } catch (error) {
        console.error(`[FCMJob] Error processing ${notificationType} notifications:`, error);
        return {
            processed: 0,
            sent: 0,
            failed: 0,
            error: error.message
        };
    }
};

/**
 * Main job function - runs every 5 minutes
 */
const runJob = async () => {
    // Prevent concurrent executions
    if (isRunning) {
        console.log('[FCMJob] ⏭️  Job already running, skipping this execution');
        return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
        console.log('[FCMJob] 🚀 Starting FCM notification check');

        // Process morning and evening notifications in parallel
        const [morningResult, eveningResult] = await Promise.all([
            processNotifications('morning'),
            processNotifications('evening')
        ]);

        const totalProcessed = morningResult.processed + eveningResult.processed;
        const totalSent = morningResult.sent + eveningResult.sent;
        const totalFailed = morningResult.failed + eveningResult.failed;
        const duration = Date.now() - startTime;

        console.log(`[FCMJob] ✅ Complete in ${duration}ms:`);
        console.log(`  - Processed: ${totalProcessed} schedules`);
        console.log(`  - Sent: ${totalSent} notifications`);
        console.log(`  - Failed: ${totalFailed} notifications`);

    } catch (error) {
        console.error('[FCMJob] ❌ Job execution error:', error);
    } finally {
        isRunning = false;
    }
};

/**
 * Start the cron job
 */
const start = () => {
    if (job) {
        console.log('[FCMJob] ⚠️  Job already started');
        return;
    }

    // Run every 5 minutes: */5 * * * *
    job = cron.schedule('*/5 * * * *', runJob, {
        scheduled: true,
        timezone: 'UTC'
    });

    console.log('[FCMJob] ✅ Started (runs every 5 minutes)');
    
    // Run immediately on start (optional - for testing)
    // Uncomment if you want to run immediately on server start:
    // runJob();
};

/**
 * Stop the cron job
 */
const stop = () => {
    if (job) {
        job.stop();
        job = null;
        console.log('[FCMJob] ⏹️  Stopped');
    }
};

/**
 * Get job status
 */
const getStatus = () => {
    return {
        isRunning: isRunning,
        isScheduled: job !== null,
        schedule: '*/5 * * * * (every 5 minutes)'
    };
};

module.exports = {
    start,
    stop,
    getStatus,
    runJob // Export for manual testing
};

