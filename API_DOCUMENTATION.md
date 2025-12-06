# Sanora API Documentation

Base URL: `https://api.sanoraindia.com`

---

## 🔐 Authentication Endpoints

### 1. User Signup (OTP Verification Required)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/signup`

**⚠️ IMPORTANT:** OTP verification is **MANDATORY** for signup. 

**Signup Flow:**
1. User enters email and clicks "Send" → OTP is sent to email
2. User verifies email with OTP code → Gets verification token
3. User fills personal information (First Name, Last Name, Phone Number, Gender, Password)
4. User submits complete signup form with all fields + verification token

The verification token proves the email was already verified and allows the user time to fill the form.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourPassword123",
  "confirmPassword": "yourPassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "gender": "Male",
  "emailVerificationToken": "token_from_verify_otp_signup_endpoint",
  "phoneVerificationToken": "token_from_verify_phone_otp_signup_endpoint"
}
```

**Required Fields:**
- `email` (string): User's email address (must match the email used for OTP verification)
- `password` (string): User's password (minimum 6 characters)
- `confirmPassword` (string, optional): Password confirmation (must match password if provided)
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `phoneNumber` (string): User's phone number
- `gender` (string): User's gender - must be one of: "Male", "Female", "Other", "Prefer not to say"
- `emailVerificationToken` (string, required): Token from email OTP verification endpoint (`/api/auth/verify-otp-signup`, valid for 20 minutes)
- `phoneVerificationToken` (string, required): Token from phone OTP verification endpoint (`/api/auth/verify-phone-otp-signup`, valid for 20 minutes)

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "accessToken": "jwt_access_token_here",
    "refreshToken": "refresh_token_here",
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

**Note:**
- `accessToken`: JWT token valid for 15 minutes - use this for API requests in `Authorization: Bearer <accessToken>` header
- `refreshToken`: Long-lived token (30 days) - store securely and use to get new access tokens when the access token expires

**Response (Error - 400 - Missing fields):**
```json
{
  "success": false,
  "message": "Email, password, first name, last name, phone number, and gender are required"
}
```

**Response (Error - 400 - Invalid gender):**
```json
{
  "success": false,
  "message": "Gender must be one of: Male, Female, Other, Prefer not to say"
}
```

**Response (Error - 400 - Password too short):**
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

**Response (Error - 400 - Password mismatch):**
```json
{
  "success": false,
  "message": "Password and confirm password do not match"
}
```

**Response (Error - 400 - Missing Email Verification):**
```json
{
  "success": false,
  "message": "Email verification is required. Please verify your email using /api/auth/send-otp-signup and /api/auth/verify-otp-signup"
}
```

**Response (Error - 400 - Missing Phone Verification):**
```json
{
  "success": false,
  "message": "Phone verification is required. Please verify your phone using /api/auth/send-phone-otp-signup and /api/auth/verify-phone-otp-signup"
}
```

**Response (Error - 400 - Phone Already Registered):**
```json
{
  "success": false,
  "message": "Phone number is already registered"
}
```

**Response (Error - 400 - User exists):**
```json
{
  "success": false,
  "message": "User already exists with this email"
}
```

---

### 2. User Login

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/login`

**Request Body (Option 1 - Login with Email):**
```json
{
  "email": "user@example.com",
  "password": "yourPassword123"
}
```

**Request Body (Option 2 - Login with Phone Number):**
```json
{
  "phoneNumber": "+1234567890",
  "password": "yourPassword123"
}
```

**Required Fields:**
- Either `email` (string) OR `phoneNumber` (string) - one of these is required
- `password` (string): User's password

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt_access_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+1234567890",
      "gender": "Male",
      "name": "John Doe",
      "profileImage": "https://..."
    }
  }
}
```

**Note:**
- `accessToken`: JWT token valid for 15 minutes - use this for API requests in `Authorization: Bearer <accessToken>` header
- `refreshToken`: Long-lived token (30 days) - store securely and use to get new access tokens when the access token expires

**Response (Error - 400 - Missing fields):**
```json
{
  "success": false,
  "message": "Either email or phone number, and password are required"
}
```

**Response (Error - 400 - Invalid credentials):**
```json
{
  "success": false,
  "message": "Invalid email/phone number or password"
}
```

---

## 📧 OTP Endpoints

### 3. Send OTP via Twilio (Phone Verification)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/send-otp`

**Request Body:**
```json
{
  "phone": "+1234567890"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "sid": "VEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "status": "pending"
}
```

**Response (Error - 400 - Missing phone):**
```json
{
  "success": false,
  "message": "phone is required"
}
```

**Response (Error - 500 - Twilio not configured):**
```json
{
  "success": false,
  "message": "Twilio Verify Service not configured"
}
```

**Note:** 
- Uses Twilio Verify service to send SMS OTP
- Phone number must be in E.164 format (e.g., +1234567890)
- Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` environment variables
- OTP is sent via SMS automatically by Twilio

---

### 4. Verify OTP via Twilio (Phone Verification)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/verify-otp`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "code": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Phone verified"
}
```

**Response (Error - 400 - Missing fields):**
```json
{
  "success": false,
  "message": "phone and code required"
}
```

**Response (Error - 400 - Invalid code):**
```json
{
  "success": false,
  "message": "Invalid or expired code"
}
```

**Response (Error - 500 - Twilio not configured):**
```json
{
  "success": false,
  "message": "Twilio Verify Service not configured"
}
```

**Note:** 
- Verifies the OTP code sent via Twilio SMS
- Phone number must match the one used in `/send-otp`
- Code is typically 6 digits
- After successful verification, you can mark user as verified in DB or issue JWT (TODO in code)

---

### 5. Send OTP for Signup (New Users - Email)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/send-otp-signup`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "data": {
    "email": "user@example.com",
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**Response (Error - 400 - User exists):**
```json
{
  "success": false,
  "message": "User already exists with this email"
}
```

**Response (Error - 429 - Rate limited):**
```json
{
  "success": false,
  "message": "Too many OTP requests. Please wait 15 minutes before trying again."
}
```

**Note:** 
- Rate limited: 3 requests per 15 minutes per email
- Works for new users (doesn't require account to exist)
- **Required before signup** - This is the first step in the signup flow
- OTP expires in 5 minutes (default)
- Email addresses are automatically normalized to lowercase
- After verification, you'll receive a verification token valid for 20 minutes to complete the signup form

---

### 6. Verify OTP for Signup (Email)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/verify-otp-signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "OTP verified successfully. You can now complete signup.",
  "data": {
    "verificationToken": "short_lived_verification_token",
    "email": "user@example.com"
  }
}
```

**Response (Error - 400 - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "remainingAttempts": 4
}
```

**Response (Error - 400 - OTP expired):**
```json
{
  "success": false,
  "message": "OTP expired"
}
```

**Response (Error - 400 - Too many attempts):**
```json
{
  "success": false,
  "message": "Too many attempts. Please request a new OTP"
}
```

**Response (Error - 429 - Rate limited):**
```json
{
  "success": false,
  "message": "Too many verification attempts. Please wait 15 minutes before trying again."
}
```

**Note:** 
- Rate limited: 5 attempts per 15 minutes per email
- Use the `emailVerificationToken` in the signup endpoint (along with phone verification token)
- Token expires in 20 minutes (allows time to fill the signup form)
- Maximum 5 attempts per OTP
- Email addresses are automatically normalized to lowercase
- **Both email and phone verification are required for signup**

---

### 7. Send Phone OTP for Signup (New Users)

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/send-phone-otp-signup`

**Request Body:**
```json
{
  "phone": "+1234567890"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "OTP sent successfully to your phone",
  "data": {
    "phone": "+1234567890",
    "sid": "VEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "status": "pending"
  }
}
```

**Response (Error - 400 - Phone already registered):**
```json
{
  "success": false,
  "message": "Phone number is already registered"
}
```

**Response (Error - 400 - Missing phone):**
```json
{
  "success": false,
  "message": "Phone number is required"
}
```

**Response (Error - 429 - Rate limited):**
```json
{
  "success": false,
  "message": "Too many OTP requests. Please wait 15 minutes before trying again."
}
```

**Response (Error - 500 - Twilio not configured):**
```json
{
  "success": false,
  "message": "Twilio is not configured for phone OTP"
}
```

**Note:** 
- Rate limited: 3 requests per 15 minutes per phone
- Works for new users (checks if phone is already registered)
- **Required before signup** - This is part of the signup flow
- Phone number must be in E.164 format (e.g., +1234567890)
- OTP expires in 10 minutes (Twilio default)
- After verification, you'll receive a phone verification token valid for 20 minutes

---

### 8. Verify Phone OTP for Signup

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/verify-phone-otp-signup`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Phone OTP verified successfully. You can now complete signup.",
  "data": {
    "phoneVerificationToken": "jwt_verification_token_here",
    "phone": "+1234567890"
  }
}
```

**Response (Error - 400 - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid or expired OTP code"
}
```

**Response (Error - 400 - Phone already registered):**
```json
{
  "success": false,
  "message": "Phone number is already registered"
}
```

**Response (Error - 500 - Twilio not configured):**
```json
{
  "success": false,
  "message": "Twilio is not configured"
}
```

**Note:** 
- Use the `phoneVerificationToken` in the signup endpoint (along with email verification token)
- Token expires in 20 minutes (allows time to fill the signup form)
- Phone number must match the one used in `/api/auth/send-phone-otp-signup`
- **Both email and phone verification are required for signup**

---

## 🔑 Forgot Password Endpoints

**⚠️ IMPORTANT:** OTP verification is **ONLY** used for:
1. **Signup** (required) - via `/api/auth/send-otp-signup`, `/api/auth/verify-otp-signup`, `/api/auth/send-phone-otp-signup`, `/api/auth/verify-phone-otp-signup`
2. **Forgot Password** (required) - via `/api/auth/forgot-password/send-otp`, `/api/auth/forgot-password/verify-otp`

OTP verification is **NOT** used for regular login. Login only requires email/phone and password.

### 9. Send OTP for Password Reset

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/forgot-password/send-otp`

**Request Body (Option 1 - With Email):**
```json
{
  "email": "user@example.com"
}
```

**Request Body (Option 2 - With Phone):**
```json
{
  "phone": "+1234567890"
}
```

**Required Fields:**
- Either `email` (string) OR `phone` (string) - one of these is required

**Response (Success - 200 - Email):**
```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "data": {
    "email": "user@example.com",
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

**Response (Success - 200 - Phone):**
```json
{
  "success": true,
  "message": "OTP sent successfully to your phone",
  "data": {
    "phone": "+1234567890",
    "sid": "VEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "status": "pending"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Either email or phone number is required"
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "User not found with the provided email or phone number"
}
```

**Response (Error - 429 - Rate limited):**
```json
{
  "success": false,
  "message": "Too many OTP requests. Please wait 15 minutes before trying again."
}
```

**Note:** 
- Rate limited: 3 requests per 15 minutes per email/phone
- Works for existing users only
- Email OTP expires in 5 minutes (default, configurable via `OTP_EXPIRY_MINUTES`)
- Phone OTP expires in 10 minutes (Twilio default)
- Phone number must be in E.164 format (e.g., +1234567890)
- Email addresses are automatically normalized to lowercase

---

### 10. Verify OTP for Password Reset

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/forgot-password/verify-otp`

**Request Body (Option 1 - With Email):**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Request Body (Option 2 - With Phone):**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Required Fields:**
- Either `email` (string) OR `phone` (string) - one of these is required
- `otp` (string): The OTP code received via email or SMS

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "OTP verified successfully. You can now reset your password.",
  "data": {
    "verificationToken": "jwt_verification_token_here",
    "email": "user@example.com"
  }
}
```

**Response (Error - 400 - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "remainingAttempts": 4
}
```

**Response (Error - 400 - OTP expired):**
```json
{
  "success": false,
  "message": "OTP expired"
}
```

**Response (Error - 400 - Too many attempts):**
```json
{
  "success": false,
  "message": "Too many attempts. Please request a new OTP"
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "User not found with this email"
}
```

**Response (Error - 429 - Rate limited):**
```json
{
  "success": false,
  "message": "Too many verification attempts. Please wait 15 minutes before trying again."
}
```

**Note:** 
- Rate limited: 5 attempts per 15 minutes per email/phone
- Use the `verificationToken` in the reset password endpoint
- Token expires in 15 minutes
- Maximum 5 attempts per OTP (for email OTP)
- Phone number must match the one used in send-otp request

---

### 11. Reset Password

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/forgot-password/reset`

**Request Body:**
```json
{
  "verificationToken": "verification_token_from_verify_otp",
  "password": "newPassword123",
  "confirmPassword": "newPassword123"
}
```

**Required Fields:**
- `verificationToken` (string): Token from `/api/auth/forgot-password/verify-otp` endpoint
- `password` (string): New password (minimum 6 characters)
- `confirmPassword` (string): Password confirmation (must match password)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Password reset successfully. You can now login with your new password."
}
```

**Response (Error - 400 - Missing fields):**
```json
{
  "success": false,
  "message": "Verification token, password, and confirm password are required"
}
```

**Response (Error - 400 - Password too short):**
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

**Response (Error - 400 - Password mismatch):**
```json
{
  "success": false,
  "message": "Password and confirm password do not match"
}
```

**Response (Error - 401 - Invalid token):**
```json
{
  "success": false,
  "message": "Invalid or expired verification token. Please request a new OTP."
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "User not found"
}
```

**Note:** 
- Requires OTP verification first
- Use the `verificationToken` from `/api/auth/forgot-password/verify-otp`
- Token expires in 15 minutes
- Password must be at least 6 characters long
- Password and confirmPassword must match
- After successful reset, user can login with the new password

---

## 🔵 Google OAuth Endpoints

### 13. Google OAuth (Web - Redirect Flow)

**Method:** `GET`  
**URL:** `https://api.sanoraindia.com/api/auth/google`

**Request:** No body required. This redirects to Google OAuth page.

**Response:** Redirects to Google login, then to your frontend callback URL with token in query parameters.

**Frontend Callback URL Format:**
```
https://your-frontend.com/auth/callback?token=JWT_TOKEN&name=User%20Name&email=user@example.com
```

**Note:** 
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in environment variables
- Configure callback URL in Google Cloud Console
- Works for web applications only

---

### 14. Google OAuth Callback

**Method:** `GET`  
**URL:** `https://api.sanoraindia.com/api/auth/google/callback`

**Request:** No body required. This is called by Google after authentication.

**Response:** Redirects to frontend with token in URL parameters.

**Note:** This endpoint is called automatically by Google. Do not call it directly.

---

### 15. Verify Google Token (Android/iOS/Web) - Signup/Login

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/verify-google-token`

**⚠️ IMPORTANT:** This endpoint handles both **signup and login** via Google OAuth. **No OTP verification is required** because Google already verifies the email address.

**Request Body:**
```json
{
  "token": "google_id_token_from_google_sign_in_sdk"
}
```

**Response (Success - 200 - New User Signup):**
```json
{
  "success": true,
  "message": "Signup successful via Google OAuth",
  "data": {
    "accessToken": "jwt_access_token_here",
    "refreshToken": "refresh_token_here",
    "isNewUser": true,
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "",
      "gender": "Other",
      "name": "John Doe",
      "profileImage": "https://..."
    }
  }
}
```

**Response (Success - 200 - Existing User Login):**
```json
{
  "success": true,
  "message": "Login successful via Google OAuth",
  "data": {
    "accessToken": "jwt_access_token_here",
    "refreshToken": "refresh_token_here",
    "isNewUser": false,
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+1234567890",
      "gender": "Male",
      "name": "John Doe",
      "profileImage": "https://..."
    }
  }
}
```

**Note:** 
- For new Google OAuth users, `firstName` and `lastName` are extracted from Google's display name
- `phoneNumber` defaults to empty string (user can update later)
- `gender` defaults to "Other" (user can update later)

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Token is required"
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "message": "Invalid Google token - token does not match any configured client ID"
}
```

**Note:** 
- **No OTP required** - Google already verifies the email
- Supports WEB, Android, and iOS client IDs (configure via `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` environment variables)
- Automatically creates user account if doesn't exist (signup)
- Logs in existing user if account exists (login)
- Links Google account to existing email/password account if user exists
- Returns access token (valid for 15 minutes) and refresh token (valid for 30 days)
- Works for Android, iOS, and Web applications
- `isNewUser` field indicates if this is a new signup (true) or existing login (false)
- Use `accessToken` for API requests, use `refreshToken` to get new access tokens when expired

---

### 16. Check Email Exists

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/check-email`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "exists": true,
  "data": {
    "email": "user@example.com",
    "hasGoogleAccount": false
  }
}
```

**Response (Success - 200 - Email doesn't exist):**
```json
{
  "success": true,
  "exists": false,
  "data": {
    "email": "user@example.com",
    "hasGoogleAccount": false
  }
}
```

**Note:** 
- Useful for checking if user should sign up or log in
- Shows if email has Google OAuth linked

---

## 📊 Root Endpoint

### 17. API Info

**Method:** `GET`  
**URL:** `https://api.sanoraindia.com/`

**Request:** No body required

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "🚀 Sanora Backend API is running!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "endpoints": {
    "signup": "POST /api/auth/signup",
    "login": "POST /api/auth/login",
    "profile": "GET /api/auth/profile (protected)",
    "googleAuth": "GET /api/auth/google",
    "verifyGoogleToken": "POST /api/auth/verify-google-token",
    "sendOTPSignup": "POST /api/auth/send-otp-signup",
    "verifyOTPSignup": "POST /api/auth/verify-otp-signup",
    "sendOTPPhone": "POST /send-otp (Twilio phone OTP)",
    "verifyOTPPhone": "POST /verify-otp (Twilio phone OTP)"
  }
}
```

---

## 🔑 Protected Routes

For protected routes, include the JWT token in the Authorization header:

**Header:**
```
Authorization: Bearer your_jwt_token_here
```

**Example:**
```bash
curl -X GET https://api.sanoraindia.com/api/protected-route \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 18. Get Current User Profile

**Method:** `GET`  
**URL:** `https://api.sanoraindia.com/api/auth/profile`

**Authentication:** Required (Protected Route)

**Headers:**
```
Authorization: Bearer your_jwt_token_here
```

**Request:** No body required

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+1234567890",
      "gender": "Male",
      "name": "John Doe",
      "profileImage": "https://...",
      "isGoogleOAuth": false,
      "googleId": null,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

**Response (Error - 401 - No token):**
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

**Response (Error - 401 - Invalid token):**
```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

**Response (Error - 404 - User not found):**
```json
{
  "success": false,
  "message": "User not found"
}
```

**Note:** 
- Requires valid JWT access token in Authorization header
- Returns complete user profile information
- Password is automatically excluded from response
- Access token can be obtained from `/api/auth/login` or `/api/auth/signup` endpoints
- If access token expires, use `/api/auth/refresh-token` to get a new access token

**Example with curl:**
```bash
curl -X GET https://api.sanoraindia.com/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 19. Refresh Access Token

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/refresh-token`

**Authentication:** Not required (public endpoint)

**Request Body:**
```json
{
  "refreshToken": "refresh_token_from_login_or_signup"
}
```

**Required Fields:**
- `refreshToken` (string): The refresh token received from login or signup

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Access token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_access_token_here"
  }
}
```

**Response (Error - 400 - Missing refresh token):**
```json
{
  "success": false,
  "message": "Refresh token is required"
}
```

**Response (Error - 401 - Invalid refresh token):**
```json
{
  "success": false,
  "message": "Invalid refresh token"
}
```

**Note:** 
- Use this endpoint when your access token expires (after 15 minutes)
- Refresh token is valid for 30 days
- Only returns a new access token (refresh token remains the same)
- Store the new access token and use it for subsequent API requests
- If refresh token is invalid or expired, user must login again

**Example with curl:**
```bash
curl -X POST https://api.sanoraindia.com/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your_refresh_token_here"}'
```

---

### 20. Logout

**Method:** `POST`  
**URL:** `https://api.sanoraindia.com/api/auth/logout`

**Authentication:** Required (Protected Route)

**Headers:**
```
Authorization: Bearer your_access_token_here
```

**Request:** No body required

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Response (Error - 401 - No token):**
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

**Response (Error - 401 - Invalid token):**
```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

**Note:** 
- Requires valid JWT access token in Authorization header
- Invalidates the refresh token stored in the database
- After logout, the refresh token cannot be used to get new access tokens
- User must login again to get new tokens

**Example with curl:**
```bash
curl -X POST https://api.sanoraindia.com/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📝 Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error message (in development mode only)"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation errors, invalid input, user already exists)
- `401` - Unauthorized (invalid token, wrong password, expired token)
- `404` - Not Found (user not found, route not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## 🔄 Authentication Flow Examples

### Standard Signup Flow (Email + Phone OTP Verification):

**Step 1: Email Verification (OTP)**
1. **Send OTP to Email:**
   ```bash
   POST /api/auth/send-otp-signup
   Body: { "email": "user@example.com" }
   ```
   → OTP sent to email address

2. **Verify Email OTP:**
   ```bash
   POST /api/auth/verify-otp-signup
   Body: { "email": "user@example.com", "otp": "123456" }
   ```
   → Returns `emailVerificationToken` (valid for 20 minutes)

**Step 2: Phone Verification (OTP)**
3. **Send OTP to Phone:**
   ```bash
   POST /api/auth/send-phone-otp-signup
   Body: { "phone": "+1234567890" }
   ```
   → OTP sent via SMS (Twilio)

4. **Verify Phone OTP:**
   ```bash
   POST /api/auth/verify-phone-otp-signup
   Body: { "phone": "+1234567890", "otp": "123456" }
   ```
   → Returns `phoneVerificationToken` (valid for 20 minutes)

**Step 3: Complete Signup Form**
5. **Fill and Submit Signup Form:**
   ```bash
   POST /api/auth/signup
   Body: {
     "email": "user@example.com",
     "password": "yourPassword123",
     "confirmPassword": "yourPassword123",
     "firstName": "John",
     "lastName": "Doe",
     "phoneNumber": "+1234567890",
     "gender": "Male",
     "emailVerificationToken": "token_from_step_2",
     "phoneVerificationToken": "token_from_step_4"
   }
   ```
   → Returns JWT token and user data

6. **Use token in `Authorization: Bearer <token>` header for protected routes**

**Important Notes:**
- **Both email and phone verification are required** before submitting the signup form
- Email and phone verification can be done in any order (Steps 1-2 and 3-4 can be swapped)
- Both verification tokens are valid for 20 minutes to allow time to fill the form
- Password must be at least 6 characters long
- Password and confirmPassword must match
- Phone number must be in E.164 format (e.g., +1234567890)
- Phone number will be normalized and checked for duplicates

---

### Standard Login Flow:

1. **Login:**
   ```bash
   POST /api/auth/login
   Body: { "email": "user@example.com", "password": "yourPassword123" }
   ```
   → Returns JWT token

2. **Use token in `Authorization: Bearer <token>` header for protected routes**

---

### Google OAuth Web Flow:

1. User clicks "Sign in with Google"
2. Redirect to `GET /api/auth/google`
3. Google redirects to `/api/auth/google/callback`
4. Backend redirects to frontend with token in URL parameters
5. Frontend extracts token and stores it

---

### Google OAuth Android/iOS Flow (Signup/Login - No OTP Required):

1. Android/iOS app gets Google ID token from Google Sign-In SDK
2. **Verify Token (Signup or Login):**
   ```bash
   POST /api/auth/verify-google-token
   Body: { "token": "google_id_token" }
   ```
   → Returns JWT token and user info
   → `isNewUser: true` if new signup, `false` if existing login
   → **No OTP verification needed** (Google already verified email)

3. Use JWT token for authenticated requests

---

### Forgot Password Flow:

**Step 1: Send OTP (Email or Phone)**
1. **Send OTP via Email:**
   ```bash
   POST /api/auth/forgot-password/send-otp
   Body: { "email": "user@example.com" }
   ```
   → OTP sent to email address

   OR

   **Send OTP via Phone:**
   ```bash
   POST /api/auth/forgot-password/send-otp
   Body: { "phone": "+1234567890" }
   ```
   → OTP sent via SMS (Twilio)

**Step 2: Verify OTP**
2. **Verify OTP:**
   ```bash
   POST /api/auth/forgot-password/verify-otp
   Body: { "email": "user@example.com", "otp": "123456" }
   ```
   OR
   ```bash
   POST /api/auth/forgot-password/verify-otp
   Body: { "phone": "+1234567890", "otp": "123456" }
   ```
   → Returns `verificationToken` (valid for 15 minutes)

**Step 3: Reset Password**
3. **Reset Password:**
   ```bash
   POST /api/auth/forgot-password/reset
   Body: {
     "verificationToken": "token_from_step_2",
     "password": "newPassword123",
     "confirmPassword": "newPassword123"
   }
   ```
   → Password updated successfully

4. **Login with new password:**
   ```bash
   POST /api/auth/login
   Body: { "email": "user@example.com", "password": "newPassword123" }
   ```

**Important Notes:**
- User can use either email or phone number for password reset
- OTP verification is required before password reset
- Verification token is valid for 15 minutes
- Password must be at least 6 characters long
- Password and confirmPassword must match

---

**⚠️ IMPORTANT:** OTP verification is **ONLY** used for:
1. **Signup** (required) - Both email and phone OTP verification are mandatory
2. **Forgot Password** (required) - OTP verification is required before password reset

**OTP is NOT used for regular login.** Login only requires email/phone and password.

---

## 🔄 Refresh Token Flow

The API uses a two-token authentication system for enhanced security:

### Token Types

1. **Access Token** (Short-lived)
   - Valid for **15 minutes**
   - Used for API requests in `Authorization: Bearer <accessToken>` header
   - Automatically expires after 15 minutes

2. **Refresh Token** (Long-lived)
   - Valid for **30 days**
   - Stored securely in the database
   - Used to obtain new access tokens when the current one expires
   - Invalidated on logout

### How It Works

1. **On Signup/Login:**
   - User receives both `accessToken` and `refreshToken`
   - Store both tokens securely on the client side

2. **Making API Requests:**
   - Use `accessToken` in the `Authorization: Bearer <accessToken>` header
   - If the access token expires (after 15 minutes), you'll receive a 401 error

3. **Refreshing Access Token:**
   - When access token expires, call `/api/auth/refresh-token` with your `refreshToken`
   - You'll receive a new `accessToken` to use for subsequent requests
   - The `refreshToken` remains the same

4. **Logout:**
   - Call `/api/auth/logout` to invalidate the refresh token
   - After logout, the refresh token cannot be used to get new access tokens
   - User must login again to get new tokens

### Example Flow

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { accessToken, refreshToken } = await loginResponse.json();

// 2. Use access token for API requests
const profileResponse = await fetch('/api/auth/profile', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// 3. When access token expires (401 error), refresh it
if (profileResponse.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  const { accessToken: newAccessToken } = await refreshResponse.json();
  // Use newAccessToken for subsequent requests
}

// 4. Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### Security Benefits

- **Reduced Attack Window:** Short-lived access tokens limit exposure if compromised
- **Automatic Rotation:** Access tokens are refreshed regularly
- **Revocable:** Refresh tokens can be invalidated on logout or security events
- **Stateless Access:** Access tokens don't require database lookups for validation

---

## 🔒 Security Features

- **Rate Limiting:**
  - OTP requests: 3 per 15 minutes per email
  - OTP verification: 5 attempts per 15 minutes per email
  
- **OTP Security:**
  - OTP expires in 5 minutes (configurable via `OTP_EXPIRY_MINUTES`)
  - Maximum 5 verification attempts per OTP
  - OTPs are hashed before storage
  - One-time use only (marked as verified after successful verification)

- **Token Security:**
  - Access tokens expire in 15 minutes (short-lived for security)
  - Refresh tokens expire in 30 days (long-lived for convenience)
  - Refresh tokens are stored securely in the database
  - Refresh tokens are invalidated on logout
  - Verification tokens expire in 20 minutes (allows time to fill signup form)
  - Passwords are hashed using bcrypt
  - Password minimum length: 6 characters

- **Email Normalization:**
  - All email addresses are automatically normalized to lowercase
  - Prevents case-sensitivity issues

---

## 🧪 Testing Examples

### Test Signup Flow with curl:

```bash
# Step 1: Send OTP
curl -X POST https://api.sanoraindia.com/api/auth/send-otp-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Step 2: Check email for OTP code (e.g., 123456)

# Step 3: Verify OTP
curl -X POST https://api.sanoraindia.com/api/auth/verify-otp-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# Step 4: Complete signup (use verificationToken from step 3)
curl -X POST https://api.sanoraindia.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"MyPassword123",
    "confirmPassword":"MyPassword123",
    "firstName":"Test",
    "lastName":"User",
    "phoneNumber":"+1234567890",
    "gender":"Male",
    "verificationToken":"PASTE_TOKEN_HERE"
  }'
```

### Test Login with curl:

**Login with Email:**
```bash
curl -X POST https://api.sanoraindia.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyPassword123"}'
```

**Login with Phone Number:**
```bash
curl -X POST https://api.sanoraindia.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890","password":"MyPassword123"}'
```

### Test Get User Profile:

**Step 1: Login to get token**
```bash
curl -X POST https://api.sanoraindia.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyPassword123"}'
```

**Step 2: Use token to get profile**
```bash
curl -X GET https://api.sanoraindia.com/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test Google Token Verification:

```bash
curl -X POST https://api.sanoraindia.com/api/auth/verify-google-token \
  -H "Content-Type: application/json" \
  -d '{"token":"GOOGLE_ID_TOKEN_HERE"}'
```

### Test Twilio Phone OTP Flow:

```bash
# Step 1: Send OTP to phone
curl -X POST https://api.sanoraindia.com/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890"}'

# Step 2: Verify OTP (use code received via SMS)
curl -X POST https://api.sanoraindia.com/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","code":"123456"}'
```

---

## 📚 Additional Notes

- All timestamps are in ISO 8601 format (UTC)
- Email addresses are case-insensitive (automatically normalized)
- OTP codes are 6 digits
- JWT tokens should be stored securely on the client side
- Rate limiting helps prevent abuse and spam
- For production, ensure all environment variables are properly configured
- See `OTP_SETUP_GUIDE.md` for email service configuration
- For Twilio phone OTP, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`
