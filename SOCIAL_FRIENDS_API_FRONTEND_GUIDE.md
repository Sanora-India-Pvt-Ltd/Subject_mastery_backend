# Social and Friends API Frontend Guide

This guide covers posts, reels, reactions, comments, reporting, blocking, and friend features.

## Table of Contents
1. [Base URL](#base-url)
2. [Authentication Header](#authentication-header)
3. [Standard Response Shape](#standard-response-shape)
4. [Reaction Types](#reaction-types)
5. [Posts](#posts)
6. [Reels](#reels)
7. [Reactions API (Alternate Endpoints)](#reactions-api-alternate-endpoints)
8. [User Search and Profiles](#user-search-and-profiles)
9. [Blocking](#blocking)
10. [Friend Requests and Friends](#friend-requests-and-friends)
11. [Report a User](#report-a-user)
12. [Notes for Frontend Integration](#notes-for-frontend-integration)

## Base URL
Use your environment configuration for the API origin.

Example:
```
http://localhost:3100
```

## Authentication Header
Protected routes require:
```
Authorization: Bearer <access_token>
```

## Standard Response Shape
```
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

## Reaction Types
Valid values: `happy`, `sad`, `angry`, `hug`, `wow`, `like`.

## Posts

### Create Post
POST `/api/posts/create` (protected, multipart/form-data)

Fields:
- `caption` (optional)
- `media` (optional, up to 10 files)

At least one of `caption` or `media` is required.

### Get All Posts (Feed)
GET `/api/posts/all?page=1&limit=10` (public)

Notes:
- Returns newest first.
- Returns up to 15 latest comments per post.
- When authenticated, blocked users and reported posts are filtered out.
- Private profile visibility is enforced for authenticated viewers.

### Get My Posts
GET `/api/posts/me?page=1&limit=10` (protected)

### Get User Posts
GET `/api/posts/user/:id?page=1&limit=10` (public)

Notes:
- If authenticated, privacy and blocking checks apply.

### React to Post
POST `/api/posts/:id/like` (protected)

Body:
```json
{
  "reaction": "like"
}
```

Response includes `action` (`liked`, `unliked`, or `reaction_updated`), `reaction`, and `likeCount`.

### Add Comment to Post
POST `/api/posts/:id/comment` (protected)

Body:
```json
{
  "text": "Nice post!"
}
```

### Delete Comment from Post
DELETE `/api/posts/:id/comment/:commentId` (protected)

### Report Post
POST `/api/posts/:id/report` (protected)

Body:
```json
{
  "reason": "spam",
  "description": "Optional details"
}
```

### Delete Post
DELETE `/api/posts/:id` (protected, owner only)

## Reels

### Create Reel (Recommended Single Step)
POST `/api/reels/create` (protected, multipart/form-data)

Fields:
- `media` (required, video file)
- `caption` (optional)
- `contentType` (required: `education` or `fun`)
- `visibility` (optional: `public`, `followers`, `private`)

### Create Reel (Legacy Two Step)
POST `/api/reels/upload-media` (protected, multipart/form-data)
- Field: `media`

POST `/api/reels/create-with-media` (protected, JSON body)

### Get Reels
GET `/api/reels?contentType=education&page=1&limit=10` (public)

### Get User Reels
GET `/api/reels/user/:id?page=1&limit=10` (public)

### React to Reel
POST `/api/reels/:id/like` (protected)

Body:
```json
{
  "reaction": "like"
}
```

### Add Comment to Reel
POST `/api/reels/:id/comment` (protected)

Body:
```json
{
  "text": "Great reel!"
}
```

### Delete Comment from Reel
DELETE `/api/reels/:id/comment/:commentId` (protected)

### Report Reel
POST `/api/reels/:id/report` (protected)

Body:
```json
{
  "reason": "inappropriate",
  "description": "Optional details"
}
```

### Delete Reel
DELETE `/api/reels/:id` (protected, owner only)

## Reactions API (Alternate Endpoints)

### React to Post
POST `/api/likes/post/:id` (protected)

### React to Reel
POST `/api/likes/reel/:id` (protected)

### Get Reactions
GET `/api/likes/:content(post|reel)/:contentId` (public)

Returns users grouped by reaction type with counts.

## User Search and Profiles

### Search Users
GET `/api/user/search?query=john&page=1&limit=20` (protected)

Notes:
- Excludes blocked users in both directions.
- Respects privacy (limited fields for private profiles if not friends).

### Get User Profile
GET `/api/user/:userId/profile` (protected)

## Blocking

### Block User
POST `/api/user/block/:blockedUserId` (protected)

### Unblock User
DELETE `/api/user/block/:blockedUserId` (protected)

### List Blocked Users
GET `/api/user/blocked` (protected)

Notes:
- Blocking is bidirectional.
- Blocking removes friendships and cancels pending friend requests.
- Feeds and searches exclude blocked users.

## Friend Requests and Friends

### Send Friend Request
POST `/api/friend/send/:receiverId` (protected)

### Accept Friend Request
POST `/api/friend/accept/:requestId` (protected)

### Reject Friend Request
POST `/api/friend/reject/:requestId` (protected)

### Cancel Sent Friend Request
DELETE `/api/friend/cancel/:requestId` (protected)

### List Friends
GET `/api/friend/list` (protected)

### List Received Requests
GET `/api/friend/requests/received` (protected)

### List Sent Requests
GET `/api/friend/requests/sent` (protected)

### Unfriend
DELETE `/api/friend/unfriend/:friendId` (protected)

### Friend Suggestions
GET `/api/friend/suggestions?limit=10` (protected)

Notes:
- Suggestions are based on mutual friends when possible.
- Blocked users and pending requests are excluded.

## Report a User
POST `/api/reports/users/:userId/report` (protected)

Body:
```json
{
  "reason": "bullying_harassment_abuse",
  "description": "Optional details"
}
```

## Notes for Frontend Integration
- Comment arrays are limited to the most recent items; use `commentCount` for total.
- Reaction toggles are idempotent (same reaction removes it).
- Feeds are filtered by blocking and reporting when authenticated.
- Use pagination on all list endpoints.
