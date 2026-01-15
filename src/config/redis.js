/**
 * Redis Configuration for BullMQ
 * 
 * Provides Redis connection for job queues.
 * Uses existing redisConnection.js infrastructure.
 */

const Redis = require('ioredis');

/**
 * Get Redis connection options for BullMQ
 * Returns connection object or null if Redis not available
 * 
 * BullMQ requires specific connection options:
 * - maxRetriesPerRequest: null (unlimited retries)
 * - enableReadyCheck: false (don't wait for ready)
 */
const getRedisConnectionOptions = () => {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
        return null;
    }

    try {
        // Parse Redis URL
        let host, port, password, username;
        
        if (redisUrl.includes('://')) {
            const url = new URL(redisUrl);
            host = url.hostname;
            port = parseInt(url.port) || 6379;
            username = url.username || undefined;
            password = url.password || undefined;
        } else {
            // Simple format: host:port or host:port:password
            const parts = redisUrl.split(':');
            host = parts[0];
            port = parseInt(parts[1]) || 6379;
            password = parts[2] || undefined;
        }

        return {
            host,
            port,
            password,
            username,
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false, // Required for BullMQ
            lazyConnect: true,
            retryStrategy: (times) => {
                return Math.min(times * 100, 2000);
            }
        };
    } catch (error) {
        console.error('❌ Failed to parse Redis URL:', error.message);
        return null;
    }
};

/**
 * Create a new Redis connection for BullMQ
 * BullMQ needs its own connection instance
 */
const createRedisConnection = () => {
    const connectionOptions = getRedisConnectionOptions();
    
    if (!connectionOptions) {
        return null;
    }

    try {
        const redis = new Redis(connectionOptions);
        
        redis.on('error', (err) => {
            console.error('❌ BullMQ Redis connection error:', err.message);
        });

        redis.on('ready', () => {
            console.log('✅ BullMQ Redis connection ready');
        });

        return redis;
    } catch (error) {
        console.error('❌ Failed to create BullMQ Redis connection:', error.message);
        return null;
    }
};

module.exports = {
    getRedisConnectionOptions,
    createRedisConnection
};
