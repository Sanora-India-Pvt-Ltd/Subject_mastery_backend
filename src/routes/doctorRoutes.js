const express = require('express');
const { doctorSignup, doctorLogin } = require('../controllers/doctorController');

const router = express.Router();

router.post('/signup', doctorSignup);
router.post('/login', doctorLogin);

module.exports = router;