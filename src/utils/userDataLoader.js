/**
 * User Data Loader - Batch user data fetching to prevent N+1 queries
 * 
 * This utility batches multiple user lookups into single queries
 * to improve performance and reduce database load.
 */

const User = require('../models/authorization/User');
const mongoose = require('mongoose');

// Cache for user data (in-memory, short TTL)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Batch fetch user data by IDs
 * @param {Array<string|ObjectId>} userIds - Array of user IDs
 * @param {string} select - Fields to select (default: basic profile fields)
 * @returns {Promise<Map>} - Map of userId -> user data
 */
const batchGetUsers = async (userIds, select = 'profile.name profile.profileImage profile.visibility social.friends social.blockedUsers') => {
    if (!userIds || userIds.length === 0) {
        return new Map();
    }

    // Normalize and deduplicate IDs
    const uniqueIds = [...new Set(userIds.map(id => id.toString()))];
    const objectIds = uniqueIds.map(id => new mongoose.Types.ObjectId(id));

    // Check cache first
    const cached = new Map();
    const uncachedIds = [];
    
    for (const id of uniqueIds) {
        const cachedData = userCache.get(id);
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
            cached.set(id, cachedData.data);
        } else {
            uncachedIds.push(id);
        }
    }

    // Fetch uncached users in a single query
    if (uncachedIds.length > 0) {
        const uncachedObjectIds = uncachedIds.map(id => new mongoose.Types.ObjectId(id));
        const users = await User.find({
            _id: { $in: uncachedObjectIds }
        }).select(select).lean();

        // Store in cache and result map
        for (const user of users) {
            const userId = user._id.toString();
            cached.set(userId, user);
            userCache.set(userId, {
                data: user,
                timestamp: Date.now()
            });
        }
    }

    return cached;
};

/**
 * Batch fetch blocked users for multiple users
 * @param {Array<string|ObjectId>} userIds - Array of user IDs
 * @returns {Promise<Map>} - Map of userId -> array of blocked user IDs
 */
const batchGetBlockedUsers = async (userIds) => {
    if (!userIds || userIds.length === 0) {
        return new Map();
    }

    const uniqueIds = [...new Set(userIds.map(id => id.toString()))];
    const objectIds = uniqueIds.map(id => new mongoose.Types.ObjectId(id));

    const users = await User.find({
        _id: { $in: objectIds }
    }).select('social.blockedUsers').lean();

    const blockedMap = new Map();
    for (const user of users) {
        const userId = user._id.toString();
        const blockedUsers = user.social?.blockedUsers || [];
        blockedMap.set(userId, blockedUsers.map(id => id.toString()));
    }

    return blockedMap;
};

/**
 * Batch check if users are friends
 * @param {Array<{userId1: string, userId2: string}>} pairs - Array of user ID pairs
 * @returns {Promise<Map>} - Map of "userId1_userId2" -> boolean
 */
const batchCheckFriendships = async (pairs) => {
    if (!pairs || pairs.length === 0) {
        return new Map();
    }

    // Get all unique user IDs
    const allUserIds = new Set();
    pairs.forEach(pair => {
        allUserIds.add(pair.userId1.toString());
        allUserIds.add(pair.userId2.toString());
    });

    // Fetch all users with their friends lists
    const users = await User.find({
        _id: { $in: Array.from(allUserIds).map(id => new mongoose.Types.ObjectId(id)) }
    }).select('social.friends').lean();

    // Create a map of userId -> friends array
    const friendsMap = new Map();
    for (const user of users) {
        const userId = user._id.toString();
        const friends = (user.social?.friends || []).map(id => id.toString());
        friendsMap.set(userId, friends);
    }

    // Check each pair
    const result = new Map();
    for (const pair of pairs) {
        const userId1 = pair.userId1.toString();
        const userId2 = pair.userId2.toString();
        const key = `${userId1}_${userId2}`;
        
        const user1Friends = friendsMap.get(userId1) || [];
        result.set(key, user1Friends.includes(userId2));
    }

    return result;
};

/**
 * Batch check if users are blocked
 * @param {Array<{blockerId: string, blockedId: string}>} pairs - Array of blocker/blocked pairs
 * @returns {Promise<Map>} - Map of "blockerId_blockedId" -> boolean
 */
const batchCheckBlocked = async (pairs) => {
    if (!pairs || pairs.length === 0) {
        return new Map();
    }

    // Get all unique blocker IDs
    const blockerIds = [...new Set(pairs.map(p => p.blockerId.toString()))];
    const blockedMap = await batchGetBlockedUsers(blockerIds);

    // Check each pair
    const result = new Map();
    for (const pair of pairs) {
        const blockerId = pair.blockerId.toString();
        const blockedId = pair.blockedId.toString();
        const key = `${blockerId}_${blockedId}`;
        
        const blockedUsers = blockedMap.get(blockerId) || [];
        result.set(key, blockedUsers.includes(blockedId));
    }

    return result;
};

/**
 * Clear cache for a specific user or all users
 * @param {string} userId - Optional user ID to clear, or null to clear all
 */
const clearCache = (userId = null) => {
    if (userId) {
        userCache.delete(userId.toString());
    } else {
        userCache.clear();
    }
};

module.exports = {
    batchGetUsers,
    batchGetBlockedUsers,
    batchCheckFriendships,
    batchCheckBlocked,
    clearCache
};

