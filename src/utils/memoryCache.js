/**
 * Simple in-memory cache utility
 * Provides a lightweight caching solution without Redis dependency
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if not found/expired
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            return null;
        }

        // Check if expired
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set a value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in seconds (default: 300)
     * @returns {boolean} - Success status
     */
    set(key, value, ttl = 300) {
        try {
            // Clear existing timer if any
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
            }

            const expiresAt = Date.now() + (ttl * 1000);
            
            this.cache.set(key, {
                value,
                expiresAt,
                createdAt: Date.now()
            });

            // Set timer to auto-delete when expired
            const timer = setTimeout(() => {
                this.delete(key);
            }, ttl * 1000);

            this.timers.set(key, timer);

            return true;
        } catch (err) {
            console.error('Memory cache set error:', err.message);
            return false;
        }
    }

    /**
     * Delete a key from cache
     * @param {string} key - Cache key
     * @returns {boolean} - Success status
     */
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return this.cache.delete(key);
    }

    /**
     * Delete all keys matching a pattern
     * @param {string} pattern - Pattern to match (supports * wildcard)
     * @returns {number} - Number of keys deleted
     */
    invalidatePattern(pattern) {
        let count = 0;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
                count++;
            }
        }

        return count;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {object} - Cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Singleton instance
const memoryCache = new MemoryCache();

module.exports = memoryCache;

