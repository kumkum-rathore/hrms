const router = require('express').Router();
const auth = require('../middleware/authenticate');
const multer = require('multer');
const upload = require('../middleware/upload');
const c = require('../controllers/upload.controller');

router.use(auth);

router.post(
  '/',
  (req, res, next) =>
    upload.single('file')(req, res, err => {
      if (err instanceof multer.MulterError)
        return res.status(400).json({
          success: false,
          message:
            err.code === 'LIMIT_FILE_SIZE'
              ? 'File exceeds 25 MB limit.'
              : 'Upload rejected.',
          error: { code: err.code, details: [] }
        });
      if (err)
        return res.status(400).json({
          success: false,
          message: err.message,
          error: { code: 'UPLOAD_REJECTED', details: [] }
        });
      next();
    }),
  c.upload
);

// Preview must be registered BEFORE '/:key' so it doesn't get swallowed.
router.get('/:key/preview', c.preview);

router.get('/:key', c.download);

module.exports = router;