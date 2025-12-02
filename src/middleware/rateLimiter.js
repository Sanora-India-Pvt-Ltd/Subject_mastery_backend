const { RateLimiterMemory } = require('rate-limiter-flexible');

// Rate limiter for OTP requests (max 3 requests per 15 minutes per email)
const otpRateLimiter = new RateLimiterMemory({
    points: 3, // 3 requests
    duration: 15 * 60, // per 15 minutes
    blockDuration: 15 * 60 // block for 15 minutes if exceeded
});

// Rate limiter for OTP verification (max 5 attempts per OTP)
const verifyRateLimiter = new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 15 * 60, // per 15 minutes
    blockDuration: 15 * 60 // block for 15 minutes if exceeded
});

const limitOTPRequests = async (req, res, next) => {
    try {
        const email = req.body?.email;
        
        // If email is missing, let the route handler deal with validation
        // Don't block the request here
        if (!email) {
            return next();
        }
        
        const key = `otp_${email}`;
        await otpRateLimiter.consume(key);
        next();
    } catch (error) {
        // Check if it's a rate limit error
        if (error.remainingPoints !== undefined) {
            return res.status(429).json({
                success: false,
                message: 'Too many OTP requests. Please wait 15 minutes before trying again.'
            });
        }
        // For other errors, log and continue
        console.error('Rate limiter error:', error.message);
        next();
    }
};

const limitVerifyRequests = async (req, res, next) => {
    try {
        const email = req.body?.email;
        
        // If email is missing, let the route handler deal with validation
        // Don't block the request here
        if (!email) {
            return next();
        }
        
        const key = `verify_${email}`;
        await verifyRateLimiter.consume(key);
        next();
    } catch (error) {
        // Check if it's a rate limit error
        if (error.remainingPoints !== undefined) {
            return res.status(429).json({
                success: false,
                message: 'Too many verification attempts. Please wait 15 minutes before trying again.'
            });
        }
        // For other errors, log and continue
        console.error('Rate limiter error:', error.message);
        next();
    }
};

module.exports = {
    limitOTPRequests,
    limitVerifyRequests
};