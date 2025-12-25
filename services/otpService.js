const bcrypt = require('bcryptjs');
const OTP = require('../src/models/authorization/OTP');

// Generate random 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash OTP
const hashOTP = async (otp) => {
    return await bcrypt.hash(otp, 10);
};

// Verify OTP
const verifyOTP = async (hashedOTP, otp) => {
    return await bcrypt.compare(otp, hashedOTP);
};

// Create OTP record
const createOTPRecord = async (email, userType) => {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    
    // Delete any existing OTP for this email
    await OTP.deleteMany({ email: normalizedEmail });
    
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 5) * 60000);
    
    const otpRecord = await OTP.create({
        email: normalizedEmail,
        otp: hashedOTP,
        userType,
        expiresAt,
        attempts: 0,
        verified: false
    });
    
    return {
        otpRecord,
        plainOTP: otp
    };
};

// Validate OTP
const validateOTP = async (email, userType, otp) => {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    
    const otpRecord = await OTP.findOne({ 
        email: normalizedEmail, 
        userType,
        verified: false 
    });
    
    if (!otpRecord) {
        return { valid: false, message: 'OTP not found or already used' };
    }
    
    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return { valid: false, message: 'OTP expired' };
    }
    
    // Check max attempts (5 attempts max)
    if (otpRecord.attempts >= 5) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return { valid: false, message: 'Too many attempts. Please request a new OTP' };
    }
    
    // Verify OTP
    const isValid = await verifyOTP(otpRecord.otp, otp);
    
    if (isValid) {
        otpRecord.verified = true;
        await otpRecord.save();
        return { valid: true, message: 'OTP verified successfully' };
    } else {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return { 
            valid: false, 
            message: 'Invalid OTP', 
            remainingAttempts: 5 - otpRecord.attempts 
        };
    }
};

module.exports = {
    generateOTP,
    hashOTP,
    verifyOTP,
    createOTPRecord,
    validateOTP
};