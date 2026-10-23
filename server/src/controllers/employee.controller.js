const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const CustomRole = require('../models/CustomRole');
const Salary = require('../models/Salary');
const Shift = require('../models/Shift');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { validatePermissionList, hasPermission } = require('../utils/permissions');
const { nextBranchCode, previewBranchCode } = require('../utils/codeSequence');
const { isValidOptionalPhone } = require('../utils/phoneValidation');
const roles = ['EMPLOYEE'];
function safe(u) { return { id: u._id, employeeCode: u.employeeCode, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, role: u.role, branchId: u.branchId, shiftId: u.shiftId, departmentId: u.departmentId, customRoleId: u.customRoleId, permissions: u.permissions, status: u.status, joiningDate: u.joiningDate, leavingDate: u.leavingDate, experienceYears: u.experienceYears, experienceSummary: u.experienceSummary, hasPreviousExperience: u.hasPreviousExperience, previousCompanyName: u.previousCompanyName, previousCompanyLeavingDate: u.previousCompanyLeavingDate, previousCompanyLeavingReason: u.previousCompanyLeavingReason, salaryAmount: u.salaryAmount, createdAt: u.createdAt }; }
async function previewCode(req, res) {
  if (!hasPermission(req.user, 'employee.create'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to create employees.', code: 'FORBIDDEN' });
  const branch = await Branch.findOne({ _id: req.user.branchId, status: 'ACTIVE' }).select('_id branchCode');
  if (!branch)
    return sendError(res, { statusCode: 400, message: 'Selected branch is unavailable.', code: 'INVALID_BRANCH' });
  return sendSuccess(res, { message: 'Employee code preview loaded.', data: { employeeCode: await previewBranchCode(branch, 'EMP') } });
}
async function list(req, res) {
  const canAccessDirectory = [
    'employee.view',
    'employee.create',
    'task.assign',
    'role.create',
    'employee.salary.manage',
    'calendar.manage',
    'project.manage'
  ].some(permission => hasPermission(req.user, permission));
  if (!canAccessDirectory)
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view branch employees.', code: 'FORBIDDEN' });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = { isArchived: { $ne: true } };
  if (req.user.role === 'EMPLOYEE' && !req.user.permissions?.some(p => ['employee.view','employee.create','task.assign','task.review','task.view','role.create','employee.salary.manage','calendar.manage','project.manage'].includes(p))) filter._id = req.user.id;
  else if (req.user.role === 'SUPER_ADMIN') { filter.role = { $nin: ['SUPER_ADMIN', 'BRANCH_ADMIN'] }; if (req.query.branchId) filter.branchId = req.query.branchId; }
  else {
    filter.branchId = req.user.branchId;
    filter.role = { $ne: 'BRANCH_ADMIN' };
  }
  if (req.query.status && ['INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.search) { const term = String(req.query.search).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ firstName: new RegExp(term, 'i') }, { lastName: new RegExp(term, 'i') }, { email: new RegExp(term, 'i') }, { employeeCode: new RegExp(term, 'i') }]; }
  const [users, total] = await Promise.all([User.find(filter).populate('branchId', 'name branchCode').populate('departmentId', 'name code').populate('customRoleId', 'name code').populate('shiftId', 'name startTime endTime graceMinutes').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
  const data = users.map(u => {
    const item = { ...safe(u), branch: req.user.role === 'SUPER_ADMIN' ? u.branchId : undefined, customRole: u.customRoleId, branchId: u.branchId?._id || u.branchId };
    if (!hasPermission(req.user, 'employee.view') && String(u._id) !== req.user.id) {
      return {
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        employeeCode: item.employeeCode,
        role: item.role,
        branchId: item.branchId,
        departmentId: item.departmentId,
        customRole: item.customRole,
        status: item.status
      };
    }
    if (!hasPermission(req.user, 'employee.salary.manage') && String(u._id) !== req.user.id) delete item.salaryAmount;
    return item;
  });
  return sendSuccess(res, { message: 'Employees loaded.', data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}
async function create(req, res) {
  if (!hasPermission(req.user, 'employee.create')) return sendError(res, { statusCode: 403, message: 'You do not have permission to create employees.', code: 'FORBIDDEN' });
  const { firstName, lastName = '', email, password, role = 'EMPLOYEE', phone = null, joiningDate, departmentId = null, customRoleId = null, shiftId, permissions, hasPreviousExperience = false, experienceYears = 0, previousCompanyName = '', previousCompanyLeavingDate, previousCompanyLeavingReason = '', salaryAmount = 0 } = req.body || {};
  const errors = [];
  if (typeof firstName !== 'string' || firstName.trim().length < 2) errors.push({ field: 'firstName', message: 'First name must be at least 2 characters.' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'email', message: 'Valid email is required.' });
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) errors.push({ field: 'password', message: 'Initial password must be 12–128 characters.' });
  if (!isValidOptionalPhone(phone)) errors.push({ field: 'phone', message: 'Phone must contain exactly 10 digits.' });
  if (!roles.includes(role)) errors.push({ field: 'role', message: 'Role is not allowed for employee creation.' });
  if (typeof hasPreviousExperience !== 'boolean') errors.push({ field: 'hasPreviousExperience', message: 'Specify whether the employee has previous work experience.' });
  if (!Number.isFinite(Number(experienceYears)) || Number(experienceYears) < 0 || Number(experienceYears) > 70) errors.push({ field: 'experienceYears', message: 'Experience must be between 0 and 70 years.' });
  if (hasPreviousExperience) {
    if (typeof previousCompanyName !== 'string' || previousCompanyName.trim().length < 2 || previousCompanyName.trim().length > 120) errors.push({ field: 'previousCompanyName', message: 'Enter a previous company name between 2 and 120 characters.' });
    if (typeof previousCompanyLeavingReason !== 'string' || previousCompanyLeavingReason.trim().length < 2 || previousCompanyLeavingReason.trim().length > 1000) errors.push({ field: 'previousCompanyLeavingReason', message: 'Enter a reason for leaving between 2 and 1000 characters.' });
    const previousLeavingDate = new Date(previousCompanyLeavingDate);
    const validPreviousLeavingDate =
      typeof previousCompanyLeavingDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(previousCompanyLeavingDate) &&
      !Number.isNaN(previousLeavingDate.getTime()) &&
      previousLeavingDate.toISOString().slice(0, 10) === previousCompanyLeavingDate &&
      previousCompanyLeavingDate <= new Date().toISOString().slice(0, 10);
    if (!validPreviousLeavingDate) errors.push({ field: 'previousCompanyLeavingDate', message: 'Enter a valid previous company leaving date that is not in the future.' });
    if (Number(experienceYears) <= 0) errors.push({ field: 'experienceYears', message: 'Total experience must be greater than zero when previous experience is selected.' });
  }
  if (!departmentId) errors.push({ field: 'departmentId', message: 'A department is required.' });
  if (!Number.isFinite(Number(salaryAmount)) || Number(salaryAmount) < 0) errors.push({ field: 'salaryAmount', message: 'Salary must be a non-negative number.' });
  if (permissions !== undefined && (!validatePermissionList(permissions) || permissions.some(permission => !req.user.permissions?.includes(permission)))) errors.push({ field: 'permissions', message: 'Select only valid permissions granted to your account.' });
  if (!shiftId) errors.push({ field: 'shiftId', message: 'Assign a shift to the employee.' });
  if (role !== 'EMPLOYEE') errors.push({ field: 'role', message: 'Employee base account type must be EMPLOYEE. Use a branch-created custom role for job titles.' });
  const targetBranch = req.user.branchId;
  if (role !== 'SUPER_ADMIN' && !targetBranch) errors.push({ field: 'branchId', message: 'A branch is required.' });
  if (errors.length) return sendError(res, { statusCode: 400, message: 'Please correct the employee details.', code: 'VALIDATION_ERROR', details: errors });
  const branch = targetBranch ? await Branch.findOne({ _id: targetBranch, status: 'ACTIVE' }).select('_id branchCode') : null;
  if (targetBranch && !branch) return sendError(res, { statusCode: 400, message: 'Selected branch is unavailable.', code: 'INVALID_BRANCH' });
  const dept = await Department.findOne({ _id: departmentId, branchId: targetBranch, isArchived: { $ne: true } });
  if (!dept) return sendError(res, { statusCode: 400, message: 'Select an active department from your branch.', code: 'INVALID_DEPARTMENT' });
  if (!mongoose.isValidObjectId(shiftId))
    return sendError(res, { statusCode: 400, message: 'Select a valid shift.', code: 'INVALID_SHIFT' });
  const shift = shiftId
    ? await Shift.findOne({ _id: shiftId, branchId: targetBranch }).select('_id')
    : null;
  if (!shift) return sendError(res, { statusCode: 400, message: 'Select a shift created for your branch.', code: 'INVALID_SHIFT' });
  let assignedRole = null;
  if (customRoleId) {
    if (!mongoose.isValidObjectId(customRoleId))
      return sendError(res, { statusCode: 400, message: 'Select a valid branch role.', code: 'INVALID_ROLE' });
    assignedRole = await CustomRole.findOne({ _id: customRoleId, branchId: targetBranch, isArchived: { $ne: true } });
    if (!assignedRole)
      return sendError(res, { statusCode: 400, message: 'Select a role created for this branch.', code: 'INVALID_ROLE' });
  }
  const assignedPermissions = [...new Set(permissions ?? [])];
  if (assignedPermissions.some(permission => !req.user.permissions?.includes(permission)))
    return sendError(res, { statusCode: 400, message: 'Selected employee permissions must be granted to your account.', code: 'INVALID_PERMISSIONS' });
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const joined = joiningDate ? new Date(joiningDate) : new Date();
    if (Number.isNaN(joined.getTime()) || joined > new Date()) return sendError(res, { statusCode: 400, message: 'Joining date must be a valid date that is not in the future.', code: 'INVALID_JOINING_DATE' });
      const employeeCode = await nextBranchCode(branch, 'EMP');
      const user = await User.create({ firstName: firstName.trim(), lastName, email: email.trim().toLowerCase(), passwordHash, role, branchId: targetBranch || null, phone, employeeCode, joiningDate: joined, departmentId: departmentId || null, customRoleId: assignedRole?._id || null, shiftId: shift._id, permissions: assignedPermissions, experienceYears: hasPreviousExperience ? Number(experienceYears) : 0, hasPreviousExperience, previousCompanyName: hasPreviousExperience ? previousCompanyName.trim() : '', previousCompanyLeavingDate: hasPreviousExperience ? new Date(previousCompanyLeavingDate) : null, previousCompanyLeavingReason: hasPreviousExperience ? previousCompanyLeavingReason.trim() : '', salaryAmount: Number(salaryAmount), leavingDate: null, status: 'ACTIVE' });
    { const month = `${joined.getFullYear()}-${String(joined.getMonth()+1).padStart(2,'0')}`; try { await Salary.create({ branchId: targetBranch, userId: user._id, month, baseSalary: Number(salaryAmount), createdBy: req.user.id, status: 'DRAFT', notes: 'Initial salary record created during employee onboarding.' }); } catch (salaryError) { await User.findByIdAndDelete(user._id); throw salaryError; } }
    return sendSuccess(res, { statusCode: 201, message: 'Employee created with onboarding salary record.', data: safe(user) });
  } catch (err) { if (err.code === 11000) return sendError(res, { statusCode: 409, message: 'Email or employee code already exists.', code: 'DUPLICATE_RECORD' }); throw err; }
}

async function update(req, res) {
  if (!hasPermission(req.user, 'employee.update')) return sendError(res, { statusCode: 403, message: 'You do not have permission to update employees.', code: 'FORBIDDEN' });
  if (req.user.role === 'BRANCH_ADMIN' && String(req.params.id) === String(req.user.id)) return sendError(res, { statusCode: 403, message: 'Branch Admins cannot edit their own profile.', code: 'SELF_PROFILE_EDIT_FORBIDDEN' });
  const user = await User.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!user) return sendError(res, { statusCode: 404, message: 'Employee not found in your branch.', code: 'EMPLOYEE_NOT_FOUND' });
  const wasActive = user.status === 'ACTIVE';
  const {
    leavingDate,
    status,
    phone,
    departmentId,
    experienceYears,
    hasPreviousExperience,
    previousCompanyName,
    previousCompanyLeavingDate,
    previousCompanyLeavingReason,
    experienceSummary,
    permissions
  } = req.body || {};
  if (!isValidOptionalPhone(phone)) return sendError(res, { statusCode: 400, message: 'Phone must contain exactly 10 digits.', code: 'VALIDATION_ERROR', details: [{ field: 'phone' }] });
  if (leavingDate !== undefined) { const date = leavingDate === null || leavingDate === '' ? null : new Date(leavingDate); if (date && (Number.isNaN(date.getTime()) || (user.joiningDate && date < user.joiningDate))) return sendError(res, { statusCode: 400, message: 'Leaving date must be on or after joining date.', code: 'INVALID_LEAVING_DATE' }); user.leavingDate = date; if (date) user.status = 'INACTIVE'; }
  if (status !== undefined) { if (!['ACTIVE','INACTIVE','SUSPENDED'].includes(status)) return sendError(res, { statusCode: 400, message: 'Invalid employee status.', code: 'INVALID_STATUS' }); user.status = status; if (status === 'ACTIVE') user.leavingDate = null; }
  if (phone !== undefined) user.phone = String(phone).slice(0,30);
  if (experienceYears !== undefined) { const n=Number(experienceYears); if(!Number.isFinite(n)||n<0||n>70)return sendError(res,{statusCode:400,message:'Experience must be between 0 and 70 years.',code:'VALIDATION_ERROR'});user.experienceYears=n; }
  if (experienceSummary !== undefined) user.experienceSummary=String(experienceSummary).slice(0,2000);
  if (hasPreviousExperience !== undefined) {
    if (typeof hasPreviousExperience !== 'boolean')
      return sendError(res, { statusCode: 400, message: 'Previous experience selection must be true or false.', code: 'VALIDATION_ERROR' });
    user.hasPreviousExperience = hasPreviousExperience;
    if (!hasPreviousExperience) {
      user.experienceYears = 0;
      user.previousCompanyName = '';
      user.previousCompanyLeavingDate = null;
      user.previousCompanyLeavingReason = '';
    } else {
      const companyName = String(previousCompanyName || '').trim();
      const reason = String(previousCompanyLeavingReason || '').trim();
      const years = Number(experienceYears);
      const companyLeavingDate = previousCompanyLeavingDate
        ? new Date(previousCompanyLeavingDate)
        : null;
      if (!companyName || companyName.length > 120 || !reason || reason.length > 1000)
        return sendError(res, { statusCode: 400, message: 'Provide a previous company name and reason for leaving.', code: 'VALIDATION_ERROR' });
      if (!companyLeavingDate || Number.isNaN(companyLeavingDate.getTime()) || companyLeavingDate > new Date())
        return sendError(res, { statusCode: 400, message: 'Provide a valid previous company leaving date that is not in the future.', code: 'INVALID_EXPERIENCE_DATE' });
      if (!Number.isFinite(years) || years < 0.5 || years > 70)
        return sendError(res, { statusCode: 400, message: 'Experience must be between 0.5 and 70 years when previous experience is selected.', code: 'VALIDATION_ERROR' });
      user.experienceYears = years;
      user.previousCompanyName = companyName;
      user.previousCompanyLeavingDate = companyLeavingDate;
      user.previousCompanyLeavingReason = reason;
    }
  }
  if (permissions !== undefined) {
    if (!validatePermissionList(permissions) || permissions.some(permission => !req.user.permissions?.includes(permission)))
      return sendError(res, { statusCode: 400, message: 'Select only valid permissions granted to your account.', code: 'INVALID_PERMISSIONS' });
    user.permissions = [...new Set(permissions)];
  }
  if (departmentId !== undefined) { if (departmentId) { const Department=require('../models/Department'); const d=await Department.findOne({_id:departmentId,branchId:req.user.branchId,isArchived:{$ne:true}}); if(!d)return sendError(res,{statusCode:400,message:'Department belongs to another branch or is archived.',code:'INVALID_DEPARTMENT'}); } user.departmentId=departmentId||null; }
  if (wasActive && user.status !== 'ACTIVE') user.tokenVersion += 1;
  await user.save();
  if (user.status !== 'ACTIVE') await Project.updateMany({ branchId: user.branchId }, { $pull: { members: user._id } });
  return sendSuccess(res,{message:'Employee record updated.',data:safe(user)});
}
async function remove(req, res) {
  if (!hasPermission(req.user, 'employee.update')) return sendError(res, { statusCode: 403, message: 'You do not have permission to deactivate employees.', code: 'FORBIDDEN' });
  const user = await User.findOne({ _id: req.params.id, branchId: req.user.branchId, role: 'EMPLOYEE', isArchived: { $ne: true } });
  if (!user) return sendError(res, { statusCode: 404, message: 'Employee not found in your branch.', code: 'EMPLOYEE_NOT_FOUND' });
  // Keep HR history intact: deactivate the account rather than physically deleting attendance/salary/task records.
  user.status = 'INACTIVE'; user.leavingDate = user.leavingDate || new Date(); user.tokenVersion += 1;
  await user.save();
  await Project.updateMany({ branchId: user.branchId }, { $pull: { members: user._id } });
  return sendSuccess(res, { message: 'Employee deactivated; historical records were retained.', data: safe(user) });
}
async function archive(req, res) {
  if (!hasPermission(req.user, 'employee.update')) return sendError(res, { statusCode: 403, message: 'You do not have permission to archive employees.', code: 'FORBIDDEN' });
  const user = await User.findOne({ _id: req.params.id, branchId: req.user.branchId, role: 'EMPLOYEE', isArchived: { $ne: true } });
  if (!user) return sendError(res, { statusCode: 404, message: 'Employee not found in your branch.', code: 'EMPLOYEE_NOT_FOUND' });
  if (user.status === 'ACTIVE') user.tokenVersion += 1;
  user.status = 'INACTIVE';
  user.isArchived = true;
  user.archivedAt = new Date();
  await user.save();
  await Project.updateMany({ branchId: user.branchId }, { $pull: { members: user._id } });
  return sendSuccess(res, { message: 'Employee archived; historical records were retained.', data: safe(user) });
}
module.exports = { list, create, update, remove, archive, previewCode };
