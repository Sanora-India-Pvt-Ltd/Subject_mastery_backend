/**
 * Notification Category Metadata Helper
 * 
 * Provides UI-friendly metadata for notification categories.
 * Used to render category labels, icons, and colors in the frontend.
 * 
 * Usage:
 *   const { getCategoryMeta } = require('./utils/notificationCategoryMeta');
 *   const meta = getCategoryMeta('COURSE');
 */

/**
 * Get category metadata
 * @param {string} category - Category key (e.g., 'COURSE', 'SYSTEM')
 * @returns {Object} Category metadata with label, icon, and color
 */
const getCategoryMeta = (category) => {
    const categoryMap = {
        COURSE: {
            key: 'COURSE',
            label: 'Courses',
            icon: 'book',
            color: '#4F46E5' // Indigo
        },
        VIDEO: {
            key: 'VIDEO',
            label: 'Videos',
            icon: 'video',
            color: '#DC2626' // Red
        },
        SOCIAL: {
            key: 'SOCIAL',
            label: 'Social',
            icon: 'users',
            color: '#059669' // Emerald
        },
        MARKETPLACE: {
            key: 'MARKETPLACE',
            label: 'Marketplace',
            icon: 'shopping-cart',
            color: '#D97706' // Amber
        },
        WALLET: {
            key: 'WALLET',
            label: 'Wallet',
            icon: 'wallet',
            color: '#7C3AED' // Violet
        },
        SYSTEM: {
            key: 'SYSTEM',
            label: 'System',
            icon: 'bell',
            color: '#6B7280' // Gray
        },
        CONFERENCE: {
            key: 'CONFERENCE',
            label: 'Conferences',
            icon: 'video-camera',
            color: '#0284C7' // Sky blue
        },
        PAYMENT: {
            key: 'PAYMENT',
            label: 'Payments',
            icon: 'credit-card',
            color: '#16A34A' // Green
        },
        SECURITY: {
            key: 'SECURITY',
            label: 'Security',
            icon: 'shield',
            color: '#DC2626' // Red
        }
    };

    // Return category metadata or fallback to SYSTEM
    return categoryMap[category] || categoryMap.SYSTEM;
};

module.exports = {
    getCategoryMeta
};
