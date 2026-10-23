const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/project.controller');
router.use(auth);
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);
module.exports = router;
