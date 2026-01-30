const AlarmProfile = require('../../models/MindTrain/AlarmProfile');
const mongoose = require('mongoose');
const { getMindTrainConnection } = require('../../config/dbMindTrain');

/**
 * Alarm Profile Service
 * 
 * Handles business logic for alarm profile operations:
 * - Create/update alarm profiles
 * - Deactivate other profiles when one becomes active
 * - Sync status tracking
 * 
 * NOTE: Uses MindTrain database connection for all operations
 */

/**
 * Create or update an alarm profile
 * If isActive is true, deactivates all other profiles for the user
 * 
 * @param {Object} profileData - Alarm profile data
 * @param {string|ObjectId} profileData.userId - User ID
 * @param {string} profileData.id - Profile ID
 * @returns {Promise<Object>} Created/updated profile and list of deactivated profiles
 */
const createOrUpdateAlarmProfile = async (profileData) => {
    // Get MindTrain connection for transaction
    const mindTrainConnection = getMindTrainConnection();
    if (!mindTrainConnection) {
        throw new Error('MindTrain database connection not initialized');
    }
    
    const session = await mindTrainConnection.startSession();
    session.startTransaction();

    try {
        const { userId, id, isActive, ...otherFields } = profileData;

        // Validate userId
        if (!userId) {
            throw new Error('userId is required');
        }

        // Validate id
        if (!id) {
            throw new Error('id is required');
        }

        // Convert userId to ObjectId if needed
        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        // Prepare update data
        const updateData = {
            ...otherFields,
            userId: userIdObjectId,
            id: String(id).trim(),
            updatedAt: new Date()
        };

        // If this profile is being set as active, deactivate all others
        let deactivatedProfiles = [];
        if (isActive === true) {
            // Deactivate all other profiles for this user
            const deactivateResult = await AlarmProfile.updateMany(
                {
                    userId: userIdObjectId,
                    id: { $ne: String(id).trim() },
                    isActive: true
                },
                {
                    $set: {
                        isActive: false,
                        updatedAt: new Date()
                    }
                },
                { session }
            );

            // Fetch deactivated profiles for response
            if (deactivateResult.modifiedCount > 0) {
                deactivatedProfiles = await AlarmProfile.find({
                    userId: userIdObjectId,
                    id: { $ne: String(id).trim() },
                    isActive: false
                })
                .select('id title isActive _id')
                .lean()
                .session(session);
            }
        }

        // Set isActive in update data
        updateData.isActive = isActive === true;

        // Create or update the profile (upsert)
        const profile = await AlarmProfile.findOneAndUpdate(
            {
                userId: userIdObjectId,
                id: String(id).trim()
            },
            {
                $set: updateData,
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                session
            }
        );

        await session.commitTransaction();
        session.endSession();

        return {
            profile,
            deactivatedProfiles,
            deactivatedCount: deactivatedProfiles.length
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

/**
 * Get all alarm profiles for a user, separated by active/inactive status
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Object with activeProfiles and inactiveProfiles arrays
 */
const getUserAlarmProfiles = async (userId) => {
    if (!userId) {
        throw new Error('userId is required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    const profiles = await AlarmProfile.find({ userId: userIdObjectId })
        .sort({ createdAt: -1 })
        .lean();

    const activeProfiles = profiles.filter(p => p.isActive === true);
    const inactiveProfiles = profiles.filter(p => p.isActive === false);

    return {
        activeProfiles,
        inactiveProfiles,
        totalActive: activeProfiles.length,
        totalInactive: inactiveProfiles.length,
        totalProfiles: profiles.length
    };
};

/**
 * Get active alarm profile for a user
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Active alarm profile or null
 */
const getActiveAlarmProfile = async (userId) => {
    if (!userId) {
        throw new Error('userId is required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    return await AlarmProfile.findOne({
        userId: userIdObjectId,
        isActive: true
    }).lean();
};

/**
 * Update sync metadata for an alarm profile
 * 
 * @param {string|ObjectId} userId - User ID
 * @param {string} profileId - Profile ID
 * @param {Object} syncData - Sync metadata
 * @returns {Promise<Object>} Updated profile
 */
const updateSyncMetadata = async (userId, profileId, syncData) => {
    if (!userId || !profileId) {
        throw new Error('userId and profileId are required');
    }

    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

    const updateFields = {
        updatedAt: new Date()
    };

    if (syncData.lastSyncTimestamp !== undefined) {
        updateFields.lastSyncTimestamp = syncData.lastSyncTimestamp;
    }
    if (syncData.lastSyncSource !== undefined) {
        updateFields.lastSyncSource = syncData.lastSyncSource;
    }
    if (syncData.syncHealthScore !== undefined) {
        updateFields.syncHealthScore = syncData.syncHealthScore;
    }
    if (syncData.lastSyncStatus !== undefined) {
        updateFields.lastSyncStatus = syncData.lastSyncStatus;
    }
    if (syncData.nextSyncCheckTime !== undefined) {
        updateFields.nextSyncCheckTime = syncData.nextSyncCheckTime;
    }

    return await AlarmProfile.findOneAndUpdate(
        {
            userId: userIdObjectId,
            id: String(profileId).trim()
        },
        { $set: updateFields },
        { new: true, runValidators: true }
    );
};

module.exports = {
    createOrUpdateAlarmProfile,
    getUserAlarmProfiles,
    getActiveAlarmProfile,
    updateSyncMetadata
};

