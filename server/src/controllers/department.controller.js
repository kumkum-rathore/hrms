const Department = require('../models/Department');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');
const { nextBranchCode } = require('../utils/codeSequence');

async function list(req, res) {
  if (!hasPermission(req.user, 'department.view') && !hasPermission(req.user, 'department.create') && !hasPermission(req.user, 'employee.create') && !hasPermission(req.user, 'task.assign') && !hasPermission(req.user, 'project.manage'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view departments.', code: 'FORBIDDEN' });
  const filter = { isArchived: { $ne: true } };
  if (req.user.role !== 'SUPER_ADMIN') filter.branchId = req.user.branchId;
  else if (req.query.branchId) filter.branchId = req.query.branchId;
  const rows = await Department.find(filter).populate('managerId', 'firstName lastName email').sort({ name: 1 }).lean();
  return sendSuccess(res, { message: 'Departments loaded.', data: rows });
}

async function saveDepartment(req, res, isUpdate) {
  if (!hasPermission(req.user, 'department.create'))
    return sendError(res, { statusCode: 403, message: `You do not have permission to ${isUpdate ? 'edit' : 'create'} departments.`, code: 'FORBIDDEN' });
  const { name, description = '', managerId } = req.body || {};
  const target = req.user.branchId;
  if (!target || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)
    return sendError(res, { statusCode: 400, message: 'Branch and department name are required.', code: 'VALIDATION_ERROR' });
  if (typeof description !== 'string' || description.length > 500)
    return sendError(res, { statusCode: 400, message: 'Department description cannot exceed 500 characters.', code: 'VALIDATION_ERROR' });
  let row = null;
  let branch = null;
  if (isUpdate) {
    row = await Department.findOne({ _id: req.params.id, branchId: target, isArchived: { $ne: true } });
    if (!row) return sendError(res, { statusCode: 404, message: 'Department not found in your branch.', code: 'DEPARTMENT_NOT_FOUND' });
  } else {
    branch = await Branch.findOne({ _id: target, status: 'ACTIVE' }).select('branchCode');
    if (!branch) return sendError(res, { statusCode: 400, message: 'Selected branch is unavailable.', code: 'INVALID_BRANCH' });
  }
  if (managerId) {
    const manager = await User.findOne({ _id: managerId, branchId: target, status: 'ACTIVE', isArchived: { $ne: true } });
    if (!manager) return sendError(res, { statusCode: 400, message: 'Manager must be an active employee of this branch.', code: 'INVALID_MANAGER' });
  }
  if (!row) row = new Department({ branchId: target, code: await nextBranchCode(branch, 'DEPT'), createdBy: req.user.id, managerId: null });
  row.name = name.trim();
  row.description = description.trim();
  if (managerId !== undefined) row.managerId = managerId || null;
  try {
    await row.save();
    return sendSuccess(res, { statusCode: isUpdate ? 200 : 201, message: `Department ${isUpdate ? 'updated' : 'created'}.`, data: row });
  } catch (error) {
    if (error.code === 11000)
      return sendError(res, { statusCode: 409, message: 'Generated department code or name already exists. Please retry.', code: 'DUPLICATE_DEPARTMENT' });
    throw error;
  }
}

async function create(req, res) {
  return saveDepartment(req, res, false);
}

async function update(req, res) {
  return saveDepartment(req, res, true);
}

async function archive(req, res) {
  if (!hasPermission(req.user, 'department.create'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to archive departments.', code: 'FORBIDDEN' });
  const department = await Department.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!department) return sendError(res, { statusCode: 404, message: 'Department not found in your branch.', code: 'DEPARTMENT_NOT_FOUND' });
  department.isArchived = true;
  department.archivedAt = new Date();
  await department.save();
  return sendSuccess(res, { message: 'Department archived; employee history was retained.', data: department });
}

module.exports = { list, create, update, archive };
