# MindTrain API Frontend Guide

This guide describes all MindTrain API endpoints for alarm profile management, sync configuration, sync health monitoring, and FCM notifications.

## Table of Contents
1. [Base URL](#base-url)
2. [Authentication Header](#authentication-header)
3. [Standard Response Shape](#standard-response-shape)
4. [Alarm Profile Management](#alarm-profile-management)
   - [Create Alarm Profile](#create-alarm-profile)
   - [Get Alarm Profiles](#get-alarm-profiles)
   - [Delete Alarm Profile](#delete-alarm-profile)
5. [Sync Configuration](#sync-configuration)
   - [Sync Config](#sync-config)
6. [Sync Health & Status](#sync-health--status)
   - [Report Sync Health](#report-sync-health)
   - [Get Sync Status](#get-sync-status)
7. [FCM Notifications](#fcm-notifications)
   - [Send FCM Notifications](#send-fcm-notifications)
   - [Test Broadcast Notification](#test-broadcast-notification)
   - [Broadcast Notification](#broadcast-notification)
   - [FCM Callback](#fcm-callback)
8. [Notes for Frontend Integration](#notes-for-frontend-integration)

## Base URL
Use your environment configuration for the API origin.

Example:
```
http://localhost:3100
```

All endpoints below are relative to the base URL.

## Authentication Header
Protected routes require:
```
Authorization: Bearer <access_token>
```

**Note:** Some endpoints (like FCM callback) may have different authentication requirements as noted in their respective sections.

## Standard Response Shape
```
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

Errors follow the same shape with `"success": false` and may include:
- `code`: Error code for programmatic handling
- `errors`: Object with field-specific error messages
- `error`: Detailed error message (development only)

## Alarm Profile Management

### Create Alarm Profile
POST `/api/mindtrain/create-alarm-profile` (protected)

Creates a new alarm profile and automatically deactivates all other profiles for the same user.

**Request Body:**
```json
{
  "id": "profile_unique_id",
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "title": "Morning Meditation",
  "description": "Optional description",
  "alarmsPerDay": 3,
  "selectedDaysPerWeek": [1, 3, 5],
  "startTime": "06:00:00",
  "endTime": "22:00:00",
  "isFixedTime": false,
  "fixedTime": null,
  "specificDates": null,
  "isActive": true
}
```

**Required Fields:**
- `id`: Unique identifier for the profile
- `youtubeUrl`: YouTube video URL
- `title`: Profile title
- `alarmsPerDay`: Number of alarms per day (number)
- `selectedDaysPerWeek`: Array of numbers (1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday)
- `startTime`: Start time in HH:mm:ss format (e.g., "06:00:00")
- `endTime`: End time in HH:mm:ss format (e.g., "22:00:00")

**Note:** `userId` is automatically extracted from the JWT authentication token. Do not include it in the request body.

**Optional Fields:**
- `description`: Profile description
- `isFixedTime`: Boolean, if true use fixedTime
- `fixedTime`: Time string if isFixedTime is true
- `specificDates`: Array of specific dates if applicable

**Success Response (200):**
```json
{
  "success": true,
  "message": "Alarm profile created successfully",
  "data": {
    "createdProfile": {
      "id": "profile_unique_id",
      "userId": "user_id",
      "youtubeUrl": "https://www.youtube.com/watch?v=...",
      "title": "Morning Meditation",
      "description": "",
      "alarmsPerDay": 3,
      "selectedDaysPerWeek": [1, 3, 5],
      "startTime": "06:00:00",
      "endTime": "22:00:00",
      "isFixedTime": false,
      "fixedTime": null,
      "specificDates": null,
      "isActive": true,
      "createdAt": "2025-01-29T10:00:00.000Z",
      "updatedAt": "2025-01-29T10:00:00.000Z",
      "_id": "mongodb_object_id"
    },
    "deactivatedProfiles": [
      {
        "id": "old_profile_id",
        "title": "Old Profile",
        "_id": "mongodb_object_id",
        "isActive": false
      }
    ],
    "deactivatedCount": 1
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Authentication required
- `500` - Server error

**Notes:**
- `userId` is automatically extracted from the JWT authentication token (from `Authorization` header)
- Creating a new profile automatically deactivates all other profiles for the authenticated user
- The `isActive` field is automatically set to `true` for new profiles
- Users can only create profiles for themselves (enforced by JWT authentication)

### Get Alarm Profiles
GET `/api/mindtrain/get-alarm-profiles` (protected)

Retrieves all alarm profiles for the authenticated user, separated into active and inactive profiles.

**Query Parameters (optional):**
- `userId`: Must match authenticated user if provided

**Success Response (200):**
```json
{
  "success": true,
  "message": "Alarm profiles retrieved successfully",
  "data": {
    "activeProfiles": [
      {
        "id": "profile_unique_id",
        "userId": "user_id",
        "youtubeUrl": "https://www.youtube.com/watch?v=...",
        "title": "Morning Meditation",
        "description": "",
        "alarmsPerDay": 3,
        "selectedDaysPerWeek": [1, 3, 5],
        "startTime": "06:00:00",
        "endTime": "22:00:00",
        "isFixedTime": false,
        "fixedTime": null,
        "specificDates": null,
        "isActive": true,
        "createdAt": "2025-01-29T10:00:00.000Z",
        "updatedAt": "2025-01-29T10:00:00.000Z",
        "_id": "mongodb_object_id"
      }
    ],
    "inactiveProfiles": [],
    "totalActive": 1,
    "totalInactive": 0,
    "totalProfiles": 1
  }
}
```

**Error Responses:**
- `400` - userId query parameter mismatch (if provided)
- `401` - Authentication required
- `500` - Server error

**Notes:**
- Returns empty arrays if no profiles exist
- Profiles are automatically separated into active and inactive

### Delete Alarm Profile
DELETE `/api/mindtrain/alarm-profiles/:profileId` (protected)

Deletes an alarm profile and performs cascade cleanup:
- Deletes FCM schedule associated with the profile
- Deletes notification logs for the profile
- Handles active profile transition (activates next profile or disables FCM)

**URL Parameters:**
- `profileId`: The unique identifier of the profile to delete

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile deleted successfully",
  "data": {
    "deletedProfileId": "profile_unique_id",
    "cascadeCleanup": {
      "fcmScheduleDeleted": true,
      "notificationLogsDeleted": 5,
      "remainingProfiles": 2,
      "fcmDisabled": false
    }
  }
}
```

**Response Fields:**
- `deletedProfileId`: The ID of the deleted profile
- `cascadeCleanup.fcmScheduleDeleted`: Whether FCM schedule was deleted
- `cascadeCleanup.notificationLogsDeleted`: Number of notification logs deleted
- `cascadeCleanup.remainingProfiles`: Number of profiles remaining for the user
- `cascadeCleanup.fcmDisabled`: Whether FCM was disabled (if no profiles remain)

**Error Responses:**
- `400` - Profile ID is required
- `401` - Authentication required
- `404` - Profile not found
- `500` - Server error

**Error Codes:**
- `PROFILE_ID_REQUIRED` - Profile ID parameter is required
- `PROFILE_NOT_FOUND` - Profile not found or doesn't belong to user
- `DELETE_FAILED` - Server error during deletion

**Notes:**
- Only the profile owner can delete their profile
- If the deleted profile was active and other profiles exist, the next profile is automatically activated
- If the deleted profile was active and no profiles remain, FCM is disabled
- All related data (FCM schedule, notification logs) is cleaned up automatically
- Deletion uses database transactions to ensure data consistency

## Sync Configuration

### Sync Config
PUT `/api/mindtrain/alarm-profiles/sync-config` (protected)

Create/update alarm profile and configure FCM schedule in a single request. This endpoint combines alarm profile creation with FCM notification scheduling.

**Request Body:**
```json
{
  "alarmProfile": {
    "id": "profile_unique_id",
    "youtubeUrl": "https://www.youtube.com/watch?v=...",
    "title": "Morning Meditation",
    "alarmsPerDay": 3,
    "selectedDaysPerWeek": [1, 3, 5],
    "startTime": "06:00:00",
    "endTime": "22:00:00"
  },
  "fcmConfig": {
    "morningNotificationTime": "08:00",
    "eveningNotificationTime": "20:00",
    "timezone": "America/New_York"
  }
}
```

**Required Fields:**
- `alarmProfile`: Object with all required alarm profile fields (same as Create Alarm Profile, but without `userId`)
- `fcmConfig.morningNotificationTime`: Time in HH:mm format
- `fcmConfig.eveningNotificationTime`: Time in HH:mm format

**Note:** `userId` is automatically extracted from the JWT authentication token. Do not include it in `alarmProfile` object.

**Optional Fields:**
- `fcmConfig.timezone`: Timezone string (defaults to "UTC")

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile and FCM schedule configured",
  "data": {
    "profile": {
      "id": "profile_unique_id",
      "userId": "user_id",
      "isActive": true,
      "lastSyncTimestamp": null,
      "lastSyncSource": null,
      "syncHealthScore": 100,
      "nextSyncCheckTime": "2025-01-29T11:00:00.000Z"
    },
    "fcmSchedule": {
      "userId": "user_id",
      "activeProfileId": "profile_unique_id",
      "morningNotificationTime": "08:00",
      "eveningNotificationTime": "20:00",
      "nextMorningNotification": "2025-01-30T08:00:00.000Z",
      "nextEveningNotification": "2025-01-29T20:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400` - Missing required fields, invalid time format, or invalid timezone
- `401` - Authentication required
- `500` - Server error

**Error Codes:**
- `MISSING_ALARM_PROFILE` - alarmProfile is required
- `MISSING_FCM_CONFIG` - fcmConfig is required
- `INVALID_ALARM_PROFILE` - Missing required alarmProfile fields
- `INVALID_FCM_CONFIG` - Missing required fcmConfig fields
- `INVALID_TIME_FORMAT` - Time must be in HH:mm format (for FCM times) or HH:mm:ss format (for alarm profile times)
- `INVALID_TIMEZONE` - Invalid timezone format
- `SYNC_CONFIG_ERROR` - Server error during configuration

**Notes:**
- `userId` is automatically extracted from the JWT authentication token
- FCM time format must be HH:mm (e.g., "08:00", "20:30")
- Alarm profile time format must be HH:mm:ss (e.g., "06:00:00", "22:00:00")
- `nextSyncCheckTime` is set to 1 hour from the request time
- This endpoint automatically deactivates other profiles (same as Create Alarm Profile)
- Users can only configure profiles for themselves (enforced by JWT authentication)

## Sync Health & Status

### Report Sync Health
PUT `/api/mindtrain/alarm-profiles/sync-health` (protected)

Client reports sync health status to backend. Records device state and sync metrics for monitoring and recovery.

**Request Body:**
```json
{
  "deviceId": "device_unique_id",
  "deviceState": {
    "isOnline": true,
    "batteryLevel": 85,
    "timezone": "America/New_York"
  },
  "syncMetrics": {
    "lastSyncTime": "2025-01-29T10:00:00.000Z",
    "syncSuccessCount": 10,
    "syncFailureCount": 2,
    "averageSyncLatency": 150
  }
}
```

**Required Fields:**
- `deviceId`: Unique device identifier
- `syncMetrics`: Object with sync metrics

**Optional Fields:**
- `deviceState`: Object with device state information

**Success Response (200):**
```json
{
  "success": true,
  "message": "Sync health recorded",
  "data": {
    "healthScore": 85,
    "status": "healthy",
    "recommendations": [],
    "nextSyncCheckTime": "2025-01-30T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - Authentication required
- `500` - Server error

**Error Codes:**
- `MISSING_DEVICE_ID` - deviceId is required
- `MISSING_SYNC_METRICS` - syncMetrics is required
- `SYNC_HEALTH_ERROR` - Server error during health recording

**Notes:**
- `nextSyncCheckTime` is set to 24 hours from the request time
- Health score is calculated based on sync metrics
- Status can be "healthy", "warning", or "critical"

### Get Sync Status
GET `/api/mindtrain/alarm-profiles/sync-status` (protected)

Client checks if server has any pending sync/recovery actions. Returns delta changes and recovery actions.

**Query Parameters:**
- `deviceId` (required): Unique device identifier
- `lastSyncTime` (optional): ISO timestamp of last sync

**Success Response (200):**
```json
{
  "success": true,
  "message": "Sync status retrieved",
  "data": {
    "needsSync": true,
    "reason": "Profile updated on server",
    "profileChanges": [
      {
        "id": "profile_unique_id",
        "action": "updated",
        "fields": ["profile"],
        "changedAt": "2025-01-29T10:30:00.000Z"
      }
    ],
    "fcmScheduleUpdate": {
      "morningNotificationTime": "08:00",
      "eveningNotificationTime": "20:00"
    },
    "recoveryActions": [
      {
        "type": "resync_profile",
        "profileId": "profile_unique_id",
        "reason": "Server detected client sync failures"
      }
    ]
  }
}
```

**Response Fields:**
- `needsSync`: Boolean indicating if sync is required
- `reason`: Human-readable reason for sync
- `profileChanges`: Array of profile changes since lastSyncTime
- `fcmScheduleUpdate`: Updated FCM schedule if changed (null if no changes)
- `recoveryActions`: Array of recovery actions if issues detected

**Error Responses:**
- `400` - Missing deviceId query parameter
- `401` - Authentication required
- `500` - Server error

**Error Codes:**
- `MISSING_DEVICE_ID` - deviceId query parameter is required
- `SYNC_STATUS_ERROR` - Server error during status retrieval

**Notes:**
- If `lastSyncTime` is not provided, `needsSync` will be `true` with reason "Initial sync required"
- `profileChanges` will be empty if no changes detected
- `fcmScheduleUpdate` will be `null` if schedule hasn't changed
- `recoveryActions` will be empty if no issues detected

## FCM Notifications

### Send FCM Notifications
POST `/api/mindtrain/fcm-notifications/send` (protected - requires authentication)

Server-side endpoint to trigger FCM notification sends. This is typically used by scheduled jobs or admin tools.

**Note:** This endpoint should be restricted to admin/service authentication (TODO in implementation).

**Request Body:**
```json
{
  "type": "scheduled_sync_trigger",
  "targetUsers": "all_with_active_profiles",
  "notificationType": "morning",
  "batchSize": 1000
}
```

**Required Fields:**
- `type`: Must be `"scheduled_sync_trigger"`
- `targetUsers`: Must be `"all_with_active_profiles"`
- `notificationType`: Either `"morning"` or `"evening"`

**Optional Fields:**
- `batchSize`: Number of notifications per batch (default: 1000)

**Success Response (202):**
```json
{
  "success": true,
  "message": "Notification job queued",
  "data": {
    "jobId": "fcm_batch_1738156800000_a1b2c3d4",
    "targetUserCount": 150,
    "batchSize": 1000,
    "estimatedTime": "1s",
    "status": "queued"
  }
}
```

**Error Responses:**
- `400` - Invalid type, targetUsers, or notificationType
- `401` - Authentication required
- `500` - Server error

**Error Codes:**
- `INVALID_TYPE` - type must be "scheduled_sync_trigger"
- `INVALID_TARGET_USERS` - targetUsers must be "all_with_active_profiles"
- `INVALID_NOTIFICATION_TYPE` - notificationType must be "morning" or "evening"
- `FCM_SEND_ERROR` - Server error during job queuing

**Notes:**
- Returns 202 Accepted status as the job is queued asynchronously
- `jobId` can be used to track job status
- `estimatedTime` is calculated based on batch size

### Test Broadcast Notification
POST `/api/mindtrain/fcm-notifications/test` (public - no authentication required)

Test endpoint to manually trigger a broadcast notification. Useful for testing WebSocket and FCM delivery methods.

**Request Body:**
```json
{
  "profileId": "profile_unique_id",
  "notificationType": "morning"
}
```

**Required Fields:**
- None (all fields are optional)

**Optional Fields:**
- `notificationType`: Either `"morning"` or `"evening"` (defaults to `"morning"`)
- `profileId`: Profile ID (optional - not needed for broadcast)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Test notification broadcasted successfully",
  "data": {
    "broadcast": true,
    "profileId": null,
    "notificationType": "morning",
    "deliveryMethod": "broadcast",
    "stats": {
      "socketBroadcastCount": 150,
      "fcmProcessedCount": 5000,
      "fcmFailedCount": 2
    },
    "timestamp": "2025-01-31T10:00:00.000Z"
  }
}
```

**Response Fields:**
- `broadcast`: Always `true` for broadcast responses
- `profileId`: Profile ID (may be null if not provided)
- `notificationType`: Type of notification sent
- `deliveryMethod`: Always `"broadcast"` for broadcast responses
- `stats.socketBroadcastCount`: Number of connected sockets that received the broadcast
- `stats.fcmProcessedCount`: Total number of users who received FCM push notifications
- `stats.fcmFailedCount`: Number of failed FCM deliveries
- `timestamp`: When the notification was sent

**Error Responses:**
- `400` - Invalid notificationType
- `500` - Server error

**Error Codes:**
- `INVALID_NOTIFICATION_TYPE` - notificationType must be "morning" or "evening"
- `BROADCAST_FAILED` - Failed to broadcast notification
- `TEST_NOTIFICATION_ERROR` - Server error during test notification

**Notes:**
- **No authentication required** - This endpoint is public for testing purposes
- **Broadcasts to ALL users** - No userId or profileId needed
- Sends via both Socket.IO (to connected users) and FCM push (to all users in database)
- All connected users receive Socket.IO events instantly
- All users in database receive FCM push notifications
- Response includes statistics about delivery
- Useful for debugging and testing broadcast notification delivery

**Testing Scenarios:**

1. **Test WebSocket Broadcast:**
   - Open app (WebSocket connected)
   - Call test endpoint with `notificationType`
   - Check app logs for `mindtrain:sync_notification` event

2. **Test FCM Broadcast:**
   - Close app (WebSocket disconnected)
   - Call test endpoint with `notificationType`
   - Check phone for push notification

### Broadcast Notification
POST `/api/mindtrain/fcm-notifications/broadcast` (public - no authentication required)

Broadcast notification to ALL users who have installed the app. **No profile ID or user ID needed** - sends to everyone automatically.

**Request Body:**
```json
{
  "notificationType": "morning"
}
```

**Required Fields:**
- None (all fields are optional)

**Optional Fields:**
- `notificationType`: Either `"morning"` or `"evening"` (defaults to `"morning"`)
- `profileId`: Profile ID (optional - not needed for broadcast to all users)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notification broadcasted successfully",
  "data": {
    "broadcast": true,
    "profileId": null,
    "notificationType": "morning",
    "deliveryMethod": "broadcast",
    "stats": {
      "socketBroadcastCount": 150,
      "fcmProcessedCount": 5000,
      "fcmFailedCount": 2
    },
    "timestamp": "2025-01-31T10:00:00.000Z"
  }
}
```

**Response Fields:**
- `broadcast`: Always `true` for broadcast responses
- `profileId`: Profile ID (may be null if not provided)
- `notificationType`: Type of notification sent
- `deliveryMethod`: Always `"broadcast"` for broadcast responses
- `stats.socketBroadcastCount`: Number of connected sockets that received the broadcast
- `stats.fcmProcessedCount`: Total number of users who received FCM push notifications
- `stats.fcmFailedCount`: Number of failed FCM deliveries
- `timestamp`: When the notification was sent

**Error Responses:**
- `400` - Invalid notificationType
- `500` - Server error

**Error Codes:**
- `INVALID_NOTIFICATION_TYPE` - notificationType must be "morning" or "evening"
- `BROADCAST_FAILED` - Failed to broadcast notification
- `BROADCAST_ERROR` - Server error during broadcast

**Notes:**
- **No authentication required** - This endpoint is public for testing purposes
- **No profileId or userId needed** - Broadcasts to ALL users automatically
- Sends via both Socket.IO (to connected users) and FCM push (to all users in database)
- All connected users receive Socket.IO events instantly
- All users in database receive FCM push notifications
- Response includes statistics about delivery
- Useful for testing and sending announcements to all users

**Example Usage:**
```bash
# Simple broadcast - no profile ID needed
POST /api/mindtrain/fcm-notifications/broadcast
{
  "notificationType": "morning"
}
```

### FCM Callback
POST `/api/mindtrain/fcm-notifications/callback` (public)

FCM delivery status webhook callback. Receives delivery status updates from Firebase Cloud Messaging.

**Note:** This endpoint should be secured with Firebase Admin SDK authentication (TODO in implementation).

**Request Body:**
```json
{
  "notificationIds": ["notif_001", "notif_002"],
  "status": "delivered",
  "deliveredAt": "2025-01-29T14:00:00.000Z",
  "failedIds": ["notif_003"],
  "failureReason": "InvalidToken"
}
```

**Required Fields:**
- `notificationIds`: Array of notification IDs

**Optional Fields:**
- `status`: Delivery status (e.g., "delivered")
- `deliveredAt`: ISO timestamp of delivery
- `failedIds`: Array of failed notification IDs
- `failureReason`: Reason for failure

**Success Response (200):**
```json
{
  "success": true,
  "message": "Delivery status recorded"
}
```

**Error Responses:**
- `400` - Missing or invalid notificationIds
- `500` - Server error

**Error Codes:**
- `MISSING_NOTIFICATION_IDS` - notificationIds array is required
- `FCM_CALLBACK_ERROR` - Server error during callback processing

**Notes:**
- This endpoint updates notification logs in the database
- Failed notifications are recorded for retry logic
- Used by Firebase to report delivery status

## When to Use Each Endpoint

### Alarm Profile Management

**Create Alarm Profile** (`POST /api/mindtrain/create-alarm-profile`)
- ✅ **Use when:** User creates a new alarm profile for the first time
- ✅ **Use when:** User wants to create a simple profile without FCM schedule configuration
- ✅ **Use when:** You only need to create/update the profile (not FCM settings)
- ❌ **Don't use when:** You need to configure FCM notification schedule (use `sync-config` instead)

**Get Alarm Profiles** (`GET /api/mindtrain/get-alarm-profiles`)
- ✅ **Use when:** App starts/loads - fetch user's existing profiles
- ✅ **Use when:** User opens alarm settings screen
- ✅ **Use when:** Need to display list of active/inactive profiles
- ✅ **Use when:** Need to check if user has any profiles before showing create UI

**Delete Alarm Profile** (`DELETE /api/mindtrain/alarm-profiles/:profileId`)
- ✅ **Use when:** User deletes a profile from settings
- ✅ **Use when:** User wants to remove an old/unused profile
- ✅ **Use when:** Need to clean up profiles (cascade cleanup happens automatically)

### Sync Configuration

**Sync Config** (`PUT /api/mindtrain/alarm-profiles/sync-config`)
- ✅ **Use when:** **Initial setup** - First time user sets up alarm profile + FCM notifications
- ✅ **Use when:** **Major updates** - User changes both profile AND FCM schedule together
- ✅ **Use when:** User completes onboarding/setup wizard
- ✅ **Use when:** Need to configure both alarm profile and notification timing in one call
- ❌ **Don't use when:** Only creating a profile (use `create-alarm-profile` instead)
- ❌ **Don't use when:** Only updating FCM schedule (this endpoint updates both)

### Sync Health & Status

**Report Sync Health** (`PUT /api/mindtrain/alarm-profiles/sync-health`)
- ✅ **Use when:** **Periodic reporting** - Every 24 hours (recommended)
- ✅ **Use when:** After successful sync operation
- ✅ **Use when:** After error recovery attempts
- ✅ **Use when:** App background sync completes
- ✅ **Use when:** Device state changes significantly (battery, network, etc.)

**Get Sync Status** (`GET /api/mindtrain/alarm-profiles/sync-status`)
- ✅ **Use when:** **Before syncing** - Check if server has updates/changes
- ✅ **Use when:** App comes to foreground - Check for pending updates
- ✅ **Use when:** Periodic check (use `nextSyncCheckTime` from previous response as guidance)
- ✅ **Use when:** After receiving FCM notification - Check what changed
- ✅ **Use when:** User manually triggers sync
- ❌ **Don't use too frequently** - Respect `nextSyncCheckTime` to avoid unnecessary requests

### FCM Notifications

**Send FCM Notifications** (`POST /api/mindtrain/fcm-notifications/send`)
- ✅ **Use when:** Backend scheduled job needs to send notifications
- ✅ **Use when:** Admin/service needs to trigger notifications
- ❌ **Not for frontend** - This is a backend/internal endpoint

**Test Broadcast Notification** (`POST /api/mindtrain/fcm-notifications/test`)
- ✅ **Use when:** Testing notification delivery during development
- ✅ **Use when:** Debugging WebSocket/FCM integration
- ✅ **Use when:** Verifying notification system works
- ❌ **Not for production** - Testing only

**Broadcast Notification** (`POST /api/mindtrain/fcm-notifications/broadcast`)
- ✅ **Use when:** Sending announcements to all users
- ✅ **Use when:** System-wide notifications
- ✅ **Use when:** Admin needs to notify all users
- ❌ **Not for user-specific notifications** - Broadcasts to everyone

**FCM Callback** (`POST /api/mindtrain/fcm-notifications/callback`)
- ✅ **Use when:** Firebase reports delivery status (webhook)
- ❌ **Not called by frontend** - This is a Firebase webhook endpoint

## Notes for Frontend Integration

### General Guidelines
- All protected endpoints require JWT authentication via `Authorization: Bearer <token>` header
- Use the standard response shape for consistent error handling
- Error codes can be used for programmatic error handling
- Timestamps are returned in ISO 8601 format

### Alarm Profile Management
- Only one active profile per user at a timef
- Creating a new profile automatically deactivates existing profiles
- Profile IDs should be unique and generated client-side (UUID recommended)
- `userId` is automatically extracted from JWT token - do not include it in request body
- Users can only create/manage profiles for themselves (enforced by authentication)

### Sync Configuration
- Use `sync-config` endpoint for initial setup or major updates
- Time format must be HH:mm (24-hour format)
- Timezone defaults to UTC if not specified
- `nextSyncCheckTime` indicates when client should check for updates

### Sync Health & Status
- Report sync health periodically (recommended: every 24 hours)
- Use `sync-status` endpoint before syncing to check for updates
- Include `lastSyncTime` in sync-status requests for delta updates
- Monitor `recoveryActions` for server-initiated recovery steps

### FCM Notifications
- `send` endpoint is typically used by backend services, not frontend
- `test` and `broadcast` endpoints are for testing and broadcasting to all users
- `callback` endpoint is a webhook for Firebase, not called by frontend
- Frontend should handle FCM tokens and notification display
- All notifications are broadcast-only (no user-specific notifications)

### Error Handling
- Check `success` field first
- Use `code` field for programmatic error handling
- Display `message` to users
- Log `error` field in development only

### Rate Limiting
- Be mindful of sync health reporting frequency
- Don't poll sync-status too frequently (use `nextSyncCheckTime` as guidance)
- Respect server recommendations in sync health responses

### Best Practices & Common Flows

#### 1. **Initial Setup Flow (First Time User)**
```
1. User opens app → GET /get-alarm-profiles (check if profiles exist)
2. User creates profile → POST /create-alarm-profile OR PUT /sync-config
   - Use sync-config if also setting up FCM notifications
   - Use create-alarm-profile if just creating profile
3. After setup → PUT /sync-health (report initial sync health)
```

#### 2. **Regular Sync Flow (Daily Operations)**
```
1. App starts/foreground → GET /sync-status (check for updates)
2. If needsSync = true → Sync data locally
3. After sync → PUT /sync-health (report sync completion)
4. Repeat based on nextSyncCheckTime from response
```

#### 3. **Profile Management Flow**
```
Create New Profile:
  - POST /create-alarm-profile (simple profile)
  - OR PUT /sync-config (profile + FCM setup)

Update Existing Profile:
  - PUT /sync-config (updates both profile and FCM)

View Profiles:
  - GET /get-alarm-profiles (get all profiles)

Delete Profile:
  - DELETE /alarm-profiles/:profileId (cascade cleanup automatic)
```

#### 4. **Error Recovery Flow**
```
1. GET /sync-status (check for recovery actions)
2. If recoveryActions present → Follow server recommendations
3. Perform recovery steps locally
4. PUT /sync-health (report recovery completion)
```

#### 5. **FCM Notification Received Flow**
```
1. App receives FCM notification → GET /sync-status (check what changed)
2. If needsSync = true → Sync data
3. Update local state
4. PUT /sync-health (optional - report sync)
```

#### 6. **Periodic Health Reporting**
```
Every 24 hours (or as recommended):
  - PUT /sync-health (report device state and sync metrics)
  - Use nextSyncCheckTime from response for next check
```