# MindTrain API Frontend Guide

This guide describes all MindTrain API endpoints for alarm profile management, sync configuration, sync health monitoring, and FCM notifications.

## Table of Contents
1. [Base URL](#base-url)
2. [Authentication Header](#authentication-header)
3. [Standard Response Shape](#standard-response-shape)
4. [Alarm Profile Management](#alarm-profile-management)
   - [Create Alarm Profile](#create-alarm-profile)
   - [Get Alarm Profiles](#get-alarm-profiles)
5. [Sync Configuration](#sync-configuration)
   - [Sync Config](#sync-config)
6. [Sync Health & Status](#sync-health--status)
   - [Report Sync Health](#report-sync-health)
   - [Get Sync Status](#get-sync-status)
7. [FCM Notifications](#fcm-notifications)
   - [Send FCM Notifications](#send-fcm-notifications)
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
  "userId": "user_id",
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "title": "Morning Meditation",
  "description": "Optional description",
  "alarmsPerDay": 3,
  "selectedDaysPerWeek": ["Monday", "Wednesday", "Friday"],
  "startTime": "06:00",
  "endTime": "22:00",
  "isFixedTime": false,
  "fixedTime": null,
  "specificDates": null,
  "isActive": true
}
```

**Required Fields:**
- `id`: Unique identifier for the profile
- `userId`: Must match authenticated user ID
- `youtubeUrl`: YouTube video URL
- `title`: Profile title
- `alarmsPerDay`: Number of alarms per day (number)
- `selectedDaysPerWeek`: Array of day names
- `startTime`: Start time in HH:mm format
- `endTime`: End time in HH:mm format

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
      "selectedDaysPerWeek": ["Monday", "Wednesday", "Friday"],
      "startTime": "06:00",
      "endTime": "22:00",
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
- `400` - Missing required fields or userId mismatch
- `401` - Authentication required
- `500` - Server error

**Notes:**
- The `userId` in the request body must match the authenticated user's ID
- Creating a new profile automatically deactivates all other profiles for the user
- The `isActive` field is automatically set to `true` for new profiles

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
        "selectedDaysPerWeek": ["Monday", "Wednesday", "Friday"],
        "startTime": "06:00",
        "endTime": "22:00",
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

## Sync Configuration

### Sync Config
PUT `/api/mindtrain/alarm-profiles/sync-config` (protected)

Create/update alarm profile and configure FCM schedule in a single request. This endpoint combines alarm profile creation with FCM notification scheduling.

**Request Body:**
```json
{
  "alarmProfile": {
    "id": "profile_unique_id",
    "userId": "user_id",
    "youtubeUrl": "https://www.youtube.com/watch?v=...",
    "title": "Morning Meditation",
    "alarmsPerDay": 3,
    "selectedDaysPerWeek": ["Monday", "Wednesday", "Friday"],
    "startTime": "06:00",
    "endTime": "22:00"
  },
  "fcmConfig": {
    "morningNotificationTime": "08:00",
    "eveningNotificationTime": "20:00",
    "timezone": "America/New_York"
  }
}
```

**Required Fields:**
- `alarmProfile`: Object with all required alarm profile fields (same as Create Alarm Profile)
- `fcmConfig.morningNotificationTime`: Time in HH:mm format
- `fcmConfig.eveningNotificationTime`: Time in HH:mm format

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
- `403` - userId mismatch
- `500` - Server error

**Error Codes:**
- `MISSING_ALARM_PROFILE` - alarmProfile is required
- `MISSING_FCM_CONFIG` - fcmConfig is required
- `INVALID_ALARM_PROFILE` - Missing required alarmProfile fields
- `INVALID_FCM_CONFIG` - Missing required fcmConfig fields
- `INVALID_TIME_FORMAT` - Time must be in HH:mm format
- `INVALID_TIMEZONE` - Invalid timezone format
- `USER_ID_MISMATCH` - userId doesn't match authenticated user
- `SYNC_CONFIG_ERROR` - Server error during configuration

**Notes:**
- Time format must be HH:mm (e.g., "08:00", "20:30")
- `nextSyncCheckTime` is set to 1 hour from the request time
- This endpoint automatically deactivates other profiles (same as Create Alarm Profile)

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
POST `/api/mindtrain/fcm-notifications/send` (protected)

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

## Notes for Frontend Integration

### General Guidelines
- All protected endpoints require JWT authentication via `Authorization: Bearer <token>` header
- Use the standard response shape for consistent error handling
- Error codes can be used for programmatic error handling
- Timestamps are returned in ISO 8601 format

### Alarm Profile Management
- Only one active profile per user at a time
- Creating a new profile automatically deactivates existing profiles
- Profile IDs should be unique and generated client-side (UUID recommended)
- `userId` in request body must match authenticated user

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
- `callback` endpoint is a webhook for Firebase, not called by frontend
- Frontend should handle FCM tokens and notification display

### Error Handling
- Check `success` field first
- Use `code` field for programmatic error handling
- Display `message` to users
- Log `error` field in development only

### Rate Limiting
- Be mindful of sync health reporting frequency
- Don't poll sync-status too frequently (use `nextSyncCheckTime` as guidance)
- Respect server recommendations in sync health responses

### Best Practices
1. **Initial Setup Flow:**
   - Create alarm profile → Sync config → Report initial sync health

2. **Regular Sync Flow:**
   - Check sync status → Sync if needed → Report sync health

3. **Error Recovery:**
   - Monitor recovery actions from sync-status
   - Follow server recommendations for recovery steps
   - Report sync health after recovery attempts

4. **Profile Updates:**
   - Use sync-config for major changes
   - Use create-alarm-profile for simple profile creation
   - Always verify userId matches authenticated user

