const express = require('express');
const { protect } = require('../middleware/auth');
const {
    searchCompanies,
    createCompany
} = require('../controllers/companyController');

const router = express.Router();

// Search companies - public endpoint (no auth required for search)
router.get('/search', searchCompanies);

// Create company - requires authentication
router.post('/', protect, createCompany);

// Debug: Log all registered routes
console.log('📋 Company routes registered:');
console.log('  GET  /api/company/search');
console.log('  POST /api/company (protected)');

module.exports = router;

