const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/s3');
const path = require('path');
const { isVideo } = require('../services/videoTranscoder');

// Disk storage for videos (needed for transcoding)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, require('os').tmpdir());
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const fileName = `uploads/${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;
    cb(null, fileName);
  }
});

// S3 storage for images (direct upload)
const s3Storage = multerS3({
  s3,
  bucket: process.env.AWS_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `uploads/${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;
    cb(null, fileName);
  }
});

// Hybrid upload: diskStorage for videos, s3Storage for images
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, require('os').tmpdir());
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const fileName = `uploads/${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${ext}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

module.exports = upload;

