# Socket Messaging Documentation

Complete guide for implementing real-time messaging using Socket.IO WebSocket connections.

## Table of Contents

1. [Overview](#overview)
2. [Connection & Authentication](#connection--authentication)
3. [Socket Events Reference](#socket-events-reference)
4. [Message Types & Formats](#message-types--formats)
5. [Room Management](#room-management)
6. [Real-Time Features](#real-time-features)
7. [Error Handling](#error-handling)
8. [Integration Examples](#integration-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Socket Messaging system provides real-time bidirectional communication for chat functionality. It uses Socket.IO for WebSocket connections with fallback to HTTP long-polling.

### Key Features

- ✅ Real-time message delivery
- ✅ Typing indicators
- ✅ Read receipts (sent, delivered, read)
- ✅ User presence (online/offline)
- ✅ Message deletion
- ✅ Media support (images, videos, files)
- ✅ Message replies
- ✅ Blocked user protection
- ✅ Automatic reconnection

### Architecture

```
Client ←→ WebSocket (Socket.IO) ←→ Server ←→ MongoDB
                                      ↓
                                   Redis (Presence)
```

### Endpoints

- **WebSocket (Local)**: `ws://localhost:3100`
- **WebSocket (Production)**: `wss://api.ulearnandearn.com`
- **REST API Base (Local)**: `http://localhost:3100/api`
- **REST API Base (Production)**: `https://api.ulearnandearn.com/api`

---

## Connection & Authentication

### Establishing Connection

The socket connection requires JWT authentication. The token must be provided during connection initialization.

#### JavaScript/Web

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3100', {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN'
  },
  transports: ['websocket', 'polling'], // polling as fallback
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

#### Flutter/Dart

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io(
  'http://localhost:3100',
  IO.OptionBuilder()
    .setTransports(['websocket', 'polling'])
    .setAuth({'token': 'YOUR_JWT_ACCESS_TOKEN'})
    .enableReconnection()
    .setReconnectionDelay(1000)
    .setReconnectionAttempts(5)
    .build(),
);
```

#### React Native

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3100', {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN'
  },
  transports: ['websocket', 'polling']
});
```

### Authentication Methods

The server accepts the token in two ways:

1. **Via `auth` object** (Recommended):
   ```javascript
   auth: { token: 'YOUR_JWT_TOKEN' }
   ```

2. **Via Authorization header**:
   ```javascript
   headers: { authorization: 'Bearer YOUR_JWT_TOKEN' }
   ```

### Connection Events

```javascript
// Successful connection
socket.on('connect', () => {
  console.log('Connected!', socket.id);
  // User is now online
});

// Connection error
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // Common errors:
  // - "Authentication error: Token required"
  // - "Authentication error: Invalid token"
  // - "Authentication error: User not found"
});

// Disconnection
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // User is now offline
});

// Reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});
```

---

## Socket Events Reference

### Client → Server Events

#### 1. Join Conversation

Join a conversation room to receive real-time updates.

**Event**: `join:conversation`

**Payload**:
```javascript
{
  conversationId: 'string' // MongoDB ObjectId
}
```

**Example**:
```javascript
socket.emit('join:conversation', {
  conversationId: '507f1f77bcf86cd799439011'
});
```

**Response**: No direct response. Listen for `error` event if joining fails.

**Error Cases**:
- `{ message: 'Conversation not found' }` - Invalid conversation ID
- `{ message: 'Not authorized to join this conversation' }` - User is not a participant

---

#### 2. Leave Conversation

Leave a conversation room (optional, socket automatically leaves on disconnect).

**Event**: `leave:conversation`

**Payload**:
```javascript
{
  conversationId: 'string'
}
```

**Example**:
```javascript
socket.emit('leave:conversation', {
  conversationId: '507f1f77bcf86cd799439011'
});
```

---

#### 3. Send Message

Send a message to a conversation.

**Event**: `send:message`

**Payload**:
```javascript
{
  conversationId: 'string',      // Required
  text: 'string',                // Optional (required if no media)
  media: [                       // Optional (required if no text)
    {
      url: 'string',             // Required - Media URL from upload API
      type: 'image' | 'video' | 'file', // Required
      filename: 'string',        // Optional
      size: number               // Optional - File size in bytes
    }
  ],
  messageType: 'text' | 'image' | 'video' | 'file', // Required
  replyTo: 'string'              // Optional - Message ID to reply to
}
```

**Example - Text Message**:
```javascript
socket.emit('send:message', {
  conversationId: '507f1f77bcf86cd799439011',
  text: 'Hello, how are you?',
  messageType: 'text'
});
```

**Example - Media Message**:
```javascript
socket.emit('send:message', {
  conversationId: '507f1f77bcf86cd799439011',
  text: 'Check this out!', // Optional caption
  media: [{
    url: 'https://res.cloudinary.com/.../image.jpg',
    type: 'image',
    filename: 'photo.jpg',
    size: 245678
  }],
  messageType: 'image'
});
```

**Example - Reply to Message**:
```javascript
socket.emit('send:message', {
  conversationId: '507f1f77bcf86cd799439011',
  text: 'That sounds great!',
  messageType: 'text',
  replyTo: '507f1f77bcf86cd799439012' // Original message ID
});
```

**Validation Rules**:
- At least one of `text` or `media` must be provided
- `messageType` must match the content type
- Audio messages are **NOT supported** and will be rejected
- User must be a participant in the conversation
- Cannot send to blocked users

**Error Cases**:
- `{ message: 'Conversation not found' }`
- `{ message: 'Not authorized to send message' }`
- `{ message: 'You cannot send messages to a blocked user' }`
- `{ message: 'Audio messages are not allowed' }`
- `{ message: 'Failed to send message' }`

---

#### 4. Typing Indicator - Start

Notify other participants that user is typing.

**Event**: `typing:start`

**Payload**:
```javascript
{
  conversationId: 'string'
}
```

**Example**:
```javascript
socket.emit('typing:start', {
  conversationId: '507f1f77bcf86cd799439011'
});
```

**Best Practice**: Emit this when user starts typing, and emit `typing:stop` after a delay (e.g., 3 seconds) or when user stops typing.

---

#### 5. Typing Indicator - Stop

Notify other participants that user stopped typing.

**Event**: `typing:stop`

**Payload**:
```javascript
{
  conversationId: 'string'
}
```

**Example**:
```javascript
socket.emit('typing:stop', {
  conversationId: '507f1f77bcf86cd799439011'
});
```

---

#### 6. Mark Messages as Read

Mark one or more messages as read.

**Event**: `message:read`

**Payload**:
```javascript
{
  messageIds: ['string'],  // Array of message IDs (can be empty for all)
  conversationId: 'string' // Required
}
```

**Example - Mark Specific Messages**:
```javascript
socket.emit('message:read', {
  conversationId: '507f1f77bcf86cd799439011',
  messageIds: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
});
```

**Example - Mark All Messages in Conversation**:
```javascript
socket.emit('message:read', {
  conversationId: '507f1f77bcf86cd799439011',
  messageIds: [] // Empty array marks all unread messages
});
```

**Note**: Only messages from other users are marked as read. Your own messages are never marked as read.

---

### Server → Client Events

#### 1. New Message

Emitted when a new message is received in a conversation.

**Event**: `new:message`

**Payload**:
```javascript
{
  message: {
    _id: 'string',
    conversationId: 'string',
    senderId: {
      _id: 'string',
      name: 'string',
      profileImage: 'string'
    },
    text: 'string' | null,
    media: [
      {
        url: 'string',
        type: 'image' | 'video' | 'file',
        filename: 'string' | null,
        size: number | null
      }
    ],
    messageType: 'text' | 'image' | 'video' | 'file',
    status: 'sent' | 'delivered' | 'read',
    replyTo: {
      _id: 'string',
      text: 'string',
      senderId: {
        _id: 'string',
        name: 'string',
        profileImage: 'string'
      }
    } | null,
    createdAt: 'ISO Date String',
    updatedAt: 'ISO Date String'
  }
}
```

**Example Handler**:
```javascript
socket.on('new:message', ({ message }) => {
  console.log('New message:', message);
  // Add message to UI
  addMessageToChat(message);
});
```

---

#### 2. Message Sent Confirmation

Confirmation that your message was successfully sent and saved.

**Event**: `message:sent`

**Payload**:
```javascript
{
  messageId: 'string',
  conversationId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('message:sent', ({ messageId, conversationId }) => {
  console.log('Message sent:', messageId);
  // Update message status in UI to 'sent'
  updateMessageStatus(messageId, 'sent');
});
```

---

#### 3. Message Delivered

Emitted when a message is delivered to online recipients.

**Event**: `message:delivered`

**Payload**:
```javascript
{
  messageId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('message:delivered', ({ messageId }) => {
  console.log('Message delivered:', messageId);
  // Update message status in UI to 'delivered'
  updateMessageStatus(messageId, 'delivered');
});
```

**Note**: This event is only emitted if at least one recipient is online when the message is sent.

---

#### 4. Messages Read

Emitted when messages are marked as read by a recipient.

**Event**: `messages:read`

**Payload**:
```javascript
{
  messageIds: ['string'],
  readBy: 'string',        // User ID who read the messages
  conversationId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('messages:read', ({ messageIds, readBy, conversationId }) => {
  console.log('Messages read by:', readBy);
  // Update message status in UI to 'read'
  messageIds.forEach(id => updateMessageStatus(id, 'read'));
});
```

---

#### 5. Typing Indicator - Start

Emitted when another user starts typing.

**Event**: `typing:start`

**Payload**:
```javascript
{
  userId: 'string',
  conversationId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('typing:start', ({ userId, conversationId }) => {
  console.log('User typing:', userId);
  // Show typing indicator in UI
  showTypingIndicator(userId);
});
```

---

#### 6. Typing Indicator - Stop

Emitted when another user stops typing.

**Event**: `typing:stop`

**Payload**:
```javascript
{
  userId: 'string',
  conversationId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('typing:stop', ({ userId, conversationId }) => {
  console.log('User stopped typing:', userId);
  // Hide typing indicator in UI
  hideTypingIndicator(userId);
});
```

---

#### 7. User Online

Emitted when a user comes online.

**Event**: `user:online`

**Payload**:
```javascript
{
  userId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('user:online', ({ userId }) => {
  console.log('User online:', userId);
  // Update user status in UI
  updateUserStatus(userId, 'online');
});
```

---

#### 8. User Offline

Emitted when a user goes offline.

**Event**: `user:offline`

**Payload**:
```javascript
{
  userId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('user:offline', ({ userId }) => {
  console.log('User offline:', userId);
  // Update user status in UI
  updateUserStatus(userId, 'offline');
});
```

---

#### 9. Message Deleted

Emitted when a message is deleted.

**Event**: `message:deleted`

**Payload**:
```javascript
{
  messageId: 'string',
  conversationId: 'string'
}
```

**Example Handler**:
```javascript
socket.on('message:deleted', ({ messageId, conversationId }) => {
  console.log('Message deleted:', messageId);
  // Remove message from UI or show "This message was deleted"
  removeMessageFromUI(messageId);
});
```

---

#### 10. Group Photo Updated

Emitted when a group photo is uploaded or updated. All group participants receive this event.

**Event**: `group:photo:updated`

**Payload**:
```javascript
{
  groupId: 'string',        // Group conversation ID
  groupImage: 'string',      // New group photo URL
  updatedBy: 'string'        // User ID who updated the photo
}
```

**Example Handler**:
```javascript
socket.on('group:photo:updated', ({ groupId, groupImage, updatedBy }) => {
  console.log('Group photo updated:', groupId, groupImage);
  // Update group photo in UI
  updateGroupPhoto(groupId, groupImage);
});
```

**Note**: This event is emitted to all participants in the group conversation room (`conversation:{groupId}`).

---

#### 11. Group Photo Removed

Emitted when a group photo is removed. All group participants receive this event.

**Event**: `group:photo:removed`

**Payload**:
```javascript
{
  groupId: 'string',        // Group conversation ID
  groupImage: null,         // Always null when removed
  removedBy: 'string'       // User ID who removed the photo
}
```

**Example Handler**:
```javascript
socket.on('group:photo:removed', ({ groupId, groupImage, removedBy }) => {
  console.log('Group photo removed:', groupId);
  // Remove group photo from UI (show default avatar)
  updateGroupPhoto(groupId, null);
});
```

**Note**: This event is emitted to all participants in the group conversation room (`conversation:{groupId}`).

---

#### 12. Error

Emitted when an error occurs.

**Event**: `error`

**Payload**:
```javascript
{
  message: 'string' // Error description
}
```

**Example Handler**:
```javascript
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
  // Show error to user
  showError(message);
});
```

**Common Error Messages**:
- `'Conversation not found'`
- `'Not authorized to join this conversation'`
- `'Not authorized to send message'`
- `'You cannot send messages to a blocked user'`
- `'Action not available'` (User has blocked you)
- `'Audio messages are not allowed'`
- `'Failed to send message'`
- `'Failed to join conversation'`
- `'Failed to mark messages as read'`

---

## Message Types & Formats

### Text Messages

Simple text-only messages.

```javascript
{
  conversationId: 'string',
  text: 'Hello, world!',
  messageType: 'text'
}
```

### Media Messages

Messages containing images, videos, or files. Media must be uploaded first via REST API.

#### Upload Media (REST API)

**Endpoint**: `POST /api/media/upload`

**Content-Type**: `multipart/form-data`

**Field Name**: `media`

**Max File Size**: 20MB

**Supported Types**: Images (JPEG, PNG, GIF, WebP) and Videos (MP4, MOV, AVI, etc.)

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/.../image.jpg",
    "type": "image",
    "format": "jpg",
    "fileSize": 245678,
    "filename": "image.jpg"
  }
}
```

#### Send Media Message

```javascript
// Step 1: Upload file
const formData = new FormData();
formData.append('media', file);

const uploadResponse = await fetch('/api/media/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const uploadData = await uploadResponse.json();

// Step 2: Send message via WebSocket
socket.emit('send:message', {
  conversationId: 'string',
  text: 'Optional caption',
  media: [{
    url: uploadData.data.url,
    type: uploadData.data.type, // 'image' | 'video' | 'file'
    filename: file.name,
    size: uploadData.data.fileSize
  }],
  messageType: uploadData.data.type
});
```

### Reply Messages

Messages that reply to another message.

```javascript
{
  conversationId: 'string',
  text: 'This is a reply',
  messageType: 'text',
  replyTo: '507f1f77bcf86cd799439012' // Original message ID
}
```

The `replyTo` field will be populated with the original message data in the response.

---

## Room Management

### Conversation Rooms

Each conversation has its own room: `conversation:{conversationId}`

### User Rooms

Each user has a personal room: `user:{userId}`

### Joining Rooms

You must join a conversation room to receive messages for that conversation:

```javascript
socket.on('connect', () => {
  // Join all active conversations
  activeConversations.forEach(conv => {
    socket.emit('join:conversation', {
      conversationId: conv._id
    });
  });
});
```

### Best Practices

1. **Join on Connect**: Join all active conversations when socket connects
2. **Join on Open**: Join conversation when user opens a chat
3. **Leave on Close**: Optionally leave when user closes a chat (not required)
4. **Rejoin on Reconnect**: Rejoin all conversations after reconnection

---

## Real-Time Features

### Typing Indicators

Show when users are typing in a conversation.

**Implementation**:
```javascript
let typingTimeout;

function handleTyping(conversationId) {
  // Clear existing timeout
  clearTimeout(typingTimeout);
  
  // Emit typing start
  socket.emit('typing:start', { conversationId });
  
  // Set timeout to stop typing after 3 seconds
  typingTimeout = setTimeout(() => {
    socket.emit('typing:stop', { conversationId });
  }, 3000);
}

// On input change
inputElement.addEventListener('input', () => {
  handleTyping(conversationId);
});

// On input blur
inputElement.addEventListener('blur', () => {
  socket.emit('typing:stop', { conversationId });
});
```

### Read Receipts

Track message delivery status: `sent` → `delivered` → `read`

**Status Flow**:
1. **Sent**: Message created and saved
2. **Delivered**: At least one recipient is online
3. **Read**: Recipient has viewed the message

**Implementation**:
```javascript
// Mark messages as read when conversation is viewed
function markConversationAsRead(conversationId, messageIds) {
  socket.emit('message:read', {
    conversationId,
    messageIds // Empty array for all, or specific IDs
  });
}

// Update UI when status changes
socket.on('message:delivered', ({ messageId }) => {
  updateMessageStatus(messageId, 'delivered');
});

socket.on('messages:read', ({ messageIds }) => {
  messageIds.forEach(id => updateMessageStatus(id, 'read'));
});
```

### User Presence

Track when users are online or offline.

**Implementation**:
```javascript
socket.on('user:online', ({ userId }) => {
  updateUserPresence(userId, 'online');
});

socket.on('user:offline', ({ userId }) => {
  updateUserPresence(userId, 'offline');
});
```

**Note**: Presence is automatically managed. Users are set online on connect and offline on disconnect.

---

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  switch (error.message) {
    case 'Authentication error: Token required':
      // Redirect to login
      redirectToLogin();
      break;
    case 'Authentication error: Invalid token':
      // Refresh token or redirect to login
      refreshToken();
      break;
    default:
      // Show generic error
      showError('Connection failed. Please try again.');
  }
});
```

### Socket Errors

```javascript
socket.on('error', ({ message }) => {
  // Handle specific errors
  if (message.includes('blocked')) {
    showError('You cannot send messages to this user');
  } else if (message.includes('not authorized')) {
    showError('You are not authorized to perform this action');
  } else {
    showError(message);
  }
});
```

### Reconnection Strategy

```javascript
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected, reconnect manually
    socket.connect();
  }
  // Otherwise, socket will automatically reconnect
});

socket.on('reconnect', () => {
  // Rejoin all conversations
  rejoinAllConversations();
});
```

---

## Integration Examples

### Complete React Hook Example

```javascript
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

function useSocketMessaging(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3100', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    newSocket.on('new:message', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('typing:start', ({ userId }) => {
      setTypingUsers(prev => new Set([...prev, userId]));
    });

    newSocket.on('typing:stop', ({ userId }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const joinConversation = (conversationId) => {
    if (socket && connected) {
      socket.emit('join:conversation', { conversationId });
    }
  };

  const sendMessage = (conversationId, text, media = []) => {
    if (socket && connected) {
      socket.emit('send:message', {
        conversationId,
        text,
        media,
        messageType: media.length > 0 ? media[0].type : 'text'
      });
    }
  };

  const startTyping = (conversationId) => {
    if (socket && connected) {
      socket.emit('typing:start', { conversationId });
    }
  };

  const stopTyping = (conversationId) => {
    if (socket && connected) {
      socket.emit('typing:stop', { conversationId });
    }
  };

  const markAsRead = (conversationId, messageIds = []) => {
    if (socket && connected) {
      socket.emit('message:read', { conversationId, messageIds });
    }
  };

  return {
    socket,
    connected,
    messages,
    typingUsers,
    joinConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead
  };
}
```

### Complete Flutter Example

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketMessagingService {
  IO.Socket? _socket;
  bool _connected = false;
  final List<Function(Map<String, dynamic>)> _messageListeners = [];
  final List<Function(String)> _typingListeners = [];

  void connect(String token) {
    _socket = IO.io(
      'http://localhost:3100',
      IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .setAuth({'token': token})
        .enableReconnection()
        .build(),
    );

    _socket!.onConnect((_) {
      _connected = true;
      print('Socket connected');
    });

    _socket!.onDisconnect((_) {
      _connected = false;
      print('Socket disconnected');
    });

    _socket!.on('new:message', (data) {
      for (var listener in _messageListeners) {
        listener(data);
      }
    });

    _socket!.on('typing:start', (data) {
      final userId = data['userId'];
      for (var listener in _typingListeners) {
        listener(userId);
      }
    });

    _socket!.on('error', (data) {
      print('Socket error: $data');
    });
  }

  void joinConversation(String conversationId) {
    if (_socket != null && _connected) {
      _socket!.emit('join:conversation', {'conversationId': conversationId});
    }
  }

  void sendMessage({
    required String conversationId,
    String? text,
    List<Map<String, dynamic>>? media,
  }) {
    if (_socket != null && _connected) {
      _socket!.emit('send:message', {
        'conversationId': conversationId,
        'text': text,
        'media': media ?? [],
        'messageType': media != null && media.isNotEmpty
            ? media[0]['type']
            : 'text',
      });
    }
  }

  void startTyping(String conversationId) {
    if (_socket != null && _connected) {
      _socket!.emit('typing:start', {'conversationId': conversationId});
    }
  }

  void stopTyping(String conversationId) {
    if (_socket != null && _connected) {
      _socket!.emit('typing:stop', {'conversationId': conversationId});
    }
  }

  void markAsRead(String conversationId, List<String> messageIds) {
    if (_socket != null && _connected) {
      _socket!.emit('message:read', {
        'conversationId': conversationId,
        'messageIds': messageIds,
      });
    }
  }

  void onMessage(Function(Map<String, dynamic>) listener) {
    _messageListeners.add(listener);
  }

  void onTyping(Function(String) listener) {
    _typingListeners.add(listener);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _connected = false;
  }
}
```

---

## Best Practices

### 1. Connection Management

- ✅ Connect socket when app starts or user logs in
- ✅ Disconnect socket when user logs out
- ✅ Handle reconnection automatically
- ✅ Rejoin conversations after reconnection

### 2. Room Management

- ✅ Join conversations when user opens them
- ✅ Join all active conversations on connect
- ✅ Rejoin conversations after reconnection

### 3. Message Handling

- ✅ Store messages locally for offline access
- ✅ Sync with REST API periodically
- ✅ Handle message status updates (sent → delivered → read)
- ✅ Show loading state while sending

### 4. Typing Indicators

- ✅ Debounce typing events (wait 1-3 seconds before stopping)
- ✅ Stop typing when user sends message
- ✅ Stop typing when user leaves input field

### 5. Read Receipts

- ✅ Mark messages as read when conversation is viewed
- ✅ Mark messages as read when user scrolls to bottom
- ✅ Update UI when read status changes

### 6. Error Handling

- ✅ Show user-friendly error messages
- ✅ Handle network errors gracefully
- ✅ Retry failed operations
- ✅ Log errors for debugging

### 7. Performance

- ✅ Limit number of active socket connections
- ✅ Use pagination for message history
- ✅ Lazy load conversations
- ✅ Optimize media uploads

### 8. Security

- ✅ Always use HTTPS/WSS in production
- ✅ Validate tokens before connecting
- ✅ Handle token expiration
- ✅ Respect blocked user restrictions

---

## Troubleshooting

### Connection Issues

**Problem**: Socket won't connect

**Solutions**:
1. Verify server is running and accessible
2. Check token is valid and not expired
3. Verify CORS settings on server
4. Check network connectivity
5. Try using polling transport as fallback

**Problem**: Connection drops frequently

**Solutions**:
1. Check network stability
2. Increase reconnection delay
3. Implement exponential backoff
4. Check server logs for errors

### Message Issues

**Problem**: Messages not appearing

**Solutions**:
1. Verify you joined the conversation room
2. Check you're listening for `new:message` event
3. Verify you're a participant in the conversation
4. Check server logs for errors
5. Verify message wasn't blocked

**Problem**: Messages not sending

**Solutions**:
1. Check socket is connected
2. Verify conversation ID is valid
3. Check you're a participant
4. Verify message format is correct
5. Check for error events

### Typing Indicators Not Working

**Solutions**:
1. Verify you're emitting `typing:start` and `typing:stop`
2. Check you're listening for typing events
3. Verify conversation room is joined
4. Check debounce logic

### Read Receipts Not Updating

**Solutions**:
1. Verify you're emitting `message:read` event
2. Check you're listening for `messages:read` event
3. Verify message IDs are correct
4. Check user is a participant

---

## Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [CHAT_FRONTEND_SOCKET.md](./CHAT_FRONTEND_SOCKET.md) - Frontend-focused guide
- [WEBSOCKET_TESTING_GUIDE.md](./WEBSOCKET_TESTING_GUIDE.md) - Testing guide
- [CHAT_SYSTEM_GUIDE.md](./CHAT_SYSTEM_GUIDE.md) - Complete chat system documentation

---

## Quick Reference

### Connection
```javascript
const socket = io('http://localhost:3100', {
  auth: { token: 'JWT_TOKEN' },
  transports: ['websocket', 'polling']
});
```

### Join Conversation
```javascript
socket.emit('join:conversation', { conversationId: 'ID' });
```

### Send Message
```javascript
socket.emit('send:message', {
  conversationId: 'ID',
  text: 'Hello',
  messageType: 'text'
});
```

### Listen for Messages
```javascript
socket.on('new:message', ({ message }) => {
  // Handle message
});
```

### Typing
```javascript
socket.emit('typing:start', { conversationId: 'ID' });
socket.emit('typing:stop', { conversationId: 'ID' });
```

### Read Receipts
```javascript
socket.emit('message:read', {
  conversationId: 'ID',
  messageIds: []
});
```

---

**Last Updated**: 2024

