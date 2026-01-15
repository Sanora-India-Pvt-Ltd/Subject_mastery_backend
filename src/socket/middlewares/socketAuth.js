/**
 * Socket Authentication Middleware
 * 
 * This middleware extends the existing socket authentication in socketServer.js
 * to support both USER and UNIVERSITY tokens for notifications.
 * 
 * The main socketServer.js already handles USER authentication.
 * This file provides a reference for how to extend it for UNIVERSITY support.
 */

const jwt = require('jsonwebtoken');
const User = require('../../models/authorization/User');
const University = require('../../models/auth/University');

/**
 * Enhanced socket authentication that supports both USER and UNIVERSITY
 * 
 * This is a reference implementation. The actual middleware is integrated
 * into socketServer.js to maintain a single authentication flow.
 * 
 * Usage in socketServer.js:
 *   - Check decoded.type === 'university' for university tokens
 *   - Set socket.universityId and socket.identity for universities
 *   - Set socket.userId and socket.identity for users
 */
const authenticateSocket = async (socket, next) => {
    try {
        // Read token from handshake
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            
            // Handle UNIVERSITY token
            if (decoded.type === 'university') {
                const university = await University.findById(decoded.id).select('-password');
                
                if (!university) {
                    return next(new Error('Authentication error: University not found'));
                }

                // Check if active
                const isActive = university.account?.status?.isActive ?? university.isActive;
                if (!isActive) {
                    return next(new Error('Authentication error: University account is inactive'));
                }

                // Check if verified
                const isVerified = university.verification?.isVerified ?? university.isVerified;
                if (!isVerified) {
                    return next(new Error('Authentication error: Email verification required'));
                }

                socket.universityId = university._id.toString();
                socket.identity = {
                    id: university._id.toString(),
                    type: 'UNIVERSITY'
                };
                
                return next();
            }

            // Handle USER token (default)
            const user = await User.findById(decoded.id).select('-auth');
            
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.userId = user._id.toString();
            socket.identity = {
                id: user._id.toString(),
                type: 'USER'
            };
            
            return next();

        } catch (error) {
            return next(new Error('Authentication error: Invalid token'));
        }
    } catch (error) {
        return next(new Error('Authentication error'));
    }
};

module.exports = {
    authenticateSocket
};
