const router = require('express').Router();
const controller = require('../controllers/leave.controller');
const authenticate = require('../middleware/authenticate');
router.use(authenticate);
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/decision', controller.decide);
module.exports = router;
