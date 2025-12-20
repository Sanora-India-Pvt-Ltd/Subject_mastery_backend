# WebSocket Chat Testing Guide

This guide explains how to test the WebSocket chat functionality using Socket.IO.

## 📋 Prerequisites

1. **Server Running**: Make sure your server is running on port 3100 (or your configured port)
2. **JWT Token**: Get a valid access token from login/signup API
3. **Conversation ID**: Get a conversation ID from `GET /api/chat/conversations` or create one with `GET /api/chat/conversation/:participantId`

## 🔧 Installation

For Node.js testing, install the client library:

```bash
npm install socket.io-client
```

## 🧪 Testing Methods

### Method 1: HTML Test Page (Recommended for Quick Testing)

1. Open `test-websocket-chat.html` in your browser
2. Enter your server URL (e.g., `http://localhost:3100` or `https://api.ulearnandearn.com`)
3. Enter your JWT access token
4. Click "Connect"
5. Enter a conversation ID and click "Join Conversation"
6. Send messages and see real-time updates!

**Features:**
- ✅ Visual interface
- ✅ Real-time event logging
- ✅ Easy to use
- ✅ No installation needed (uses CDN)

### Method 2: Node.js Test Script

1. Install dependencies:
   ```bash
   npm install socket.io-client
   ```

2. Edit `test-websocket-chat.js`:
   - Update `TOKEN` with your JWT access token
   - Update `SERVER_URL` (default: `http://localhost:3100`)
   - Update `CONVERSATION_ID` with a valid conversation ID

3. Run the script:
   ```bash
   node test-websocket-chat.js
   ```

**Features:**
- ✅ Automated testing
- ✅ Programmatic control
- ✅ Can be integrated into test suites

### Method 3: Browser Console (Quick Test)

Open your browser's developer console and paste:

```javascript
// Load Socket.IO client (if not already loaded)
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
document.head.appendChild(script);

// Wait for script to load, then connect
setTimeout(() => {
    const socket = io('http://localhost:3100', {
        auth: {
            token: 'YOUR_JWT_TOKEN_HERE'
        }
    });
    
    socket.on('connect', () => {
        console.log('Connected!', socket.id);
        
        // Join conversation
        socket.emit('join:conversation', {
            conversationId: 'YOUR_CONVERSATION_ID_HERE'
        });
        
        // Listen for messages
        socket.on('new:message', (data) => {
            console.log('New message:', data.message);
        });
        
        // Send a message
        socket.emit('send:message', {
            conversationId: 'YOUR_CONVERSATION_ID_HERE',
            text: 'Hello from browser console!',
            messageType: 'text'
        });
    });
}, 1000);
```

## 📡 WebSocket Events Reference

### Client → Server Events

#### Connect
```javascript
const socket = io('http://localhost:3100', {
    auth: {
        token: 'YOUR_JWT_TOKEN'
    }
});
```

#### Join Conversation
```javascript
socket.emit('join:conversation', {
    conversationId: 'conversation_id'
});
```

#### Send Message
```javascript
socket.emit('send:message', {
    conversationId: 'conversation_id',
    text: 'Hello!',
    messageType: 'text', // 'text' | 'image' | 'video' | 'audio' | 'file'
    media: [], // Optional
    replyTo: 'message_id' // Optional
});
```

#### Typing Indicator
```javascript
// Start typing
socket.emit('typing:start', {
    conversationId: 'conversation_id'
});

// Stop typing
socket.emit('typing:stop', {
    conversationId: 'conversation_id'
});
```

#### Mark Messages as Read
```javascript
socket.emit('message:read', {
    conversationId: 'conversation_id',
    messageIds: [] // Empty array = mark all as read
});
```

### Server → Client Events

#### Connection Status
```javascript
socket.on('connect', () => {
    console.log('Connected!');
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});

socket.on('error', (data) => {
    console.error('Error:', data.message);
});
```

#### Messages
```javascript
// New message received
socket.on('new:message', (data) => {
    console.log('New message:', data.message);
});

// Message sent confirmation
socket.on('message:sent', (data) => {
    console.log('Message sent:', data.messageId);
});

// Message delivered
socket.on('message:delivered', (data) => {
    console.log('Message delivered:', data.messageId);
});

// Messages read
socket.on('messages:read', (data) => {
    console.log('Messages read:', data.messageIds);
});
```

#### Typing Indicators
```javascript
socket.on('typing:start', (data) => {
    console.log('User typing:', data.userId);
});

socket.on('typing:stop', (data) => {
    console.log('User stopped typing:', data.userId);
});
```

#### Presence
```javascript
socket.on('user:online', (data) => {
    console.log('User online:', data.userId);
});

socket.on('user:offline', (data) => {
    console.log('User offline:', data.userId);
});
```

## 🔍 Step-by-Step Testing Workflow

### 1. Get Your JWT Token

```bash
# Login to get token
curl -X POST "https://api.ulearnandearn.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "yourpassword"
  }'
```

Copy the `accessToken` from the response.

### 2. Get or Create a Conversation

```bash
# Get all conversations
curl -X GET "https://api.ulearnandearn.com/api/chat/conversations" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Or create a new conversation with a user
curl -X GET "https://api.ulearnandearn.com/api/chat/conversation/PARTICIPANT_USER_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Copy the `_id` from the conversation object.

### 3. Connect via WebSocket

Use one of the testing methods above with:
- **Token**: Your access token from step 1
- **Conversation ID**: Your conversation ID from step 2

### 4. Test Sending Messages

Send a message and verify:
- ✅ Message appears in the event log
- ✅ `message:sent` event is received
- ✅ If recipient is online, `message:delivered` is received
- ✅ Message is saved in database (check via REST API)

### 5. Test Real-Time Features

- **Typing Indicators**: Start/stop typing and verify events
- **Read Receipts**: Mark messages as read and verify `messages:read` event
- **Presence**: Connect with two users and verify online/offline events

## 🐛 Troubleshooting

### Connection Fails

**Error**: `Authentication error: Token required`
- **Solution**: Make sure you're passing the token in the `auth` object

**Error**: `Authentication error: Invalid token`
- **Solution**: Your token might be expired. Get a new token from login API

**Error**: `Connection refused`
- **Solution**: Make sure your server is running and accessible

### Messages Not Appearing

1. **Check Connection**: Verify socket is connected (`socket.connected === true`)
2. **Check Room**: Make sure you joined the conversation room (`join:conversation`)
3. **Check Authorization**: Verify you're a participant in the conversation
4. **Check Server Logs**: Look for errors in server console

### Events Not Firing

1. **Verify Event Names**: Make sure event names match exactly (case-sensitive)
2. **Check Listeners**: Ensure you're listening for events before they're emitted
3. **Check Server**: Verify server is emitting the events correctly

## 📚 Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [CHAT_SYSTEM_GUIDE.md](./CHAT_SYSTEM_GUIDE.md) - Full chat system documentation
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - REST API documentation

## 💡 Tips

1. **Use HTML Test Page**: Easiest way to test and see all events in real-time
2. **Test with Two Users**: Open two browser tabs with different tokens to test real-time messaging
3. **Check Network Tab**: Use browser DevTools Network tab to see WebSocket frames
4. **Monitor Server Logs**: Watch server console for connection and message logs

## 🎯 Quick Test Checklist

- [ ] Server is running
- [ ] JWT token is valid
- [ ] Conversation ID is valid
- [ ] WebSocket connection established
- [ ] Joined conversation room
- [ ] Can send messages
- [ ] Can receive messages
- [ ] Typing indicators work
- [ ] Read receipts work
- [ ] Presence (online/offline) works







