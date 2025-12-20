# Real-Time Chat System Guide

This guide explains how to use the real-time chat system implemented with Socket.IO, MongoDB, and Redis.

## 🎯 Features

- ✅ Real-time messaging via WebSocket (Socket.IO)
- ✅ Typing indicators
- ✅ Read receipts (sent → delivered → read)
- ✅ Online/Offline presence
- ✅ Message status tracking
- ✅ Media support (images, videos, audio, files)
- ✅ Message deletion (for me / for everyone)
- ✅ Reply to messages
- ✅ Rate limiting & security
- ✅ Redis scaling support (multi-server)

## 📋 Database Models

### Conversation Model
- `participants`: Array of user IDs
- `lastMessage`: Reference to last message
- `lastMessageAt`: Timestamp of last message
- `isGroup`: Boolean (for future group chat support)
- `createdAt`, `updatedAt`: Timestamps

### Message Model
- `conversationId`: Reference to conversation
- `senderId`: Reference to user who sent the message
- `text`: Message text (nullable)
- `media`: Array of media objects (url, type, filename, size)
- `messageType`: 'text' | 'image' | 'video' | 'audio' | 'file'
- `status`: 'sent' | 'delivered' | 'read'
- `replyTo`: Reference to message being replied to
- `deletedAt`: Timestamp if deleted
- `deletedFor`: Array of user IDs who deleted the message
- `createdAt`, `updatedAt`: Timestamps

## 🔌 WebSocket Events

### ⚠️ Important: Protocol Usage

**REST API Endpoints:**
- Use `https://` or `http://` for REST API calls
- Example: `https://api.ulearnandearn.com/api/chat/conversations`

**WebSocket Connection:**
- Use `ws://` or `wss://` for Socket.IO connections (no `/api/chat` path)
- Example: `ws://localhost:3100` or `wss://api.ulearnandearn.com`

**Do NOT use `wss://` for REST API endpoints!**

### Client → Server Events

#### Authentication
Connect with JWT token:
```javascript
// Local development
const socket = io('http://localhost:3100', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Production
const socket = io('wss://api.ulearnandearn.com', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

#### Join Conversation
```javascript
socket.emit('join:conversation', {
  conversationId: 'conversation_id_here'
});
```

#### Leave Conversation
```javascript
socket.emit('leave:conversation', {
  conversationId: 'conversation_id_here'
});
```

#### Send Message
```javascript
socket.emit('send:message', {
  conversationId: 'conversation_id_here',
  text: 'Hello!', // Optional if media is provided
  media: [ // Optional
    {
      url: 'https://example.com/image.jpg',
      type: 'image',
      filename: 'image.jpg',
      size: 1024000
    }
  ],
  messageType: 'text', // 'text' | 'image' | 'video' | 'audio' | 'file'
  replyTo: 'message_id_here' // Optional
});
```

#### Typing Indicator
```javascript
// Start typing
socket.emit('typing:start', {
  conversationId: 'conversation_id_here'
});

// Stop typing
socket.emit('typing:stop', {
  conversationId: 'conversation_id_here'
});
```

#### Mark Messages as Read
```javascript
socket.emit('message:read', {
  messageIds: ['message_id_1', 'message_id_2'],
  conversationId: 'conversation_id_here'
});
```

### Server → Client Events

#### New Message
```javascript
socket.on('new:message', (data) => {
  console.log('New message:', data.message);
  // data.message contains full message object with sender info
});
```

#### Message Sent (Confirmation)
```javascript
socket.on('message:sent', (data) => {
  console.log('Message sent:', data.messageId);
});
```

#### Message Delivered
```javascript
socket.on('message:delivered', (data) => {
  console.log('Message delivered:', data.messageId);
});
```

#### Messages Read
```javascript
socket.on('messages:read', (data) => {
  console.log('Messages read:', data.messageIds);
  console.log('Read by:', data.readBy);
});
```

#### Typing Indicator
```javascript
socket.on('typing:start', (data) => {
  console.log('User typing:', data.userId);
});

socket.on('typing:stop', (data) => {
  console.log('User stopped typing:', data.userId);
});
```

#### User Online/Offline
```javascript
socket.on('user:online', (data) => {
  console.log('User online:', data.userId);
});

socket.on('user:offline', (data) => {
  console.log('User offline:', data.userId);
});
```

#### Message Deleted
```javascript
socket.on('message:deleted', (data) => {
  console.log('Message deleted:', data.messageId);
});
```

#### Error
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

## 🌐 REST API Endpoints

All endpoints require authentication (Bearer token in Authorization header).

### Get All Conversations
```
GET /api/chat/conversations
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id",
      "participants": [
        {
          "_id": "user_id",
          "firstName": "John",
          "lastName": "Doe",
          "name": "John Doe",
          "profileImage": "https://...",
          "isOnline": true,
          "lastSeen": 1234567890
        }
      ],
      "lastMessage": {
        "_id": "message_id",
        "text": "Hello!",
        "senderId": {...},
        "status": "read",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "lastMessageAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get or Create Conversation
```
GET /api/chat/conversation/:participantId
```

Creates a new conversation with the specified user, or returns existing one.

### Get Messages
```
GET /api/chat/conversation/:conversationId/messages?page=1&limit=50
```

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Messages per page (default: 50)

Response:
```json
{
  "success": true,
  "data": [
    {
      "_id": "message_id",
      "conversationId": "conversation_id",
      "senderId": {
        "_id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "profileImage": "https://..."
      },
      "text": "Hello!",
      "media": [],
      "messageType": "text",
      "status": "read",
      "replyTo": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

### Send Message (REST API)
```
POST /api/chat/message
```

Body:
```json
{
  "conversationId": "conversation_id",
  "text": "Hello!",
  "media": [
    {
      "url": "https://example.com/image.jpg",
      "type": "image",
      "filename": "image.jpg",
      "size": 1024000
    }
  ],
  "messageType": "text",
  "replyTo": "message_id"
}
```

**Note:** WebSocket is preferred for real-time messaging. Use REST API only when WebSocket is unavailable.

### Delete Message
```
DELETE /api/chat/message/:messageId
```

Body:
```json
{
  "deleteForEveryone": true // false = delete for me only
}
```

### Mark Messages as Read
```
POST /api/chat/messages/read
```

Body:
```json
{
  "conversationId": "conversation_id",
  "messageIds": ["message_id_1", "message_id_2"] // Optional, marks all if not provided
}
```

### Get Unread Count
```
GET /api/chat/unread-count
```

Response:
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

## 🔒 Security Features

### 1. JWT Authentication
- All WebSocket connections require JWT token
- Token is verified before allowing connection
- Invalid tokens are rejected

### 2. Authorization
- Users can only join conversations they're participants in
- Users can only send messages to their conversations
- Message deletion is restricted to sender (for everyone) or participant (for me)

### 3. Rate Limiting
- **Messages**: Max 30 messages per minute per user
- **Conversations**: Max 10 conversations per hour per user
- Returns 429 status with `retryAfter` in seconds

### 4. Media Protection
- Use Cloudinary signed URLs or AWS S3 pre-signed URLs
- Media URLs should expire after a certain time
- Validate media types and sizes on upload

## 📦 Frontend Integration Example

### React Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function ChatComponent({ userId, token }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io('http://localhost:3100', {
      auth: {
        token: token
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
    });

    newSocket.on('new:message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    newSocket.on('typing:start', (data) => {
      if (data.userId !== userId) {
        setIsTyping(true);
      }
    });

    newSocket.on('typing:stop', (data) => {
      if (data.userId !== userId) {
        setIsTyping(false);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, userId]);

  const sendMessage = (conversationId, text) => {
    socket.emit('send:message', {
      conversationId,
      text,
      messageType: 'text'
    });
  };

  const startTyping = (conversationId) => {
    socket.emit('typing:start', { conversationId });
  };

  const stopTyping = (conversationId) => {
    socket.emit('typing:stop', { conversationId });
  };

  return (
    <div>
      {/* Chat UI */}
    </div>
  );
}
```

### React Native Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function ChatScreen({ userId, token }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://your-server.com', {
      auth: {
        token: token
      },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Connected');
    });

    newSocket.on('new:message', (data) => {
      // Handle new message
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  // Rest of your component
}
```

## 🚀 Setup & Configuration

### Environment Variables

Add to your `.env` file:

```env
# Redis (optional, for scaling)
REDIS_URL=redis://localhost:6379
# Or for Redis Cloud:
# REDIS_URL=redis://username:password@host:port

# Client URL for CORS
CLIENT_URL=http://localhost:3000
```

### Redis Setup (Optional)

Redis is optional but recommended for:
- Multi-server scaling
- Presence tracking
- Better performance

**Local Redis:**
```bash
# Install Redis
# macOS: brew install redis
# Linux: sudo apt-get install redis-server
# Windows: Download from https://redis.io/download

# Start Redis
redis-server
```

**Redis Cloud (Free):**
1. Sign up at https://redis.com/try-free/
2. Create a database
3. Copy connection URL
4. Add to `.env` as `REDIS_URL`

### Install Dependencies

```bash
npm install socket.io @socket.io/redis-adapter ioredis
```

## 📊 Message Flow

1. **User sends message** → WebSocket emits `send:message`
2. **Server validates** → Checks conversation & authorization
3. **Server saves to DB** → Creates message in MongoDB
4. **Server updates conversation** → Updates `lastMessage` and `lastMessageAt`
5. **Server emits to room** → All participants receive `new:message`
6. **Status updates** → `sent` → `delivered` (if online) → `read` (when viewed)

## 🔄 Offline Support

- Messages are stored in database
- When user comes online, fetch messages via REST API
- WebSocket reconnects automatically
- Unread messages are marked when fetched

## 📱 Push Notifications (Future)

To add push notifications:

1. Install Firebase Admin SDK
2. Store FCM tokens in user model
3. When message is sent and receiver is offline:
   - Send push notification via FCM
   - Include message preview and conversation ID

## 🐛 Troubleshooting

### WebSocket Connection Fails
- Check JWT token is valid
- Verify CORS settings
- Check server logs for errors

### Messages Not Appearing
- Verify user is in conversation room
- Check conversation participants
- Verify message was saved to database

### Redis Connection Issues
- App works without Redis (single server only)
- Check Redis URL format
- Verify Redis server is running

### Rate Limit Errors
- Wait for `retryAfter` seconds
- Reduce message frequency
- Check rate limit configuration

## 📚 Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [MongoDB Mongoose](https://mongoosejs.com/)
- [Redis Documentation](https://redis.io/documentation)
- [JWT Authentication](https://jwt.io/)


