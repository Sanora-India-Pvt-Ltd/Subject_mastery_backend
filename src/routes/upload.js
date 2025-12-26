const router = require('express').Router();
const upload = require('../middleware/s3Upload');

router.post('/upload/test', upload.single('file'), (req, res) => {
  res.json({
    success: true,
    url: req.file.location,
    key: req.file.key
  });
});

module.exports = router;

