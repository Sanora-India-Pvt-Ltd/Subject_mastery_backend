const { Reel, ALLOWED_CONTENT_TYPES } = require('../models/Reel');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const Media = require('../models/Media');
const mongoose = require('mongoose');

// Upload video for reels
const uploadReelMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const user = req.user; // From protect middleware
        const userFolder = `user_uploads/${user._id}/reels`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: userFolder,
            upload_preset: process.env.UPLOAD_PRESET,
            resource_type: 'auto', // auto = images + videos
            quality: '100'
        });

        // Determine media type
        const mediaType = result.resource_type === 'video' ? 'video' : 'image';
        if (mediaType !== 'video') {
            return res.status(400).json({
                success: false,
                message: 'Reels require video uploads (resource_type must be video)'
            });
        }

        // Save upload record to database
        const mediaRecord = await Media.create({
            userId: user._id,
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            resource_type: result.resource_type,
            fileSize: result.bytes || req.file.size,
            originalFilename: req.file.originalname,
            folder: result.folder || userFolder
        });

        return res.status(200).json({
            success: true,
            message: 'Reel media uploaded successfully',
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                type: mediaType,
                format: result.format,
                duration: result.duration,
                width: result.width,
                height: result.height,
                fileSize: result.bytes || req.file.size,
                mediaId: mediaRecord._id
            }
        });
    } catch (error) {
        console.error('Reel media upload error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload reel media',
            error: error.message
        });
    }
};

// Create a new reel with mandatory contentType key
const createReel = async (req, res) => {
    try {
        const user = req.user;
        const { caption, media, contentType, visibility } = req.body;

        if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: `contentType is required and must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`
            });
        }

        if (!media || !media.url || !media.publicId || !media.type) {
            return res.status(400).json({
                success: false,
                message: 'media must include url, publicId, and type'
            });
        }

        if (media.type !== 'video') {
            return res.status(400).json({
                success: false,
                message: 'Reels media type must be "video"'
            });
        }

        // Create the reel
        const reel = await Reel.create({
            userId: user._id,
            caption: caption || '',
            media: {
                url: media.url,
                publicId: media.publicId,
                thumbnailUrl: media.thumbnailUrl || '',
                type: media.type,
                format: media.format || '',
                duration: media.duration,
                dimensions: media.width && media.height ? {
                    width: media.width,
                    height: media.height
                } : undefined,
                size: media.fileSize || media.size
            },
            contentType,
            visibility: visibility || 'public'
        });

        // Populate user info for response
        await reel.populate('userId', 'firstName lastName name email profileImage');

        // Extract userId as string (handle both populated and non-populated cases)
        const userIdString = reel.userId._id ? reel.userId._id.toString() : reel.userId.toString();
        const userInfo = reel.userId._id ? {
            id: reel.userId._id.toString(),
            firstName: reel.userId.firstName,
            lastName: reel.userId.lastName,
            name: reel.userId.name,
            email: reel.userId.email,
            profileImage: reel.userId.profileImage
        } : null;

        return res.status(201).json({
            success: true,
            message: 'Reel created successfully',
            data: {
                reel: {
                    id: reel._id.toString(),
                    userId: userIdString,
                    user: userInfo,
                    caption: reel.caption,
                    media: reel.media,
                    contentType: reel.contentType,
                    visibility: reel.visibility,
                    views: reel.views || 0,
                    likes: reel.likes || [],
                    comments: reel.comments || [],
                    likeCount: reel.likeCount,
                    commentCount: reel.commentCount,
                    createdAt: reel.createdAt,
                    updatedAt: reel.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Create reel error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create reel',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Fetch reels with simple pagination
const getReels = async (req, res) => {
    try {
        const contentType = req.query.contentType;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Validation
        if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid contentType. Must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`
            });
        }

        // Get reels sorted by newest first
        const reels = await Reel.find({ contentType, visibility: 'public' })
            .populate('userId', 'firstName lastName name email profileImage')
            .populate('likes.userId', 'firstName lastName name profileImage')
            .populate('comments.userId', 'firstName lastName name profileImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalReels = await Reel.countDocuments({ contentType, visibility: 'public' });

        return res.status(200).json({
            success: true,
            message: 'Reels retrieved successfully',
            data: {
                reels: reels.map(reel => {
                    const userIdString = reel.userId._id ? reel.userId._id.toString() : reel.userId.toString();
                    const userInfo = reel.userId._id ? {
                        id: reel.userId._id.toString(),
                        firstName: reel.userId.firstName,
                        lastName: reel.userId.lastName,
                        name: reel.userId.name,
                        email: reel.userId.email,
                        profileImage: reel.userId.profileImage
                    } : null;

                    return {
                        id: reel._id.toString(),
                        userId: userIdString,
                        user: userInfo,
                        caption: reel.caption,
                        media: reel.media,
                        contentType: reel.contentType,
                        visibility: reel.visibility,
                        views: reel.views || 0,
                        likes: reel.likes || [],
                        comments: reel.comments || [],
                        likeCount: reel.likeCount,
                        commentCount: reel.commentCount,
                        createdAt: reel.createdAt,
                        updatedAt: reel.updatedAt
                    };
                }),
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalReels / limit),
                    totalReels: totalReels,
                    hasNextPage: page < Math.ceil(totalReels / limit),
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get reels error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve reels',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get reels by user ID with pagination
const getUserReels = async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Validate user ID
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get reels for this user
        const reels = await Reel.find({ userId: id })
            .populate('userId', 'firstName lastName name email profileImage')
            .populate('likes.userId', 'firstName lastName name profileImage')
            .populate('comments.userId', 'firstName lastName name profileImage')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalReels = await Reel.countDocuments({ userId: id });

        return res.status(200).json({
            success: true,
            message: 'User reels retrieved successfully',
            data: {
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    profileImage: user.profileImage
                },
                reels: reels.map(reel => {
                    const userIdString = reel.userId._id ? reel.userId._id.toString() : reel.userId.toString();
                    const userInfo = reel.userId._id ? {
                        id: reel.userId._id.toString(),
                        firstName: reel.userId.firstName,
                        lastName: reel.userId.lastName,
                        name: reel.userId.name,
                        email: reel.userId.email,
                        profileImage: reel.userId.profileImage
                    } : null;

                    return {
                        id: reel._id.toString(),
                        userId: userIdString,
                        user: userInfo,
                        caption: reel.caption,
                        media: reel.media,
                        contentType: reel.contentType,
                        visibility: reel.visibility,
                        views: reel.views || 0,
                        likes: reel.likes || [],
                        comments: reel.comments || [],
                        likeCount: reel.likeCount,
                        commentCount: reel.commentCount,
                        createdAt: reel.createdAt,
                        updatedAt: reel.updatedAt
                    };
                }),
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalReels / limit),
                    totalReels: totalReels,
                    hasNextPage: page < Math.ceil(totalReels / limit),
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get user reels error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user reels',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    uploadReelMedia,
    createReel,
    getReels,
    getUserReels
};

