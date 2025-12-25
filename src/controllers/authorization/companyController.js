const Company = require('../../models/authorization/Company');

// Search companies by name
const searchCompanies = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchTerm = query.trim();
        const normalizedSearchTerm = searchTerm.toLowerCase();

        // Search for companies that match the query (case-insensitive)
        const companies = await Company.find({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { normalizedName: { $regex: normalizedSearchTerm, $options: 'i' } }
            ]
        })
        .limit(20) // Limit results to 20
        .sort({ name: 1 }) // Sort alphabetically
        .select('name isCustom createdAt');

        // If no matches found, return special flag to allow custom entry
        if (companies.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No companies found',
                data: {
                    companies: [],
                    canAddCustom: true,
                    suggestedName: searchTerm
                }
            });
        }

        // Return found companies
        return res.status(200).json({
            success: true,
            message: `Found ${companies.length} company/companies`,
            data: {
                companies: companies.map(company => ({
                    id: company._id,
                    name: company.name,
                    isCustom: company.isCustom,
                    createdAt: company.createdAt
                })),
                canAddCustom: false,
                suggestedName: null
            }
        });

    } catch (error) {
        console.error('Search companies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching companies',
            error: error.message
        });
    }
};

// Create a new company (custom entry)
const createCompany = async (req, res) => {
    try {
        const { name } = req.body;
        const user = req.user; // From protect middleware

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }

        const companyName = name.trim();
        const normalizedName = companyName.toLowerCase();

        // Check if company already exists
        const existingCompany = await Company.findOne({
            $or: [
                { name: companyName },
                { normalizedName: normalizedName }
            ]
        });

        if (existingCompany) {
            return res.status(200).json({
                success: true,
                message: 'Company already exists',
                data: {
                company: {
                    id: existingCompany._id,
                    name: existingCompany.name,
                    isCustom: existingCompany.isCustom,
                    createdAt: existingCompany.createdAt
                }
                }
            });
        }

        // Create new company
        const newCompany = await Company.create({
            name: companyName,
            normalizedName: normalizedName,
            isCustom: true,
            createdBy: user._id
        });

        return res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: {
                company: {
                    id: newCompany._id,
                    name: newCompany.name,
                    isCustom: newCompany.isCustom,
                    createdAt: newCompany.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Create company error:', error);
        
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
            // Company was created by another request, fetch it
            const companyName = req.body.name.trim();
            const normalizedName = companyName.toLowerCase();
            const existingCompany = await Company.findOne({
                $or: [
                    { name: companyName },
                    { normalizedName: normalizedName }
                ]
            });

            if (existingCompany) {
                return res.status(200).json({
                    success: true,
                    message: 'Company already exists',
                    data: {
                company: {
                    id: existingCompany._id,
                    name: existingCompany.name,
                    isCustom: existingCompany.isCustom,
                    createdAt: existingCompany.createdAt
                }
                    }
                });
            }
        }

        res.status(500).json({
            success: false,
            message: 'Error creating company',
            error: error.message
        });
    }
};

module.exports = {
    searchCompanies,
    createCompany
};

