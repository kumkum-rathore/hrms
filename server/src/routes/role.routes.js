const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/role.controller');
const { hasPermission } = require('../utils/permissions');
router.use(auth);
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', c.archive);
router.get('/permissions', (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && !hasPermission(req.user, 'role.create'))
    return res.status(403).json({ success: false, message: 'You do not have permission to view the permission catalogue.', error: { code: 'FORBIDDEN', details: [] } });
  return res.json({ success: true, data: c.allowedPermissions });
});
module.exports = router;
