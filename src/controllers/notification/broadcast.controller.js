const { emitNotification } = require('../../services/notification/notificationEmitter');
const { NOTIFICATION_CATEGORIES } = require('../../constants/notificationCategories');
const User = require('../../models/authorization/User');
const University = require('../../models/auth/University');
const mongoose = require('mongoose');

/**
 * Send broadcast notification
 * POST /api/admin/notifications/broadcast
 * 
 * Sends a notification to all users, all universities, or both.
 * Uses batch processing for scalability.
 */
const sendBroadcast = async (req, res) => {
    try {
        const { title, message, category, scope, payload, priority, channels } = req.body;

        // Validate required fields
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Title is required and must be a non-empty string'
            });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required and must be a non-empty string'
            });
        }

        if (!category || !NOTIFICATION_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: `Category is required and must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`
            });
        }

        if (!scope || !['ALL', 'USERS', 'UNIVERSITIES'].includes(scope)) {
            return res.status(400).json({
                success: false,
                message: 'Scope is required and must be one of: ALL, USERS, UNIVERSITIES'
            });
        }

        // Determine createdBy (SYSTEM or ADMIN)
        const createdBy = req.isSystem ? 'SYSTEM' : 'ADMIN';

        // Determine recipients based on scope
        const recipients = [];
        const batchSize = 500; // Process 500 recipients per batch

        console.log(`📢 Broadcast started`, {
            title,
            category,
            scope,
            createdBy
        });

        // Fetch user IDs if scope includes USERS or ALL
        if (scope === 'USERS' || scope === 'ALL') {
            let userSkip = 0;
            let hasMoreUsers = true;

            while (hasMoreUsers) {
                const users = await User.find({})
                    .select('_id')
                    .skip(userSkip)
                    .limit(batchSize)
                    .lean();

                if (users.length === 0) {
                    hasMoreUsers = false;
                } else {
                    users.forEach(user => {
                        recipients.push({
                            recipientId: user._id,
                            recipientType: 'USER'
                        });
                    });
                    userSkip += batchSize;
                    
                    if (users.length < batchSize) {
                        hasMoreUsers = false;
                    }
                }
            }

            console.log(`📦 Users batch processed: ${recipients.length} users`);
        }

        // Fetch university IDs if scope includes UNIVERSITIES or ALL
        if (scope === 'UNIVERSITIES' || scope === 'ALL') {
            let universitySkip = 0;
            let hasMoreUniversities = true;

            while (hasMoreUniversities) {
                const universities = await University.find({})
                    .select('_id')
                    .skip(universitySkip)
                    .limit(batchSize)
                    .lean();

                if (universities.length === 0) {
                    hasMoreUniversities = false;
                } else {
                    universities.forEach(university => {
                        recipients.push({
                            recipientId: university._id,
                            recipientType: 'UNIVERSITY'
                        });
                    });
                    universitySkip += batchSize;
                    
                    if (universities.length < batchSize) {
                        hasMoreUniversities = false;
                    }
                }
            }

            console.log(`📦 Universities batch processed: ${recipients.length} total recipients`);
        }

        if (recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No recipients found for the specified scope'
            });
        }

        // Process recipients in batches
        let processedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            
            // Process batch in parallel (but limit concurrency)
            const batchPromises = batch.map(async (recipient) => {
                try {
                    // Emit notification with broadcast flags
                    await emitNotification({
                        recipientId: recipient.recipientId,
                        recipientType: recipient.recipientType,
                        category,
                        type: 'BROADCAST', // Special type for broadcasts
                        title: title.trim(),
                        message: message.trim(),
                        payload: payload || {},
                        priority: priority || 'NORMAL',
                        channels: channels || ['IN_APP', 'PUSH'],
                        // Broadcast-specific metadata
                        _broadcast: true,
                        _broadcastScope: scope,
                        _createdBy: createdBy
                    });
                    
                    return { success: true };
                } catch (error) {
                    console.error('Broadcast notification error for recipient:', {
                        recipientId: recipient.recipientId.toString(),
                        recipientType: recipient.recipientType,
                        error: error.message
                    });
                    return { success: false, error: error.message };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                if (result.success) {
                    processedCount++;
                } else {
                    failedCount++;
                }
            });

            console.log(`📦 Batch processed: ${i + batch.length}/${recipients.length}`, {
                processed: processedCount,
                failed: failedCount
            });
        }

        console.log(`✅ Broadcast completed`, {
            totalRecipients: recipients.length,
            processed: processedCount,
            failed: failedCount,
            category,
            scope
        });

        return res.status(200).json({
            success: true,
            message: 'Broadcast notification sent successfully',
            data: {
                totalRecipients: recipients.length,
                processed: processedCount,
                failed: failedCount,
                scope,
                category
            }
        });

    } catch (error) {
        console.error('Broadcast error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send broadcast notification',
            error: error.message
        });
    }
};

module.exports = {
    sendBroadcast
};
