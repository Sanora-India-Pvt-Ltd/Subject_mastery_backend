/**
 * Redis stub/fallback module
 * Provides Redis-like interface without actual Redis connection
 * All methods return safe defaults that won't break the application
 */

// In-memory presence tracking (fallback for when Redis is not available)
const inMemoryPresence = {
    onlineUsers: new Map(), // userId -> { online: true, lastSeen: timestamp }
    cleanupInterval: null,
    
    startCleanup() {
        if (this.cleanupInterval) return;
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const fiveMinutesAgo = now - (5 * 60 * 1000);
            
            for (const [userId, data] of this.onlineUsers.entries()) {
                if (data.lastSeen < fiveMinutesAgo) {
                    this.onlineUsers.delete(userId);
                }
            }
        }, 5 * 60 * 1000); // Run every 5 minutes
    },
    
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
};

// Start cleanup on module load
inMemoryPresence.startCleanup();

// Redis stub functions that return safe defaults
const getRedis = () => null;
const getRedisSubscriber = () => null;
const getRedisPublisher = () => null;

const waitForRedisReady = async () => {
    // Always return false since Redis is not available
    return false;
};

// Presence tracking functions using in-memory storage
const setUserOnline = async (userId) => {
    const now = Date.now();
    inMemoryPresence.onlineUsers.set(userId, { online: true, lastSeen: now });
};

const setUserOffline = async (userId) => {
    const now = Date.now();
    const existing = inMemoryPresence.onlineUsers.get(userId);
    inMemoryPresence.onlineUsers.set(userId, { 
        online: false, 
        lastSeen: existing?.lastSeen || now 
    });
};

const isUserOnline = async (userId) => {
    const userData = inMemoryPresence.onlineUsers.get(userId);
    return userData?.online === true;
};

const getUserLastSeen = async (userId) => {
    const userData = inMemoryPresence.onlineUsers.get(userId);
    return userData?.lastSeen || null;
};

module.exports = {
    getRedis,
    getRedisSubscriber,
    getRedisPublisher,
    waitForRedisReady,
    setUserOnline,
    setUserOffline,
    isUserOnline,
    getUserLastSeen
};

