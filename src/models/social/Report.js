const mongoose = require('mongoose');

const REPORT_REASONS = [
    'problem_involving_someone_under_18',
    'bullying_harassment_or_abuse',
    'suicide_or_self_harm',
    'violent_hateful_or_disturbing_content',
    'adult_content',
    'scam_fraud_or_false_information',
    'intellectual_property',
    'political',
    'i_dont_want_to_see_this'
];

const reportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    contentType: {
        type: String,
        required: true,
        enum: ['post', 'reel'],
        index: true
    },
    reason: {
        type: String,
        required: true,
        enum: REPORT_REASONS
    }
}, {
    timestamps: true
});

// Compound index to ensure a user can only report the same content once
reportSchema.index({ userId: 1, contentId: 1, contentType: 1 }, { unique: true });

// Compound index for checking if 2 users reported with same reason
reportSchema.index({ contentId: 1, contentType: 1, reason: 1 });

module.exports = {
    Report: mongoose.model('Report', reportSchema),
    REPORT_REASONS
};

