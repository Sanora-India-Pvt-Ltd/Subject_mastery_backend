const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Transcode video to Baseline Profile Level 3.1 for Flutter compatibility
 * @param {string} inputPath - Path to input video file
 * @param {string} outputDir - Optional directory to save transcoded video (defaults to OS temp dir)
 * @returns {Promise<{outputPath: string, duration: number, width: number, height: number, fileSize: number}>}
 */
const transcodeVideo = (inputPath, outputDir = null) => {
    return new Promise(async (resolve, reject) => {
        let outputPath = null;
        let finalOutputDir = null;

        try {
            // Validate input file exists
            try {
                await fs.access(inputPath);
            } catch (accessError) {
                throw new Error(`Input video file not found: ${inputPath}`);
            }

            // Use OS temp directory if not provided
            finalOutputDir = outputDir || path.join(os.tmpdir(), 'video_transcoding');
            
            // Create output directory if it doesn't exist
            await fs.mkdir(finalOutputDir, { recursive: true });

            // Generate unique output filename
            const outputFilename = `transcoded_${uuidv4()}.mp4`;
            outputPath = path.join(finalOutputDir, outputFilename);

            // Get video metadata first
            let videoMetadata = null;

            // First, get video info
            ffmpeg.ffprobe(inputPath, async (err, metadata) => {
                if (err) {
                    console.error('Error getting video metadata:', err);
                    return reject(new Error('Failed to get video metadata: ' + err.message));
                }

                videoMetadata = {
                    duration: metadata.format.duration || 0,
                    width: metadata.streams.find(s => s.codec_type === 'video')?.width || 0,
                    height: metadata.streams.find(s => s.codec_type === 'video')?.height || 0
                };

                // Get original dimensions to ensure Level 3.1 compliance
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const originalWidth = videoStream?.width || 1920;
                const originalHeight = videoStream?.height || 1080;
                
                // Level 3.1 constraints: max 1280x720 @ 30fps, max bitrate ~14Mbps
                // Scale down if needed to stay within Level 3.1 limits
                let targetWidth = originalWidth;
                let targetHeight = originalHeight;
                
                if (originalWidth > 1280 || originalHeight > 720) {
                    // Calculate scale to fit within 1280x720 while maintaining aspect ratio
                    const scale = Math.min(1280 / originalWidth, 720 / originalHeight);
                    targetWidth = Math.floor(originalWidth * scale);
                    targetHeight = Math.floor(originalHeight * scale);
                    // Ensure dimensions are even (required for H.264)
                    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
                    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
                    console.log(`Scaling video from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight} for Level 3.1 compliance`);
                }

                // Transcode video with Baseline Profile Level 3.1 (strict constraints)
                // CRITICAL: These settings ensure avc1.42E01E (Baseline 3.1) for maximum Android compatibility
                const ffmpegCommand = ffmpeg(inputPath)
                    .videoCodec('libx264')
                    .outputOptions([
                        '-profile:v baseline',      // Baseline profile (most compatible for Android) - CRITICAL
                        '-level 3.1',              // Level 3.1 - CRITICAL (must be 3.1, not 31)
                        '-pix_fmt yuv420p',        // YUV 4:2:0 pixel format (ensures compatibility) - CRITICAL
                        '-r 30',                   // Frame rate 30fps (Level 3.1 max)
                        '-movflags +faststart',    // Faststart flag (optimizes for streaming/playback) - CRITICAL
                        '-preset fast',            // Encoding speed
                        '-crf 23',                 // Quality (lower = better, 18-28 range)
                        '-maxrate 10M',            // Max bitrate (Level 3.1 safe)
                        '-bufsize 20M',            // Buffer size
                        '-force_key_frames 0:00:00.000', // Force keyframe at start
                        '-x264-params keyint=30:min-keyint=30:scenecut=0:level_idc=31:force-cfr=1' // Force Level 3.1 with constant frame rate
                    ])
                    .audioCodec('aac')
                    .audioBitrate('128k')
                    .audioFrequency(44100)
                    .audioChannels(2)
                    .output(outputPath);

                // Add scale filter if dimensions need to be reduced
                if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
                    ffmpegCommand.videoFilters(`scale=${targetWidth}:${targetHeight}`);
                }

                // Track transcoding process for cleanup
                let transcodingProcess = null;
                let isCompleted = false;
                let isError = false;

                ffmpegCommand
                    .on('start', (commandLine) => {
                        console.log('[VideoTranscoder] FFmpeg transcoding started');
                        console.log('[VideoTranscoder] Command:', commandLine);
                        console.log('[VideoTranscoder] Input:', inputPath);
                        console.log('[VideoTranscoder] Output:', outputPath);
                        console.log('[VideoTranscoder] Target: H.264 Baseline Profile 3.1, yuv420p, faststart');
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            console.log(`[VideoTranscoder] Progress: ${Math.round(progress.percent)}%`);
                        }
                    })
                    .on('end', async () => {
                        if (isError) return; // Prevent double resolution
                        isCompleted = true;
                        console.log('[VideoTranscoder] Video transcoding completed successfully');
                        
                        try {
                            // Verify output file exists
                            await fs.access(outputPath);
                            
                            // Get file size and verify it's not empty
                            const stats = await fs.stat(outputPath);
                            if (stats.size === 0) {
                                throw new Error('Transcoded video file is empty');
                            }

                            console.log('[VideoTranscoder] Output file size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
                            
                            resolve({
                                outputPath,
                                duration: videoMetadata.duration,
                                width: targetWidth || videoMetadata.width,
                                height: targetHeight || videoMetadata.height,
                                fileSize: stats.size
                            });
                        } catch (statError) {
                            console.error('[VideoTranscoder] Error verifying output file:', statError);
                            // Cleanup invalid output file
                            await cleanupFile(outputPath);
                            reject(new Error('Transcoded video verification failed: ' + statError.message));
                        }
                    })
                    .on('error', async (err) => {
                        if (isCompleted) return; // Prevent double rejection
                        isError = true;
                        console.error('[VideoTranscoder] FFmpeg transcoding error:', err);
                        console.error('[VideoTranscoder] Error details:', {
                            message: err.message,
                            code: err.code,
                            signal: err.signal,
                            killed: err.killed
                        });
                        
                        // Cleanup partial output file on error
                        try {
                            await cleanupFile(outputPath);
                        } catch (cleanupErr) {
                            console.error('[VideoTranscoder] Error during cleanup:', cleanupErr);
                        }
                        
                        reject(new Error('Video transcoding failed: ' + err.message));
                    });

                // Store process reference for potential cleanup
                transcodingProcess = ffmpegCommand                    .run();
            });
        } catch (error) {
            console.error('[VideoTranscoder] Transcoding setup error:', error);
            
            // Cleanup on setup error
            if (outputPath) {
                await cleanupFile(outputPath, 'setup_error');
            }
            
            reject(new Error('Failed to setup video transcoding: ' + error.message));
        }
    });
};

/**
 * Check if file is a video based on mimetype
 * @param {string} mimetype - File mimetype
 * @returns {boolean}
 */
const isVideo = (mimetype) => {
    return mimetype && mimetype.startsWith('video/');
};

/**
 * Clean up temporary files with better error handling
 * @param {string} filePath - Path to file to delete
 * @param {string} context - Optional context for logging
 */
const cleanupFile = async (filePath, context = '') => {
    if (!filePath) {
        return;
    }

    try {
        // Check if file exists
        const exists = await fs.access(filePath)
            .then(() => true)
            .catch(() => false);

        if (exists) {
            await fs.unlink(filePath);
            const contextMsg = context ? ` [${context}]` : '';
            console.log(`[VideoTranscoder] Cleaned up temporary file${contextMsg}:`, filePath);
        }
    } catch (error) {
        // Log but don't throw - cleanup errors shouldn't break the flow
        console.error(`[VideoTranscoder] Error cleaning up file (${filePath}):`, error.message);
    }
};

module.exports = {
    transcodeVideo,
    isVideo,
    cleanupFile
};

