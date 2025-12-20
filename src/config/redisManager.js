// Redis is disabled - using memory cache stub instead
const memoryCache = require('../utils/memoryCache');
const EventEmitter = require('events');

class RedisManager extends EventEmitter {
    constructor() {
        super();
        // Always "connected" since we're using in-memory cache
        this.isConnected = true;
    }

    async connect() {
        // No-op: memory cache is always available
        this.isConnected = true;
        this.emit('ready');
        return true;
    }

    async get(key) {
        // Use memory cache
        return memoryCache.get(key);
    }

    async set(key, value, ttl = 300) {
        // Use memory cache
        return memoryCache.set(key, value, ttl);
    }

    async invalidatePattern(pattern) {
        // Use memory cache
        return memoryCache.invalidatePattern(pattern);
    }

    async pipeline(operations) {
        // Memory cache doesn't support pipeline, but we can simulate it
        const results = [];
        for (const [cmd, key, ...args] of operations) {
            try {
                if (cmd === 'get') {
                    results.push([null, memoryCache.get(key)]);
                } else if (cmd === 'set' || cmd === 'setex') {
                    const ttl = args[0] || 300;
                    const value = args[1] || args[0];
                    results.push([null, memoryCache.set(key, value, ttl)]);
                } else if (cmd === 'del') {
                    results.push([null, memoryCache.delete(key)]);
                } else {
                    results.push([null, null]);
                }
            } catch (err) {
                results.push([err, null]);
            }
        }
        return results;
    }

    disconnect() {
        // No-op: nothing to disconnect
        this.isConnected = false;
    }
}

// Singleton instance
const redisManager = new RedisManager();

// Emit ready event immediately since memory cache is always available
process.nextTick(() => {
    redisManager.emit('ready');
});

console.log('ℹ️  RedisManager using in-memory cache (Redis disabled)');

module.exports = redisManager;
