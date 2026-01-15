/**
 * Firebase Admin SDK Configuration
 * 
 * Initializes Firebase Admin for FCM (Firebase Cloud Messaging).
 * Supports Android, Web Push, and iOS (via APNs bridge).
 * 
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY (JSON string or path to service account)
 * - FIREBASE_CLIENT_EMAIL
 * 
 * Or:
 * - FIREBASE_SERVICE_ACCOUNT_PATH (path to service account JSON file)
 */

let admin = null;
let messaging = null;

const initializeFirebase = () => {
    try {
        // Check if Firebase Admin is already initialized
        if (admin) {
            return { admin, messaging };
        }

        // Try to require firebase-admin
        try {
            admin = require('firebase-admin');
        } catch (error) {
            console.warn('⚠️  firebase-admin not installed. Push notifications will be disabled.');
            console.warn('   Install with: npm install firebase-admin');
            return { admin: null, messaging: null };
        }

        // Check if already initialized
        if (admin.apps.length > 0) {
            messaging = admin.messaging();
            return { admin, messaging };
        }

        // Initialize Firebase Admin
        let serviceAccount;

        // Option 1: Service account file path
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            try {
                serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            } catch (error) {
                console.error('❌ Failed to load Firebase service account from path:', error.message);
                return { admin: null, messaging: null };
            }
        }
        // Option 2: Environment variables
        else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            };
        }
        // Option 3: Try default service account (for Google Cloud environments)
        else {
            try {
                // Google Cloud automatically provides credentials
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
                messaging = admin.messaging();
                console.log('✅ Firebase Admin initialized with application default credentials');
                return { admin, messaging };
            } catch (error) {
                console.warn('⚠️  Firebase Admin not configured. Push notifications will be disabled.');
                console.warn('   Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/PRIVATE_KEY/CLIENT_EMAIL');
                return { admin: null, messaging: null };
            }
        }

        // Initialize with service account
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        messaging = admin.messaging();
        console.log('✅ Firebase Admin initialized successfully');

        return { admin, messaging };

    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
        return { admin: null, messaging: null };
    }
};

// Initialize on module load
const firebase = initializeFirebase();

const getMessaging = () => {
    if (!messaging) {
        // Try to reinitialize
        const result = initializeFirebase();
        messaging = result.messaging;
    }
    return messaging;
};

module.exports = {
    admin: firebase.admin,
    messaging: firebase.messaging,
    getMessaging,
    initializeFirebase
};
