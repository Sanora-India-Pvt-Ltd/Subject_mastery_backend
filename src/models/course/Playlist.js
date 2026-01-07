const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
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
    order: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
playlistSchema.index({ courseId: 1, order: 1 });
playlistSchema.index({ courseId: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);

