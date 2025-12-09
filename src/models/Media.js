const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Index for faster queries
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
    }
}, {
    timestamps: true
});

// Index for querying by user and date
mediaSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Media', mediaSchema);

