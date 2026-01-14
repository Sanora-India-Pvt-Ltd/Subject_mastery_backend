const Address = require('../../models/authorization/Address');
const mongoose = require('mongoose');

/**
 * Create a new address
 * POST /api/addresses
 */
const createAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            label,
            fullName,
            phoneNumber,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            country,
            isDefault
        } = req.body;

        // Validate required fields
        if (!label || !fullName || !phoneNumber || !addressLine1 || !city || !state || !zipCode) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: label, fullName, phoneNumber, addressLine1, city, state, zipCode are required'
            });
        }

        // If this is set as default, unset other default addresses
        if (isDefault === true) {
            await Address.updateMany(
                { userId, isDefault: true },
                { isDefault: false }
            );
        }

        // Create address
        const address = await Address.create({
            userId,
            label: label.trim(),
            fullName: fullName.trim(),
            phoneNumber: phoneNumber.trim(),
            addressLine1: addressLine1.trim(),
            addressLine2: addressLine2 ? addressLine2.trim() : '',
            city: city.trim(),
            state: state.trim(),
            zipCode: zipCode.trim(),
            country: country || 'India',
            isDefault: isDefault || false
        });

        return res.status(201).json({
            success: true,
            message: 'Address created successfully',
            data: { address }
        });

    } catch (error) {
        console.error('Create address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating address',
            error: error.message
        });
    }
};

/**
 * Get all addresses for the authenticated user
 * GET /api/addresses
 */
const getAddresses = async (req, res) => {
    try {
        const userId = req.user._id;

        const addresses = await Address.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Addresses retrieved successfully',
            data: { addresses }
        });

    } catch (error) {
        console.error('Get addresses error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving addresses',
            error: error.message
        });
    }
};

/**
 * Get a single address by ID
 * GET /api/addresses/:addressId
 */
const getAddressById = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID'
            });
        }

        const address = await Address.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Address retrieved successfully',
            data: { address }
        });

    } catch (error) {
        console.error('Get address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving address',
            error: error.message
        });
    }
};

/**
 * Update an address
 * PUT /api/addresses/:addressId
 */
const updateAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;
        const {
            label,
            fullName,
            phoneNumber,
            addressLine1,
            addressLine2,
            city,
            state,
            zipCode,
            country,
            isDefault
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID'
            });
        }

        const address = await Address.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // If setting as default, unset other default addresses
        if (isDefault === true && !address.isDefault) {
            await Address.updateMany(
                { userId, isDefault: true, _id: { $ne: addressId } },
                { isDefault: false }
            );
        }

        // Update fields
        if (label !== undefined) address.label = label.trim();
        if (fullName !== undefined) address.fullName = fullName.trim();
        if (phoneNumber !== undefined) address.phoneNumber = phoneNumber.trim();
        if (addressLine1 !== undefined) address.addressLine1 = addressLine1.trim();
        if (addressLine2 !== undefined) address.addressLine2 = addressLine2.trim();
        if (city !== undefined) address.city = city.trim();
        if (state !== undefined) address.state = state.trim();
        if (zipCode !== undefined) address.zipCode = zipCode.trim();
        if (country !== undefined) address.country = country.trim();
        if (isDefault !== undefined) address.isDefault = isDefault;

        await address.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            data: { address }
        });

    } catch (error) {
        console.error('Update address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating address',
            error: error.message
        });
    }
};

/**
 * Delete an address
 * DELETE /api/addresses/:addressId
 */
const deleteAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID'
            });
        }

        const address = await Address.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        await Address.findByIdAndDelete(addressId);

        return res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        console.error('Delete address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting address',
            error: error.message
        });
    }
};

/**
 * Set an address as default
 * PATCH /api/addresses/:addressId/set-default
 */
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID'
            });
        }

        const address = await Address.findOne({
            _id: addressId,
            userId
        });

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Unset all other default addresses
        await Address.updateMany(
            { userId, isDefault: true, _id: { $ne: addressId } },
            { isDefault: false }
        );

        // Set this address as default
        address.isDefault = true;
        await address.save();

        return res.status(200).json({
            success: true,
            message: 'Default address updated successfully',
            data: { address }
        });

    } catch (error) {
        console.error('Set default address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error setting default address',
            error: error.message
        });
    }
};

module.exports = {
    createAddress,
    getAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};

