/**
 * Debug script to check Google OAuth configuration
 * Run this to verify your OAuth setup
 */

require('dotenv').config();

console.log('\n🔍 Google OAuth Configuration Check\n');
console.log('=' .repeat(50));

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || '⚠️  Using default');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || '⚠️  NOT SET');

// Determine the actual callback URL being used
const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
    (process.env.NODE_ENV === 'production' 
        ? 'https://sanora.onrender.com/api/auth/google/callback'
        : 'http://localhost:3100/api/auth/google/callback');

console.log('\n🔗 Actual Callback URL Being Used:');
console.log('   ', callbackURL);

console.log('\n✅ Expected in Google Console:');
console.log('   Authorized redirect URIs should include:');
console.log('   ', callbackURL);

console.log('\n📝 Google Cloud Console Checklist:');
console.log('   1. Go to: https://console.cloud.google.com/');
console.log('   2. Select your project');
console.log('   3. Navigate to: APIs & Services → Credentials');
console.log('   4. Click your OAuth 2.0 Client ID');
console.log('   5. Under "Authorized redirect URIs", ensure this EXACT URI is listed:');
console.log('      ', callbackURL);
console.log('   6. Under "Authorized JavaScript origins", ensure these are listed:');
console.log('      ', 'http://localhost:3100');
console.log('      ', 'http://localhost:5500');

console.log('\n⚠️  Common Issues:');
console.log('   - Trailing slash: http://localhost:3100/api/auth/google/callback/ ❌');
console.log('   - Wrong protocol: https://localhost:3100/... ❌ (use http:// for localhost)');
console.log('   - Wrong port: http://localhost:3000/... ❌ (should be 3100)');
console.log('   - Typo in path: /api/auth/google/callbak ❌ (should be callback)');

console.log('\n' + '='.repeat(50));
console.log('\n💡 If the URI above matches your Google Console, wait 1-5 minutes');
console.log('   for changes to propagate, then try again.\n');

