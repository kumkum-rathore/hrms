const { sendSuccess, sendError } = require('../utils/apiResponse');

const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const Document = require('../models/EmployeeDocument');
const Task = require('../models/Task');
const { hasPermission } = require('../utils/permissions');

/**
 * Resolve + authorize a private upload by its storage key.
 * Returns { full, fileName } on success, or null if not allowed / not found.
 */
async function resolvePrivateFile(req) {
  const key = String(req.params.key || '');

  // Storage keys look like a UUID + extension, e.g.
  //   3f9c1e2a-7b5d-4e8a-9c1f-123456789abc.pdf
  if (!/^[a-f0-9-]{20,80}\.[a-z0-9]{1,12}$/i.test(key)) return null;

  const doc = await Document.findOne({ storageKey: key });
  let allowed = false;

  if (doc) {
    allowed =
      doc.userId.toString() === req.user.id ||
      (req.user.branchId &&
        doc.branchId.toString() === req.user.branchId &&
        (hasPermission(req.user, 'document.view') ||
          hasPermission(req.user, 'document.verify') ||
          (doc.projectId && hasPermission(req.user, 'project.manage')) ||
          req.user.permissions?.some(p =>
            ['document.view', 'document.verify'].includes(p)
          )));
  }

  if (!allowed) {
    const task = await Task.findOne({ 'submissions.files.url': key });
    if (task) {
      const submission = task.submissions.find(item =>
        item.files.some(file => file.url === key)
      );
      allowed =
        task.branchId.toString() === req.user.branchId &&
        !!submission &&
        (submission.submittedBy.toString() === req.user.id ||
          submission.submittedTo?.toString() === req.user.id);
    }
  }

  if (!allowed) return null;

  const dir = path.resolve(
    process.env.PRIVATE_UPLOAD_DIR ||
      path.join(__dirname, '../../private-uploads')
  );
  const full = path.join(dir, key);

  // Path-traversal guard.
  if (!full.startsWith(dir + path.sep) || !fs.existsSync(full)) return null;

  return { full, fileName: doc?.fileName || key };
}

async function upload(req, res) {
  if (
    !hasPermission(req.user, 'document.upload') &&
    !hasPermission(req.user, 'employee.create') &&
    !hasPermission(req.user, 'task.submit') &&
    !hasPermission(req.user, 'task.assign') &&
    !hasPermission(req.user, 'project.manage')
  )
    return sendError(res, {
      statusCode: 403,
      message: 'You do not have permission to upload files.',
      code: 'FORBIDDEN'
    });

  if (!req.file)
    return sendError(res, {
      statusCode: 400,
      message: 'Choose a file to upload.',
      code: 'FILE_REQUIRED'
    });

  return sendSuccess(res, {
    statusCode: 201,
    message:
      'File stored privately. Save the returned metadata with a document or task submission.',
    data: {
      storageKey: req.file.filename,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      downloadEndpoint: `/api/v1/uploads/${req.file.filename}`,
      previewEndpoint: `/api/v1/uploads/${req.file.filename}/preview`
    }
  });
}

async function download(req, res) {
  const file = await resolvePrivateFile(req);
  if (!file)
    return sendError(res, {
      statusCode: 404,
      message: 'File not found or access denied.',
      code: 'FILE_NOT_FOUND'
    });

  return res.download(file.full, file.fileName);
}

/**
 * Inline preview of a private file. Same auth as download,
 * but serves with Content-Disposition: inline so the browser renders it.
 */
async function preview(req, res) {
  const file = await resolvePrivateFile(req);
  if (!file)
    return sendError(res, {
      statusCode: 404,
      message: 'File not found or access denied.',
      code: 'FILE_NOT_FOUND'
    });

  const ext = path.extname(file.full).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain; charset=utf-8'
  };

  const mimeType = mimeMap[ext] || 'application/octet-stream';

  // 🔑 Key difference vs download — inline, not attachment.
  res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Private docs — do not cache.
  res.setHeader('Cache-Control', 'private, no-store');

  return res.sendFile(file.full);
}

module.exports = { upload, download, preview };