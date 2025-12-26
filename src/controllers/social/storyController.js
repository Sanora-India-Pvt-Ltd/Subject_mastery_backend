const Story = require('../../models/social/Story');
const User = require('../../models/authorization/User');
const StorageService = require('../../services/storage.service');
const mongoose = require('mongoose');
const { isVideo } = require('../../services/videoTranscoder');

// Helper function to get all blocked user IDs
const getBlockedUserIds = async (userId) => {
    try {
        const user = await User.findById(userId).select('social.blockedUsers');
        if (!user) return [];
        
        const blockedUsers = user.social?.blockedUsers || [];
        const uniqueBlocked = [...new Set(blockedUsers.map(id => id.toString()))];
        
        return uniqueBlocked.map(id => mongoose.Types.ObjectId(id));
    } catch (error) {
        console.error('Error getting blocked users:', error);
        return [];
    }
};

// Helper function to check if a user is blocked
const isUserBlocked = async (blockerId, blockedId) => {
    try {
        const blockedUserIds = await getBlockedUserIds(blockerId);
        return blockedUserIds.some(id => id.toString() === blockedId.toString());
    } catch (error) {
        console.error('Error checking if user is blocked:', error);
        return false;
    }
};

// Create a new story
const createStory = async (req, res) => {
    try {
        const user = req.user; // From protect middleware
        const { url, publicId, type, format } = req.body;

        // Validate required fields
        if (!url || !publicId || !type) {
            return res.status(400).json({
                success: false,
                message: 'Story must have url, publicId, and type (image/video)'
            });
        }

        // Validate media type
        if (!['image', 'video'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Media type must be either "image" or "video"'
            });
        }

        // Calculate expiration time (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Create the story
        const story = await Story.create({
            userId: user._id,
            media: {
                url: url,
                publicId: publicId,
                type: type,
                format: format || null
            },
            expiresAt: expiresAt
        });

        // Populate user info for response
        await story.populate('userId', 'profile.name.first profile.name.last profile.name.full profile.email profile.profileImage');

        // Extract userId as string (handle both populated and non-populated cases)
        const userIdString = story.userId._id ? story.userId._id.toString() : story.userId.toString();
        const userInfo = story.userId._id ? {
            id: story.userId._id.toString(),
            firstName: story.userId.profile?.name?.first,
            lastName: story.userId.profile?.name?.last,
            name: story.userId.profile?.name?.full,
            email: story.userId.profile?.email,
            profileImage: story.userId.profile?.profileImage
        } : null;

        return res.status(201).json({
            success: true,
            message: 'Story created successfully',
            data: {
                story: {
                    id: story._id.toString(),
                    userId: userIdString,
                    user: userInfo,
                    media: story.media,
                    createdAt: story.createdAt,
                    expiresAt: story.expiresAt
                }
            }
        });

    } catch (error) {
        console.error('Create story error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create story',
            error: error.message
        });
    }
};

// Get stories for a specific user
const getUserStories = async (req, res) => {
    try {
        const { id } = req.params;

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

        // Get user ID from token if authenticated (optional)
        const viewingUserId = req.user?._id;

        // Check if viewing user is blocked by the story owner or vice versa
        if (viewingUserId) {
            // Check if viewing user has blocked the story owner
            const viewingUserBlocked = await isUserBlocked(viewingUserId, id);
            if (viewingUserBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot view stories from a blocked user'
                });
            }

            // Check if story owner has blocked the viewing user
            const ownerBlocked = await isUserBlocked(id, viewingUserId);
            if (ownerBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'Content not available'
                });
            }
        }

        // Get active stories (expiresAt > now) for this user
        const now = new Date();
        const stories = await Story.find({
            userId: id,
            expiresAt: { $gt: now }
        })
        .populate('userId', 'profile.name.first profile.name.last profile.name.full profile.email profile.profileImage')
        .sort({ createdAt: -1 }); // Most recent first

        return res.status(200).json({
            success: true,
            message: 'User stories retrieved successfully',
            data: {
                user: {
                    id: user._id.toString(),
                    name: user.profile?.name?.full,
                    email: user.profile?.email,
                    profileImage: user.profile?.profileImage
                },
                stories: stories.map(story => {
                    const userIdString = story.userId._id ? story.userId._id.toString() : story.userId.toString();
                    const userInfo = story.userId._id ? {
                        id: story.userId._id.toString(),
                        firstName: story.userId.profile?.name?.first,
                        lastName: story.userId.profile?.name?.last,
                        name: story.userId.profile?.name?.full,
                        email: story.userId.profile?.email,
                        profileImage: story.userId.profile?.profileImage
                    } : null;

                    return {
                        id: story._id.toString(),
                        userId: userIdString,
                        user: userInfo,
                        media: story.media,
                        createdAt: story.createdAt,
                        expiresAt: story.expiresAt
                    };
                }),
                count: stories.length
            }
        });

    } catch (error) {
        console.error('Get user stories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user stories',
            error: error.message
        });
    }
};

// Get all stories from friends (grouped by user)
const getAllFriendsStories = async (req, res) => {
    try {
        const user = req.user; // From protect middleware

        // Get user's friends list and blocked users
        const currentUser = await User.findById(user._id).select('social.friends');
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Include current user's own stories as well
        const friendIds = currentUser.social?.friends || [];
        // Get blocked users
        const blockedUserIds = await getBlockedUserIds(user._id);
        
        // Filter out blocked users from friend list
        const unblockedFriendIds = friendIds.filter(
            friendId => !blockedUserIds.some(blockedId => blockedId.toString() === friendId.toString())
        );
        
        const allUserIds = [...unblockedFriendIds, user._id]; // Keep as ObjectIds for MongoDB query

        // Get active stories (expiresAt > now) from friends and self
        const now = new Date();
        let stories = await Story.find({
            userId: { $in: allUserIds },
            expiresAt: { $gt: now }
        })
            .populate('userId', 'profile.name.first profile.name.last profile.name.full profile.email profile.profileImage')
            .sort({ createdAt: -1 }); // Most recent first

        // Also filter out stories from users who have blocked the current user
        const usersWhoBlockedMe = await User.find({
            'social.blockedUsers': user._id
        }).select('_id').lean();
        const blockedByUserIds = new Set(usersWhoBlockedMe.map(u => u._id.toString()));
        
        stories = stories.filter(story => {
            const storyUserId = story.userId._id ? story.userId._id.toString() : story.userId.toString();
            return !blockedByUserIds.has(storyUserId);
        });

        // Group stories by user
        const storiesByUser = {};
        stories.forEach(story => {
            const userIdString = story.userId._id ? story.userId._id.toString() : story.userId.toString();
            
            if (!storiesByUser[userIdString]) {
                const userInfo = story.userId._id ? {
                    id: story.userId._id.toString(),
                    firstName: story.userId.profile?.name?.first,
                    lastName: story.userId.profile?.name?.last,
                    name: story.userId.profile?.name?.full,
                    email: story.userId.profile?.email,
                    profileImage: story.userId.profile?.profileImage
                } : null;

                storiesByUser[userIdString] = {
                    user: userInfo,
                    stories: []
                };
            }

            storiesByUser[userIdString].stories.push({
                id: story._id.toString(),
                userId: userIdString,
                media: story.media,
                createdAt: story.createdAt,
                expiresAt: story.expiresAt
            });
        });

        // Convert to array and sort by most recent story
        const storiesArray = Object.values(storiesByUser).sort((a, b) => {
            const aLatest = a.stories[0]?.createdAt || new Date(0);
            const bLatest = b.stories[0]?.createdAt || new Date(0);
            return bLatest - aLatest; // Most recent first
        });

        return res.status(200).json({
            success: true,
            message: 'Friends stories retrieved successfully',
            data: {
                stories: storiesArray,
                count: storiesArray.length,
                totalStories: stories.length
            }
        });

    } catch (error) {
        console.error('Get all friends stories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve friends stories',
            error: error.message
        });
    }
};

// Upload media for stories (similar to posts)
const uploadStoryMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
                error: 'Please provide a media file in the request'
            });
        }

        const user = req.user; // From protect middleware

        // Validate user exists
        if (!user || !user._id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                error: 'User not authenticated'
            });
        }

        // Check if uploaded file is a video
        const isVideoFile = isVideo(req.file.mimetype);

        // Handle file upload based on storage type
        // diskUpload provides file.path, multer-s3 provides file.location and file.key
        let uploadResult;
        if (req.file.path) {
            // File was saved to disk (diskStorage) - upload to S3
            uploadResult = await StorageService.uploadFromPath(req.file.path);
        } else if (req.file.location && req.file.key) {
            // File was already uploaded via multer-s3
            uploadResult = await StorageService.uploadFromRequest(req.file);
        } else {
            throw new Error('Invalid file object: missing path (diskStorage) or location/key (multer-s3)');
        }

        // Determine media type from mimetype
        const mediaType = isVideoFile ? 'video' : 'image';
        const format = req.file.mimetype.split('/')[1] || 'unknown';

        return res.status(200).json({
            success: true,
            message: 'Story media uploaded successfully',
            data: {
                url: uploadResult.url,
                publicId: uploadResult.key, // Use key as publicId
                type: mediaType,
                format: format,
                fileSize: req.file.size
            }
        });

    } catch (error) {
        const errorMessage = error?.message || 'Unknown error occurred';
        const errorCode = error?.code;
        
        console.error('[StoryController] Story media upload error:', error);
        
        // Determine error status code and message based on error type
        let statusCode = 500;
        let userMessage = 'Failed to upload story media';
        
        // Handle DNS/network errors
        if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
            statusCode = 503;
            userMessage = 'Unable to connect to media upload service';
        } else if (errorMessage?.includes('file') || errorMessage?.includes('path')) {
            statusCode = 400;
            userMessage = 'File upload error';
        } else if (errorCode === 'LIMIT_FILE_SIZE') {
            statusCode = 400;
            userMessage = 'File size exceeds maximum limit';
        }

        // Return appropriate error response
        return res.status(statusCode).json({
            success: false,
            message: userMessage,
            error: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && errorCode ? { code: errorCode } : {})
        });
    }
};

module.exports = {
    createStory,
    getUserStories,
    getAllFriendsStories,
    uploadStoryMedia
};
