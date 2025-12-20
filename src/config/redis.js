// Redis is disabled - using stub/fallback instead
// This provides the same interface without requiring Redis connection
const redisStub = require('./redisStub');

module.exports = redisStub;
