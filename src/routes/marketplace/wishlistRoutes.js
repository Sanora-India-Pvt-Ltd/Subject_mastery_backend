const express = require('express');
const { protect } = require('../../middleware/auth');
const {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    checkWishlistStatus
} = require('../../controllers/marketplace/wishlistController');

const router = express.Router();

router.post('/add', protect, addToWishlist);
router.delete('/remove/:productId', protect, removeFromWishlist);
router.get('/', protect, getWishlist);
router.get('/check/:productId', protect, checkWishlistStatus);

module.exports = router;
