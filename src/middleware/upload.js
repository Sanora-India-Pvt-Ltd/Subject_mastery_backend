const multer = require("multer");

const storage = multer.diskStorage({});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

module.exports = upload;
