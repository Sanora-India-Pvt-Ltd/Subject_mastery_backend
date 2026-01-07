const Playlist = require('../../models/course/Playlist');
const Video = require('../../models/course/Video');
const Course = require('../../models/course/Course');

/**
 * Create playlist (course owner only)
 */
const createPlaylist = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { name, description, thumbnail, order } = req.body;
        const universityId = req.universityId; // From middleware

        // Verify course ownership
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        if (course.universityId.toString() !== universityId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to create playlists for this course'
            });
        }

        const playlist = await Playlist.create({
            courseId,
            name,
            description: description || '',
            thumbnail: thumbnail || null,
            order: order || 0
        });

        res.status(201).json({
            success: true,
            message: 'Playlist created successfully',
            data: { playlist }
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating playlist',
            error: error.message
        });
    }
};

/**
 * Get all playlists for a course
 */
const getPlaylists = async (req, res) => {
    try {
        const { courseId } = req.params;

        const playlists = await Playlist.find({ courseId })
            .sort({ order: 1, createdAt: 1 })
            .lean();

        res.status(200).json({
            success: true,
            message: 'Playlists retrieved successfully',
            data: { playlists }
        });
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving playlists',
            error: error.message
        });
    }
};

/**
 * Update playlist (reorder, rename)
 */
const updatePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, thumbnail, order } = req.body;
        const universityId = req.universityId; // From middleware

        const playlist = await Playlist.findById(id).populate('courseId');

        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found'
            });
        }

        // Verify course ownership
        const course = await Course.findById(playlist.courseId);
        if (course.universityId.toString() !== universityId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to update this playlist'
            });
        }

        // Update fields
        if (name !== undefined) playlist.name = name;
        if (description !== undefined) playlist.description = description;
        if (thumbnail !== undefined) playlist.thumbnail = thumbnail;
        if (order !== undefined) playlist.order = order;

        await playlist.save();

        res.status(200).json({
            success: true,
            message: 'Playlist updated successfully',
            data: { playlist }
        });
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating playlist',
            error: error.message
        });
    }
};

/**
 * Delete playlist (handle video cleanup)
 */
const deletePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const universityId = req.universityId; // From middleware

        const playlist = await Playlist.findById(id);

        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found'
            });
        }

        // Verify course ownership
        const course = await Course.findById(playlist.courseId);
        if (course.universityId.toString() !== universityId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this playlist'
            });
        }

        // Delete all videos in playlist
        await Video.deleteMany({ playlistId: id });

        // Delete playlist
        await Playlist.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Playlist deleted successfully'
        });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting playlist',
            error: error.message
        });
    }
};

module.exports = {
    createPlaylist,
    getPlaylists,
    updatePlaylist,
    deletePlaylist
};

