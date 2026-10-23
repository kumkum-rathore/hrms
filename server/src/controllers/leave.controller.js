const LeaveRequest = require('../models/LeaveRequest');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');
async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN') return sendError(res, { statusCode: 403, message: 'Superadmin manages branches only; leave records are private branch data.', code: 'FORBIDDEN' });
  if (!['leave.apply', 'leave.view', 'leave.approve'].some(permission => hasPermission(req.user, permission)))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view leave requests.', code: 'FORBIDDEN' });
  const filter = {};
  if (!hasPermission(req.user, 'leave.view') && !hasPermission(req.user, 'leave.approve')) filter.userId = req.user.id;
  else if (req.user.role !== 'SUPER_ADMIN') filter.branchId = req.user.branchId;
  else if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.status && ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status)) filter.status = req.query.status;
  const rows = await LeaveRequest.find(filter).populate('userId', 'firstName lastName employeeCode').populate('decisionBy', 'firstName lastName').sort({ createdAt: -1 }).limit(100).lean();
  return sendSuccess(res, { message: 'Leave requests loaded.', data: rows });
}
async function create(req, res) {
  if (!hasPermission(req.user, 'leave.apply')) return sendError(res, { statusCode: 403, message: 'You do not have permission to apply for leave.', code: 'FORBIDDEN' });
  const { leaveType, startDate, endDate, reason } = req.body || {};
  const allowed = ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'OTHER'];
  const start = new Date(startDate); const end = new Date(endDate);
  if (!allowed.includes(leaveType) || !startDate || !endDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000) return sendError(res, { statusCode: 400, message: 'Provide a valid leave type, date range and reason.', code: 'VALIDATION_ERROR' });
  const row = await LeaveRequest.create({ userId: req.user.id, branchId: req.user.branchId || null, leaveType, startDate: start, endDate: end, reason: reason.trim() });
  return sendSuccess(res, { statusCode: 201, message: 'Leave request submitted.', data: row });
}
async function decide(req, res) {
  if (req.user.role === 'SUPER_ADMIN' || !hasPermission(req.user, 'leave.approve')) return sendError(res, { statusCode: 403, message: 'You cannot review leave requests.', code: 'INSUFFICIENT_PERMISSIONS' });
  const { status, decisionNote = '' } = req.body || {};
  if (!['APPROVED', 'REJECTED'].includes(status)) return sendError(res, { statusCode: 400, message: 'Decision must be APPROVED or REJECTED.', code: 'VALIDATION_ERROR' });
  const row = await LeaveRequest.findById(req.params.id);
  if (!row) return sendError(res, { statusCode: 404, message: 'Leave request not found.', code: 'LEAVE_NOT_FOUND' });
  if (req.user.role !== 'SUPER_ADMIN' && row.branchId?.toString() !== req.user.branchId) return sendError(res, { statusCode: 403, message: 'This request belongs to another branch.', code: 'BRANCH_ACCESS_DENIED' });
  if (row.status !== 'PENDING') return sendError(res, { statusCode: 409, message: 'This leave request has already been decided.', code: 'LEAVE_ALREADY_DECIDED' });
  row.status = status; row.decisionBy = req.user.id; row.decisionAt = new Date(); row.decisionNote = String(decisionNote).slice(0, 500); await row.save();
  return sendSuccess(res, { message: `Leave request ${status.toLowerCase()}.`, data: row });
}
module.exports = { list, create, decide };
