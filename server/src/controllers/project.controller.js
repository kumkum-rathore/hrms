const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { isValidOptionalPhone } = require('../utils/phoneValidation');
const { hasPermission } = require('../utils/permissions');

function canManageProjects(user) {
  return hasPermission(user, 'project.manage');
}

function validProjectDates(startDate, dueDate) {
  if (typeof startDate !== 'string' || typeof dueDate !== 'string') return false;
  const start = new Date(startDate);
  const due = new Date(dueDate);
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(due.getTime()) &&
    start.toISOString().slice(0, 10) === startDate &&
    due.toISOString().slice(0, 10) === dueDate &&
    due >= start;
}

async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN') {
    return sendError(res, { statusCode: 403, message: 'Superadmin manages branches and access. Open a branch account to manage its projects.', code: 'FORBIDDEN' });
  }
  if (!hasPermission(req.user, 'project.view') && !canManageProjects(req.user))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view projects.', code: 'FORBIDDEN' });
  const filter = { branchId: req.user.branchId };
  if (!hasPermission(req.user, 'project.view') && !canManageProjects(req.user)) filter.$or = [{ members: req.user.id }, { createdBy: req.user.id }];
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.name = { $regex: String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const projects = await Project.find(filter)
    .populate('members', 'firstName lastName email employeeCode role departmentId')
    .populate('departmentId', 'name code')
    .populate('createdBy', 'firstName lastName')
    .sort({ updatedAt: -1 }).limit(300).lean();
  const ids = projects.map(p => p._id);
  const taskStats = await Task.aggregate([
    { $match: { projectId: { $in: ids }, branchId: req.user.branchId, isArchived: { $ne: true } } },
    { $group: { _id: { projectId: '$projectId', status: '$status' }, count: { $sum: 1 } } }
  ]);
  const byProject = {};
  for (const row of taskStats) {
    const id = String(row._id.projectId);
    byProject[id] ||= { total: 0, completed: 0, overdue: 0 };
    byProject[id].total += row.count;
    if (row._id.status === 'APPROVED') byProject[id].completed += row.count;
  }
  const now = new Date();
  const overdue = await Task.find({ projectId: { $in: ids }, branchId: req.user.branchId, isArchived: { $ne: true }, dueDate: { $lt: now }, status: { $nin: ['APPROVED'] } }).select('projectId').lean();
  for (const task of overdue) if (byProject[String(task.projectId)]) byProject[String(task.projectId)].overdue += 1;
  return sendSuccess(res, { message: 'Projects loaded.', data: projects.map(p => ({ ...p, taskSummary: byProject[String(p._id)] || { total: 0, completed: 0, overdue: 0 } })) });
}

async function create(req, res) {
  if (!canManageProjects(req.user)) return sendError(res, { statusCode: 403, message: 'You do not have permission to create projects.', code: 'FORBIDDEN' });
  const body = req.body || {};
  if (typeof body.name !== 'string' || body.name.trim().length < 3) return sendError(res, { statusCode: 400, message: 'Project name must be at least 3 characters.', code: 'VALIDATION_ERROR' });
  if (typeof body.clientName !== 'string' || body.clientName.trim().length < 2 || body.clientName.trim().length > 180) return sendError(res, { statusCode: 400, message: 'Client name is required and must be 2 to 180 characters.', code: 'VALIDATION_ERROR', details: [{ field: 'clientName' }] });
  if (!isValidOptionalPhone(body.clientPhone) || !/^\d{10}$/.test(String(body.clientPhone || ''))) return sendError(res, { statusCode: 400, message: 'Client phone must contain exactly 10 digits.', code: 'VALIDATION_ERROR', details: [{ field: 'clientPhone' }] });
  if (!validProjectDates(body.startDate, body.dueDate)) return sendError(res, { statusCode: 400, message: 'Valid start and due dates are required, and due date must be on or after start date.', code: 'INVALID_PROJECT_DATES' });
  if (!req.user.branchId) return sendError(res, { statusCode: 400, message: 'Your account must belong to a branch.', code: 'BRANCH_REQUIRED' });
  if (!body.departmentId) return sendError(res, { statusCode: 400, message: 'Select a department for this project.', code: 'INVALID_DEPARTMENT' });
  const department = await Department.findOne({ _id: body.departmentId, branchId: req.user.branchId, isArchived: { $ne: true } }).select('_id');
  if (!department) return sendError(res, { statusCode: 400, message: 'Select an active department from your branch.', code: 'INVALID_DEPARTMENT' });
  const memberIds = Array.isArray(body.members) ? [...new Set(body.members.map(String))] : [];
  if (memberIds.length) {
    const valid = await User.countDocuments({ _id: { $in: memberIds }, branchId: req.user.branchId, departmentId: department._id, status: 'ACTIVE', role: 'EMPLOYEE', isArchived: { $ne: true } });
    if (valid !== memberIds.length) return sendError(res, { statusCode: 400, message: 'All assigned employees must be active employees in the selected department.', code: 'INVALID_MEMBERS' });
  }
  const project = await Project.create({
    branchId: req.user.branchId, name: body.name.trim(), description: String(body.description || '').trim(),
    clientName: String(body.clientName || '').trim(), clientPhone: String(body.clientPhone || '').trim(),
    clientDetails: String(body.clientDetails || '').trim(), departmentId: department._id, startDate: body.startDate || null, dueDate: body.dueDate || null,
    status: body.status || 'PLANNING', priority: body.priority || 'MEDIUM', members: memberIds,
    createdBy: req.user.id, updatedBy: req.user.id
  });
  return sendSuccess(res, { statusCode: 201, message: 'Project created.', data: project });
}

async function update(req, res) {
  if (!canManageProjects(req.user)) return sendError(res, { statusCode: 403, message: 'You do not have permission to edit projects.', code: 'FORBIDDEN' });
  const project = await Project.findOne({ _id: req.params.id, branchId: req.user.branchId });
  if (!project) return sendError(res, { statusCode: 404, message: 'Project not found in your branch.', code: 'PROJECT_NOT_FOUND' });
  const body = req.body || {};
  const nextClientName = body.clientName ?? project.clientName;
  const nextClientPhone = body.clientPhone ?? project.clientPhone;
  if (typeof nextClientName !== 'string' || nextClientName.trim().length < 2 || nextClientName.trim().length > 180) return sendError(res, { statusCode: 400, message: 'Client name is required and must be 2 to 180 characters.', code: 'VALIDATION_ERROR', details: [{ field: 'clientName' }] });
  if (!isValidOptionalPhone(nextClientPhone) || !/^\d{10}$/.test(String(nextClientPhone || ''))) return sendError(res, { statusCode: 400, message: 'Client phone must contain exactly 10 digits.', code: 'VALIDATION_ERROR', details: [{ field: 'clientPhone' }] });
  const nextStartDate = body.startDate ?? (project.startDate ? project.startDate.toISOString().slice(0, 10) : null);
  const nextDueDate = body.dueDate ?? (project.dueDate ? project.dueDate.toISOString().slice(0, 10) : null);
  if (!validProjectDates(nextStartDate, nextDueDate)) return sendError(res, { statusCode: 400, message: 'Valid start and due dates are required, and due date must be on or after start date.', code: 'INVALID_PROJECT_DATES' });
  const nextDepartmentId = body.departmentId ?? project.departmentId;
  if (!nextDepartmentId) return sendError(res, { statusCode: 400, message: 'Select a department for this project.', code: 'INVALID_DEPARTMENT' });
  const department = await Department.findOne({ _id: nextDepartmentId, branchId: req.user.branchId, isArchived: { $ne: true } }).select('_id');
  if (!department) return sendError(res, { statusCode: 400, message: 'Select an active department from your branch.', code: 'INVALID_DEPARTMENT' });
  const allowed = ['name', 'description', 'clientName', 'clientPhone', 'clientDetails', 'startDate', 'dueDate', 'status', 'priority'];
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) project[key] = body[key] === '' && ['startDate', 'dueDate'].includes(key) ? null : body[key];
  project.departmentId = department._id;
  if (Object.prototype.hasOwnProperty.call(body, 'members') || Object.prototype.hasOwnProperty.call(body, 'departmentId')) {
    const candidateMembers = body.members ?? project.members.map(String);
    if (!Array.isArray(candidateMembers)) return sendError(res, { statusCode: 400, message: 'Members must be a list.', code: 'VALIDATION_ERROR' });
    const ids = [...new Set(candidateMembers.map(String))];
    const valid = ids.length ? await User.countDocuments({ _id: { $in: ids }, branchId: req.user.branchId, departmentId: department._id, status: 'ACTIVE', role: 'EMPLOYEE', isArchived: { $ne: true } }) : 0;
    if (valid !== ids.length) return sendError(res, { statusCode: 400, message: 'All assigned employees must be active employees in the selected department.', code: 'INVALID_MEMBERS' });
    if (Object.prototype.hasOwnProperty.call(body, 'members')) project.members = ids;
  }
  project.updatedBy = req.user.id;
  await project.save();
  return sendSuccess(res, { message: 'Project updated.', data: project });
}

async function remove(req, res) {
  if (!canManageProjects(req.user)) return sendError(res, { statusCode: 403, message: 'You do not have permission to archive projects.', code: 'FORBIDDEN' });
  const project = await Project.findOne({ _id: req.params.id, branchId: req.user.branchId });
  if (!project) return sendError(res, { statusCode: 404, message: 'Project not found in your branch.', code: 'PROJECT_NOT_FOUND' });
  const linkedTasks = await Task.countDocuments({ projectId: project._id, branchId: project.branchId });
  if (linkedTasks) return sendError(res, { statusCode: 409, message: 'This project has tasks. Mark it Completed or Cancelled instead of deleting it, so task history is preserved.', code: 'PROJECT_HAS_TASKS' });
  await project.deleteOne();
  return sendSuccess(res, { message: 'Project deleted.', data: { id: project.id } });
}
module.exports = { list, create, update, remove };
