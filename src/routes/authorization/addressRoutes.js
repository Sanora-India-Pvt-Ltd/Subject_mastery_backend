const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const {
    createAddress,
    getAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} = require('../../controllers/authorization/addressController');

// Address CRUD Routes (User only)
router.post('/', protect, createAddress);
router.get('/', protect, getAddresses);
router.get('/:addressId', protect, getAddressById);
router.put('/:addressId', protect, updateAddress);
router.delete('/:addressId', protect, deleteAddress);
router.patch('/:addressId/set-default', protect, setDefaultAddress);

module.exports = router;

