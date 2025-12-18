# Friend API Documentation

**Base URL:** `https://api.ulearnandearn.com/api/friend`

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Friend Request Management](#friend-request-management)
   - [Send Friend Request](#1-send-friend-request)
   - [Accept Friend Request](#2-accept-friend-request)
   - [Reject Friend Request](#3-reject-friend-request)
   - [Cancel Sent Friend Request](#4-cancel-sent-friend-request)
4. [Friend List Management](#friend-list-management)
   - [List All Friends](#5-list-all-friends)
   - [List Received Friend Requests](#6-list-received-friend-requests)
   - [List Sent Friend Requests](#7-list-sent-friend-requests)
   - [Unfriend a User](#8-unfriend-a-user)
5. [Friend Suggestions](#friend-suggestions)
   - [Get Friend Suggestions](#9-get-friend-suggestions)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

---

## Overview

The Friend API provides endpoints for managing friendships, friend requests, and discovering new friends. All endpoints require authentication and support blocking functionality to prevent interactions with blocked users.

### Key Features:
- **Friend Requests**: Send, accept, reject, and cancel friend requests
- **Friend Management**: List friends, unfriend users
- **Friend Suggestions**: Get personalized friend suggestions based on mutual friends
- **Blocking Support**: Automatically excludes blocked users from all operations
- **Bidirectional Friendship**: When a friend request is accepted, both users are added to each other's friend list

### Friend Request Status:
- `pending`: Request has been sent but not yet accepted/rejected
- `accepted`: Request has been accepted, users are now friends
- `rejected`: Request has been rejected

---

## Authentication

All friend API endpoints require authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

**Note:** The access token is obtained from the authentication endpoints. See [AUTH_API_DOCUMENTATION.md](./AUTH_API_DOCUMENTATION.md) for details.

---

## Friend Request Management

### 1. Send Friend Request

**Method:** `POST`  
**URL:** `/api/friend/send/:receiverId`  
**Authentication:** Required

**Description:**  
Send a friend request to another user. The request will be in `pending` status until the receiver accepts or rejects it.

**URL Parameters:**
- `receiverId` (string, required): The MongoDB ObjectId of the user to send the friend request to

**Request Example:**
```bash
curl -X POST https://api.ulearnandearn.com/api/friend/send/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Friend request sent successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "sender": {
      "_id": "507f1f77bcf86cd799439010",
      "profile": {
        "name": {
          "first": "John",
          "last": "Doe",
          "full": "John Doe"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile.jpg",
        "email": "john@example.com"
      }
    },
    "receiver": {
      "_id": "507f1f77bcf86cd799439011",
      "profile": {
        "name": {
          "first": "Jane",
          "last": "Smith",
          "full": "Jane Smith"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile2.jpg",
        "email": "jane@example.com"
      }
    },
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid receiver ID | The receiverId is not a valid MongoDB ObjectId |
| 400 | You cannot send a friend request to yourself | Attempting to send request to yourself |
| 400 | You are already friends with this user | Users are already friends |
| 400 | You have already sent a friend request to this user | A pending request already exists |
| 400 | This user has already sent you a friend request. Please accept or reject it first. | The other user has already sent you a request |
| 400 | A friend request already exists between these users | Duplicate request detected |
| 403 | You cannot send a friend request to a blocked user | Sender has blocked the receiver |
| 403 | Action not available | Receiver has blocked the sender |
| 404 | User not found | The receiverId does not exist |
| 500 | Failed to send friend request | Internal server error |

**Validation Rules:**
- Cannot send request to yourself
- Cannot send request if already friends
- Cannot send request if a pending request already exists (in either direction)
- Cannot send request to blocked users
- Cannot send request if you are blocked by the receiver

---

### 2. Accept Friend Request

**Method:** `POST`  
**URL:** `/api/friend/accept/:requestId`  
**Authentication:** Required

**Description:**  
Accept a pending friend request. When accepted, both users are automatically added to each other's friend list, and the request status is updated to `accepted`.

**URL Parameters:**
- `requestId` (string, required): The MongoDB ObjectId of the friend request to accept

**Request Example:**
```bash
curl -X POST https://api.ulearnandearn.com/api/friend/accept/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Friend request accepted successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "sender": {
      "_id": "507f1f77bcf86cd799439010",
      "profile": {
        "name": {
          "first": "John",
          "last": "Doe",
          "full": "John Doe"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile.jpg",
        "email": "john@example.com"
      }
    },
    "receiver": {
      "_id": "507f1f77bcf86cd799439011",
      "profile": {
        "name": {
          "first": "Jane",
          "last": "Smith",
          "full": "Jane Smith"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile2.jpg",
        "email": "jane@example.com"
      }
    },
    "status": "accepted",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid request ID | The requestId is not a valid MongoDB ObjectId |
| 400 | This friend request has already been accepted | Request was already accepted |
| 400 | This friend request has already been rejected | Request was already rejected |
| 403 | You can only accept friend requests sent to you | Attempting to accept a request you didn't receive |
| 403 | You cannot accept a friend request from a blocked user | Sender is blocked by receiver |
| 403 | Action not available | Receiver is blocked by sender |
| 404 | Friend request not found | The requestId does not exist |
| 500 | Failed to accept friend request | Internal server error |

**Notes:**
- Only the receiver of a friend request can accept it
- After acceptance, both users are added to each other's `friends` array
- The request status is updated to `accepted` for historical tracking

---

### 3. Reject Friend Request

**Method:** `POST`  
**URL:** `/api/friend/reject/:requestId`  
**Authentication:** Required

**Description:**  
Reject a pending friend request. The request status is updated to `rejected`, but the request is kept in the database for audit purposes.

**URL Parameters:**
- `requestId` (string, required): The MongoDB ObjectId of the friend request to reject

**Request Example:**
```bash
curl -X POST https://api.ulearnandearn.com/api/friend/reject/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Friend request rejected successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "sender": {
      "_id": "507f1f77bcf86cd799439010",
      "profile": {
        "name": {
          "first": "John",
          "last": "Doe",
          "full": "John Doe"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile.jpg",
        "email": "john@example.com"
      }
    },
    "receiver": {
      "_id": "507f1f77bcf86cd799439011",
      "profile": {
        "name": {
          "first": "Jane",
          "last": "Smith",
          "full": "Jane Smith"
        },
        "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile2.jpg",
        "email": "jane@example.com"
      }
    },
    "status": "rejected",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid request ID | The requestId is not a valid MongoDB ObjectId |
| 400 | This friend request has already been accepted | Request was already accepted |
| 400 | This friend request has already been rejected | Request was already rejected |
| 403 | You can only reject friend requests sent to you | Attempting to reject a request you didn't receive |
| 404 | Friend request not found | The requestId does not exist |
| 500 | Failed to reject friend request | Internal server error |

**Notes:**
- Only the receiver of a friend request can reject it
- Rejected requests are kept in the database for audit purposes
- Users can send a new friend request after rejection

---

### 4. Cancel Sent Friend Request

**Method:** `DELETE`  
**URL:** `/api/friend/cancel/:requestId`  
**Authentication:** Required

**Description:**  
Cancel a pending friend request that you sent. This permanently deletes the request from the database.

**URL Parameters:**
- `requestId` (string, required): The MongoDB ObjectId of the friend request to cancel

**Request Example:**
```bash
curl -X DELETE https://api.ulearnandearn.com/api/friend/cancel/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Friend request cancelled successfully"
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid request ID | The requestId is not a valid MongoDB ObjectId |
| 400 | This friend request has already been accepted | Cannot cancel an accepted request |
| 400 | This friend request has already been rejected | Cannot cancel a rejected request |
| 403 | You can only cancel friend requests you sent | Attempting to cancel a request you didn't send |
| 404 | Friend request not found | The requestId does not exist |
| 500 | Failed to cancel friend request | Internal server error |

**Notes:**
- Only the sender of a friend request can cancel it
- Can only cancel requests with `pending` status
- Cancelled requests are permanently deleted (unlike rejected requests which are kept)

---

## Friend List Management

### 5. List All Friends

**Method:** `GET`  
**URL:** `/api/friend/list`  
**Authentication:** Required

**Description:**  
Get a list of all users who are friends with the authenticated user. Blocked users are automatically excluded from the results.

**Query Parameters:**
- None

**Request Example:**
```bash
curl -X GET https://api.ulearnandearn.com/api/friend/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Friends retrieved successfully",
  "data": {
    "friends": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Jane Smith",
        "profileImage": "https://example.com/profile2.jpg"
      },
      {
        "_id": "507f1f77bcf86cd799439013",
        "name": "Bob Johnson",
        "profileImage": "https://example.com/profile3.jpg"
      }
    ],
    "count": 2
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 404 | User not found | The authenticated user does not exist |
| 500 | Failed to retrieve friends | Internal server error |

**Notes:**
- Blocked users are automatically filtered out from the friends list
- The response includes only essential friend information (ID, name, profile image)
- The response format uses simplified fields (`name`, `profileImage`) extracted from the nested profile structure
- The actual database stores user data in a nested structure: `profile.name.first`, `profile.name.last`, `profile.name.full`, `profile.profileImage`, etc.

---

### 6. List Received Friend Requests

**Method:** `GET`  
**URL:** `/api/friend/requests/received`  
**Authentication:** Required

**Description:**  
Get a list of all pending friend requests that have been sent to the authenticated user. Requests from blocked users are automatically excluded.

**Query Parameters:**
- None

**Request Example:**
```bash
curl -X GET https://api.ulearnandearn.com/api/friend/requests/received \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Received friend requests retrieved successfully",
  "data": {
    "requests": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "sender": {
          "_id": "507f1f77bcf86cd799439010",
          "profile": {
            "name": {
              "first": "John",
              "last": "Doe",
              "full": "John Doe"
            },
            "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/profile.jpg",
            "email": "john@example.com",
            "bio": "Software developer"
          },
          "location": {
            "currentCity": "New York",
            "hometown": "Boston"
          }
        },
        "receiver": "507f1f77bcf86cd799439011",
        "status": "pending",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 500 | Failed to retrieve received friend requests | Internal server error |

**Notes:**
- Only returns requests with `pending` status
- Requests are sorted by creation date (newest first)
- Requests from blocked users are automatically excluded
- Includes detailed sender information for easy decision-making

---

### 7. List Sent Friend Requests

**Method:** `GET`  
**URL:** `/api/friend/requests/sent`  
**Authentication:** Required

**Description:**  
Get a list of all pending friend requests that the authenticated user has sent to others. Requests to blocked users are automatically excluded.

**Query Parameters:**
- None

**Request Example:**
```bash
curl -X GET https://api.ulearnandearn.com/api/friend/requests/sent \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Sent friend requests retrieved successfully",
  "data": {
    "requests": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "sender": "507f1f77bcf86cd799439010",
        "receiver": {
          "_id": "507f1f77bcf86cd799439011",
          "profile": {
            "name": {
              "first": "Jane",
              "last": "Smith",
              "full": "Jane Smith"
            },
            "profileImage": "https://example.com/profile2.jpg",
            "email": "jane@example.com",
            "bio": "Designer"
          },
          "location": {
            "currentCity": "San Francisco",
            "hometown": "Los Angeles"
          }
        },
        "status": "pending",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 500 | Failed to retrieve sent friend requests | Internal server error |

**Notes:**
- Only returns requests with `pending` status
- Requests are sorted by creation date (newest first)
- Requests to blocked users are automatically excluded
- Includes detailed receiver information

---

### 8. Unfriend a User

**Method:** `DELETE`  
**URL:** `/api/friend/unfriend/:friendId`  
**Authentication:** Required

**Description:**  
Remove a friendship between the authenticated user and another user. Both users are removed from each other's friend list, and any accepted friend requests between them are updated to `rejected` status.

**URL Parameters:**
- `friendId` (string, required): The MongoDB ObjectId of the user to unfriend

**Request Example:**
```bash
curl -X DELETE https://api.ulearnandearn.com/api/friend/unfriend/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User unfriended successfully"
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 400 | Invalid friend ID | The friendId is not a valid MongoDB ObjectId |
| 400 | You cannot unfriend yourself | Attempting to unfriend yourself |
| 400 | You are not friends with this user | Users are not currently friends |
| 404 | User not found | The friendId does not exist |
| 500 | Failed to unfriend user | Internal server error |

**Notes:**
- Removes the friendship bidirectionally (from both users' friend lists)
- Updates any accepted friend requests to `rejected` status for historical tracking
- After unfriending, users can send new friend requests to each other

---

## Friend Suggestions

### 9. Get Friend Suggestions

**Method:** `GET`  
**URL:** `/api/friend/suggestions`  
**Authentication:** Required

**Description:**  
Get personalized friend suggestions based on mutual friends. If the user has no friends, random users are suggested instead. Suggestions are sorted by the number of mutual friends (descending).

**Query Parameters:**
- `limit` (integer, optional): Maximum number of suggestions to return (default: 10)

**Request Example:**
```bash
curl -X GET "https://api.ulearnandearn.com/api/friend/suggestions?limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Friend suggestions retrieved successfully",
  "data": {
    "suggestions": [
      {
        "user": {
          "_id": "507f1f77bcf86cd799439014",
          "profile": {
            "name": {
              "first": "Alice",
              "last": "Williams",
              "full": "Alice Williams"
            },
            "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/example.jpg",
            "email": "alice@example.com",
            "bio": "Photographer",
            "gender": "Female"
          },
          "location": {
            "currentCity": "Seattle",
            "hometown": "Portland"
          }
        },
        "mutualFriendsCount": 5,
        "mutualFriends": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "profile": {
              "name": {
                "first": "Jane",
                "last": "Smith",
                "full": "Jane Smith"
              },
              "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/example2.jpg"
            }
          },
          {
            "_id": "507f1f77bcf86cd799439013",
            "profile": {
              "name": {
                "first": "Bob",
                "last": "Johnson",
                "full": "Bob Johnson"
              },
              "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/example3.jpg"
            }
          },
          {
            "_id": "507f1f77bcf86cd799439015",
            "profile": {
              "name": {
                "first": "Charlie",
                "last": "Brown",
                "full": "Charlie Brown"
              },
              "profileImage": "https://res.cloudinary.com/dxb1fppe3/image/upload/v1765539668/user_uploads/example4.jpg"
            }
          }
        ]
      }
    ],
    "count": 1
  }
}
```

**Error Responses:**

| Status Code | Error Message | Description |
|------------|---------------|-------------|
| 404 | User not found | The authenticated user does not exist |
| 500 | Failed to retrieve friend suggestions | Internal server error |

**Notes:**
- Suggestions are based on friends of friends (mutual connections)
- Users with more mutual friends appear first
- Automatically excludes:
  - Current user
  - Existing friends
  - Blocked users (both directions)
  - Users with pending friend requests
- If user has no friends, returns random users instead
- Shows up to 3 mutual friends per suggestion
- User data is returned in the nested profile structure: `profile.name.first`, `profile.name.last`, `profile.name.full`, `profile.profileImage`, `profile.email`, `profile.bio`, `profile.gender`, etc.

**Algorithm:**
1. Get all friends of the current user
2. For each friend, get their friends (friends of friends)
3. Count mutual friends for each potential suggestion
4. Sort by mutual friend count (descending)
5. Filter out excluded users (blocked, pending requests, etc.)
6. Return top N suggestions

---

## Data Models

### FriendRequest Model

```javascript
{
  _id: ObjectId,                    // Unique request ID
  sender: ObjectId,                 // Reference to User (sender)
  receiver: ObjectId,               // Reference to User (receiver)
  status: String,                   // 'pending' | 'accepted' | 'rejected'
  createdAt: Date,                  // Request creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

### User Model (Friends Array)

```javascript
{
  _id: ObjectId,                    // User ID
  friends: [ObjectId],              // Array of friend User IDs
  // ... other user fields
}
```

### Friend List Item

```javascript
{
  _id: ObjectId,                    // Friend's user ID
  name: String,                     // Friend's full name
  profileImage: String              // Friend's profile image URL
}
```

### Friend Suggestion Item

```javascript
{
  user: {
    _id: ObjectId,
    profile: {
      name: {
        first: String,
        last: String,
        full: String
      },
      profileImage: String,
      email: String,
      bio: String,
      gender: String,
      pronouns: String,
      coverPhoto: String
    },
    location: {
      currentCity: String,
      hometown: String
    }
  },
  mutualFriendsCount: Number,        // Number of mutual friends
  mutualFriends: [                  // Array of mutual friend objects (max 3)
    {
      _id: ObjectId,
      profile: {
        name: {
          first: String,
          last: String,
          full: String
        },
        profileImage: String
      }
    }
  ]
}
```

### User Profile Structure (Actual Database Format)

```javascript
{
  _id: ObjectId,                    // User ID
  profile: {
    name: {
      first: String,                // e.g., "Anushka"
      last: String,                 // e.g., "Kotiyal"
      full: String                  // e.g., "Anushka Kotiyal"
    },
    email: String,                  // e.g., "anushkakotiyal12@gmail.com"
    gender: String,                 // e.g., "Other", "Male", "Female"
    profileImage: String,           // Cloudinary URL
    pronouns: String,               // e.g., "they/them"
    bio: String,                    // User bio
    coverPhoto: String              // Cloudinary URL
  },
  location: {
    currentCity: String,
    hometown: String
  },
  friends: [ObjectId],              // Array of friend User IDs
  // ... other user fields
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": "Detailed error message (only in development mode)"
}
```

### Common HTTP Status Codes

| Status Code | Meaning | Common Scenarios |
|------------|---------|------------------|
| 200 | OK | Successful GET, POST, DELETE operations |
| 201 | Created | Successfully created a new resource |
| 400 | Bad Request | Invalid parameters, validation errors |
| 403 | Forbidden | Blocked users, unauthorized actions |
| 404 | Not Found | User or resource not found |
| 500 | Internal Server Error | Server-side errors |

### Error Response Examples

**Invalid ID Format:**
```json
{
  "success": false,
  "message": "Invalid receiver ID"
}
```

**Already Friends:**
```json
{
  "success": false,
  "message": "You are already friends with this user"
}
```

**Blocked User:**
```json
{
  "success": false,
  "message": "You cannot send a friend request to a blocked user"
}
```

**Not Found:**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## Examples

### Complete Friend Request Flow

**1. Send a friend request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/friend/send/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**2. Receiver checks received requests:**
```bash
curl -X GET https://api.ulearnandearn.com/api/friend/requests/received \
  -H "Authorization: Bearer RECEIVER_ACCESS_TOKEN"
```

**3. Receiver accepts the request:**
```bash
curl -X POST https://api.ulearnandearn.com/api/friend/accept/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer RECEIVER_ACCESS_TOKEN"
```

**4. Both users can now see each other in their friend list:**
```bash
curl -X GET https://api.ulearnandearn.com/api/friend/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### JavaScript Example (Fetch API)

```javascript
// Send friend request
async function sendFriendRequest(receiverId, accessToken) {
  const response = await fetch(
    `https://api.ulearnandearn.com/api/friend/send/${receiverId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Accept friend request
async function acceptFriendRequest(requestId, accessToken) {
  const response = await fetch(
    `https://api.ulearnandearn.com/api/friend/accept/${requestId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Get friend list
async function getFriendList(accessToken) {
  const response = await fetch(
    'https://api.ulearnandearn.com/api/friend/list',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Get friend suggestions
async function getFriendSuggestions(accessToken, limit = 10) {
  const response = await fetch(
    `https://api.ulearnandearn.com/api/friend/suggestions?limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Unfriend a user
async function unfriendUser(friendId, accessToken) {
  const response = await fetch(
    `https://api.ulearnandearn.com/api/friend/unfriend/${friendId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}
```

### Python Example (requests library)

```python
import requests

BASE_URL = "https://api.ulearnandearn.com/api/friend"
ACCESS_TOKEN = "your_access_token_here"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}"
}

# Send friend request
def send_friend_request(receiver_id):
    response = requests.post(
        f"{BASE_URL}/send/{receiver_id}",
        headers=headers
    )
    return response.json()

# Accept friend request
def accept_friend_request(request_id):
    response = requests.post(
        f"{BASE_URL}/accept/{request_id}",
        headers=headers
    )
    return response.json()

# Get friend list
def get_friend_list():
    response = requests.get(
        f"{BASE_URL}/list",
        headers=headers
    )
    return response.json()

# Get friend suggestions
def get_friend_suggestions(limit=10):
    response = requests.get(
        f"{BASE_URL}/suggestions",
        headers=headers,
        params={"limit": limit}
    )
    return response.json()

# Unfriend a user
def unfriend_user(friend_id):
    response = requests.delete(
        f"{BASE_URL}/unfriend/{friend_id}",
        headers=headers
    )
    return response.json()
```

---

## Best Practices

1. **Error Handling**: Always check the `success` field in responses before processing data
2. **Token Management**: Ensure access tokens are valid and refreshed when expired
3. **Rate Limiting**: Be mindful of API rate limits when making multiple requests
4. **User Experience**: 
   - Show loading states while processing friend requests
   - Provide clear feedback for all actions (success/error)
   - Update UI immediately after accepting/rejecting requests
5. **Blocking**: Remember that blocked users are automatically excluded from all friend operations
6. **Validation**: Validate user IDs on the client side before making requests
7. **Caching**: Consider caching friend lists and suggestions for better performance

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- User IDs are MongoDB ObjectIds (24-character hexadecimal strings)
- Friend requests are bidirectional - when accepted, both users are added to each other's friend list
- Blocked users cannot interact with each other through the friend system
- **Database Structure**: User data is stored in a nested structure:
  ```javascript
  {
    profile: {
      name: {
        first: "Anushka",
        last: "Kotiyal",
        full: "Anushka Kotiyal"
      },
      email: "anushkakotiyal12@gmail.com",
      gender: "Other",
      profileImage: "https://res.cloudinary.com/...",
      pronouns: "",
      bio: "this is bio by Anushka",
      coverPhoto: "https://res.cloudinary.com/..."
    },
    location: {
      currentCity: "...",
      hometown: "..."
    }
  }
  ```
- API responses may return simplified formats for friend lists, but detailed responses (like friend requests) include the full nested structure
- Friend suggestions algorithm prioritizes users with more mutual friends
- Accepted friend requests are kept in the database with `accepted` status for historical tracking
- Rejected friend requests are kept in the database with `rejected` status for audit purposes
- Cancelled friend requests are permanently deleted from the database

---

## Support

For issues or questions regarding the Friend API, please refer to:
- [AUTH_API_DOCUMENTATION.md](./AUTH_API_DOCUMENTATION.md) - For authentication details
- [SOCIAL_FEATURES_DOCUMENTATION.md](./SOCIAL_FEATURES_DOCUMENTATION.md) - For other social features

---

**Last Updated:** January 2024  
**API Version:** 1.0

