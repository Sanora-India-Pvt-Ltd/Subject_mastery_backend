const Notification = require('../../models/notification/Notification');
const mongoose = require('mongoose');

/**
 * Get user's notifications (paginated)
 * GET /api/notifications
 * 
 * Query params:
 * - page (default: 1)
 * - limit (default: 20, max: 50)
 * - unreadOnly (boolean, optional)
 */
const getMyNotifications = async (req, res) => {
    try {
        // Detect recipient from flexibleAuth
        let recipientId, recipientType;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            recipientType = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            recipientType = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Parse query parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === true;

        // Build query
        const query = {
            recipientId,
            recipientType
        };

        // Add unread filter if requested
        if (unreadOnly) {
            query.isRead = false;
        }

        // Fetch notifications (using compound index for performance)
        const [notifications, totalCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query)
        ]);

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return res.status(200).json({
            success: true,
            message: 'Notifications retrieved successfully',
            data: {
                notifications,
                pagination: {
                    currentPage: page,
                    limit,
                    totalCount,
                    totalPages,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve notifications',
            error: error.message
        });
    }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
    try {
        // Detect recipient from flexibleAuth
        let recipientId, recipientType;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            recipientType = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            recipientType = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Count unread notifications (using compound index)
        const unreadCount = await Notification.countDocuments({
            recipientId,
            recipientType,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            message: 'Unread count retrieved successfully',
            data: {
                unreadCount
            }
        });

    } catch (error) {
        console.error('Get unread count error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve unread count',
            error: error.message
        });
    }
};

/**
 * Mark a single notification as read
 * POST /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate notification ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
        }

        // Detect recipient from flexibleAuth
        let recipientId, recipientType;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            recipientType = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            recipientType = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Find notification and verify ownership
        const notification = await Notification.findOne({
            _id: id,
            recipientId,
            recipientType
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Mark as read (idempotent - already read is still success)
        if (!notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: {
                notification: {
                    _id: notification._id,
                    isRead: notification.isRead,
                    readAt: notification.readAt
                }
            }
        });

    } catch (error) {
        console.error('Mark as read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
};

/**
 * Mark all notifications as read
 * POST /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
    try {
        // Detect recipient from flexibleAuth
        let recipientId, recipientType;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            recipientType = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            recipientType = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Update all unread notifications
        const result = await Notification.updateMany(
            {
                recipientId,
                recipientType,
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            data: {
                updatedCount: result.modifiedCount
            }
        });

    } catch (error) {
        console.error('Mark all as read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: error.message
        });
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};
