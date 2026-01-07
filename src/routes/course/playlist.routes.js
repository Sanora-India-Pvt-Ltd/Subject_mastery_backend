const express = require('express');
const router = express.Router();
const {
    createPlaylist,
    getPlaylists,
    updatePlaylist,
    deletePlaylist
} = require('../../controllers/course/playlist.controller');
const { protectUniversity } = require('../../middleware/universityAuth.middleware');
const { protect } = require('../../middleware/auth');

// Playlist Routes
router.post('/courses/:courseId/playlists', protectUniversity, createPlaylist);
router.get('/courses/:courseId/playlists', protect, getPlaylists);
router.put('/playlists/:id', protectUniversity, updatePlaylist);
router.delete('/playlists/:id', protectUniversity, deletePlaylist);

module.exports = router;

