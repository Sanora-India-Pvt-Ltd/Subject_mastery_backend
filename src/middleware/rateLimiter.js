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
        const email = req.body.email;
        const key = `otp_${email}`;
        
        await otpRateLimiter.consume(key);
        next();
    } catch (error) {
        res.status(429).json({
            success: false,
            message: 'Too many OTP requests. Please wait 15 minutes before trying again.'
        });
    }
};

const limitVerifyRequests = async (req, res, next) => {
    try {
        const email = req.body.email;
        const key = `verify_${email}`;
        
        await verifyRateLimiter.consume(key);
        next();
    } catch (error) {
        res.status(429).json({
            success: false,
            message: 'Too many verification attempts. Please wait 15 minutes before trying again.'
        });
    }
};

module.exports = {
    limitOTPRequests,
    limitVerifyRequests
};