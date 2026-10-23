const router = require('express').Router();
const controller = require('../controllers/branch.controller');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
router.use(authenticate);
router.get('/', authorizeRoles('SUPER_ADMIN', 'BRANCH_ADMIN'), controller.list);
router.post('/code', authorizeRoles('SUPER_ADMIN'), controller.reserveCode);
router.post('/', authorizeRoles('SUPER_ADMIN'), controller.create);
router.patch('/:id', authorizeRoles('SUPER_ADMIN'), controller.update);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), controller.remove);
// Superadmin can list all branches and create branches. Branch Admin's list endpoint is server-filtered to their assigned branch only; they cannot create branches.
module.exports = router;
