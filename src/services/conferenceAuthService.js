const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Shared auth helper for Host & Speaker

// Maximum number of devices
const MAX_DEVICES = 5;

// Helper to normalize email
const normalizeEmail = (email) => email.trim().toLowerCase();

// Basic email regex (same as existing controllers)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared device-limit helper
const manageDeviceLimit = (entity) => {
    if (!entity.tokens) entity.tokens = {};
    if (!Array.isArray(entity.tokens.refreshTokens)) entity.tokens.refreshTokens = [];

    if (entity.tokens.refreshTokens.length >= MAX_DEVICES) {
        entity.tokens.refreshTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        entity.tokens.refreshTokens.shift();
    }
};

/**
 * Shared signup logic for Host/Speaker
 * @param {Object} options
 * @param {'host'|'speaker'} options.entityType
 * @param {mongoose.Model} options.Model - Mongoose model (Host or Speaker)
 * @param {Function} options.generateAccessToken
 * @param {Function} options.generateRefreshToken
 * @param {Object} options.body - req.body
 * @param {string} options.userAgent - req.headers['user-agent']
 */
const signupEntity = async ({
    entityType,
    Model,
    generateAccessToken,
    generateRefreshToken,
    body,
    userAgent
}) => {
    const displayName = entityType === 'host' ? 'Host' : 'Speaker';

    const { email, password, name, bio, phone, emailVerificationToken, phoneVerificationToken } = body;

    if (!email || !password || !name) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Email, password, and name are required'
            }
        };
    }

    const normalizedEmail = normalizeEmail(email);
    if (!emailRegex.test(normalizedEmail)) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Invalid email format'
            }
        };
    }

    if (password.length < 6) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Password must be at least 6 characters long'
            }
        };
    }

    const existing = await Model.findOne({ email: normalizedEmail });
    if (existing) {
        return {
            status: 400,
            body: {
                success: false,
                message: `${displayName} already exists with this email`
            }
        };
    }

    // Normalize phone (if provided)
    let normalizedPhone = null;
    if (phone) {
        normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
        }

        // Check if phone already exists for any conference account
        const existingPhone = await Model.findOne({ phone: normalizedPhone });
        if (existingPhone) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: `${displayName} already exists with this phone number`
                }
            };
        }
    }

    // Require email + phone verification tokens (manual signup)
    if (!emailVerificationToken || !phoneVerificationToken) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Both email and phone verification tokens are required. First verify email and phone via OTP, then call signup with the returned tokens.'
            }
        };
    }

    // Verify email token
    let emailDecoded;
    try {
        emailDecoded = jwt.verify(emailVerificationToken, process.env.JWT_SECRET);
    } catch (error) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid or expired email verification token. Please verify your email OTP again.'
            }
        };
    }

    if (
        emailDecoded.purpose !== 'otp_verification' ||
        emailDecoded.verificationType !== 'email' ||
        !emailDecoded.forSignup ||
        normalizeEmail(emailDecoded.email) !== normalizedEmail
    ) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid email verification token. Email does not match or token is invalid.'
            }
        };
    }

    // Verify phone token
    let phoneDecoded;
    try {
        phoneDecoded = jwt.verify(phoneVerificationToken, process.env.JWT_SECRET);
    } catch (error) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid or expired phone verification token. Please verify your phone OTP again.'
            }
        };
    }

    if (
        phoneDecoded.purpose !== 'otp_verification' ||
        phoneDecoded.verificationType !== 'phone' ||
        !phoneDecoded.forSignup ||
        (normalizedPhone && phoneDecoded.phone !== normalizedPhone)
    ) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid phone verification token. Phone number does not match or token is invalid.'
            }
        };
    }

    const entity = await Model.create({
        email: normalizedEmail,
        password,
        name: name.trim(),
        bio: bio || '',
        phone: normalizedPhone || null,
        emailVerified: true,
        phoneVerified: !!normalizedPhone,
        tokens: {
            refreshTokens: []
        }
    });

    const { token: refreshToken, expiryDate } = generateRefreshToken();
    manageDeviceLimit(entity);
    entity.tokens.refreshTokens.push({
        token: refreshToken,
        expiresAt: expiryDate,
        device: userAgent || 'Unknown Device',
        createdAt: new Date()
    });
    entity.lastLogin = new Date();
    await entity.save();

    const accessTokenPayload =
        entityType === 'host'
            ? { id: entity._id, type: 'host' }
            : { id: entity._id, sub: entity._id, type: 'speaker', verified: true };

    const accessToken = generateAccessToken(accessTokenPayload);

    const safeEntity = {
        _id: entity._id,
        email: entity.email,
        name: entity.name,
        bio: entity.bio,
        phone: entity.phone,
        profileImage: entity.profileImage,
        isVerified: entity.isVerified,
        createdAt: entity.createdAt
    };

    return {
        status: 201,
        body: {
            success: true,
            data: {
                [entityType]: safeEntity,
                accessToken,
                refreshToken
            }
        }
    };
};

/**
 * Shared login logic for Host/Speaker
 */
const loginEntity = async ({
    entityType,
    Model,
    generateAccessToken,
    generateRefreshToken,
    body,
    userAgent
}) => {
    const displayName = entityType === 'host' ? 'Host' : 'Speaker';
    const { email, password } = body;

    if (!email || !password) {
        return {
            status: 400,
            body: {
                success: false,
                message: 'Email and password are required'
            }
        };
    }

    const normalizedEmail = normalizeEmail(email);
    const entity = await Model.findOne({ email: normalizedEmail });

    if (!entity) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid email or password'
            }
        };
    }

    if (!entity.isActive) {
        return {
            status: 403,
            body: {
                success: false,
                message: `${displayName} account is inactive`
            }
        };
    }

    const isPasswordValid = await entity.comparePassword(password);
    if (!isPasswordValid) {
        return {
            status: 401,
            body: {
                success: false,
                message: 'Invalid email or password'
            }
        };
    }

    const { token: refreshToken, expiryDate } = generateRefreshToken();
    manageDeviceLimit(entity);
    entity.tokens.refreshTokens.push({
        token: refreshToken,
        expiresAt: expiryDate,
        device: userAgent || 'Unknown Device',
        createdAt: new Date()
    });
    entity.lastLogin = new Date();
    await entity.save();

    const accessTokenPayload =
        entityType === 'host'
            ? { id: entity._id, type: 'host' }
            : { id: entity._id, sub: entity._id, type: 'speaker', verified: true };

    const accessToken = generateAccessToken(accessTokenPayload);

    const safeEntity = {
        _id: entity._id,
        email: entity.email,
        name: entity.name,
        bio: entity.bio,
        phone: entity.phone,
        profileImage: entity.profileImage,
        isVerified: entity.isVerified,
        lastLogin: entity.lastLogin
    };

    return {
        status: 200,
        body: {
            success: true,
            data: {
                [entityType]: safeEntity,
                accessToken,
                refreshToken
            }
        }
    };
};

/**
 * Shared profile getter
 */
const getProfileEntity = async ({ entityType, req }) => {
    const key = entityType;
    const current = req[key];
    const Model = mongoose.model(
        entityType === 'host' ? 'Host' : 'Speaker'
    );

    const entity = await Model.findById(current._id).select('-password -tokens');

    return {
        status: 200,
        body: {
            success: true,
            data: entity
        }
    };
};

/**
 * Shared profile updater
 */
const updateProfileEntity = async ({ entityType, req }) => {
    const key = entityType;
    const Model = mongoose.model(
        entityType === 'host' ? 'Host' : 'Speaker'
    );

    const { name, bio, phone, profileImage } = req.body;
    const entity = await Model.findById(req[key]._id);

    if (name !== undefined) entity.name = name.trim();
    if (bio !== undefined) entity.bio = bio || '';
    if (phone !== undefined) entity.phone = phone || null;
    if (profileImage !== undefined) entity.profileImage = profileImage || '';

    await entity.save();

    const safeEntity = {
        _id: entity._id,
        email: entity.email,
        name: entity.name,
        bio: entity.bio,
        phone: entity.phone,
        profileImage: entity.profileImage,
        isVerified: entity.isVerified
    };

    return {
        status: 200,
        body: {
            success: true,
            data: safeEntity
        }
    };
};

/**
 * Shared refresh token logic
 */
const refreshTokenEntity = async ({
    entityType,
    generateAccessToken,
    generateRefreshToken,
    req
}) => {
    const key = entityType;
    const entity = req[key];
    const { refreshToken: oldRefreshToken } = req.body;

    entity.tokens.refreshTokens = entity.tokens.refreshTokens.filter(
        (rt) => rt.token !== oldRefreshToken
    );

    const { token: newRefreshToken, expiryDate } = generateRefreshToken();
    manageDeviceLimit(entity);
    entity.tokens.refreshTokens.push({
        token: newRefreshToken,
        expiresAt: expiryDate,
        device: req.headers['user-agent'] || 'Unknown Device',
        createdAt: new Date()
    });
    await entity.save();

    const accessTokenPayload =
        entityType === 'host'
            ? { id: entity._id, type: 'host' }
            : { id: entity._id, sub: entity._id, type: 'speaker', verified: true };

    const accessToken = generateAccessToken(accessTokenPayload);

    return {
        status: 200,
        body: {
            success: true,
            data: {
                accessToken,
                refreshToken: newRefreshToken
            }
        }
    };
};

/**
 * Shared logout logic
 */
const logoutEntity = async ({ entityType, req }) => {
    const key = entityType;
    const entity = req[key];
    const { refreshToken } = req.body;

    if (refreshToken) {
        entity.tokens.refreshTokens = entity.tokens.refreshTokens.filter(
            (rt) => rt.token !== refreshToken
        );
        await entity.save();
    }

    return {
        status: 200,
        body: {
            success: true,
            message: 'Logged out successfully'
        }
    };
};

module.exports = {
    manageDeviceLimit,
    signupEntity,
    loginEntity,
    getProfileEntity,
    updateProfileEntity,
    refreshTokenEntity,
    logoutEntity
};


