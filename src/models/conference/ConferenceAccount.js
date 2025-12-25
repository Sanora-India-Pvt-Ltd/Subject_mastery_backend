const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Base schema for both Host and Speaker (single collection via discriminators)
const conferenceAccountSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    bio: {
        type: String,
        default: '',
        trim: true
    },
    phone: {
        type: String,
        default: null,
        trim: true
    },
    profileImage: {
        type: String,
        default: ''
    },
    isVerified: {
        // Business-level verification (e.g. KYC) – keep existing meaning
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // New: granular contact verification flags
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    tokens: {
        refreshTokens: [{
            token: {
                type: String,
                required: true
            },
            expiresAt: {
                type: Date,
                required: true
            },
            device: {
                type: String,
                default: 'Unknown Device'
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    lastLogin: {
        type: Date,
        default: null
    },
    // Discriminator key: HOST | SPEAKER
    role: {
        type: String,
        enum: ['HOST', 'SPEAKER'],
        required: true
    }
}, {
    timestamps: true,
    discriminatorKey: 'role',
    collection: 'conferenceaccounts'
});

// Hash password before saving
conferenceAccountSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare password
conferenceAccountSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes for better query performance
// Note: email index is automatically created by unique: true in schema
conferenceAccountSchema.index({ isVerified: 1, createdAt: -1 });
conferenceAccountSchema.index({ isActive: 1 });
conferenceAccountSchema.index({ role: 1 });

const ConferenceAccount = mongoose.model('ConferenceAccount', conferenceAccountSchema);

module.exports = ConferenceAccount;


