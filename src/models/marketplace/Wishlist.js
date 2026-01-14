const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    items: [wishlistItemSchema]
}, {
    timestamps: true
});

// Compound index to prevent duplicate products in wishlist
wishlistSchema.index({ userId: 1, 'items.productId': 1 });

module.exports =
  mongoose.models.Wishlist ||
  mongoose.model('Wishlist', wishlistSchema);
