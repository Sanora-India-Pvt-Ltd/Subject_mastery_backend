/**
 * Notification Category Constants
 * 
 * Centralized list of notification categories used across the system.
 * This ensures consistency between:
 * - Notification model
 * - Notification preferences
 * - Notification emitter
 * 
 * Usage:
 *   const { NOTIFICATION_CATEGORIES } = require('./constants/notificationCategories');
 *   if (NOTIFICATION_CATEGORIES.includes(category)) { ... }
 */

const NOTIFICATION_CATEGORIES = [
    'COURSE',
    'VIDEO',
    'SOCIAL',
    'MARKETPLACE',
    'WALLET',
    'SYSTEM'
];

// Category enum for validation
const NOTIFICATION_CATEGORY_ENUM = {
    COURSE: 'COURSE',
    VIDEO: 'VIDEO',
    SOCIAL: 'SOCIAL',
    MARKETPLACE: 'MARKETPLACE',
    WALLET: 'WALLET',
    SYSTEM: 'SYSTEM'
};

module.exports = {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_CATEGORY_ENUM
};
