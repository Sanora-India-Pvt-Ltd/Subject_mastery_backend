const mongoose = require('mongoose');

const conferenceMediaSchema = new mongoose.Schema({
    conferenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conference',
        required: true
    },
    mediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media',
        required: true
    },
    type: {
        type: String,
        enum: ['PPT', 'IMAGE'],
        required: true
    },
    createdByRole: {
        type: String,
        enum: ['HOST', 'SPEAKER'],
        required: true
    },
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'createdByModel'
    },
    createdByModel: {
        type: String,
        enum: ['User', 'Speaker'],
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
conferenceMediaSchema.index({ conferenceId: 1, uploadedAt: -1 });
conferenceMediaSchema.index({ mediaId: 1 });
conferenceMediaSchema.index({ createdByRole: 1, createdById: 1 }); // For ownership queries

module.exports = mongoose.model('ConferenceMedia', conferenceMediaSchema);

