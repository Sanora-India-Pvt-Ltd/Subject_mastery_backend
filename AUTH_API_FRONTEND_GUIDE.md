# Auth API Frontend Guide

This guide describes the current authentication and account APIs for frontend usage.

## Table of Contents
1. [Base URL](#base-url)
2. [Authentication Header](#authentication-header)
3. [Standard Response Shape](#standard-response-shape)
4. [Signup Flow (Email + Phone OTP Required)](#signup-flow-email--phone-otp-required)
5. [Login](#login)
6. [Refresh Access Token](#refresh-access-token)
7. [Logout](#logout)
8. [Devices](#devices)
9. [Password Reset Flow](#password-reset-flow)
10. [Profile and Account](#profile-and-account)
11. [Media Uploads (Profile and User Media)](#media-uploads-profile-and-user-media)
12. [Institutions and Companies](#institutions-and-companies)
13. [Notes for Frontend Integration](#notes-for-frontend-integration)

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

## Standard Response Shape
```
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

Errors follow the same shape with `"success": false`.

## Signup Flow (Email + Phone OTP Required)

### 1) Send Email OTP
POST `/api/auth/send-otp-signup`

Body:
```json
{
  "email": "user@example.com"
}
```

Response includes an expiration time.

### 2) Verify Email OTP
POST `/api/auth/verify-otp-signup`

Body:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "emailVerificationToken": "jwt_token_here"
  }
}
```

### 3) Send Phone OTP
POST `/api/auth/send-phone-otp-signup`

Body:
```json
{
  "phone": "+1234567890"
}
```

### 4) Verify Phone OTP
POST `/api/auth/verify-phone-otp-signup`

Body:
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "phoneVerificationToken": "jwt_token_here"
  }
}
```

### 5) Complete Signup
POST `/api/auth/signup`

Body:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "gender": "Male",
  "emailVerificationToken": "jwt_from_verify_email",
  "phoneVerificationToken": "jwt_from_verify_phone"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token_string",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+1234567890",
      "gender": "Male",
      "name": "John Doe"
    }
  }
}
```

Notes:
- Email and phone are normalized (trimmed, lowercased for email, and plus-prefixed for phone).
- OTP verification is required for both email and phone before signup.

## Login
POST `/api/auth/login`

Body (email login):
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Body (phone login):
```json
{
  "phoneNumber": "+1234567890",
  "password": "password123"
}
```

Response includes `accessToken`, `refreshToken`, and a `user` object.

## Refresh Access Token
POST `/api/auth/refresh-token`

Body:
```json
{
  "refreshToken": "refresh_token_string"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token"
  }
}
```

## Logout
POST `/api/auth/logout` (protected)

Body (optional):
```json
{
  "refreshToken": "refresh_token_string"
}
```

Or:
```json
{
  "deviceId": 1
}
```

If no body is provided, all devices are logged out.

## Devices
GET `/api/auth/devices` (protected)

Returns a list of devices and a 1-based `deviceId` for logout calls.

## Password Reset Flow

### 1) Send OTP
POST `/api/auth/forgot-password/send-otp`

Body (email):
```json
{
  "email": "user@example.com"
}
```

Body (phone):
```json
{
  "phone": "+1234567890"
}
```

### 2) Verify OTP
POST `/api/auth/forgot-password/verify-otp`

Body:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

Response includes `verificationToken`.

### 3) Reset Password
POST `/api/auth/forgot-password/reset`

Body:
```json
{
  "verificationToken": "jwt_verification_token",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

## Profile and Account

### Get Current Profile
GET `/api/auth/profile` (protected)

Returns the full profile object with profile, location, social, professional, content, and account metadata.

### Update Profile (Full)
PUT `/api/user/profile` (protected)

Body (all optional, arrays replace full arrays):
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "name": "John Doe",
  "gender": "Male",
  "dob": "1990-01-01",
  "bio": "Updated bio",
  "currentCity": "New York",
  "hometown": "Boston",
  "relationshipStatus": "Single",
  "coverPhoto": "https://...",
  "workplace": [
    {
      "company": "company_id_or_name",
      "position": "Software Engineer",
      "startDate": "2020-01-01",
      "endDate": null,
      "isCurrent": true
    }
  ],
  "education": [
    {
      "institution": "institution_id_or_name",
      "degree": "Bachelor's",
      "field": "Computer Science",
      "startYear": 2016,
      "endYear": 2020,
      "institutionType": "university"
    }
  ]
}
```

### Update Profile Visibility
PUT `/api/user/profile/visibility` (protected)

Body:
```json
{
  "visibility": "public"
}
```

### Remove Education Entry
DELETE `/api/user/education/:educationId` (protected)

### Remove Workplace Entry
DELETE `/api/user/workplace/:workplaceId` (protected)

### Update Phone Number (OTP)
POST `/api/user/phone/send-otp` (protected)

Body:
```json
{
  "phoneNumber": "+1234567890"
}
```

POST `/api/user/phone/verify-otp` (protected)

Body:
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

## Media Uploads (Profile and User Media)

POST `/api/upload/profile-image` (protected, multipart/form-data)
- Field: `profileImage`

POST `/api/upload/cover-photo` (protected, multipart/form-data)
- Field: `coverPhoto`

POST `/api/upload/upload` (protected, multipart/form-data)
- Field: `media`

GET `/api/upload/my-media` (protected)

GET `/api/upload/my-images` (protected)

GET `/api/upload/user/:id` (public)

DELETE `/api/upload/:mediaId` (protected)

## Institutions and Companies

GET `/api/institution/search?query=harvard&type=university` (public)

POST `/api/institution` (protected)

Body:
```json
{
  "name": "Custom Institution Name",
  "type": "university",
  "city": "City Name",
  "country": "Country Name",
  "logo": "https://..."
}
```

GET `/api/company/search?query=google` (public)

POST `/api/company` (protected)

Body:
```json
{
  "name": "Custom Company Name"
}
```

## Notes for Frontend Integration
- Access tokens expire; use `/api/auth/refresh-token` to renew.
- Refresh tokens are stored per device (max 5 devices).
- Phone numbers should be sent in `+<country_code><number>` format.
- For profile updates, arrays (`workplace`, `education`) replace existing arrays.
