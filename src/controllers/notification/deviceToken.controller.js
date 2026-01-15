const DeviceToken = require('../../models/notification/DeviceToken');
const mongoose = require('mongoose');

/**
 * Register device token for push notifications
 * POST /api/notifications/device-token
 */
const registerDeviceToken = async (req, res) => {
    try {
        const { token, platform } = req.body;

        // Validate required fields
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Token is required and must be a non-empty string'
            });
        }

        if (!platform || !['ANDROID', 'IOS', 'WEB'].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: 'Platform is required and must be one of: ANDROID, IOS, WEB'
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

        // Upsert device token
        // If token exists for different user, update it
        // If token exists for same user, update lastUsedAt and ensure isActive
        const tokenData = {
            token: token.trim(),
            platform,
            role,
            isActive: true,
            lastUsedAt: new Date()
        };

        if (role === 'USER') {
            tokenData.userId = recipientId;
        } else {
            tokenData.universityId = recipientId;
        }

        // Find existing token (by token string)
        const existingToken = await DeviceToken.findOne({ token: token.trim() });

        if (existingToken) {
            // Token already exists
            if (existingToken.userId?.toString() === recipientId.toString() || 
                existingToken.universityId?.toString() === recipientId.toString()) {
                // Same user/university - update lastUsedAt and ensure active
                existingToken.isActive = true;
                existingToken.lastUsedAt = new Date();
                existingToken.platform = platform; // Update platform in case it changed
                await existingToken.save();
            } else {
                // Different user/university - deactivate old, create new
                existingToken.isActive = false;
                await existingToken.save();
                
                // Create new token for current user
                await DeviceToken.create(tokenData);
            }
        } else {
            // New token - create it
            await DeviceToken.create(tokenData);
        }

        return res.status(200).json({
            success: true,
            message: 'Device token registered successfully',
            data: {
                platform,
                role
            }
        });

    } catch (error) {
        console.error('Register device token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to register device token',
            error: error.message
        });
    }
};

/**
 * Unregister device token
 * DELETE /api/notifications/device-token/:token
 */
const unregisterDeviceToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
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

        // Find and deactivate token
        const query = {
            token: token.trim(),
            role
        };

        if (role === 'USER') {
            query.userId = recipientId;
        } else {
            query.universityId = recipientId;
        }

        const deviceToken = await DeviceToken.findOne(query);

        if (!deviceToken) {
            return res.status(404).json({
                success: false,
                message: 'Device token not found'
            });
        }

        deviceToken.isActive = false;
        await deviceToken.save();

        return res.status(200).json({
            success: true,
            message: 'Device token unregistered successfully'
        });

    } catch (error) {
        console.error('Unregister device token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to unregister device token',
            error: error.message
        });
    }
};

module.exports = {
    registerDeviceToken,
    unregisterDeviceToken
};
