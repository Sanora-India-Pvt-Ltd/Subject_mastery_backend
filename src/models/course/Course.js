const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    universityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'University',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    thumbnail: {
        type: String,
        default: null
    },
    description: {
        type: String,
        default: ''
    },
    inviteOnly: {
        type: Boolean,
        default: true
    },
    stats: {
        totalUsers: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
courseSchema.index({ universityId: 1 });
courseSchema.index({ inviteOnly: 1 });
courseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Course', courseSchema);

