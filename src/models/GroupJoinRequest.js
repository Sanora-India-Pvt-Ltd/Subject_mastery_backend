const mongoose = require('mongoose');

const groupJoinRequestSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for better query performance
groupJoinRequestSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupJoinRequestSchema.index({ userId: 1, status: 1 });
groupJoinRequestSchema.index({ groupId: 1, status: 1 });

module.exports = mongoose.model('GroupJoinRequest', groupJoinRequestSchema);

