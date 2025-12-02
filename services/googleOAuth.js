const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class GoogleOAuthService {
    constructor() {
        this.oAuth2Client = null;
        this.initializeOAuthClient();
    }

    async initializeOAuthClient() {
        // Use environment variables for security
        const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

        this.oAuth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        // Try to load existing tokens
        await this.loadSavedTokens();
    }

    async loadSavedTokens() {
        try {
            const tokenPath = path.join(__dirname, '..', 'tokens.json');
            const tokens = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
            
            if (tokens.access_token) {
                this.oAuth2Client.setCredentials(tokens);
                console.log('Google OAuth tokens loaded successfully');
            }
        } catch (error) {
            console.log('No saved tokens found. Need to authenticate.');
        }
    }

    async saveTokens(tokens) {
        try {
            const tokenPath = path.join(__dirname, '..', 'tokens.json');
            await fs.writeFile(tokenPath, JSON.stringify(tokens));
            console.log('Tokens saved successfully');
        } catch (error) {
            console.error('Error saving tokens:', error);
        }
    }

    getAuthUrl() {
        const SCOPES = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        return this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
    }

    async getTokens(code) {
        try {
            const { tokens } = await this.oAuth2Client.getToken(code);
            this.oAuth2Client.setCredentials(tokens);
            await this.saveTokens(tokens);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error);
            throw error;
        }
    }

    async refreshAccessToken() {
        try {
            const { credentials } = await this.oAuth2Client.refreshAccessToken();
            this.oAuth2Client.setCredentials(credentials);
            await this.saveTokens(credentials);
            return credentials;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw error;
        }
    }

    async isTokenValid() {
        if (!this.oAuth2Client || !this.oAuth2Client.credentials) {
            return false;
        }

        // Check if we have a refresh token (required for token refresh)
        if (!this.oAuth2Client.credentials.refresh_token) {
            return false;
        }

        // Check if token is expired or about to expire (within 5 minutes)
        const expiryDate = this.oAuth2Client.credentials.expiry_date;
        if (!expiryDate) {
            return false;
        }

        const currentTime = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

        return currentTime < (expiryDate - bufferTime);
    }

    hasRefreshToken() {
        return this.oAuth2Client && 
               this.oAuth2Client.credentials && 
               !!this.oAuth2Client.credentials.refresh_token;
    }

    async getValidToken() {
        if (!this.oAuth2Client || !this.oAuth2Client.credentials) {
            throw new Error('OAuth client not initialized or no credentials available');
        }

        // Check if we have a refresh token before trying to refresh
        if (!this.hasRefreshToken()) {
            // If we have an access token but no refresh token, return it (might be valid)
            if (this.oAuth2Client.credentials.access_token) {
                return this.oAuth2Client.credentials.access_token;
            }
            throw new Error('No refresh token available. Please authenticate first.');
        }

        if (!await this.isTokenValid()) {
            console.log('Token expired or invalid, refreshing...');
            await this.refreshAccessToken();
        }
        return this.oAuth2Client.credentials.access_token;
    }
}

module.exports = new GoogleOAuthService();