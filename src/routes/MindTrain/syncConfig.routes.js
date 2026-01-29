const express = require('express');
const { protect } = require('../../middleware/auth');
const { syncConfig } = require('../../controllers/MindTrain/syncConfig.controller');

const router = express.Router();

/**
 * PUT /api/mindtrain/alarm-profiles/sync-config
 * Create/update alarm profile and configure FCM schedule
 */
router.put('/sync-config', protect, syncConfig);

module.exports = router;

