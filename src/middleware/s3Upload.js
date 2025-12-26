const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/s3');
const path = require('path');

const upload = multer({
  storage: multerS3({
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
  })
});

module.exports = upload;
