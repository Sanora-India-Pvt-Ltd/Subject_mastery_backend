const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true // Index for faster search
    },
    normalizedName: {
        type: String,
        required: true,
        unique: true, // Unique constraint on normalized name to prevent case-insensitive duplicates
        lowercase: true,
        trim: true,
        index: true // Index for case-insensitive search
    },
    isCustom: {
        type: Boolean,
        default: true // All user-created companies are custom entries
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Can be null for system companies in the future
    }
}, {
    timestamps: true
});

// Compound index for efficient search
companySchema.index({ normalizedName: 'text' });

module.exports = mongoose.model('Company', companySchema);

