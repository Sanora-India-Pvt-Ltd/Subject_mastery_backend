const mongoose = require('mongoose');

const conferenceQuestionAnalyticsSchema = new mongoose.Schema({
    conferenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conference',
        required: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConferenceQuestion',
        required: true,
        unique: true
    },
    totalResponses: {
        type: Number,
        default: 0,
        min: 0
    },
    optionCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    correctCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
conferenceQuestionAnalyticsSchema.index({ conferenceId: 1, lastUpdated: -1 });
// Note: questionId index is automatically created by unique: true in schema

module.exports = mongoose.model('ConferenceQuestionAnalytics', conferenceQuestionAnalyticsSchema);

