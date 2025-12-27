const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const { limitMessageRequests, limitConversationRequests } = require('../../middleware/chatRateLimiter');
const upload = require('../../middleware/s3Upload');
const {
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
} = require('../../controllers/social/chatController');

// All routes require authentication
router.use(protect);

// Get all conversations for the authenticated user
router.get('/conversations', getConversations);

// Get or create a conversation with a specific user
router.get('/conversation/:participantId', limitConversationRequests, getOrCreateConversation);

// Create a group conversation
router.post('/group', createGroup);

// Update group info (admins/creator only)
router.put('/group/:groupId', updateGroupInfo);

// Upload group photo (admins/creator only)
router.post('/group/:groupId/photo', upload.single('photo'), uploadGroupPhoto);

// Remove group photo (admins/creator only)
router.delete('/group/:groupId/photo', removeGroupPhoto);

// Remove member from group (admins/creator only)
router.delete('/group/:groupId/member', removeGroupMember);

// Make a member an admin (admins/creator only)
router.post('/group/:groupId/admin', addGroupAdmin);

// Get messages for a conversation
router.get('/conversation/:conversationId/messages', getMessages);

// Send a message (REST API - WebSocket is preferred for real-time)
router.post('/message', limitMessageRequests, sendMessage);

// Delete a message
router.delete('/message/:messageId', deleteMessage);

// Mark messages as read
router.post('/messages/read', markMessagesAsRead);

// Get unread message count
router.get('/unread-count', getUnreadCount);

module.exports = router;

