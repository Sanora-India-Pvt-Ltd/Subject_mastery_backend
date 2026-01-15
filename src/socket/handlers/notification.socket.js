/**
 * Notification Socket Handler
 * 
 * Handles real-time notification delivery via Socket.IO.
 * This handler manages connection/disconnection logging for notifications.
 * 
 * The actual room joining is handled in socketServer.js connection handler.
 */

/**
 * Handle notification socket connection
 * 
 * This is called from socketServer.js when a socket connects.
 * The socket should already be authenticated and have:
 * - socket.userId (for USER) or socket.universityId (for UNIVERSITY)
 * - socket.identity = { id, type: 'USER' | 'UNIVERSITY' }
 */
const handleNotificationConnection = (socket) => {
    const identity = socket.identity || (socket.userId ? {
        id: socket.userId,
        type: 'USER'
    } : socket.universityId ? {
        id: socket.universityId,
        type: 'UNIVERSITY'
    } : null);

    if (!identity) {
        console.error('⚠️  Notification socket connected without identity');
        return;
    }

    // Log connection
    console.log(`🔌 Notification socket connected: ${identity.type} ${identity.id}`);

    // Room joining is handled in socketServer.js connection handler
    // USER → joins user:{userId}
    // UNIVERSITY → joins university:{universityId}
};

/**
 * Handle notification socket disconnect
 * 
 * This is called from socketServer.js when a socket disconnects.
 */
const handleNotificationDisconnect = (socket) => {
    const identity = socket.identity || (socket.userId ? {
        id: socket.userId,
        type: 'USER'
    } : socket.universityId ? {
        id: socket.universityId,
        type: 'UNIVERSITY'
    } : null);

    if (identity) {
        console.log(`🔌 Notification socket disconnected: ${identity.type} ${identity.id}`);
    }
};

module.exports = {
    handleNotificationConnection,
    handleNotificationDisconnect
};
