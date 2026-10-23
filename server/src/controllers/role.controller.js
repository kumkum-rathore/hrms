const CustomRole = require('../models/CustomRole');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { PERMISSION_KEYS, hasPermission } = require('../utils/permissions');
const allowedPermissions = [...PERMISSION_KEYS];
const DEFAULT_ROLES = [
  {
    name: 'Manager',
    code: 'MANAGER',
    description: 'Branch manager.'
  },
  {
    name: 'HR',
    code: 'HR',
    description: 'Human resources.'
  }
];

async function ensureDefaultRoles(branchId, createdBy) {
  for (const role of DEFAULT_ROLES) {
    try {
      await CustomRole.updateOne(
        { branchId, code: role.code },
        {
          $setOnInsert: {
            ...role,
            branchId,
            createdBy
          }
        },
        { upsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existingRole = await CustomRole.exists({ branchId, code: role.code });
      if (!existingRole) throw error;
    }
  }
}

async function list(req, res) {
  if (req.user.role !== 'SUPER_ADMIN' && (req.user.role !== 'BRANCH_ADMIN' || !hasPermission(req.user, 'role.create')))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view branch roles.', code: 'FORBIDDEN' });
  if (req.user.role === 'BRANCH_ADMIN' && req.user.branchId)
    await ensureDefaultRoles(req.user.branchId, req.user.id);
  const filter = req.user.role === 'SUPER_ADMIN' ? { branchId: { $ne: null }, isArchived: { $ne: true } } : { branchId: req.user.branchId, isArchived: { $ne: true } };
  const rows = await CustomRole.find(filter).select('-permissions').populate('branchId', 'name branchCode').populate('createdBy', 'firstName lastName role').sort({ name: 1 }).lean();
  return sendSuccess(res, { message: 'Branch roles loaded.', data: rows });
}
async function create(req, res) {
  if (req.user.role !== 'BRANCH_ADMIN' || !hasPermission(req.user, 'role.create'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to create branch roles.', code: 'FORBIDDEN' });
  const { name, description = '' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)
    return sendError(res, { statusCode: 400, message: 'Role name must be between 2 and 80 characters.', code: 'VALIDATION_ERROR' });
  if (typeof description !== 'string' || description.length > 500)
    return sendError(res, { statusCode: 400, message: 'Role description cannot exceed 500 characters.', code: 'VALIDATION_ERROR' });
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/g, '');
  if (!code)
    return sendError(res, { statusCode: 400, message: 'Role name must include letters or numbers.', code: 'VALIDATION_ERROR' });
  try {
    const role = await CustomRole.create({
      branchId: req.user.branchId,
      name: name.trim(),
      code,
      description: description.trim(),
      createdBy: req.user.id
    });
    return sendSuccess(res, { statusCode: 201, message: 'Branch role created.', data: role });
  } catch (error) {
    if (error.code === 11000)
      return sendError(res, { statusCode: 409, message: 'A role with this name already exists in your branch.', code: 'DUPLICATE_ROLE' });
    throw error;
  }
}
async function update(req, res) {
  if (req.user.role !== 'BRANCH_ADMIN' || !hasPermission(req.user, 'role.create'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to edit branch roles.', code: 'FORBIDDEN' });
  const role = await CustomRole.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!role) return sendError(res, { statusCode: 404, message: 'Role not found in your branch.', code: 'ROLE_NOT_FOUND' });
  const { name, description } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)
    return sendError(res, { statusCode: 400, message: 'Role name must be between 2 and 80 characters.', code: 'VALIDATION_ERROR' });
  if (description !== undefined && (typeof description !== 'string' || description.length > 500))
    return sendError(res, { statusCode: 400, message: 'Role description cannot exceed 500 characters.', code: 'VALIDATION_ERROR' });
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/g, '');
  if (!code) return sendError(res, { statusCode: 400, message: 'Role name must include letters or numbers.', code: 'VALIDATION_ERROR' });
  role.name = name.trim();
  role.code = code;
  if (description !== undefined) role.description = description.trim();
  try {
    await role.save();
    return sendSuccess(res, { message: 'Branch role updated.', data: role });
  } catch (error) {
    if (error.code === 11000)
      return sendError(res, { statusCode: 409, message: 'A role with this name already exists in your branch.', code: 'DUPLICATE_ROLE' });
    throw error;
  }
}
async function archive(req, res) {
  if (req.user.role !== 'BRANCH_ADMIN' || !hasPermission(req.user, 'role.create'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to archive branch roles.', code: 'FORBIDDEN' });
  const role = await CustomRole.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!role) return sendError(res, { statusCode: 404, message: 'Role not found in your branch.', code: 'ROLE_NOT_FOUND' });
  role.isArchived = true;
  role.archivedAt = new Date();
  await role.save();
  return sendSuccess(res, { message: 'Branch role archived.', data: role });
}
module.exports = { list, create, update, archive, allowedPermissions };
