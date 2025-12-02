const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

console.log('=== Loading Passport Configuration ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set');
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || 'Using default');

// Only configure Google Strategy if required environment variables are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log('Configuring Google OAuth strategy...');
    
    passport.use('google', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 
             (process.env.NODE_ENV === 'production' 
               ? 'https://sanora.onrender.com/api/auth/google/callback'
               : 'http://localhost:3100/api/auth/google/callback'),
        passReqToCallback: true,
        scope: ['profile', 'email']
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const { id, displayName, emails, photos } = profile;
            const email = emails[0].value;
            const photo = photos[0]?.value;
            
            // Check if user exists
            let user = await User.findOne({ email });
            
            if (!user) {
                // Create new user with Google OAuth
                user = await User.create({
                    email,
                    name: displayName,
                    googleId: id,
                    profileImage: photo,
                    password: 'oauth-user', // Dummy password for OAuth users
                    isGoogleOAuth: true
                });
            } else if (!user.googleId) {
                // Link Google account to existing user
                user.googleId = id;
                user.profileImage = photo;
                user.isGoogleOAuth = true;
                await user.save();
            }
            
            console.log(`Google OAuth successful for ${email}`);
            return done(null, user);
        } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error, null);
        }
    }));
    
    console.log('✅ Google OAuth strategy configured successfully');
} else {
    console.warn('⚠️ Google OAuth is not configured. Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
}

// Serialize/deserialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;