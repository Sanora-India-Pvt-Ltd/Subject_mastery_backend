/**
 * Admin Authorization Guard
 * 
 * Restricts access to admin-only endpoints.
 * Currently supports SYSTEM tokens (admin tokens can be added later).
 * 
 * Usage:
 *   router.post('/admin/route', flexibleAuth, adminGuard, controller);
 */

const adminGuard = (req, res, next) => {
    // Check if request is from SYSTEM or ADMIN
    // For now, we'll check for a system token or admin flag
    // This can be extended when admin authentication is implemented
    
    // Option 1: Check for system token (if implemented)
    if (req.systemToken || req.isSystem) {
        return next();
    }

    // Option 2: Check for admin user (if implemented)
    if (req.admin || req.isAdmin) {
        return next();
    }

    // Option 3: Check for special header (for system calls)
    if (req.headers['x-system-token'] === process.env.SYSTEM_TOKEN) {
        req.isSystem = true;
        return next();
    }

    // Reject USER and UNIVERSITY tokens
    if (req.user || req.universityId) {
        return res.status(403).json({
            success: false,
            message: 'This endpoint requires admin or system access. User and university accounts cannot access this resource.'
        });
    }

    // No authentication found
    return res.status(401).json({
        success: false,
        message: 'Admin or system authentication required'
    });
};

module.exports = {
    adminGuard
};
