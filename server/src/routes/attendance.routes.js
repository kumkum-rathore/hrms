const router = require('express').Router();
const controller = require('../controllers/attendance.controller');
const authenticate = require('../middleware/authenticate');
router.use(authenticate);
router.get('/', controller.list);
router.post('/check-in', controller.checkIn);
router.post('/check-out', controller.checkOut);
module.exports = router;
