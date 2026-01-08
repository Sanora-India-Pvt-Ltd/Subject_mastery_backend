const express = require('express');
const router = express.Router();
const { getCourseAnalytics, publishCourse } = require('../../controllers/course/course.controller');
const { protectUniversity } = require('../../middleware/universityAuth.middleware');

// University Course Analytics Routes
router.get('/courses/:courseId/analytics', protectUniversity, getCourseAnalytics);

// University Course Publishing Routes
router.post('/courses/:courseId/publish', protectUniversity, publishCourse);

module.exports = router;

