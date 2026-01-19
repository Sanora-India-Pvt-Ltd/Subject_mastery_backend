const Conversation = require('../../models/social/Conversation');
const Message = require('../../models/social/Message');
const User = require('../../models/authorization/User');
const Media = require('../../models/Media');
const mongoose = require('mongoose');
const StorageService = require('../../services/storage.service');
const { getIO } = require('../../socket/socketServer');
const { isUserOnline, getUserLastSeen } = require('../../config/redisStub');

// Helper function to get all blocked user IDs (checks both root and social.blockedUsers)
const getBlockedUserIds = async (userId) => {
    try {
        const user = await User.findById(userId).select('blockedUsers social.blockedUsers');
        if (!user) return [];
        
        // Get blocked users from both locations
        const rootBlocked = user.blockedUsers || [];
        const socialBlocked = user.social?.blockedUsers || [];
        
        // Combine and deduplicate
        const allBlocked = [...rootBlocked, ...socialBlocked];
        const uniqueBlocked = [...new Set(allBlocked.map(id => id.toString()))];
        
        return uniqueBlocked.map(id => new mongoose.Types.ObjectId(id));
    } catch (error) {
        console.error('Error getting blocked users:', error);
        return [];
    }
};

// Helper function to check if a user is blocked (checks both locations)
const isUserBlocked = async (blockerId, blockedId) => {
    try {
        const blockedUserIds = await getBlockedUserIds(blockerId);
        return blockedUserIds.some(id => id.toString() === blockedId.toString());
    } catch (error) {
        console.error('Error checking if user is blocked:', error);
        return false;
    }
};

// Get all conversations for a user
const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get current user's blocked users (from both locations)
        const blockedUserIds = await getBlockedUserIds(userId);

        const conversations = await Conversation.find({
            participants: userId,
            // Exclude conversations where all other participants are blocked
            $expr: {
                $gt: [
                    {
                        $size: {
                            $filter: {
                                input: '$participants',
                                as: 'p',
                                cond: {
                                    $and: [
                                        { $ne: ['$$p', userId] },
                                        { $not: { $in: ['$$p', blockedUserIds] } }
                                    ]
                                }
                            }
                        }
                    },
                    0
                ]
            }
        })
        .populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage')
        .populate('lastMessage')
        .populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage')
        .sort({ lastMessageAt: -1, updatedAt: -1 });

        // Batch fetch online status for all participants (fixes N+1 query problem)
        const allParticipantIds = new Set();
        conversations.forEach(conv => {
            conv.participants.forEach(p => {
                allParticipantIds.add(p._id.toString());
            });
        });

        // Batch check online status (using Promise.all for parallel execution)
        const onlineStatusMap = new Map();
        const lastSeenMap = new Map();
        await Promise.all(
            Array.from(allParticipantIds).map(async (participantId) => {
                const online = await isUserOnline(participantId);
                const lastSeen = await getUserLastSeen(participantId);
                onlineStatusMap.set(participantId, online);
                lastSeenMap.set(participantId, lastSeen);
            })
        );

        // Add online status for each participant (now using cached data)
        const conversationsWithStatus = conversations.map((conv) => {
            const otherParticipants = conv.participants.filter(
                p => p._id.toString() !== userId.toString()
            );

            const participantsWithStatus = conv.participants.map((participant) => {
                const participantId = participant._id.toString();
                const online = onlineStatusMap.get(participantId) || false;
                const lastSeen = lastSeenMap.get(participantId) || null;
                
                // Convert to plain object if needed
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                // Extract name from profile structure (new) or flat fields (old) with fallback - same as posts
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                // Extract profileImage from profile structure (new) or flat field (old) with fallback - same as posts
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            });

            return {
                ...conv,
                participants: participantsWithStatus,
                otherParticipants
            };
        });

        res.json({
            success: true,
            data: conversationsWithStatus
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get or create a conversation between two users
const getOrCreateConversation = async (req, res) => {
    try {
        const userId = req.user._id;
        const { participantId } = req.params;

        if (!participantId) {
            return res.status(400).json({
                success: false,
                message: 'Participant ID is required'
            });
        }

        if (userId.toString() === participantId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create conversation with yourself'
            });
        }

        // Check if other user exists
        const otherUser = await User.findById(participantId);
        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if either user has blocked the other (check both locations)
        const currentUserBlocked = await isUserBlocked(userId, participantId);
        if (currentUserBlocked) {
            return res.status(403).json({
                success: false,
                message: 'You cannot create a conversation with a blocked user'
            });
        }

        const otherUserBlocked = await isUserBlocked(participantId, userId);
        if (otherUserBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Action not available'
            });
        }

        // Find or create conversation
        const conversation = await Conversation.findOrCreateConversation(userId, participantId);

        // Populate last message if exists
        if (conversation.lastMessage) {
            await conversation.populate('lastMessage');
            await conversation.lastMessage.populate('senderId', 'profile.name.first profile.name.last profile.name.full profile.profileImage');
        }

        // Populate participants with profile fields if not already populated
        if (conversation.participants && conversation.participants.length > 0 && !conversation.participants[0].profile) {
            await conversation.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        }
        
        // Add online status
        const participantsWithStatus = await Promise.all(
            conversation.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                // Extract name from profile structure (new) or flat fields (old) with fallback
                let name = '';
                if (participantObj.profile?.name?.full) {
                    name = participantObj.profile.name.full;
                } else if (participantObj.profile?.name?.first || participantObj.profile?.name?.last) {
                    const first = participantObj.profile.name.first || '';
                    const last = participantObj.profile.name.last || '';
                    name = `${first} ${last}`.trim();
                } else if (participantObj.name) {
                    // Fallback to old flat name field
                    name = participantObj.name;
                } else if (participantObj.firstName || participantObj.lastName) {
                    // Fallback to old flat firstName/lastName fields
                    const first = participantObj.firstName || '';
                    const last = participantObj.lastName || '';
                    name = `${first} ${last}`.trim();
                }
                
                // Extract profileImage from profile structure (new) or flat field (old) with fallback
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        res.json({
            success: true,
            data: {
                ...conversation.toObject(),
                participants: participantsWithStatus
            }
        });
    } catch (error) {
        console.error('Get or create conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get or create conversation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Verify user is a participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const isParticipant = conversation.participants.some(
            p => p.toString() === userId.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this conversation'
            });
        }

        // Get messages
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const messages = await Message.find({
            conversationId,
            deletedAt: null,
            $or: [
                { deletedFor: { $ne: userId } },
                { deletedFor: { $exists: false } }
            ]
        })
        .populate('senderId', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage')
        .populate({
            path: 'replyTo',
            populate: {
                path: 'senderId',
                select: 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage'
            }
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

        // Reverse to get chronological order
        messages.reverse();
        
        // Transform messages to include proper sender name and profileImage
        const transformedMessages = messages.map(msg => {
            const msgObj = msg.toObject ? msg.toObject() : msg;
            const senderObj = msgObj.senderId?.toObject ? msgObj.senderId.toObject() : msgObj.senderId;
            
            // Extract name from profile structure (new) or flat fields (old) with fallback - same as posts
            const senderName = senderObj?.profile?.name?.full || 
                              (senderObj?.profile?.name?.first && senderObj?.profile?.name?.last 
                                  ? `${senderObj.profile.name.first} ${senderObj.profile.name.last}`.trim()
                                  : senderObj?.profile?.name?.first || senderObj?.profile?.name?.last || 
                                    senderObj?.name || 
                                    (senderObj?.firstName || senderObj?.lastName 
                                      ? `${senderObj.firstName || ''} ${senderObj.lastName || ''}`.trim()
                                      : ''));
            
            // Extract profileImage from profile structure (new) or flat field (old) with fallback
            const senderProfileImage = senderObj?.profile?.profileImage || senderObj?.profileImage || '';
            
            // Transform replyTo sender if exists
            let transformedReplyTo = null;
            if (msgObj.replyTo) {
                const replyToObj = msgObj.replyTo.toObject ? msgObj.replyTo.toObject() : msgObj.replyTo;
                const replyToSenderObj = replyToObj.senderId?.toObject ? replyToObj.senderId.toObject() : replyToObj.senderId;
                
                if (replyToSenderObj) {
                    const replyToSenderName = replyToSenderObj?.profile?.name?.full || 
                                            (replyToSenderObj?.profile?.name?.first && replyToSenderObj?.profile?.name?.last 
                                                ? `${replyToSenderObj.profile.name.first} ${replyToSenderObj.profile.name.last}`.trim()
                                                : replyToSenderObj?.profile?.name?.first || replyToSenderObj?.profile?.name?.last || 
                                                  replyToSenderObj?.name || 
                                                  (replyToSenderObj?.firstName || replyToSenderObj?.lastName 
                                                    ? `${replyToSenderObj.firstName || ''} ${replyToSenderObj.lastName || ''}`.trim()
                                                    : ''));
                    
                    const replyToSenderProfileImage = replyToSenderObj?.profile?.profileImage || replyToSenderObj?.profileImage || '';
                    
                    transformedReplyTo = {
                        ...replyToObj,
                        senderId: {
                            _id: replyToSenderObj._id,
                            name: replyToSenderName,
                            profileImage: replyToSenderProfileImage
                        }
                    };
                } else {
                    transformedReplyTo = replyToObj;
                }
            }
            
            return {
                ...msgObj,
                senderId: senderObj ? {
                    _id: senderObj._id,
                    name: senderName,
                    profileImage: senderProfileImage
                } : senderObj,
                replyTo: transformedReplyTo
            };
        });

        // Mark messages as read
        const unreadMessageIds = transformedMessages
            .filter(msg => 
                msg.senderId?._id?.toString() !== userId.toString() && 
                msg.status !== 'read'
            )
            .map(msg => msg._id);

        if (unreadMessageIds.length > 0) {
            await Message.updateMany(
                {
                    _id: { $in: unreadMessageIds },
                    conversationId
                },
                { status: 'read' }
            );

            // Emit read receipt via WebSocket
            const io = getIO();
            io.to(`conversation:${conversationId}`).emit('messages:read', {
                messageIds: unreadMessageIds,
                readBy: userId.toString(),
                conversationId
            });
        }

        res.json({
            success: true,
            data: transformedMessages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: await Message.countDocuments({
                    conversationId,
                    deletedAt: null,
                    $or: [
                        { deletedFor: { $ne: userId } },
                        { deletedFor: { $exists: false } }
                    ]
                })
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Send a message (REST API endpoint - WebSocket is preferred for real-time)
const sendMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId, text, media, messageType, replyTo } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation ID is required'
            });
        }

        if (!text && (!media || media.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Message text or media is required'
            });
        }

        // Verify conversation and authorization
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const isParticipant = conversation.participants.some(
            p => p.toString() === userId.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to send message'
            });
        }

        // Check if current user has blocked any participant or vice versa (check both locations)
        const otherParticipants = conversation.participants.filter(
            p => p.toString() !== userId.toString()
        );

        for (const participant of otherParticipants) {
            const currentUserBlocked = await isUserBlocked(userId, participant);
            if (currentUserBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot send messages to a blocked user'
                });
            }

            const otherUserBlocked = await isUserBlocked(participant, userId);
            if (otherUserBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'Action not available'
                });
            }
        }

        // Determine message type if not provided
        let detectedMessageType = messageType;
        if (!detectedMessageType && media && media.length > 0) {
            // Use the first media item's type, or default to 'image'
            detectedMessageType = media[0].type || 'image';
        } else if (!detectedMessageType) {
            detectedMessageType = 'text';
        }

        // Create message
        const messageData = {
            conversationId,
            senderId: userId,
            messageType: detectedMessageType,
            status: 'sent'
        };

        if (text) messageData.text = text;
        if (media && media.length > 0) messageData.media = media;
        if (replyTo) messageData.replyTo = replyTo;

        const message = await Message.create(messageData);
        await message.populate('senderId', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        if (message.replyTo) {
            await message.populate({
                path: 'replyTo',
                populate: {
                    path: 'senderId',
                    select: 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage'
                }
            });
        }

        // Transform message sender data
        const messageObj = message.toObject();
        const senderObj = messageObj.senderId?.toObject ? messageObj.senderId.toObject() : messageObj.senderId;
        
        // Extract name from profile structure (new) or flat fields (old) with fallback
        const senderName = senderObj?.profile?.name?.full || 
                          (senderObj?.profile?.name?.first && senderObj?.profile?.name?.last 
                              ? `${senderObj.profile.name.first} ${senderObj.profile.name.last}`.trim()
                              : senderObj?.profile?.name?.first || senderObj?.profile?.name?.last || 
                                senderObj?.name || 
                                (senderObj?.firstName || senderObj?.lastName 
                                  ? `${senderObj.firstName || ''} ${senderObj.lastName || ''}`.trim()
                                  : ''));
        
        // Extract profileImage from profile structure (new) or flat field (old) with fallback
        const senderProfileImage = senderObj?.profile?.profileImage || senderObj?.profileImage || '';
        
        const transformedMessage = {
            ...messageObj,
            senderId: senderObj ? {
                _id: senderObj._id,
                name: senderName,
                profileImage: senderProfileImage
            } : senderObj
        };

        // Update conversation
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Emit via WebSocket
        const io = getIO();
        io.to(`conversation:${conversationId}`).emit('new:message', {
            message: transformedMessage
        });

        res.json({
            success: true,
            data: transformedMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete a message
const deleteMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { messageId } = req.params;
        const { deleteForEveryone } = req.body;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user is sender or participant
        const conversation = await Conversation.findById(message.conversationId);
        const isParticipant = conversation.participants.some(
            p => p.toString() === userId.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (deleteForEveryone && message.senderId.toString() === userId.toString()) {
            // Delete for everyone (only sender can do this)
            message.deletedAt = new Date();
            await message.save();

            // Emit via WebSocket
            const io = getIO();
            io.to(`conversation:${message.conversationId}`).emit('message:deleted', {
                messageId,
                conversationId: message.conversationId
            });
        } else {
            // Delete for me only
            if (!message.deletedFor) {
                message.deletedFor = [];
            }
            message.deletedFor.push(userId);
            await message.save();
        }

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Mark messages as read
const markMessagesAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId, messageIds } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation ID is required'
            });
        }

        // Verify user is a participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const isParticipant = conversation.participants.some(
            p => p.toString() === userId.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Update message status
        const query = {
            conversationId,
            senderId: { $ne: userId },
            status: { $ne: 'read' }
        };

        if (messageIds && messageIds.length > 0) {
            query._id = { $in: messageIds };
        }

        const result = await Message.updateMany(query, { status: 'read' });

        // Emit via WebSocket
        const io = getIO();
        io.to(`conversation:${conversationId}`).emit('messages:read', {
            messageIds: messageIds || [],
            readBy: userId.toString(),
            conversationId
        });

        res.json({
            success: true,
            message: 'Messages marked as read',
            count: result.modifiedCount
        });
    } catch (error) {
        console.error('Mark messages as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark messages as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get unread message count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        }).select('_id');

        const conversationIds = conversations.map(c => c._id);

        const unreadCount = await Message.countDocuments({
            conversationId: { $in: conversationIds },
            senderId: { $ne: userId },
            status: { $ne: 'read' },
            deletedAt: null,
            $or: [
                { deletedFor: { $ne: userId } },
                { deletedFor: { $exists: false } }
            ]
        });

        res.json({
            success: true,
            data: {
                unreadCount
            }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create a group conversation
const createGroup = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupName, participants, groupImage } = req.body;

        // Validate group name
        if (!groupName || typeof groupName !== 'string' || groupName.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Group name is required'
            });
        }

        // Validate participants
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one participant is required'
            });
        }

        // Remove duplicates and ensure creator is included
        const uniqueParticipantIds = [...new Set(participants.map(id => id.toString()))];
        
        // Remove creator from participants array if present (will add them separately)
        const participantIds = uniqueParticipantIds
            .filter(id => id !== userId.toString())
            .map(id => new mongoose.Types.ObjectId(id));

        // Validate all participants exist
        const existingUsers = await User.find({
            _id: { $in: participantIds }
        }).select('_id');

        const existingUserIds = existingUsers.map(u => u._id.toString());
        const invalidParticipantIds = participantIds.filter(
            id => !existingUserIds.includes(id.toString())
        );

        if (invalidParticipantIds.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'One or more participants not found',
                invalidIds: invalidParticipantIds.map(id => id.toString())
            });
        }

        // Check for blocked users (check both locations)
        const blockedUserIds = await getBlockedUserIds(userId);
        const blockedParticipants = participantIds.filter(
            id => blockedUserIds.some(blockedId => blockedId.toString() === id.toString())
        );

        if (blockedParticipants.length > 0) {
            return res.status(403).json({
                success: false,
                message: 'Cannot add blocked users to group',
                blockedIds: blockedParticipants.map(id => id.toString())
            });
        }

        // Check if any participant has blocked the creator
        for (const participantId of participantIds) {
            const participantBlocked = await isUserBlocked(participantId, userId);
            if (participantBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot create group with users who have blocked you'
                });
            }
        }

        // Create group conversation with creator as first participant
        const allParticipants = [userId, ...participantIds];
        
        const groupConversation = await Conversation.create({
            participants: allParticipants,
            isGroup: true,
            groupName: groupName.trim(),
            groupImage: groupImage && groupImage.trim() !== '' ? groupImage.trim() : null,
            createdBy: userId
        });

        // Populate participants and creator
        await groupConversation.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await groupConversation.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            groupConversation.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                // Extract name from profile structure (new) or flat fields (old) with fallback
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                // Extract profileImage from profile structure (new) or flat field (old) with fallback
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator name and profileImage
        const creatorObj = groupConversation.createdBy?.toObject ? groupConversation.createdBy.toObject() : groupConversation.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: {
                ...groupConversation.toObject(),
                participants: participantsWithStatus,
                createdBy: creatorObj ? {
                    _id: creatorObj._id,
                    name: creatorName,
                    profileImage: creatorProfileImage
                } : null
            }
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update group info (name, etc.)
const updateGroupInfo = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;
        const { groupName } = req.body;

        // Validate group ID
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid group ID is required'
            });
        }

        // Find the group
        const group = await Conversation.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if it's a group
        if (!group.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group conversation'
            });
        }

        // Check if user is a participant
        const isParticipant = group.participants.some(
            p => p.toString() === userId.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant of this group'
            });
        }

        // Check if user is an admin or creator
        const isAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === userId.toString()
        );
        const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'Only group admins or creator can update group info'
            });
        }

        // Validate and update group name
        if (groupName !== undefined) {
            if (typeof groupName !== 'string' || groupName.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Group name cannot be empty'
                });
            }
            group.groupName = groupName.trim();
        }

        await group.save();

        // Populate for response
        await group.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await group.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');
        await group.populate('admins', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            group.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator info
        const creatorObj = group.createdBy?.toObject ? group.createdBy.toObject() : group.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        // Emit via WebSocket to notify all participants
        const io = getIO();
        io.to(`conversation:${groupId}`).emit('group:updated', {
            groupId: groupId,
            groupName: group.groupName,
            updatedBy: userId.toString()
        });

        res.json({
            success: true,
            message: 'Group info updated successfully',
            data: {
                ...group.toObject(),
                participants: participantsWithStatus,
                createdBy: creatorObj ? {
                    _id: creatorObj._id,
                    name: creatorName,
                    profileImage: creatorProfileImage
                } : null
            }
        });
    } catch (error) {
        console.error('Update group info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update group info',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Upload group photo
const uploadGroupPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user._id;
        const { groupId } = req.params;

        // Validate group ID
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid group ID is required'
            });
        }

        // Validate that it's an image
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Only image files are allowed for group photos (JPEG, PNG, GIF, WebP)'
            });
        }

        // Find the group
        const group = await Conversation.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if it's a group
        if (!group.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group conversation'
            });
        }

        // Check if user is a participant
        const isParticipant = group.participants.some(
            p => p.toString() === userId.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant of this group'
            });
        }

        // Check if user is an admin or creator
        const isAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === userId.toString()
        );
        const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'Only group admins or creator can upload group photo'
            });
        }

        // Group-specific folder path
        const groupFolder = `group_uploads/${groupId}/photos`;

        // Delete old group image from S3 if it exists
        if (group.groupImage) {
            try {
                // Find the media record to get the S3 key
                const oldMedia = await Media.findOne({ 
                    url: group.groupImage 
                });
                if (oldMedia && oldMedia.public_id) {
                    // public_id contains the S3 key
                    await StorageService.delete(oldMedia.public_id);
                }
                // Delete from Media collection
                await Media.findOneAndDelete({ 
                    url: group.groupImage 
                });
            } catch (deleteError) {
                // Log but don't fail if old image deletion fails
                console.warn('Failed to delete old group image:', deleteError.message);
            }
        }

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

        const format = req.file.mimetype.split('/')[1] || 'unknown';

        // Update group's groupImage field
        group.groupImage = uploadResult.url;
        await group.save();

        // Save upload record to database
        const mediaRecord = await Media.create({
            userId: userId, // Track who uploaded it
            url: uploadResult.url,
            public_id: uploadResult.key, // Store S3 key in public_id field for backward compatibility
            format: format,
            resource_type: 'image',
            fileSize: req.file.size,
            originalFilename: req.file.originalname,
            folder: 'group_uploads',
            provider: uploadResult.provider
        });

        // Populate for response
        await group.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await group.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            group.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator info
        const creatorObj = group.createdBy?.toObject ? group.createdBy.toObject() : group.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        // Emit via WebSocket to notify all participants
        const io = getIO();
        io.to(`conversation:${groupId}`).emit('group:photo:updated', {
            groupId: groupId,
            groupImage: uploadResult.url,
            updatedBy: userId.toString()
        });

        res.status(200).json({
            success: true,
            message: 'Group photo uploaded successfully',
            data: {
                id: mediaRecord._id,
                url: uploadResult.url,
                public_id: uploadResult.key,
                format: format,
                fileSize: req.file.size,
                group: {
                    ...group.toObject(),
                    participants: participantsWithStatus,
                    createdBy: creatorObj ? {
                        _id: creatorObj._id,
                        name: creatorName,
                        profileImage: creatorProfileImage
                    } : null
                },
                uploadedAt: mediaRecord.createdAt
            }
        });
    } catch (error) {
        console.error('Upload group photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload group photo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Remove group photo
const removeGroupPhoto = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;

        // Validate group ID
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid group ID is required'
            });
        }

        // Find the group
        const group = await Conversation.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if it's a group
        if (!group.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group conversation'
            });
        }

        // Check if user is a participant
        const isParticipant = group.participants.some(
            p => p.toString() === userId.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant of this group'
            });
        }

        // Check if user is an admin or creator
        const isAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === userId.toString()
        );
        const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'Only group admins or creator can remove group photo'
            });
        }

        // Check if group has a photo
        if (!group.groupImage) {
            return res.status(404).json({
                success: false,
                message: 'No group photo found to remove'
            });
        }

        const groupImageUrl = group.groupImage;

        // Find the media record to get the S3 key
        const media = await Media.findOne({ 
            url: groupImageUrl 
        });

        // Delete from S3 if media record exists
        if (media && media.public_id) {
            try {
                await StorageService.delete(media.public_id);
            } catch (deleteError) {
                console.warn('Failed to delete group photo from S3:', deleteError.message);
                // Continue with database deletion even if S3 deletion fails
            }
        }

        // Delete from Media collection if it exists
        if (media) {
            await Media.findByIdAndDelete(media._id);
        }

        // Clear group image from group record
        group.groupImage = null;
        await group.save();

        // Populate for response
        await group.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await group.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            group.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator info
        const creatorObj = group.createdBy?.toObject ? group.createdBy.toObject() : group.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        // Emit via WebSocket to notify all participants
        const io = getIO();
        io.to(`conversation:${groupId}`).emit('group:photo:removed', {
            groupId: groupId,
            groupImage: null,
            removedBy: userId.toString()
        });

        res.status(200).json({
            success: true,
            message: 'Group photo removed successfully',
            data: {
                group: {
                    ...group.toObject(),
                    participants: participantsWithStatus,
                    createdBy: creatorObj ? {
                        _id: creatorObj._id,
                        name: creatorName,
                        profileImage: creatorProfileImage
                    } : null
                }
            }
        });
    } catch (error) {
        console.error('Remove group photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove group photo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Remove a member from a group (admins/creator only)
const removeGroupMember = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;
        const { memberId } = req.body;

        // Validate group ID
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid group ID is required'
            });
        }

        // Validate member ID
        if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid member ID is required'
            });
        }

        // Find the group
        const group = await Conversation.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if it's a group
        if (!group.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group conversation'
            });
        }

        // Check if user is a participant
        const isParticipant = group.participants.some(
            p => p.toString() === userId.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant of this group'
            });
        }

        // Check if user is an admin or creator
        const isAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === userId.toString()
        );
        const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'Only group admins or creator can remove members'
            });
        }

        // Check if member to be removed exists in participants
        const memberObjectId = new mongoose.Types.ObjectId(memberId);
        const memberIndex = group.participants.findIndex(
            p => p.toString() === memberId.toString()
        );

        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Member not found in group'
            });
        }

        // Prevent removing the creator
        if (group.createdBy && group.createdBy.toString() === memberId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove the group creator'
            });
        }

        // Prevent removing yourself if you're an admin (optional - you might want to allow this)
        // For now, we'll allow admins to remove themselves, but not the creator
        if (memberId.toString() === userId.toString() && isCreator) {
            return res.status(400).json({
                success: false,
                message: 'Group creator cannot remove themselves from the group'
            });
        }

        // Remove member from participants
        group.participants = group.participants.filter(
            p => p.toString() !== memberId.toString()
        );

        // Remove from admins if they were an admin
        if (group.admins && group.admins.length > 0) {
            group.admins = group.admins.filter(
                adminId => adminId.toString() !== memberId.toString()
            );
        }

        await group.save();

        // Populate for response
        await group.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await group.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');
        await group.populate('admins', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            group.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator info
        const creatorObj = group.createdBy?.toObject ? group.createdBy.toObject() : group.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        // Get removed member info for WebSocket event
        const removedMember = await User.findById(memberId).select('profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        const removedMemberObj = removedMember?.toObject ? removedMember.toObject() : removedMember;
        const removedMemberName = removedMemberObj?.profile?.name?.full || 
                                 (removedMemberObj?.profile?.name?.first && removedMemberObj?.profile?.name?.last 
                                     ? `${removedMemberObj.profile.name.first} ${removedMemberObj.profile.name.last}`.trim()
                                     : removedMemberObj?.profile?.name?.first || removedMemberObj?.profile?.name?.last || 
                                       removedMemberObj?.name || 
                                       (removedMemberObj?.firstName || removedMemberObj?.lastName 
                                         ? `${removedMemberObj.firstName || ''} ${removedMemberObj.lastName || ''}`.trim()
                                         : ''));
        const removedMemberProfileImage = removedMemberObj?.profile?.profileImage || removedMemberObj?.profileImage || '';

        // Emit via WebSocket to notify all participants
        const io = getIO();
        io.to(`conversation:${groupId}`).emit('group:member:removed', {
            groupId: groupId,
            removedMemberId: memberId,
            removedMember: removedMemberObj ? {
                _id: removedMemberObj._id,
                name: removedMemberName,
                profileImage: removedMemberProfileImage
            } : null,
            removedBy: userId.toString(),
            participants: participantsWithStatus
        });

        // Also notify the removed member
        io.to(`user:${memberId}`).emit('group:removed', {
            groupId: groupId,
            groupName: group.groupName
        });

        res.json({
            success: true,
            message: 'Member removed from group successfully',
            data: {
                ...group.toObject(),
                participants: participantsWithStatus,
                createdBy: creatorObj ? {
                    _id: creatorObj._id,
                    name: creatorName,
                    profileImage: creatorProfileImage
                } : null,
                removedMember: removedMemberObj ? {
                    _id: removedMemberObj._id,
                    name: removedMemberName,
                    profileImage: removedMemberProfileImage
                } : null
            }
        });
    } catch (error) {
        console.error('Remove group member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove member from group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Make a member an admin (admins/creator only)
const addGroupAdmin = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;
        const { memberId } = req.body;

        // Validate group ID
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid group ID is required'
            });
        }

        // Validate member ID
        if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid member ID is required'
            });
        }

        // Find the group
        const group = await Conversation.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if it's a group
        if (!group.isGroup) {
            return res.status(400).json({
                success: false,
                message: 'This is not a group conversation'
            });
        }

        // Check if user is a participant
        const isParticipant = group.participants.some(
            p => p.toString() === userId.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant of this group'
            });
        }

        // Check if user is an admin or creator
        const isAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === userId.toString()
        );
        const isCreator = group.createdBy && group.createdBy.toString() === userId.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: 'Only group admins or creator can make members admin'
            });
        }

        // Check if member to be made admin exists in participants
        const memberObjectId = new mongoose.Types.ObjectId(memberId);
        const isMemberParticipant = group.participants.some(
            p => p.toString() === memberId.toString()
        );

        if (!isMemberParticipant) {
            return res.status(404).json({
                success: false,
                message: 'User is not a member of this group'
            });
        }

        // Check if user is already an admin
        const isAlreadyAdmin = group.admins && group.admins.some(
            adminId => adminId.toString() === memberId.toString()
        );

        if (isAlreadyAdmin) {
            return res.status(400).json({
                success: false,
                message: 'User is already an admin'
            });
        }

        // Initialize admins array if it doesn't exist
        if (!group.admins) {
            group.admins = [];
        }

        // Add member to admins array
        group.admins.push(memberObjectId);
        await group.save();

        // Populate for response
        await group.populate('participants', 'profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        await group.populate('createdBy', 'profile.name.first profile.name.last profile.name.full profile.profileImage');
        await group.populate('admins', 'profile.name.first profile.name.last profile.name.full profile.profileImage');

        // Add online status for participants
        const participantsWithStatus = await Promise.all(
            group.participants.map(async (participant) => {
                const online = await isUserOnline(participant._id.toString());
                const lastSeen = await getUserLastSeen(participant._id.toString());
                
                const participantObj = participant.toObject ? participant.toObject() : participant;
                
                const name = participantObj.profile?.name?.full || 
                            (participantObj.profile?.name?.first && participantObj.profile?.name?.last 
                                ? `${participantObj.profile.name.first} ${participantObj.profile.name.last}`.trim()
                                : participantObj.profile?.name?.first || participantObj.profile?.name?.last || 
                                  participantObj.name || 
                                  (participantObj.firstName || participantObj.lastName 
                                    ? `${participantObj.firstName || ''} ${participantObj.lastName || ''}`.trim()
                                    : ''));
                
                const profileImage = participantObj.profile?.profileImage || participantObj.profileImage || '';
                
                return {
                    _id: participantObj._id,
                    name: name,
                    profileImage: profileImage,
                    isOnline: online,
                    lastSeen: lastSeen
                };
            })
        );

        // Extract creator info
        const creatorObj = group.createdBy?.toObject ? group.createdBy.toObject() : group.createdBy;
        const creatorName = creatorObj?.profile?.name?.full || 
                          (creatorObj?.profile?.name?.first && creatorObj?.profile?.name?.last 
                              ? `${creatorObj.profile.name.first} ${creatorObj.profile.name.last}`.trim()
                              : creatorObj?.profile?.name?.first || creatorObj?.profile?.name?.last || 
                                creatorObj?.name || 
                                (creatorObj?.firstName || creatorObj?.lastName 
                                  ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim()
                                  : ''));
        const creatorProfileImage = creatorObj?.profile?.profileImage || creatorObj?.profileImage || '';

        // Get new admin info for WebSocket event
        const newAdmin = await User.findById(memberId).select('profile.name.first profile.name.last profile.name.full profile.profileImage firstName lastName name profileImage');
        const newAdminObj = newAdmin?.toObject ? newAdmin.toObject() : newAdmin;
        const newAdminName = newAdminObj?.profile?.name?.full || 
                           (newAdminObj?.profile?.name?.first && newAdminObj?.profile?.name?.last 
                               ? `${newAdminObj.profile.name.first} ${newAdminObj.profile.name.last}`.trim()
                               : newAdminObj?.profile?.name?.first || newAdminObj?.profile?.name?.last || 
                                 newAdminObj?.name || 
                                 (newAdminObj?.firstName || newAdminObj?.lastName 
                                   ? `${newAdminObj.firstName || ''} ${newAdminObj.lastName || ''}`.trim()
                                   : ''));
        const newAdminProfileImage = newAdminObj?.profile?.profileImage || newAdminObj?.profileImage || '';

        // Extract admins info
        const adminsWithStatus = await Promise.all(
            group.admins.map(async (admin) => {
                const adminObj = admin.toObject ? admin.toObject() : admin;
                const adminName = adminObj?.profile?.name?.full || 
                                  (adminObj?.profile?.name?.first && adminObj?.profile?.name?.last 
                                      ? `${adminObj.profile.name.first} ${adminObj.profile.name.last}`.trim()
                                      : adminObj?.profile?.name?.first || adminObj?.profile?.name?.last || 
                                        adminObj?.name || 
                                        (adminObj?.firstName || adminObj?.lastName 
                                          ? `${adminObj.firstName || ''} ${adminObj.lastName || ''}`.trim()
                                          : ''));
                const adminProfileImage = adminObj?.profile?.profileImage || adminObj?.profileImage || '';
                
                return {
                    _id: adminObj._id,
                    name: adminName,
                    profileImage: adminProfileImage
                };
            })
        );

        // Emit via WebSocket to notify all participants
        const io = getIO();
        io.to(`conversation:${groupId}`).emit('group:admin:added', {
            groupId: groupId,
            newAdminId: memberId,
            newAdmin: newAdminObj ? {
                _id: newAdminObj._id,
                name: newAdminName,
                profileImage: newAdminProfileImage
            } : null,
            addedBy: userId.toString(),
            admins: adminsWithStatus
        });

        res.json({
            success: true,
            message: 'Member promoted to admin successfully',
            data: {
                ...group.toObject(),
                participants: participantsWithStatus,
                admins: adminsWithStatus,
                createdBy: creatorObj ? {
                    _id: creatorObj._id,
                    name: creatorName,
                    profileImage: creatorProfileImage
                } : null,
                newAdmin: newAdminObj ? {
                    _id: newAdminObj._id,
                    name: newAdminName,
                    profileImage: newAdminProfileImage
                } : null
            }
        });
    } catch (error) {
        console.error('Add group admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to make member admin',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    deleteMessage,
    markMessagesAsRead,
    getUnreadCount,
    createGroup,
    updateGroupInfo,
    uploadGroupPhoto,
    removeGroupPhoto,
    removeGroupMember,
    addGroupAdmin
};

