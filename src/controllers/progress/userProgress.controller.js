const UserVideoProgress = require('../../models/progress/UserVideoProgress');
const Video = require('../../models/course/Video');
const { updateCourseProgress } = require('../../services/progress/progressService');

// Throttle progress updates (10 seconds)
const progressUpdateCache = new Map();

/**
 * Update video progress (UPSERT on userId+videoId, throttle to 10sec)
 */
const updateVideoProgress = async (req, res) => {
    try {
        // Support videoId from either params (PUT /video/:videoId) or body (POST /video)
        const videoId = req.params.videoId || req.body.videoId;
        const { lastWatchedSecond, progressPercent } = req.body;
        const userId = req.userId; // From user auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!videoId) {
            return res.status(400).json({
                success: false,
                message: 'videoId is required'
            });
        }

        // Verify video exists
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Throttle: Check if update was made recently (10 seconds)
        const cacheKey = `${userId}:${videoId}`;
        const lastUpdate = progressUpdateCache.get(cacheKey);
        const now = Date.now();

        if (lastUpdate && (now - lastUpdate) < 10000) {
            return res.status(200).json({
                success: true,
                message: 'Progress update throttled (10 second interval)',
                data: { throttled: true }
            });
        }

        // Update cache
        progressUpdateCache.set(cacheKey, now);

        // Get existing progress to check if already completed (for idempotency)
        const existingProgress = await UserVideoProgress.findOne({ userId, videoId });
        const wasAlreadyCompleted = existingProgress && existingProgress.completed;

        // Prepare update data
        const updateData = {
            updatedAt: new Date()
        };

        // 1️⃣ Always update progressPercent if provided
        if (progressPercent !== undefined && progressPercent !== null) {
            updateData.progressPercent = Math.min(100, Math.max(0, progressPercent));
        }

        // 2️⃣ Update resume position ONLY if provided
        if (lastWatchedSecond !== undefined && lastWatchedSecond !== null) {
            updateData.lastWatchedSecond = Math.max(0, lastWatchedSecond);
        }

        // 3️⃣ COMPLETION LOGIC: Mark as completed if progressPercent >= 100
        // Only mark as completed if not already completed (idempotent)
        if (progressPercent !== undefined && progressPercent !== null && progressPercent >= 100) {
            if (!wasAlreadyCompleted) {
                updateData.completed = true;
                updateData.completedAt = new Date();
            }
        }

        // UPSERT progress
        const progress = await UserVideoProgress.findOneAndUpdate(
            { userId, videoId },
            updateData,
            { upsert: true, new: true }
        );

        // 5️⃣ If video just completed, trigger course completion logic
        // Check if video was just completed in this request (not already completed before)
        const justCompleted = progress.completed && !wasAlreadyCompleted;
        
        if (justCompleted) {
            // Trigger course completion logic (non-blocking)
            updateCourseProgress(userId, video.courseId).catch(err => {
                console.error('Error updating course progress after video completion:', err);
            });
        }

        res.status(200).json({
            success: true,
            message: 'Progress updated successfully',
            data: { progress }
        });
    } catch (error) {
        console.error('Update video progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating progress',
            error: error.message
        });
    }
};

/**
 * Get progress for single video
 */
const getVideoProgress = async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.userId; // From user auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const progress = await UserVideoProgress.findOne({ userId, videoId }).lean();

        res.status(200).json({
            success: true,
            message: 'Progress retrieved successfully',
            data: {
                progress: progress || {
                    lastWatchedSecond: 0,
                    completed: false
                }
            }
        });
    } catch (error) {
        console.error('Get video progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving progress',
            error: error.message
        });
    }
};

/**
 * Get progress for multiple videos in playlist
 */
const getMultipleProgress = async (req, res) => {
    try {
        const { playlistId } = req.params;
        const userId = req.userId; // From user auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get all videos in playlist
        const videos = await Video.find({ playlistId }).select('_id').lean();
        const videoIds = videos.map(v => v._id);

        // Get progress for all videos
        const progressList = await UserVideoProgress.find({
            userId,
            videoId: { $in: videoIds }
        }).lean();

        // Create map for quick lookup
        const progressMap = {};
        progressList.forEach(p => {
            progressMap[p.videoId.toString()] = {
                lastWatchedSecond: p.lastWatchedSecond,
                completed: p.completed
            };
        });

        res.status(200).json({
            success: true,
            message: 'Progress retrieved successfully',
            data: { progress: progressMap }
        });
    } catch (error) {
        console.error('Get multiple progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving progress',
            error: error.message
        });
    }
};

/**
 * Mark video as finished
 */
const markVideoComplete = async (req, res) => {
    try {
        const { videoId } = req.params;
        const userId = req.userId; // From user auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify video exists
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Update progress
        const progress = await UserVideoProgress.findOneAndUpdate(
            { userId, videoId },
            {
                completed: true,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        // Update course progress (async - don't wait)
        const { updateCourseProgress } = require('../../services/progress/progressService');
        updateCourseProgress(userId, video.courseId).catch(err => {
            console.error('Error updating course progress:', err);
        });

        res.status(200).json({
            success: true,
            message: 'Video marked as complete',
            data: { progress }
        });
    } catch (error) {
        console.error('Mark video complete error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking video as complete',
            error: error.message
        });
    }
};

module.exports = {
    updateVideoProgress,
    getVideoProgress,
    getMultipleProgress,
    markVideoComplete
};

