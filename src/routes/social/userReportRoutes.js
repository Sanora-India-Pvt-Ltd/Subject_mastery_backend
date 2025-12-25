const express = require('express');
const router = express.Router();

// Import controller
let userReportController;
try {
  userReportController = require('../../controllers/social/userReportController');
  console.log('ƒo. User report controller loaded');
} catch (error) {
  console.error('ƒ?O Failed to load user report controller:', error.message);
  userReportController = { reportUser: null };
}

// Import auth middleware
const { protect } = require('../../middleware/auth');

// Validate controller function exists
if (!userReportController.reportUser) {
  console.error('ƒ?O reportUser function not found in controller');
}

// Report a user (authenticated users only)
// Full endpoint: POST /api/reports/users/:userId/report
if (typeof protect === 'function' && typeof userReportController.reportUser === 'function') {
  router.post('/users/:userId/report', protect, userReportController.reportUser);
  console.log('ƒo. User report route registered: POST /users/:userId/report');
} else {
  console.error('ƒ?O Cannot register route - missing auth or controller function');
}

module.exports = router;
