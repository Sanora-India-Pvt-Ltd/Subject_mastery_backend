const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/s3');
const path = require('path');

// Lazy initialization to prevent errors during module load
let upload = null;

function getUpload() {
  if (!upload) {
    if (!process.env.AWS_BUCKET_NAME) {
      throw new Error('AWS_BUCKET_NAME environment variable is required for S3 uploads');
    }
    
    upload = multer({
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
  }
  return upload;
}

// Export a proxy that initializes on first use
module.exports = new Proxy({}, {
  get(target, prop) {
    const uploadInstance = getUpload();
    const value = uploadInstance[prop];
    return typeof value === 'function' ? value.bind(uploadInstance) : value;
  }
});
