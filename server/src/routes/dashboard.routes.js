const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/dashboard.controller');
router.get('/summary', authenticate, controller.summary);
module.exports = router;
