const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // 1️⃣ profile → User Identity & Public Info
    profile: {
        name: {
            first: {
                type: String,
                required: true
            },
            last: {
                type: String,
                required: true
            },
            full: {
                type: String,
                default: ''
            }
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true
        },
        phoneNumbers: {
            primary: {
                type: String,
                required: false,
                default: undefined
            },
            alternate: {
                type: String,
                required: false,
                default: undefined
            }
        },
        gender: {
            type: String,
            required: true,
            enum: ['Male', 'Female', 'Other', 'Prefer not to say']
        },
        pronouns: {
            type: String,
            required: false,
            default: ''
        },
        dob: {
            type: Date,
            required: false
        },
        bio: {
            type: String,
            default: ''
        },
        profileImage: {
            type: String,
            default: ''
        },
        coverPhoto: {
            type: String,
            default: ''
        }
    },

    // 2️⃣ auth → Login, Password, OAuth, Tokens
    auth: {
        password: {
            type: String,
            required: true
        },
        isGoogleOAuth: {
            type: Boolean,
            default: false
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true // Allows multiple null values
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
        // Legacy fields for backward compatibility
        refreshToken: {
            type: String,
            default: null
        },
        refreshTokenExpiry: {
            type: Date,
            default: null
        }
    },

    // 3️⃣ account → Account Metadata & Status
    account: {
        isActive: {
            type: Boolean,
            default: true
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        lastLogin: {
            type: Date,
            default: null
        }
    },

    // 4️⃣ social → Friends, Blocking, Relationships
    social: {
        friends: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        blockedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        relationshipStatus: {
            type: String,
            required: false,
            enum: ['Single', 'In a relationship', 'Engaged', 'Married', 'In a civil partnership', 'In a domestic partnership', 'In an open relationship', "It's complicated", 'Separated', 'Divorced', 'Widowed'],
            default: null
        }
    },

    // 5️⃣ location → City, Hometown
    location: {
        currentCity: {
            type: String,
            default: ''
        },
        hometown: {
            type: String,
            required: false,
            default: ''
        }
    },

    // 6️⃣ professional → Work & Education
    professional: {
        education: [{
            institution: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Institution',
                required: false
            },
            description: {
                type: String,
                trim: true,
                default: ''
            },
            degree: {
                type: String,
                default: ''
            },
            field: {
                type: String,
                default: ''
            },
            institutionType: {
                type: String,
                enum: ['school', 'college', 'university', 'others'],
                default: 'school'
            },
            startMonth: {
                type: Number,
                min: 1,
                max: 12,
                required: false
            },
            startYear: {
                type: Number,
                required: false
            },
            endMonth: {
                type: Number,
                min: 1,
                max: 12,
                default: null
            },
            endYear: {
                type: Number,
                default: null
            },
            cgpa: {
                type: Number,
                min: 0,
                max: 10,
                default: null
            },
            percentage: {
                type: Number,
                min: 0,
                max: 100,
                default: null
            }
        }],
        workplace: [{
            company: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Company',
                required: true
            },
            position: {
                type: String,
                required: true
            },
            description: {
                type: String,
                trim: true,
                default: ''
            },
            startDate: {
                type: Date,
                required: true
            },
            endDate: {
                type: Date,
                default: null
            },
            isCurrent: {
                type: Boolean,
                default: false
            }
        }]
    },

    // 7️⃣ content → Media Preferences
    content: {
        generalWeightage: {
            type: Number,
            default: 0
        },
        professionalWeightage: {
            type: Number,
            default: 0
        }
    },

    // Legacy field for backward compatibility (will be removed in future)
    token: {
        type: String,
        default: null
    }
}, {
    timestamps: true // This adds createdAt and updatedAt at root level
});

// Virtual for account.createdAt and account.updatedAt (using timestamps)
userSchema.virtual('account.createdAt').get(function() {
    return this.createdAt;
});

userSchema.virtual('account.updatedAt').get(function() {
    return this.updatedAt;
});

module.exports = mongoose.model('User', userSchema);
