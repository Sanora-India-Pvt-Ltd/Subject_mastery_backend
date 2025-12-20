/**
 * WebSocket Chat Testing Script
 * 
 * This script demonstrates how to test the WebSocket chat functionality.
 * 
 * Usage:
 * 1. Make sure your server is running
 * 2. Get a valid JWT access token (from login/signup)
 * 3. Update the TOKEN and SERVER_URL variables below
 * 4. Run: node test-websocket-chat.js
 */

const { io } = require('socket.io-client');

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================

// Your JWT access token (get this from login/signup API)
const TOKEN = 'YOUR_JWT_ACCESS_TOKEN_HERE';

// Server URL (use ws:// for local, wss:// for production)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3100';

// Test conversation ID (get this from GET /api/chat/conversations or create one)
const CONVERSATION_ID = 'YOUR_CONVERSATION_ID_HERE';

// ============================================
// WEBSOCKET CONNECTION
// ============================================

console.log('🔌 Connecting to WebSocket server...');
console.log(`   Server: ${SERVER_URL}`);
console.log(`   Token: ${TOKEN.substring(0, 20)}...`);

const socket = io(SERVER_URL, {
    auth: {
        token: TOKEN
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

// ============================================
// CONNECTION EVENTS
// ============================================

socket.on('connect', () => {
    console.log('\n✅ Connected to WebSocket server!');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Join the conversation room
    if (CONVERSATION_ID && CONVERSATION_ID !== 'YOUR_CONVERSATION_ID_HERE') {
        console.log(`\n📥 Joining conversation: ${CONVERSATION_ID}`);
        socket.emit('join:conversation', {
            conversationId: CONVERSATION_ID
        });
    } else {
        console.log('\n⚠️  Warning: No conversation ID set. Update CONVERSATION_ID to test messaging.');
    }
});

socket.on('connect_error', (error) => {
    console.error('\n❌ Connection error:', error.message);
    if (error.message.includes('Authentication error')) {
        console.error('   Make sure your JWT token is valid and not expired.');
    }
});

socket.on('disconnect', (reason) => {
    console.log(`\n❌ Disconnected: ${reason}`);
});

socket.on('error', (data) => {
    console.error('\n❌ Socket error:', data.message);
});

// ============================================
// MESSAGE EVENTS (Server → Client)
// ============================================

socket.on('new:message', (data) => {
    console.log('\n📨 New message received:');
    console.log('   Message ID:', data.message._id);
    console.log('   From:', data.message.senderId.name || data.message.senderId.firstName);
    console.log('   Text:', data.message.text || '(no text)');
    console.log('   Type:', data.message.messageType);
    console.log('   Status:', data.message.status);
    console.log('   Time:', new Date(data.message.createdAt).toLocaleString());
});

socket.on('message:sent', (data) => {
    console.log('\n✅ Message sent confirmation:');
    console.log('   Message ID:', data.messageId);
    console.log('   Conversation ID:', data.conversationId);
});

socket.on('message:delivered', (data) => {
    console.log('\n📬 Message delivered:');
    console.log('   Message ID:', data.messageId);
});

socket.on('messages:read', (data) => {
    console.log('\n👁️  Messages marked as read:');
    console.log('   Message IDs:', data.messageIds);
    console.log('   Read by:', data.readBy);
});

// ============================================
// TYPING INDICATORS
// ============================================

socket.on('typing:start', (data) => {
    console.log(`\n⌨️  User ${data.userId} is typing...`);
});

socket.on('typing:stop', (data) => {
    console.log(`\n⌨️  User ${data.userId} stopped typing`);
});

// ============================================
// PRESENCE EVENTS
// ============================================

socket.on('user:online', (data) => {
    console.log(`\n🟢 User ${data.userId} came online`);
});

socket.on('user:offline', (data) => {
    console.log(`\n🔴 User ${data.userId} went offline`);
});

// ============================================
// TEST FUNCTIONS
// ============================================

/**
 * Send a text message
 */
function sendTextMessage(conversationId, text) {
    if (!socket.connected) {
        console.error('❌ Not connected to server. Wait for connection first.');
        return;
    }

    console.log(`\n📤 Sending message to conversation ${conversationId}...`);
    
    socket.emit('send:message', {
        conversationId: conversationId,
        text: text,
        messageType: 'text'
    });
}

/**
 * Send a message with media
 */
function sendMediaMessage(conversationId, mediaUrl, mediaType = 'image') {
    if (!socket.connected) {
        console.error('❌ Not connected to server. Wait for connection first.');
        return;
    }

    console.log(`\n📤 Sending media message to conversation ${conversationId}...`);
    
    socket.emit('send:message', {
        conversationId: conversationId,
        media: [{
            url: mediaUrl,
            type: mediaType,
            filename: mediaUrl.split('/').pop(),
            size: 0 // You should provide actual size
        }],
        messageType: mediaType
    });
}

/**
 * Start typing indicator
 */
function startTyping(conversationId) {
    if (!socket.connected) {
        console.error('❌ Not connected to server. Wait for connection first.');
        return;
    }

    socket.emit('typing:start', {
        conversationId: conversationId
    });
    console.log(`\n⌨️  Started typing indicator`);
}

/**
 * Stop typing indicator
 */
function stopTyping(conversationId) {
    if (!socket.connected) {
        console.error('❌ Not connected to server. Wait for connection first.');
        return;
    }

    socket.emit('typing:stop', {
        conversationId: conversationId
    });
    console.log(`\n⌨️  Stopped typing indicator`);
}

/**
 * Mark messages as read
 */
function markMessagesAsRead(conversationId, messageIds = []) {
    if (!socket.connected) {
        console.error('❌ Not connected to server. Wait for connection first.');
        return;
    }

    socket.emit('message:read', {
        conversationId: conversationId,
        messageIds: messageIds // Empty array = mark all as read
    });
    console.log(`\n👁️  Marking messages as read`);
}

// ============================================
// INTERACTIVE TESTING (if running in Node.js)
// ============================================

// Wait a bit for connection, then demonstrate usage
setTimeout(() => {
    if (socket.connected && CONVERSATION_ID && CONVERSATION_ID !== 'YOUR_CONVERSATION_ID_HERE') {
        console.log('\n\n' + '='.repeat(50));
        console.log('🧪 TESTING FUNCTIONS');
        console.log('='.repeat(50));
        
        // Example: Send a test message after 2 seconds
        setTimeout(() => {
            sendTextMessage(CONVERSATION_ID, 'Hello! This is a test message from WebSocket.');
        }, 2000);
        
        // Example: Send another message after 5 seconds
        setTimeout(() => {
            sendTextMessage(CONVERSATION_ID, 'This is a second test message.');
        }, 5000);
        
        // Example: Start typing after 8 seconds
        setTimeout(() => {
            startTyping(CONVERSATION_ID);
        }, 8000);
        
        // Example: Stop typing after 10 seconds
        setTimeout(() => {
            stopTyping(CONVERSATION_ID);
        }, 10000);
        
        // Example: Mark messages as read after 12 seconds
        setTimeout(() => {
            markMessagesAsRead(CONVERSATION_ID);
        }, 12000);
        
    } else {
        console.log('\n\n' + '='.repeat(50));
        console.log('⚠️  SETUP REQUIRED');
        console.log('='.repeat(50));
        console.log('1. Update TOKEN with your JWT access token');
        console.log('2. Update CONVERSATION_ID with a valid conversation ID');
        console.log('3. Get conversation ID from: GET /api/chat/conversations');
        console.log('   Or create one: GET /api/chat/conversation/:participantId');
        console.log('\nYou can also use the functions manually:');
        console.log('  - sendTextMessage(conversationId, "Hello!")');
        console.log('  - startTyping(conversationId)');
        console.log('  - stopTyping(conversationId)');
        console.log('  - markMessagesAsRead(conversationId)');
    }
}, 1000);

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
});

// Export functions for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        socket,
        sendTextMessage,
        sendMediaMessage,
        startTyping,
        stopTyping,
        markMessagesAsRead
    };
}







