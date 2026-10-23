const fs = require('fs');
const path = require('path');
const Document = require('../models/EmployeeDocument');
const Project = require('../models/Project');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');

async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN')
    return sendError(res, { statusCode: 403, message: 'Superadmin manages branches only; employee documents are private.', code: 'FORBIDDEN' });

  const canViewDocuments = hasPermission(req.user, 'document.view') || hasPermission(req.user, 'document.verify');
  const canManageProjects = hasPermission(req.user, 'project.manage');
  const canAccessDocuments = canViewDocuments || hasPermission(req.user, 'document.upload') || canManageProjects;
  if (!canAccessDocuments)
    return sendError(res, { statusCode: 403, message: 'You do not have permission to access documents.', code: 'FORBIDDEN' });

  const filter = {};
  if (canViewDocuments) {
    filter.branchId = req.user.branchId;
  } else if (canManageProjects) {
    filter.branchId = req.user.branchId;
    filter.projectId = { $ne: null };
  } else {
    filter.userId = req.user.id;
    filter.projectId = null;
  }

  if (req.query.projectId) {
    if (!canManageProjects)
      return sendError(res, { statusCode: 403, message: 'You cannot view project documents.', code: 'FORBIDDEN' });
    if (!mongoose.isValidObjectId(req.query.projectId))
      return sendError(res, { statusCode: 400, message: 'Select a valid project.', code: 'INVALID_PROJECT' });
    filter.projectId = req.query.projectId;
  }

  if (req.query.userId && req.user.role !== 'EMPLOYEE' && canViewDocuments)
    filter.userId = req.query.userId;

  const rows = await Document.find(filter)
    .populate('userId', 'firstName lastName employeeCode')
    .populate('projectId', 'name')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return sendSuccess(res, { message: 'Documents loaded.', data: rows });
}

async function create(req, res) {
  const {
    userId,
    projectId,
    category = 'OTHER',
    title,
    fileName,
    storageKey,
    mimeType,
    size
  } = req.body || {};
  const isProjectDocument = Boolean(projectId);
  const onboardingUpload = hasPermission(req.user, 'employee.create') && req.user.role !== 'SUPER_ADMIN';
  const authorized =
    isProjectDocument
      ? hasPermission(req.user, 'project.manage')
      : hasPermission(req.user, 'document.upload') || onboardingUpload;
  if (!authorized)
    return sendError(res, { statusCode: 403, message: 'You do not have permission to upload this document.', code: 'FORBIDDEN' });

  let targetUser;
  let project = null;
  if (isProjectDocument) {
    if (!mongoose.isValidObjectId(projectId))
      return sendError(res, { statusCode: 400, message: 'Select a valid project.', code: 'INVALID_PROJECT' });
    project = await Project.findOne({ _id: projectId, branchId: req.user.branchId });
    if (!project)
      return sendError(res, { statusCode: 400, message: 'Project is outside your permitted scope.', code: 'INVALID_PROJECT' });
    if (userId && String(userId) !== String(req.user.id))
      return sendError(res, { statusCode: 400, message: 'Project documents are attributed to their uploader.', code: 'INVALID_EMPLOYEE' });
    targetUser = await User.findOne({ _id: req.user.id, branchId: req.user.branchId }).select('_id branchId');
  } else {
    const targetId = userId || req.user.id;
    targetUser = await User.findById(targetId).select('_id branchId');
    if (!targetUser || (req.user.role !== 'SUPER_ADMIN' && String(targetUser.branchId) !== String(req.user.branchId)))
      return sendError(res, { statusCode: 400, message: 'Employee is outside your permitted scope.', code: 'INVALID_EMPLOYEE' });
    if (targetId !== req.user.id && req.user.role === 'SUPER_ADMIN')
      return sendError(res, { statusCode: 403, message: 'You can only upload your own documents.', code: 'FORBIDDEN' });
  }

  if (!targetUser)
    return sendError(res, { statusCode: 400, message: 'Uploader account is outside your permitted scope.', code: 'INVALID_EMPLOYEE' });

  const uploadDir = path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(__dirname, '../../private-uploads'));
  const safeKey =
    typeof storageKey === 'string' &&
    /^[a-f0-9-]{20,80}\.[a-z0-9]{1,12}$/i.test(storageKey) &&
    path.join(uploadDir, storageKey).startsWith(uploadDir + path.sep) &&
    fs.existsSync(path.join(uploadDir, storageKey));
  if (
    typeof title !== 'string' ||
    title.trim().length < 2 ||
    typeof fileName !== 'string' ||
    !safeKey ||
    !/^\d+$/.test(String(size)) ||
    Number(size) < 1 ||
    Number(size) > 25 * 1024 * 1024 ||
    typeof mimeType !== 'string'
  )
    return sendError(res, { statusCode: 400, message: 'Valid document metadata is required (maximum 25 MB).', code: 'VALIDATION_ERROR' });
  if (!['IDENTITY', 'EDUCATION', 'EXPERIENCE', 'CONTRACT', 'PAYSLIP', 'PROJECT', 'OTHER'].includes(category))
    return sendError(res, { statusCode: 400, message: 'Invalid document category.', code: 'VALIDATION_ERROR' });

  const row = await Document.create({
    branchId: isProjectDocument ? project.branchId : targetUser.branchId,
    userId: targetUser._id,
    projectId: project?._id || null,
    category,
    title: title.trim(),
    fileName: fileName.slice(0, 255),
    storageKey: storageKey.slice(0, 500),
    mimeType: mimeType.slice(0, 120),
    size: Number(size),
    uploadedBy: req.user.id
  });
  return sendSuccess(res, { statusCode: 201, message: 'Document metadata saved.', data: row });
}

async function verify(req, res) {
  if (!hasPermission(req.user, 'document.verify'))
    return sendError(res, { statusCode: 403, message: 'You cannot verify documents.', code: 'FORBIDDEN' });

  const { status, reviewNote = '' } = req.body || {};
  if (!['VERIFIED', 'REJECTED'].includes(status))
    return sendError(res, { statusCode: 400, message: 'Review status must be VERIFIED or REJECTED.', code: 'VALIDATION_ERROR' });

  const row = await Document.findById(req.params.id);
  if (!row)
    return sendError(res, { statusCode: 404, message: 'Document not found.', code: 'NOT_FOUND' });
  if (!req.user.branchId || String(row.branchId) !== String(req.user.branchId))
    return sendError(res, { statusCode: 403, message: 'Branch access denied.', code: 'BRANCH_ACCESS_DENIED' });
  if (!['PENDING', 'SUBMITTED'].includes(row.status))
    return sendError(res, { statusCode: 409, message: 'Only pending documents can be reviewed.', code: 'DOCUMENT_ALREADY_REVIEWED' });
  if (typeof reviewNote !== 'string' || reviewNote.length > 1000)
    return sendError(res, { statusCode: 400, message: 'Review note must be 1000 characters or fewer.', code: 'VALIDATION_ERROR' });

  row.status = status;
  row.reviewNote = reviewNote.trim();
  row.reviewedBy = req.user.id;
  await row.save();
  return sendSuccess(res, {
    message: status === 'VERIFIED' ? 'Document verified successfully.' : 'Document rejected.',
    data: row
  });
}

module.exports = { list, create, verify };
