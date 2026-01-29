const express = require('express');
const { protect } = require('../../middleware/auth');
const { createAlarmProfile, getAlarmProfiles } = require('../../controllers/MindTrain/alarmProfile.controller');

const router = express.Router();

/**
 * POST /api/mindtrain/create-alarm-profile
 * Creates a new alarm profile and automatically deactivates all other profiles for the same user.
 */
router.post('/create-alarm-profile', protect, createAlarmProfile);

/**
 * GET /api/mindtrain/get-alarm-profiles
 * Retrieves all alarm profiles for the authenticated user, separated into active and inactive profiles.
 */
router.get('/get-alarm-profiles', protect, getAlarmProfiles);

module.exports = router;

