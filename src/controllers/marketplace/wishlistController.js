const Wishlist = require('../../models/marketplace/Wishlist');
const Product = require('../../models/marketplace/Product');
const mongoose = require('mongoose');

/**
 * Add product to wishlist
 * POST /api/marketplace/wishlist/add
 */
const addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.body;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid product ID is required'
            });
        }

        // Verify product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find or create wishlist for user
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = await Wishlist.create({
                userId,
                items: []
            });
        }

        // Check if product already exists in wishlist
        const existingItemIndex = wishlist.items.findIndex(
            item => item.productId.toString() === productId.toString()
        );

        if (existingItemIndex !== -1) {
            return res.status(400).json({
                success: false,
                message: 'Product already exists in wishlist'
            });
        }

        // Add product to wishlist
        wishlist.items.push({
            productId,
            addedAt: new Date()
        });

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: 'Product added to wishlist successfully',
            data: {
                wishlist: {
                    _id: wishlist._id,
                    itemCount: wishlist.items.length
                }
            }
        });

    } catch (error) {
        console.error('Add to wishlist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding product to wishlist',
            error: error.message
        });
    }
};

/**
 * Remove product from wishlist
 * DELETE /api/marketplace/wishlist/remove/:productId
 */
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid product ID is required'
            });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        // Find and remove product from wishlist
        const itemIndex = wishlist.items.findIndex(
            item => item.productId.toString() === productId.toString()
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in wishlist'
            });
        }

        wishlist.items.splice(itemIndex, 1);
        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: 'Product removed from wishlist successfully',
            data: {
                wishlist: {
                    _id: wishlist._id,
                    itemCount: wishlist.items.length
                }
            }
        });

    } catch (error) {
        console.error('Remove from wishlist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error removing product from wishlist',
            error: error.message
        });
    }
};

/**
 * Get user's wishlist
 * GET /api/marketplace/wishlist
 */
const getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'title description price images isActive sellerId',
                populate: {
                    path: 'sellerId',
                    select: 'profile.name.full profile.email'
                }
            });

        if (!wishlist) {
            return res.status(200).json({
                success: true,
                message: 'Wishlist is empty',
                data: {
                    wishlist: {
                        items: [],
                        itemCount: 0
                    }
                }
            });
        }

        // Filter out products that no longer exist or are inactive
        const validItems = wishlist.items.filter(item => item.productId && item.productId.isActive);

        return res.status(200).json({
            success: true,
            message: 'Wishlist retrieved successfully',
            data: {
                wishlist: {
                    _id: wishlist._id,
                    items: validItems.map(item => ({
                        productId: item.productId._id,
                        product: item.productId,
                        addedAt: item.addedAt
                    })),
                    itemCount: validItems.length
                }
            }
        });

    } catch (error) {
        console.error('Get wishlist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving wishlist',
            error: error.message
        });
    }
};

/**
 * Check if product is in wishlist
 * GET /api/marketplace/wishlist/check/:productId
 */
const checkWishlistStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid product ID is required'
            });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(200).json({
                success: true,
                data: {
                    isInWishlist: false
                }
            });
        }

        const isInWishlist = wishlist.items.some(
            item => item.productId.toString() === productId.toString()
        );

        return res.status(200).json({
            success: true,
            data: {
                isInWishlist
            }
        });

    } catch (error) {
        console.error('Check wishlist status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking wishlist status',
            error: error.message
        });
    }
};

module.exports = {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    checkWishlistStatus
};
