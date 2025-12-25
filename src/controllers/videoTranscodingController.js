const videoTranscodingQueue = require('../services/videoTranscodingQueue');
const VideoTranscodingJob = require('../models/VideoTranscodingJob');
const { protect } = require('../middleware/auth');

/**
 * Get transcoding job status
 * GET /api/video-transcoding/status/:jobId
 */
const getJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!jobId) {
            return res.status(400).json({
                success: false,
                message: 'Job ID is required'
            });
        }

        const jobStatus = await videoTranscodingQueue.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if user owns this job (optional security check)
        if (req.user && jobStatus.userId !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this job'
            });
        }

        res.json({
            success: true,
            data: jobStatus
        });
    } catch (error) {
        console.error('Get job status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get job status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get all transcoding jobs for current user
 * GET /api/video-transcoding/jobs
 */
const getMyJobs = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 20, page = 1 } = req.query;

        const query = { userId };
        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const jobs = await VideoTranscodingJob.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('-__v');

        const total = await VideoTranscodingJob.countDocuments(query);

        res.json({
            success: true,
            data: {
                jobs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get my jobs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get jobs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get queue statistics
 * GET /api/video-transcoding/stats
 */
const getQueueStats = async (req, res) => {
    try {
        const stats = videoTranscodingQueue.getStats();

        // Get job counts from database
        const jobCounts = await VideoTranscodingJob.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusCounts = {};
        jobCounts.forEach(item => {
            statusCounts[item._id] = item.count;
        });

        res.json({
            success: true,
            data: {
                queue: stats,
                jobCounts: statusCounts
            }
        });
    } catch (error) {
        console.error('Get queue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get queue stats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getJobStatus,
    getMyJobs,
    getQueueStats
};

