const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

/**
 * Convert local time (HH:mm) in a timezone to UTC time
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York', 'Asia/Kolkata')
 * @param {Date} referenceDate - Reference date for conversion (default: today)
 * @returns {Object} { hour, minute } in UTC
 */
const convertLocalTimeToUTC = (hour, minute, timezone = 'UTC', referenceDate = new Date()) => {
    try {
        // If timezone is UTC or empty, return as-is
        if (timezone === 'UTC' || !timezone) {
            return { hour, minute };
        }
        
        // Get today's date components
        const today = new Date(referenceDate);
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() + 1;
        const date = today.getUTCDate();
        
        // Create a date string representing the local time in the user's timezone
        // Format: YYYY-MM-DDTHH:mm:ss (this represents the time in the specified timezone)
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        
        // Use date-fns-tz to convert from the user's timezone to UTC
        // zonedTimeToUtc takes a date string that represents a time in the given timezone
        // and returns a Date object in UTC
        const utcDate = zonedTimeToUtc(dateString, timezone);
        
        return {
            hour: utcDate.getUTCHours(),
            minute: utcDate.getUTCMinutes()
        };
    } catch (error) {
        console.warn(`[TimezoneUtils] Invalid timezone "${timezone}", defaulting to UTC`, error.message);
        // Fallback to UTC if timezone is invalid
        return { hour, minute };
    }
};

/**
 * Check if two dates are on the same day (UTC)
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
};

/**
 * Get start of day in UTC
 * @param {Date} date
 * @returns {Date}
 */
const getStartOfDayUTC = (date = new Date()) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

/**
 * Get end of day in UTC
 * @param {Date} date
 * @returns {Date}
 */
const getEndOfDayUTC = (date = new Date()) => {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
};

module.exports = {
    convertLocalTimeToUTC,
    isSameDay,
    getStartOfDayUTC,
    getEndOfDayUTC
};

