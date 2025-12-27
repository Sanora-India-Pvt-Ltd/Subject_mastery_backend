# Messaging API Documentation

Complete guide for all messaging REST API endpoints, including one-on-one and group conversations.

## Table of Contents
1. [Base URL](#base-url)
2. [Authentication Header](#authentication-header)
3. [Standard Response Shape](#standard-response-shape)
4. [Conversations](#conversations)
5. [One-on-One Conversations](#one-on-one-conversations)
6. [Group Conversations](#group-conversations)
7. [Messages](#messages)
8. [Message Management](#message-management)
9. [Unread Counts](#unread-counts)
10. [Error Handling](#error-handling)
11. [Notes for Frontend Integration](#notes-for-frontend-integration)

---

## Base URL

Use your environment configuration for the API origin.

**Local Development:**
```
http://localhost:3100
```

**Production:**
```
https://api.ulearnandearn.com
```

All endpoints below are relative to the base URL and prefixed with `/api/chat`.

---

## Authentication Header

All messaging endpoints require authentication:

```
Authorization: Bearer <access_token>
```

---

## Standard Response Shape

**Success Response:**
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

---

## Conversations

### Get All Conversations

Get all conversations (one-on-one and groups) for the authenticated user.

**Endpoint:** `GET /api/chat/conversations`

**Authentication:** Required

**Query Parameters:** None

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "conversation_id",
      "participants": [
        {
          "_id": "user_id",
          "name": "John Doe",
          "profileImage": "https://...",
          "isOnline": true,
          "lastSeen": "2024-01-15T10:30:00Z"
        }
      ],
      "isGroup": false,
      "groupName": null,
      "groupImage": null,
      "createdBy": null,
      "lastMessage": {
        "_id": "message_id",
        "text": "Hello!",
        "senderId": {
          "_id": "user_id",
          "name": "John Doe",
          "profileImage": "https://..."
        },
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "_id": "group_conversation_id",
      "participants": [
        {
          "_id": "user_id_1",
          "name": "John Doe",
          "profileImage": "https://...",
          "isOnline": true,
          "lastSeen": null
        },
        {
          "_id": "user_id_2",
          "name": "Jane Smith",
          "profileImage": "https://...",
          "isOnline": false,
          "lastSeen": "2024-01-15T10:25:00Z"
        }
      ],
      "isGroup": true,
      "groupName": "Project Team",
      "groupImage": "https://...",
      "createdBy": {
        "_id": "user_id_1",
        "name": "John Doe",
        "profileImage": "https://..."
      },
      "lastMessage": {
        "_id": "message_id",
        "text": "Meeting at 3pm",
        "senderId": {
          "_id": "user_id_2",
          "name": "Jane Smith",
          "profileImage": "https://..."
        },
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Notes:**
- Conversations are sorted by `lastMessageAt` (most recent first)
- Blocked users are automatically excluded from results
- For one-on-one conversations, `isGroup` is `false` and `groupName`/`groupImage`/`createdBy` are `null`
- For group conversations, `isGroup` is `true` and group metadata is included
- Each participant includes online status and last seen timestamp
- `otherParticipants` field is also included (participants excluding the current user)

**Error Responses:**
- `401` - Unauthorized (missing or invalid token)
- `500` - Server error

---

## One-on-One Conversations

### Get or Create One-on-One Conversation

Get an existing conversation with a specific user, or create a new one if it doesn't exist.

**Endpoint:** `GET /api/chat/conversation/:participantId`

**Authentication:** Required

**URL Parameters:**
- `participantId` (required) - The user ID of the other participant

**Rate Limiting:** Yes (see chat rate limiter middleware)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "conversation_id",
    "participants": [
      {
        "_id": "current_user_id",
        "name": "Current User",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      },
      {
        "_id": "participant_id",
        "name": "Other User",
        "profileImage": "https://...",
        "isOnline": false,
        "lastSeen": "2024-01-15T10:25:00Z"
      }
    ],
    "isGroup": false,
    "groupName": null,
    "groupImage": null,
    "createdBy": null,
    "lastMessage": {
      "_id": "message_id",
      "text": "Previous message",
      "senderId": {
        "_id": "participant_id",
        "name": "Other User",
        "profileImage": "https://..."
      },
      "createdAt": "2024-01-15T09:00:00Z"
    },
    "lastMessageAt": "2024-01-15T09:00:00Z",
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T09:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Participant ID is required / Cannot create conversation with yourself
- `403` - Cannot create conversation with a blocked user / Action not available
- `404` - User not found
- `401` - Unauthorized
- `429` - Too many requests (rate limited)
- `500` - Server error

**Notes:**
- If a conversation already exists between the two users, it returns the existing one
- If no conversation exists, a new one is created automatically
- Blocked users (in either direction) cannot be added to conversations
- The creator is automatically included in the participants array

---

## Group Conversations

### Create Group Conversation

Create a new group conversation with multiple participants.

**Endpoint:** `POST /api/chat/group`

**Authentication:** Required

**Request Body:**
```json
{
  "groupName": "Project Team",
  "participants": ["user_id_1", "user_id_2", "user_id_3"],
  "groupImage": "https://example.com/group-image.jpg"
}
```

**Fields:**
- `groupName` (required, string) - Name of the group (must be non-empty)
- `participants` (required, array) - Array of user IDs to add to the group (minimum 1 participant)
- `groupImage` (optional, string) - URL of the group image/avatar

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "_id": "group_conversation_id",
    "participants": [
      {
        "_id": "creator_user_id",
        "name": "Group Creator",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      },
      {
        "_id": "user_id_1",
        "name": "User One",
        "profileImage": "https://...",
        "isOnline": false,
        "lastSeen": "2024-01-15T10:20:00Z"
      },
      {
        "_id": "user_id_2",
        "name": "User Two",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      }
    ],
    "isGroup": true,
    "groupName": "Project Team",
    "groupImage": "https://example.com/group-image.jpg",
    "createdBy": {
      "_id": "creator_user_id",
      "name": "Group Creator",
      "profileImage": "https://..."
    },
    "lastMessage": null,
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `400` - Group name is required / At least one participant is required / One or more participants not found
- `403` - Cannot add blocked users to group / Cannot create group with users who have blocked you
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- The creator is automatically added as the first participant
- Duplicate participant IDs are automatically removed
- All participants must exist in the database
- Blocked users (in either direction) cannot be added to groups
- If `groupImage` is not provided or is an empty string, it will be set to `null`
- Group name is trimmed of whitespace

**Example Request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/chat/group \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Study Group",
    "participants": ["user_id_1", "user_id_2"],
    "groupImage": "https://example.com/study-group.jpg"
  }'
```

---

### Update Group Info

Update group information such as the group name. Only group admins or the creator can update group info.

**Endpoint:** `PUT /api/chat/group/:groupId`

**Authentication:** Required

**URL Parameters:**
- `groupId` (required) - The group conversation ID

**Request Body:**
```json
{
  "groupName": "Updated Group Name"
}
```

**Fields:**
- `groupName` (required, string) - New name for the group (must be non-empty)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Group info updated successfully",
  "data": {
    "_id": "group_conversation_id",
    "participants": [
      {
        "_id": "user_id_1",
        "name": "John Doe",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      },
      {
        "_id": "user_id_2",
        "name": "Jane Smith",
        "profileImage": "https://...",
        "isOnline": false,
        "lastSeen": "2024-01-15T10:25:00Z"
      }
    ],
    "isGroup": true,
    "groupName": "Updated Group Name",
    "groupImage": "https://...",
    "createdBy": {
      "_id": "creator_user_id",
      "name": "Group Creator",
      "profileImage": "https://..."
    },
    "admins": ["admin_user_id_1", "admin_user_id_2"],
    "lastMessage": null,
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Valid group ID is required / Group name cannot be empty / This is not a group conversation
- `403` - You are not a participant of this group / Only group admins or creator can update group info
- `404` - Group not found
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only group admins or the creator can update group information
- User must be a participant of the group
- Group name is trimmed of whitespace
- A WebSocket event `group:updated` is emitted to all group participants when the group is updated
- The event includes `groupId`, `groupName`, and `updatedBy` fields

**Example Request:**
```bash
curl -X PUT https://api.ulearnandearn.com/api/chat/group/group_id_123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "New Group Name"
  }'
```

---

### Upload Group Photo

Upload a group photo/avatar. Only group admins or the creator can upload group photos.

**Endpoint:** `POST /api/chat/group/:groupId/photo`

**Authentication:** Required

**URL Parameters:**
- `groupId` (required) - The group conversation ID

**Request Body:**
- `photo` (required, file) - Image file to upload (multipart/form-data)
  - Allowed formats: JPEG, PNG, GIF, WebP
  - Maximum file size: 20MB

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Group photo uploaded successfully",
  "data": {
    "id": "media_record_id",
    "url": "https://res.cloudinary.com/.../group_uploads/group_id/photos/image.jpg",
    "public_id": "group_uploads/group_id/photos/image",
    "format": "jpg",
    "fileSize": 1024000,
    "group": {
      "_id": "group_conversation_id",
      "participants": [
        {
          "_id": "user_id_1",
          "name": "John Doe",
          "profileImage": "https://...",
          "isOnline": true,
          "lastSeen": null
        }
      ],
      "isGroup": true,
      "groupName": "Project Team",
      "groupImage": "https://res.cloudinary.com/.../group_uploads/group_id/photos/image.jpg",
      "createdBy": {
        "_id": "creator_user_id",
        "name": "Group Creator",
        "profileImage": "https://..."
      },
      "lastMessage": null,
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    },
    "uploadedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Valid group ID is required / No file uploaded / Only image files are allowed for group photos (JPEG, PNG, GIF, WebP) / This is not a group conversation
- `403` - You are not a participant of this group / Only group admins or creator can upload group photo
- `404` - Group not found
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only group admins or the creator can upload group photos
- User must be a participant of the group
- Old group image is automatically deleted from Cloudinary when a new one is uploaded
- Image is optimized to 500x500 pixels with automatic cropping
- Image is stored in a group-specific folder: `group_uploads/{groupId}/photos/`
- Upload is tracked in the Media collection
- A WebSocket event `group:photo:updated` is emitted to all group participants when the photo is updated
- The event includes `groupId`, `groupImage`, and `updatedBy` fields

**Example Request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/chat/group/group_id_123/photo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "photo=@/path/to/group-photo.jpg"
```

**Using FormData (JavaScript):**
```javascript
const formData = new FormData();
formData.append('photo', fileInput.files[0]);

fetch('https://api.ulearnandearn.com/api/chat/group/group_id_123/photo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

---

### Remove Group Photo

Remove a group photo/avatar. Only group admins or the creator can remove group photos.

**Endpoint:** `DELETE /api/chat/group/:groupId/photo`

**Authentication:** Required

**URL Parameters:**
- `groupId` (required) - The group conversation ID

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Group photo removed successfully",
  "data": {
    "group": {
      "_id": "group_conversation_id",
      "participants": [
        {
          "_id": "user_id_1",
          "name": "John Doe",
          "profileImage": "https://...",
          "isOnline": true,
          "lastSeen": null
        }
      ],
      "isGroup": true,
      "groupName": "Project Team",
      "groupImage": null,
      "createdBy": {
        "_id": "creator_user_id",
        "name": "Group Creator",
        "profileImage": "https://..."
      },
      "lastMessage": null,
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

**Error Responses:**
- `400` - Valid group ID is required / This is not a group conversation
- `403` - You are not a participant of this group / Only group admins or creator can remove group photo
- `404` - Group not found / No group photo found to remove
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only group admins or the creator can remove group photos
- User must be a participant of the group
- Image is deleted from S3 storage and Media collection
- A WebSocket event `group:photo:removed` is emitted to all group participants when the photo is removed
- The event includes `groupId`, `groupImage: null`, and `removedBy` fields

**Example Request:**
```bash
curl -X DELETE https://api.ulearnandearn.com/api/chat/group/group_id_123/photo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Using fetch (JavaScript):**
```javascript
fetch('https://api.ulearnandearn.com/api/chat/group/group_id_123/photo', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
  .then(response => response.json())
  .then(data => console.log(data));
```

---

### Remove Group Member

Remove a member from a group. Only group admins or the creator can remove members.

**Endpoint:** `DELETE /api/chat/group/:groupId/member`

**Authentication:** Required

**URL Parameters:**
- `groupId` (required) - The group conversation ID

**Request Body:**
```json
{
  "memberId": "user_id_to_remove"
}
```

**Fields:**
- `memberId` (required, string) - The user ID of the member to remove from the group

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Member removed from group successfully",
  "data": {
    "_id": "group_conversation_id",
    "participants": [
      {
        "_id": "user_id_1",
        "name": "John Doe",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      }
    ],
    "isGroup": true,
    "groupName": "Project Team",
    "groupImage": "https://...",
    "createdBy": {
      "_id": "creator_user_id",
      "name": "Group Creator",
      "profileImage": "https://..."
    },
    "admins": ["admin_user_id_1"],
    "removedMember": {
      "_id": "removed_user_id",
      "name": "Removed User",
      "profileImage": "https://..."
    },
    "lastMessage": null,
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Valid group ID is required / Valid member ID is required / Cannot remove creator / Group creator cannot remove themselves from the group
- `403` - You are not a participant of this group / Only group admins or creator can remove members
- `404` - Group not found / Member not found in group
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only group admins or the creator can remove members
- User must be a participant of the group
- The group creator cannot be removed from the group
- If the removed member was an admin, they are also removed from the admins array
- A WebSocket event `group:member:removed` is emitted to all group participants when a member is removed
- A WebSocket event `group:removed` is emitted to the removed member to notify them
- The event includes `groupId`, `removedMemberId`, `removedMember`, `removedBy`, and updated `participants` list

**Example Request:**
```bash
curl -X DELETE https://api.ulearnandearn.com/api/chat/group/group_id_123/member \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "user_id_to_remove"
  }'
```

**Using fetch (JavaScript):**
```javascript
fetch('https://api.ulearnandearn.com/api/chat/group/group_id_123/member', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    memberId: 'user_id_to_remove'
  })
})
  .then(response => response.json())
  .then(data => console.log(data));
```

---

### Make Member Admin

Promote a group member to admin. Only existing admins or the creator can make members admin.

**Endpoint:** `POST /api/chat/group/:groupId/admin`

**Authentication:** Required

**URL Parameters:**
- `groupId` (required) - The group conversation ID

**Request Body:**
```json
{
  "memberId": "user_id_to_make_admin"
}
```

**Fields:**
- `memberId` (required, string) - The user ID of the member to promote to admin

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Member promoted to admin successfully",
  "data": {
    "_id": "group_conversation_id",
    "participants": [
      {
        "_id": "user_id_1",
        "name": "John Doe",
        "profileImage": "https://...",
        "isOnline": true,
        "lastSeen": null
      },
      {
        "_id": "user_id_2",
        "name": "Jane Smith",
        "profileImage": "https://...",
        "isOnline": false,
        "lastSeen": "2024-01-15T10:25:00Z"
      }
    ],
    "isGroup": true,
    "groupName": "Project Team",
    "groupImage": "https://...",
    "createdBy": {
      "_id": "creator_user_id",
      "name": "Group Creator",
      "profileImage": "https://..."
    },
    "admins": [
      {
        "_id": "admin_user_id_1",
        "name": "Admin One",
        "profileImage": "https://..."
      },
      {
        "_id": "new_admin_id",
        "name": "New Admin",
        "profileImage": "https://..."
      }
    ],
    "newAdmin": {
      "_id": "new_admin_id",
      "name": "New Admin",
      "profileImage": "https://..."
    },
    "lastMessage": null,
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Valid group ID is required / Valid member ID is required / User is already an admin
- `403` - You are not a participant of this group / Only group admins or creator can make members admin
- `404` - Group not found / User is not a member of this group
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only group admins or the creator can promote members to admin
- User must be a participant of the group
- The target user must already be a member of the group
- If the user is already an admin, the request will fail
- A WebSocket event `group:admin:added` is emitted to all group participants when a new admin is added
- The event includes `groupId`, `newAdminId`, `newAdmin`, `addedBy`, and updated `admins` list
- New admins have the same permissions as other admins and the creator (can update group info, upload photos, remove members, etc.)

**Example Request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/chat/group/group_id_123/admin \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "user_id_to_make_admin"
  }'
```

**Using fetch (JavaScript):**
```javascript
fetch('https://api.ulearnandearn.com/api/chat/group/group_id_123/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    memberId: 'user_id_to_make_admin'
  })
})
  .then(response => response.json())
  .then(data => console.log(data));
```

---

## Messages

### Get Messages for a Conversation

Retrieve messages for a specific conversation (one-on-one or group).

**Endpoint:** `GET /api/chat/conversation/:conversationId/messages`

**Authentication:** Required

**URL Parameters:**
- `conversationId` (required) - The conversation ID

**Query Parameters:**
- `page` (optional, default: 1) - Page number for pagination
- `limit` (optional, default: 50) - Number of messages per page

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "message_id",
      "conversationId": "conversation_id",
      "senderId": {
        "_id": "user_id",
        "name": "John Doe",
        "profileImage": "https://..."
      },
      "text": "Hello! How are you?",
      "media": [],
      "messageType": "text",
      "status": "read",
      "replyTo": null,
      "deletedAt": null,
      "deletedFor": [],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "_id": "message_id_2",
      "conversationId": "conversation_id",
      "senderId": {
        "_id": "user_id_2",
        "name": "Jane Smith",
        "profileImage": "https://..."
      },
      "text": null,
      "media": [
        {
          "url": "https://cloudinary.com/image.jpg",
          "type": "image",
          "filename": "photo.jpg",
          "size": 1024000
        }
      ],
      "messageType": "image",
      "status": "read",
      "replyTo": {
        "_id": "message_id",
        "text": "Hello! How are you?",
        "senderId": {
          "_id": "user_id",
          "name": "John Doe",
          "profileImage": "https://..."
        }
      },
      "deletedAt": null,
      "deletedFor": [],
      "createdAt": "2024-01-15T10:31:00Z",
      "updatedAt": "2024-01-15T10:31:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125
  }
}
```

**Notes:**
- Messages are returned in chronological order (oldest first)
- Messages deleted "for me" are excluded from results
- Messages deleted "for everyone" are excluded from results
- Unread messages are automatically marked as read when fetched
- Supports pagination with `page` and `limit` parameters
- `replyTo` field contains the original message if this is a reply

**Error Responses:**
- `403` - Not authorized to view this conversation
- `404` - Conversation not found
- `401` - Unauthorized
- `500` - Server error

---

### Send Message (REST API)

Send a message via REST API. **Note:** WebSocket is preferred for real-time messaging (see `CHAT_FRONTEND_SOCKET.md`).

**Endpoint:** `POST /api/chat/message`

**Authentication:** Required

**Rate Limiting:** Yes (see chat rate limiter middleware)

**Request Body:**
```json
{
  "conversationId": "conversation_id",
  "text": "Hello! This is a message.",
  "media": [
    {
      "url": "https://cloudinary.com/image.jpg",
      "type": "image",
      "filename": "photo.jpg",
      "size": 1024000
    }
  ],
  "messageType": "text",
  "replyTo": "message_id_to_reply_to"
}
```

**Fields:**
- `conversationId` (required, string) - The conversation ID
- `text` (optional, string) - Message text (required if no media)
- `media` (optional, array) - Array of media objects (required if no text)
- `messageType` (optional, string) - Type: `text`, `image`, `video`, or `file` (defaults based on content)
- `replyTo` (optional, string) - ID of message being replied to

**Media Object Structure:**
```json
{
  "url": "https://...",
  "type": "image" | "video" | "file",
  "filename": "filename.ext",
  "size": 1024000
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "_id": "message_id",
    "conversationId": "conversation_id",
    "senderId": {
      "_id": "user_id",
      "name": "John Doe",
      "profileImage": "https://..."
    },
    "text": "Hello! This is a message.",
    "media": [],
    "messageType": "text",
    "status": "sent",
    "replyTo": null,
    "deletedAt": null,
    "deletedFor": [],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `400` - Conversation ID is required / Message text or media is required / Audio messages are not allowed
- `403` - Not authorized to send message / Cannot send messages to blocked users / Action not available
- `404` - Conversation not found
- `401` - Unauthorized
- `429` - Too many requests (rate limited)
- `500` - Server error

**Notes:**
- At least one of `text` or `media` must be provided
- Audio messages are explicitly rejected
- The message is also emitted via WebSocket to all conversation participants
- Message status starts as `sent` and can be updated to `delivered` and `read` via WebSocket events

**Example Request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/chat/message \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conversation_id",
    "text": "Hello everyone!",
    "messageType": "text"
  }'
```

---

## Message Management

### Delete Message

Delete a message either "for me" (only removes from your view) or "for everyone" (removes for all participants).

**Endpoint:** `DELETE /api/chat/message/:messageId`

**Authentication:** Required

**URL Parameters:**
- `messageId` (required) - The message ID to delete

**Request Body:**
```json
{
  "deleteForEveryone": false
}
```

**Fields:**
- `deleteForEveryone` (optional, boolean) - If `true`, deletes for all participants (only sender can do this). If `false` or omitted, deletes only for the current user.

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Error Responses:**
- `403` - Not authorized (not a participant or not the sender for "for everyone" deletion)
- `404` - Message not found
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only the message sender can delete "for everyone"
- Any participant can delete "for me"
- When deleted "for everyone", the message is marked with `deletedAt` timestamp
- When deleted "for me", the user ID is added to `deletedFor` array
- Deletion events are emitted via WebSocket to all conversation participants

---

### Mark Messages as Read

Mark one or more messages as read in a conversation.

**Endpoint:** `POST /api/chat/messages/read`

**Authentication:** Required

**Request Body:**
```json
{
  "conversationId": "conversation_id",
  "messageIds": ["message_id_1", "message_id_2"]
}
```

**Fields:**
- `conversationId` (required, string) - The conversation ID
- `messageIds` (optional, array) - Specific message IDs to mark as read. If omitted, all unread messages in the conversation are marked as read.

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Messages marked as read",
  "count": 5
}
```

**Error Responses:**
- `400` - Conversation ID is required
- `403` - Not authorized (not a participant)
- `404` - Conversation not found
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only messages sent by other users are marked as read (not your own messages)
- Read receipts are emitted via WebSocket to all conversation participants
- If `messageIds` is provided, only those specific messages are marked as read
- If `messageIds` is omitted, all unread messages in the conversation are marked as read

---

## Unread Counts

### Get Unread Message Count

Get the total count of unread messages across all conversations.

**Endpoint:** `GET /api/chat/unread-count`

**Authentication:** Required

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "unreadCount": 15
  }
}
```

**Notes:**
- Returns the total count of unread messages across all conversations
- Only counts messages sent by other users
- Excludes deleted messages (both "for me" and "for everyone")

**Error Responses:**
- `401` - Unauthorized
- `500` - Server error

---

## Error Handling

### Common Error Codes

- **400 Bad Request** - Invalid request parameters or missing required fields
- **401 Unauthorized** - Missing or invalid authentication token
- **403 Forbidden** - Not authorized to perform the action (e.g., not a participant, blocked user)
- **404 Not Found** - Resource not found (user, conversation, message)
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error (details in `error` field in development mode)

### Error Response Format

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": "Detailed error stack (development only)"
}
```

### Handling Blocked Users

- You cannot create conversations with users you have blocked
- You cannot create conversations with users who have blocked you
- You cannot add blocked users to groups
- You cannot send messages to blocked users
- Blocked users are automatically excluded from conversation lists

---

## Notes for Frontend Integration

### Real-Time Messaging

**Important:** While REST API endpoints are available for sending messages, **WebSocket (Socket.IO) is the preferred method** for real-time messaging. The REST API should be used primarily for:
- Initial message fetching
- Fallback when WebSocket is unavailable
- Background sync operations

For WebSocket implementation, see:
- `CHAT_FRONTEND_SOCKET.md` - Frontend Socket.IO integration guide
- `SOCKET_MESSAGING_DOCUMENTATION.md` - Complete Socket.IO documentation
- `WEBSOCKET_TESTING_GUIDE.md` - Testing guide

### Rate Limiting

Some endpoints have rate limiting:
- `GET /api/chat/conversation/:participantId` - Limited requests per time window
- `POST /api/chat/message` - Limited message sending per time window

Handle `429 Too Many Requests` responses appropriately in your frontend.

### Pagination

When fetching messages, use pagination to avoid loading too many messages at once:
- Default limit is 50 messages per page
- Messages are returned in chronological order (oldest first)
- Use the `pagination.total` field to determine total pages

### Online Status

Participant online status is included in conversation responses:
- `isOnline: true` - User is currently online
- `isOnline: false` - User is offline
- `lastSeen` - Timestamp of when user was last seen (null if currently online)

### Message Status

Message status values:
- `sent` - Message has been sent
- `delivered` - Message has been delivered to recipient(s)
- `read` - Message has been read by recipient(s)

Status updates are handled via WebSocket events. See `CHAT_FRONTEND_SOCKET.md` for details.

### Group vs One-on-One

- **One-on-One:** `isGroup: false`, `groupName: null`, `groupImage: null`, `createdBy: null`
- **Group:** `isGroup: true`, `groupName: "..."`, `groupImage: "..."` (optional), `createdBy: {...}`

Always check the `isGroup` field to determine conversation type and display appropriate UI.

### Media Upload

For sending media messages:
1. Upload media files using the general media upload endpoint (`POST /api/media/upload`)
2. Use the returned URL in the `media` array when sending messages
3. See `VIDEO_TRANSCODING_FLOW.md` for video upload details

### Name and Profile Image Extraction

The API handles both old and new user schema formats:
- **New format:** `profile.name.full`, `profile.name.first`, `profile.name.last`, `profile.profileImage`
- **Old format:** `name`, `firstName`, `lastName`, `profileImage`

The API automatically extracts and returns the correct format, so frontend can rely on the `name` and `profileImage` fields in the response.

---

## Complete API Endpoint Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/chat/conversations` | Get all conversations | Yes |
| GET | `/api/chat/conversation/:participantId` | Get or create one-on-one conversation | Yes |
| POST | `/api/chat/group` | Create group conversation | Yes |
| PUT | `/api/chat/group/:groupId` | Update group info | Yes |
| POST | `/api/chat/group/:groupId/photo` | Upload group photo | Yes |
| DELETE | `/api/chat/group/:groupId/photo` | Remove group photo | Yes |
| DELETE | `/api/chat/group/:groupId/member` | Remove group member | Yes |
| POST | `/api/chat/group/:groupId/admin` | Make member admin | Yes |
| GET | `/api/chat/conversation/:conversationId/messages` | Get messages | Yes |
| POST | `/api/chat/message` | Send message (REST) | Yes |
| DELETE | `/api/chat/message/:messageId` | Delete message | Yes |
| POST | `/api/chat/messages/read` | Mark messages as read | Yes |
| GET | `/api/chat/unread-count` | Get unread count | Yes |

---

## Related Documentation

- `CHAT_SYSTEM_GUIDE.md` - System overview and architecture
- `CHAT_FRONTEND_SOCKET.md` - WebSocket/Socket.IO frontend integration
- `SOCKET_MESSAGING_DOCUMENTATION.md` - Complete Socket.IO reference
- `WEBSOCKET_TESTING_GUIDE.md` - Testing guide
- `API_DATA_FLOW_DOCUMENTATION.md` - General API documentation

---

**Last Updated:** 2024-01-15

**Recent Updates:**
- Added `PUT /api/chat/group/:groupId` - Update group info endpoint
- Added `POST /api/chat/group/:groupId/photo` - Upload group photo endpoint
- Added `DELETE /api/chat/group/:groupId/photo` - Remove group photo endpoint
- Added `DELETE /api/chat/group/:groupId/member` - Remove group member endpoint
- Added `POST /api/chat/group/:groupId/admin` - Make member admin endpoint

