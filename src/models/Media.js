const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Index removed - covered by compound index { userId: 1, createdAt: -1 }
    },
    url: {
        type: String,
        required: true
    },
    public_id: {
        type: String,
        required: true,
        unique: true
    },
    format: {
        type: String,
        required: true
    },
    resource_type: {
        type: String,
        required: true,
        enum: ['image', 'video', 'raw', 'auto']
    },
    fileSize: {
        type: Number, // Size in bytes
        required: false
    },
    originalFilename: {
        type: String,
        required: false
    },
    folder: {
        type: String,
        default: 'user_uploads'
    },
    transcodingJobId: {
        type: String,
        default: null,
        index: true
    },
    isTranscoding: {
        type: Boolean,
        default: false
    },
    transcodingCompleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for querying by user and date
mediaSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Media', mediaSchema);

