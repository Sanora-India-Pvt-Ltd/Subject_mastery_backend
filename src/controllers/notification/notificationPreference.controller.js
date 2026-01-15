const NotificationPreference = require('../../models/notification/NotificationPreference');
const { NOTIFICATION_CATEGORIES } = require('../../constants/notificationCategories');

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
const getPreferences = async (req, res) => {
    try {
        // Detect recipient from flexibleAuth
        let recipientId, role;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            role = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            role = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Build query
        const query = { role };
        if (role === 'USER') {
            query.userId = recipientId;
        } else {
            query.universityId = recipientId;
        }

        // Fetch all preferences
        const preferences = await NotificationPreference.find(query).lean();

        // Build response: preferences grouped by category
        const preferencesByCategory = {};
        
        // Initialize all categories with defaults
        NOTIFICATION_CATEGORIES.forEach(category => {
            preferencesByCategory[category] = {
                muted: false,
                channels: {
                    inApp: true,
                    push: true
                }
            };
        });

        // Override with user preferences
        preferences.forEach(pref => {
            preferencesByCategory[pref.category] = {
                muted: pref.muted,
                channels: {
                    inApp: pref.channels.inApp,
                    push: pref.channels.push
                }
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Preferences retrieved successfully',
            data: {
                preferences: preferencesByCategory
            }
        });

    } catch (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve preferences',
            error: error.message
        });
    }
};

/**
 * Update notification preference for a category
 * PUT /api/notifications/preferences
 */
const updatePreference = async (req, res) => {
    try {
        const { category, muted, channels } = req.body;

        // Validate category
        if (!category || !NOTIFICATION_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: `Category is required and must be one of: ${NOTIFICATION_CATEGORIES.join(', ')}`
            });
        }

        // Detect recipient from flexibleAuth
        let recipientId, role;
        
        if (req.user && req.userId) {
            recipientId = req.userId;
            role = 'USER';
        } else if (req.universityId) {
            recipientId = req.universityId;
            role = 'UNIVERSITY';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Validate channels if provided
        if (channels !== undefined) {
            if (typeof channels !== 'object' || channels === null) {
                return res.status(400).json({
                    success: false,
                    message: 'channels must be an object'
                });
            }
            if (channels.inApp !== undefined && typeof channels.inApp !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'channels.inApp must be a boolean'
                });
            }
            if (channels.push !== undefined && typeof channels.push !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'channels.push must be a boolean'
                });
            }
        }

        // Validate muted if provided
        if (muted !== undefined && typeof muted !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'muted must be a boolean'
            });
        }

        // Build preference data
        const preferenceData = {
            role,
            category
        };

        if (role === 'USER') {
            preferenceData.userId = recipientId;
        } else {
            preferenceData.universityId = recipientId;
        }

        // Set channels (merge with defaults if partial update)
        if (channels !== undefined) {
            preferenceData.channels = {
                inApp: channels.inApp !== undefined ? channels.inApp : true,
                push: channels.push !== undefined ? channels.push : true
            };
        } else {
            // Default channels if not provided
            preferenceData.channels = {
                inApp: true,
                push: true
            };
        }

        // Set muted
        preferenceData.muted = muted !== undefined ? muted : false;

        // Upsert preference
        const preference = await NotificationPreference.findOneAndUpdate(
            {
                role,
                category,
                ...(role === 'USER' ? { userId: recipientId } : { universityId: recipientId })
            },
            preferenceData,
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Preference updated successfully',
            data: {
                preference: {
                    category: preference.category,
                    muted: preference.muted,
                    channels: preference.channels
                }
            }
        });

    } catch (error) {
        console.error('Update preference error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update preference',
            error: error.message
        });
    }
};

module.exports = {
    getPreferences,
    updatePreference
};
