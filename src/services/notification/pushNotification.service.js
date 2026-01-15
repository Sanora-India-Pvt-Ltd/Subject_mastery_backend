const DeviceToken = require('../../models/notification/DeviceToken');
const { getMessaging } = require('../../config/firebase');
const mongoose = require('mongoose');

/**
 * Push Notification Service
 * 
 * Handles sending push notifications via FCM (Firebase Cloud Messaging).
 * Supports Android, Web Push, and iOS (via APNs bridge).
 * 
 * Design Principles:
 * - Fail-safe: Never throws errors
 * - Silent failures: Logs errors but doesn't break flow
 * - Token management: Automatically deactivates invalid tokens
 * - Multicast: Sends to multiple devices efficiently
 */

/**
 * Send push notification to a recipient
 * 
 * @param {Object} params
 * @param {ObjectId} params.recipientId - User or University ID
 * @param {String} params.recipientType - 'USER' | 'UNIVERSITY'
 * @param {String} params.title - Notification title
 * @param {String} params.body - Notification message/body
 * @param {Object} params.data - Additional data payload
 * 
 * @returns {Promise<Object>} Result with sent count and failed tokens
 */
const sendPushNotification = async ({ recipientId, recipientType, title, body, data = {} }) => {
    try {
        // Get FCM messaging instance
        const messaging = getMessaging();
        
        if (!messaging) {
            // Firebase not configured - silently skip
            return {
                success: false,
                reason: 'Firebase not configured',
                sentCount: 0,
                failedTokens: []
            };
        }

        // Validate recipient
        if (!recipientId || !recipientType) {
            console.warn('⚠️  Push notification skipped: Missing recipient info');
            return {
                success: false,
                reason: 'Missing recipient info',
                sentCount: 0,
                failedTokens: []
            };
        }

        // Fetch active device tokens for recipient
        const query = {
            role: recipientType,
            isActive: true
        };

        if (recipientType === 'USER') {
            query.userId = recipientId;
        } else {
            query.universityId = recipientId;
        }

        const deviceTokens = await DeviceToken.find(query).select('token platform').lean();

        if (!deviceTokens || deviceTokens.length === 0) {
            // No active tokens - silently skip
            return {
                success: true,
                reason: 'No active device tokens',
                sentCount: 0,
                failedTokens: []
            };
        }

        // Extract tokens
        const tokens = deviceTokens.map(dt => dt.token);

        // Prepare FCM message
        const message = {
            notification: {
                title: title,
                body: body
            },
            data: {
                // Convert all data values to strings (FCM requirement)
                notificationId: data.notificationId?.toString() || '',
                category: data.category || '',
                type: data.type || '',
                ...Object.keys(data).reduce((acc, key) => {
                    if (key !== 'notificationId' && key !== 'category' && key !== 'type') {
                        acc[key] = typeof data[key] === 'object' 
                            ? JSON.stringify(data[key]) 
                            : String(data[key] || '');
                    }
                    return acc;
                }, {})
            },
            // Android-specific options
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default'
                }
            },
            // iOS-specific options (APNs)
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            },
            // Web push options
            webpush: {
                notification: {
                    icon: '/icon-192x192.png', // Update with your icon path
                    badge: '/badge-72x72.png' // Update with your badge path
                }
            }
        };

        // Send multicast message
        const response = await messaging.sendEachForMulticast({
            tokens,
            ...message
        });

        // Process results
        const sentCount = response.successCount;
        const failedCount = response.failureCount;
        const failedTokens = [];

        // Handle failed tokens
        if (response.responses) {
            response.responses.forEach((result, index) => {
                if (!result.success) {
                    const token = tokens[index];
                    failedTokens.push({
                        token,
                        error: result.error?.code || 'unknown'
                    });

                    // Deactivate invalid tokens
                    // Common error codes that indicate invalid tokens:
                    const invalidTokenErrors = [
                        'messaging/invalid-registration-token',
                        'messaging/registration-token-not-registered',
                        'messaging/invalid-argument'
                    ];

                    if (result.error && invalidTokenErrors.includes(result.error.code)) {
                        DeviceToken.updateOne(
                            { token },
                            { isActive: false }
                        ).catch(err => {
                            console.error('Failed to deactivate invalid token:', err);
                        });
                        
                        console.log(`🧹 Token invalidated: ${token.substring(0, 20)}...`);
                    }
                } else {
                    // Update lastUsedAt for successful sends
                    DeviceToken.updateOne(
                        { token: tokens[index] },
                        { lastUsedAt: new Date() }
                    ).catch(err => {
                        // Silent fail - not critical
                    });
                }
            });
        }

        // Log results
        if (sentCount > 0) {
            console.log(`📲 Push notification sent`, {
                recipientType,
                recipientId: recipientId.toString(),
                sentCount,
                failedCount,
                totalTokens: tokens.length
            });
        }

        if (failedCount > 0) {
            console.warn(`⚠️  Push notification partial failure`, {
                recipientType,
                recipientId: recipientId.toString(),
                sentCount,
                failedCount,
                failedTokens: failedTokens.length
            });
        }

        return {
            success: sentCount > 0,
            sentCount,
            failedCount,
            failedTokens: failedTokens.map(ft => ft.token),
            totalTokens: tokens.length
        };

    } catch (error) {
        // Never throw - log and return failure
        console.error('❌ Push notification error (silently handled):', {
            error: error.message,
            recipientType,
            recipientId: recipientId?.toString()
        });

        return {
            success: false,
            reason: error.message,
            sentCount: 0,
            failedTokens: []
        };
    }
};

module.exports = {
    sendPushNotification
};
