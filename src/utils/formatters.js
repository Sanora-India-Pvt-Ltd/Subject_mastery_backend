/**
 * Format education data for consistent response structure
 * @param {Array|Object} education - Education data to format
 * @returns {Array} Formatted education array
 */
const formatEducation = (education) => {
    if (!education) return [];
    const educationArray = Array.isArray(education) ? education : [education];
    
    return educationArray.map(edu => ({
        ...edu.toObject ? edu.toObject() : edu,
        institution: edu.institution ? {
            id: edu.institution._id || edu.institution.id,
            name: edu.institution.name,
            type: edu.institution.type,
            city: edu.institution.city,
            country: edu.institution.country,
            logo: edu.institution.logo,
            verified: edu.institution.verified,
            isCustom: edu.institution.isCustom
        } : null
    }));
};

/**
 * Format workplace data for consistent response structure
 * @param {Array|Object} workplace - Workplace data to format
 * @returns {Array} Formatted workplace array
 */
const formatWorkplace = (workplace) => {
    if (!workplace) return [];
    const workplaceArray = Array.isArray(workplace) ? workplace : [workplace];
    
    return workplaceArray.map(work => ({
        ...work.toObject ? work.toObject() : work,
        company: work.company ? {
            id: work.company._id || work.company.id,
            name: work.company.name,
            industry: work.company.industry,
            location: work.company.location,
            logo: work.company.logo,
            verified: work.company.verified,
            isCustom: work.company.isCustom
        } : null
    }));
};

/**
 * Format user profile with consistent structure
 * @param {Object} user - User object to format
 * @param {Object} viewerContext - Context of the viewer (optional)
 * @returns {Object} Formatted user profile
 */
const formatUserProfile = (user, viewerContext = {}) => {
    if (!user) return null;
    
    const userObj = user.toObject ? user.toObject() : { ...user };
    
    // Format education and workplace
    const education = formatEducation(userObj.professional?.education || []);
    const workplace = formatWorkplace(userObj.professional?.workplace || []);
    
    // Construct the formatted user object
    const formattedUser = {
        ...userObj,
        education,
        professional: {
            ...userObj.professional,
            workplace
        }
    };

    // Remove sensitive fields if viewer is not the owner
    if (viewerContext.userId !== userObj._id?.toString()) {
        const safeUser = { ...formattedUser };
        delete safeUser.auth;
        if (safeUser.profile) {
            delete safeUser.profile.email;
        }
        return safeUser;
    }

    return formattedUser;
};

module.exports = {
    formatEducation,
    formatWorkplace,
    formatUserProfile
};
