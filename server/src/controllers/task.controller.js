const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');

function recordTaskActivity(task, actor, action, details) {
  task.activityLog.push({
    actor,
    action,
    details: String(details).slice(0, 500),
    createdAt: new Date()
  });
  if (task.activityLog.length > 50)
    task.activityLog.splice(0, task.activityLog.length - 50);
}

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────
async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN')
    return sendError(res, {
      statusCode: 403,
      message: 'Superadmin manages branches only; task details are private.',
      code: 'FORBIDDEN'
    });

  const filter = { branchId: req.user.branchId, isArchived: { $ne: true } };
  if (!['task.view', 'task.assign', 'task.review', 'task.submit'].some(permission => hasPermission(req.user, permission)))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to access tasks.', code: 'FORBIDDEN' });
  const hasTeamTaskAccess =
    hasPermission(req.user, 'task.assign') ||
    req.user.role !== 'EMPLOYEE' && hasPermission(req.user, 'task.view');

  if (!hasTeamTaskAccess) {
    filter.$or = [
      { assignedTo: req.user.id },
      { 'submissions.submittedTo': req.user.id }
    ];
  }

  if (req.query.status) filter.status = req.query.status;

  const rows = await Task.find(filter)
    .populate('projectId', 'name status priority dueDate')
    .populate('assignedTo', 'firstName lastName employeeCode role')
    .populate('departmentId', 'name code')
    .populate('assignedBy', 'firstName lastName')
    .populate('submissions.submittedTo', 'firstName lastName role') // 🆕
    .populate('activityLog.actor', 'firstName lastName role')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  for (const row of rows) {
    row.submissions = (row.submissions || []).filter(
      submission =>
        submission.submittedBy?.toString() === req.user.id ||
        (submission.submittedTo?._id || submission.submittedTo)?.toString() ===
          req.user.id
    );
  }

  return sendSuccess(res, { message: 'Tasks loaded.', data: rows });
}

async function reviews(req, res) {
  if (req.user.role === 'SUPER_ADMIN' || !req.user.branchId)
    return sendError(res, {
      statusCode: 403,
      message: 'Task reviews are available only within your branch.',
      code: 'FORBIDDEN'
    });
  if (!hasPermission(req.user, 'task.review'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to review tasks.', code: 'FORBIDDEN' });

  const rows = await Task.find({
    branchId: req.user.branchId,
    isArchived: { $ne: true },
    status: 'SUBMITTED',
    submissions: {
      $elemMatch: { submittedTo: req.user.id, status: 'SUBMITTED' }
    }
  })
    .populate('projectId', 'name')
    .populate('assignedTo', 'firstName lastName employeeCode')
    .populate('submissions.submittedBy', 'firstName lastName employeeCode')
    .populate('submissions.submittedTo', 'firstName lastName role')
    .populate('activityLog.actor', 'firstName lastName role')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const reviewTasks = rows.flatMap(task => {
    const latest = task.submissions?.[task.submissions.length - 1];
    if (
      !latest ||
      latest.status !== 'SUBMITTED' ||
      (latest.submittedTo?._id || latest.submittedTo)?.toString() !== req.user.id
    )
      return [];

    return [{ ...task, submissions: [latest] }];
  });

  return sendSuccess(res, {
    message: 'Reviews loaded.',
    data: reviewTasks
  });
}

async function reviewers(req, res) {
  if (req.user.role === 'SUPER_ADMIN' || !req.user.branchId)
    return sendError(res, {
      statusCode: 403,
      message: 'Task reviewers are available only within your branch.',
      code: 'FORBIDDEN'
    });
  if (!hasPermission(req.user, 'task.submit') && !hasPermission(req.user, 'task.assign'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to submit or assign tasks.', code: 'FORBIDDEN' });

  const rows = await User.find({
    branchId: req.user.branchId,
    role: { $ne: 'SUPER_ADMIN' },
    status: 'ACTIVE',
    isArchived: { $ne: true }
  })
    .select('_id firstName lastName email role permissions status')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  const eligibleReviewers = rows.filter(row => {
    return row.permissions?.includes('task.review');
  });

  return sendSuccess(res, {
    message: 'Task reviewers loaded.',
    data: eligibleReviewers.map(row => ({ ...row, id: row._id }))
  });
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────
async function create(req, res) {
  if (!hasPermission(req.user, 'task.assign'))
    return sendError(res, {
      statusCode: 403,
      message: 'Only managers can assign tasks.',
      code: 'FORBIDDEN'
    });

  const {
    title,
    description,
    assignedTo,
    departmentId,
    projectId = null,
    dueDate = null,
    priority = 'MEDIUM',
    taskType = 'GENERAL',
    checklist = [],
    estimatedHours = 0
  } = req.body || {};

  if (
    typeof title !== 'string' ||
    title.trim().length < 3 ||
    typeof description !== 'string' ||
    description.trim().length < 3 ||
    !assignedTo ||
    !departmentId
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Title, description, department and assignee are required.',
      code: 'VALIDATION_ERROR'
    });

  const branchId = req.user.branchId;
  if (!branchId)
    return sendError(res, {
      statusCode: 400,
      message: 'Branch is required.',
      code: 'BRANCH_REQUIRED'
    });

  if (!mongoose.isValidObjectId(departmentId))
    return sendError(res, { statusCode: 400, message: 'Select a valid department.', code: 'INVALID_DEPARTMENT' });
  const department = await Department.findOne({
    _id: departmentId,
    branchId,
    isArchived: { $ne: true }
  }).select('_id');
  if (!department)
    return sendError(res, {
      statusCode: 400,
      message: 'Select an active department from your branch.',
      code: 'INVALID_DEPARTMENT'
    });
  if (projectId) {
    const projectForDepartment = await Project.findOne({ _id: projectId, branchId }).select('departmentId');
    if (projectForDepartment?.departmentId && String(projectForDepartment.departmentId) !== String(department._id))
      return sendError(res, { statusCode: 400, message: 'Task department must match the selected project department.', code: 'INVALID_DEPARTMENT' });
  }

  const employee = await User.findOne({
    _id: assignedTo,
    departmentId: department._id,
    branchId,
    status: 'ACTIVE',
    isArchived: { $ne: true }
  });
  if (!employee || employee.role !== 'EMPLOYEE')
    return sendError(res, {
      statusCode: 400,
      message: 'Assignee must be an active employee account in this branch.',
      code: 'INVALID_ASSIGNEE'
    });

  let project = null;
  if (projectId) {
    project = await Project.findOne({ _id: projectId, branchId });
    if (!project)
      return sendError(res, {
        statusCode: 400,
        message: 'Select a valid project from your branch.',
        code: 'INVALID_PROJECT'
      });

    if (!project.members.some(memberId => memberId.toString() === String(assignedTo)))
      return sendError(res, {
        statusCode: 400,
        message: 'The assignee must be an active member selected for this project.',
        code: 'ASSIGNEE_NOT_PROJECT_MEMBER'
      });
  }

  if (
    !Array.isArray(checklist) ||
    checklist.length > 50 ||
    checklist.some(
      x => !x || typeof x.title !== 'string' || x.title.trim().length < 1
    )
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Checklist must contain up to 50 non-empty items.',
      code: 'VALIDATION_ERROR'
    });

  const row = await Task.create({
    branchId,
    projectId: project?._id || null,
    departmentId: department._id,
    estimatedHours: Math.max(0, Math.min(10000, Number(estimatedHours) || 0)),
    title: title.trim(),
    description: description.trim(),
    assignedTo,
    assignedBy: req.user.id,
    createdBy: req.user.id,
    dueDate: dueDate || null,
    priority,
    taskType,
    checklist: checklist.map(x => ({
      title: x.title.trim(),
      completed: false
    })),
    activityLog: [{
      actor: req.user.id,
      action: 'TASK_ASSIGNED',
      details: `Task assigned to ${employee.firstName} ${employee.lastName}.`
    }]
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Task assigned.',
    data: row
  });
}

async function update(req, res) {
  if (!hasPermission(req.user, 'task.assign'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to edit tasks.', code: 'FORBIDDEN' });
  const task = await Task.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!task) return sendError(res, { statusCode: 404, message: 'Task not found in your branch.', code: 'TASK_NOT_FOUND' });
  if (['SUBMITTED', 'APPROVED'].includes(task.status))
    return sendError(res, { statusCode: 409, message: 'Tasks under review or already approved cannot be edited.', code: 'TASK_LOCKED' });

  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (title.length < 3 || title.length > 180 || description.length < 3 || description.length > 5000)
    return sendError(res, { statusCode: 400, message: 'Provide a task title (3–180 characters) and description (3–5000 characters).', code: 'VALIDATION_ERROR' });
  if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority))
    return sendError(res, { statusCode: 400, message: 'Select a valid task priority.', code: 'VALIDATION_ERROR' });
  const estimatedHours = Number(body.estimatedHours);
  if (!Number.isFinite(estimatedHours) || estimatedHours < 0 || estimatedHours > 10000)
    return sendError(res, { statusCode: 400, message: 'Estimated hours must be between 0 and 10000.', code: 'VALIDATION_ERROR' });
  if (body.dueDate) {
    const dueDate = new Date(body.dueDate);
    if (Number.isNaN(dueDate.getTime()))
      return sendError(res, { statusCode: 400, message: 'Provide a valid task deadline.', code: 'VALIDATION_ERROR' });
    task.dueDate = dueDate;
  } else {
    task.dueDate = null;
  }
  if (!body.assignedTo)
    return sendError(res, { statusCode: 400, message: 'An active employee assignee is required.', code: 'VALIDATION_ERROR' });
  if (!body.departmentId)
    return sendError(res, { statusCode: 400, message: 'Select a department before assigning the task.', code: 'VALIDATION_ERROR' });
  if (!mongoose.isValidObjectId(body.departmentId))
    return sendError(res, { statusCode: 400, message: 'Select a valid department.', code: 'INVALID_DEPARTMENT' });
  const department = await Department.findOne({ _id: body.departmentId, branchId: req.user.branchId, isArchived: { $ne: true } }).select('_id');
  if (!department)
    return sendError(res, { statusCode: 400, message: 'Select an active department from your branch.', code: 'INVALID_DEPARTMENT' });
  if (body.projectId) {
    const projectForDepartment = await Project.findOne({ _id: body.projectId, branchId: req.user.branchId }).select('departmentId');
    if (projectForDepartment?.departmentId && String(projectForDepartment.departmentId) !== String(department._id))
      return sendError(res, { statusCode: 400, message: 'Task department must match the selected project department.', code: 'INVALID_DEPARTMENT' });
  }
  const employee = await User.findOne({ _id: body.assignedTo, branchId: req.user.branchId, departmentId: department._id, status: 'ACTIVE', isArchived: { $ne: true }, role: 'EMPLOYEE' });
  if (!employee)
    return sendError(res, { statusCode: 400, message: 'Assignee must be an active employee account in this branch.', code: 'INVALID_ASSIGNEE' });
  let project = null;
  if (body.projectId) {
    project = await Project.findOne({ _id: body.projectId, branchId: req.user.branchId });
    if (!project)
      return sendError(res, { statusCode: 400, message: 'Select a valid project from your branch.', code: 'INVALID_PROJECT' });
    if (!project.members.some(memberId => memberId.toString() === String(body.assignedTo)))
      return sendError(res, { statusCode: 400, message: 'The assignee must be a member selected for this project.', code: 'ASSIGNEE_NOT_PROJECT_MEMBER' });
  }
  if (!Array.isArray(body.checklist) || body.checklist.length > 50 ||
      body.checklist.some(item => !item || typeof item.title !== 'string' || item.title.trim().length < 1 || item.title.trim().length > 180))
    return sendError(res, { statusCode: 400, message: 'Checklist must contain up to 50 non-empty items (180 characters maximum each).', code: 'VALIDATION_ERROR' });

  const previousAssignee = task.assignedTo.toString();
  task.title = title;
  task.description = description;
  task.assignedTo = employee._id;
  task.departmentId = department._id;
  task.projectId = project?._id || null;
  task.priority = body.priority;
  task.estimatedHours = estimatedHours;
  const previousChecklist = new Map(task.checklist.map(item => [item.title.trim().toLowerCase(), item]));
  task.checklist = body.checklist.map(item => {
    const oldItem = previousChecklist.get(item.title.trim().toLowerCase());
    return {
      title: item.title.trim(),
      completed: oldItem?.completed || false,
      completedAt: oldItem?.completedAt || null
    };
  });
  if (task.checklist.length)
    task.progress = Math.round(task.checklist.filter(item => item.completed).length / task.checklist.length * 100);
  recordTaskActivity(
    task,
    req.user.id,
    'TASK_UPDATED',
    `Updated task details${previousAssignee !== employee._id.toString() ? ` and reassigned to ${employee.firstName} ${employee.lastName}` : ''}.`
  );
  await task.save();
  return sendSuccess(res, { message: 'Task updated.', data: task });
}

async function archive(req, res) {
  if (!hasPermission(req.user, 'task.assign'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to archive tasks.', code: 'FORBIDDEN' });
  const task = await Task.findOne({ _id: req.params.id, branchId: req.user.branchId, isArchived: { $ne: true } });
  if (!task) return sendError(res, { statusCode: 404, message: 'Task not found in your branch.', code: 'TASK_NOT_FOUND' });
  task.isArchived = true;
  task.archivedAt = new Date();
  recordTaskActivity(task, req.user.id, 'TASK_ARCHIVED', 'Archived this task; submissions, work logs, and activity history were retained.');
  await task.save();
  return sendSuccess(res, { message: 'Task archived; task history was retained.', data: { id: task.id } });
}

// ─────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────
async function submit(req, res) {
  if (!hasPermission(req.user, 'task.submit'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to submit tasks.', code: 'FORBIDDEN' });
  const task = await Task.findOne({ _id: req.params.id, isArchived: { $ne: true } });
  if (!task)
    return sendError(res, {
      statusCode: 404,
      message: 'Task not found.',
      code: 'TASK_NOT_FOUND'
    });

  if (task.assignedTo.toString() !== req.user.id)
    return sendError(res, {
      statusCode: 403,
      message: 'Only the assigned employee can submit this task.',
      code: 'FORBIDDEN'
    });

  if (['APPROVED'].includes(task.status))
    return sendError(res, {
      statusCode: 409,
      message: 'Approved task cannot be resubmitted.',
      code: 'TASK_CLOSED'
    });

  const { note = '', files = [], submittedTo } = req.body || {};

  const reviewer = submittedTo
    ? await User.findOne({
        _id: submittedTo,
        branchId: req.user.branchId,
        role: { $ne: 'SUPER_ADMIN' },
        status: 'ACTIVE'
      }).select('_id firstName lastName permissions')
    : null;

  if (!reviewer || !reviewer.permissions?.includes('task.review'))
    return sendError(res, {
      statusCode: 400,
      message: 'Select an active reviewer from your branch.',
      code: 'INVALID_REVIEWER'
    });

  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.resolve(
    process.env.PRIVATE_UPLOAD_DIR ||
      path.join(__dirname, '../../private-uploads')
  );

  // 🆕 Validate files — internal uploads OR external URLs
  if (!Array.isArray(files) || files.length > 20)
    return sendError(res, {
      statusCode: 400,
      message: 'Files must be an array (max 20).',
      code: 'VALIDATION_ERROR'
    });

  const sanitizedFiles = [];

  for (const f of files) {
    if (
      !f ||
      typeof f.name !== 'string' ||
      typeof f.url !== 'string'
    )
      return sendError(res, {
        statusCode: 400,
        message: 'Each file must have a name and url.',
        code: 'VALIDATION_ERROR'
      });

    // External URL (user-provided link)
    if (f.externalUrl || /^https?:\/\//i.test(f.url)) {
      if (!/^https?:\/\/.+/i.test(f.url))
        return sendError(res, {
          statusCode: 400,
          message: 'External URL must start with http:// or https://',
          code: 'VALIDATION_ERROR'
        });

      sanitizedFiles.push({
        name: f.name.slice(0, 255),
        url: f.url.slice(0, 1000),
        externalUrl: f.url.slice(0, 1000),
        mimeType: 'text/uri-list',
        size: 0
      });
      continue;
    }

    // Internal uploaded file — must exist in private uploads
    if (!/^[a-f0-9-]{20,80}\.[a-z0-9]{1,12}$/i.test(f.url))
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid file reference.',
        code: 'VALIDATION_ERROR'
      });

    const fullPath = path.join(uploadDir, f.url);
    if (
      !fullPath.startsWith(uploadDir + path.sep) ||
      !fs.existsSync(fullPath)
    )
      return sendError(res, {
        statusCode: 400,
        message: 'Uploaded file not found.',
        code: 'VALIDATION_ERROR'
      });

    sanitizedFiles.push({
      name: f.name.slice(0, 255),
      url: f.url.slice(0, 1000),
      externalUrl: '',
      mimeType: String(f.mimeType || 'application/octet-stream').slice(0, 120),
      size: Math.max(0, Number(f.size) || 0)
    });
  }

  task.submissions.push({
    submittedBy: req.user.id,
    submittedTo: reviewer._id,
    note: String(note).slice(0, 2000),
    files: sanitizedFiles,
    status: 'SUBMITTED'
  });
  recordTaskActivity(
    task,
    req.user.id,
    'SUBMITTED',
    `Submitted work for review to ${reviewer.firstName || 'reviewer'} ${reviewer.lastName || ''}.`
  );
  task.status = 'SUBMITTED';
  task.progress = 100;
  await task.save();

  return sendSuccess(res, {
    message: 'Task submitted for review.',
    data: task
  });
}

// ─────────────────────────────────────────────────────────────
// REVIEW
// ─────────────────────────────────────────────────────────────
async function review(req, res) {
  if (!hasPermission(req.user, 'task.review'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to review tasks.', code: 'FORBIDDEN' });
  const task = await Task.findOne({ _id: req.params.id, isArchived: { $ne: true } });
  if (!task)
    return sendError(res, {
      statusCode: 404,
      message: 'Task not found.',
      code: 'TASK_NOT_FOUND'
    });

  if (task.branchId.toString() !== req.user.branchId)
    return sendError(res, {
      statusCode: 403,
      message: 'Task belongs to another branch.',
      code: 'BRANCH_ACCESS_DENIED'
    });

  const { decision, note = '' } = req.body || {};

  if (!['APPROVED', 'CHANGES_REQUESTED'].includes(decision) || !task.submissions.length)
    return sendError(res, {
      statusCode: 400,
      message: 'A valid decision and submitted work are required.',
      code: 'VALIDATION_ERROR'
    });

  const latest = task.submissions[task.submissions.length - 1];

  if (
    task.status !== 'SUBMITTED' ||
    latest.status !== 'SUBMITTED' ||
    !latest.submittedTo ||
    latest.submittedTo.toString() !== req.user.id
  )
    return sendError(res, {
      statusCode: 403,
      message: 'Only the designated reviewer can review this submission.',
      code: 'NOT_DESIGNATED_REVIEWER'
    });

  latest.status = decision;
  latest.reviewNote = String(note).slice(0, 2000);
  latest.reviewedBy = req.user.id;
  latest.reviewedAt = new Date();
  recordTaskActivity(
    task,
    req.user.id,
    decision,
    decision === 'APPROVED'
      ? 'Approved the submitted work.'
      : 'Requested changes to the submitted work.'
  );

  task.status = decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';
  task.progress = decision === 'APPROVED' ? 100 : Math.min(task.progress, 90);

  await task.save();

  return sendSuccess(res, {
    message:
      decision === 'APPROVED' ? 'Task approved.' : 'Changes requested.',
    data: task
  });
}

// ─────────────────────────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────────────────────────
async function progress(req, res) {
  if (!hasPermission(req.user, 'task.submit'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to update task progress.', code: 'FORBIDDEN' });
  const task = await Task.findOne({ _id: req.params.id, isArchived: { $ne: true } });
  if (!task)
    return sendError(res, {
      statusCode: 404,
      message: 'Task not found.',
      code: 'TASK_NOT_FOUND'
    });

  if (task.assignedTo.toString() !== req.user.id)
    return sendError(res, {
      statusCode: 403,
      message: 'Only the assignee can update progress.',
      code: 'FORBIDDEN'
    });

  if (['SUBMITTED', 'APPROVED'].includes(task.status))
    return sendError(res, {
      statusCode: 409,
      message:
        'Progress cannot be changed while the task is under review or approved.',
      code: 'TASK_LOCKED'
    });

  const requestedProgress = Number(req.body.progress);
  if (!Number.isInteger(requestedProgress) || requestedProgress < 0 || requestedProgress > 99)
    return sendError(res, {
      statusCode: 400,
      message: 'Progress must be an integer from 0 to 99.',
      code: 'VALIDATION_ERROR'
    });

  const hours = Number(req.body.hours || 0);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24)
    return sendError(res, {
      statusCode: 400,
      message: 'Work log hours must be between 0 and 24.',
      code: 'VALIDATION_ERROR'
    });

  const note = String(req.body.note || '').trim().slice(0, 1000);
  const checklistProgress = task.checklist.length
    ? Math.round(
        (task.checklist.filter(item => item.completed).length /
          task.checklist.length) *
          100
      )
    : null;
  const n = checklistProgress ?? requestedProgress;

  task.progress = n;
  task.status = n === 0 ? 'TODO' : 'IN_PROGRESS';

  recordTaskActivity(
    task,
    req.user.id,
    'PROGRESS_UPDATED',
    note ? `Updated progress to ${n}%. ${note}` : `Updated progress to ${n}%.`
  );

  if (hours > 0 || note)
    task.workLogs.push({
      userId: req.user.id,
      note,
      hours,
      progress: n,
      createdAt: new Date()
    });

  task.actualHours =
    Math.round((Number(task.actualHours || 0) + hours) * 100) / 100;

  await task.save();

  return sendSuccess(res, { message: 'Progress updated.', data: task });
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST
// ─────────────────────────────────────────────────────────────
async function updateChecklist(req, res) {
  const task = await Task.findOne({ _id: req.params.id, isArchived: { $ne: true } });
  if (!task)
    return sendError(res, {
      statusCode: 404,
      message: 'Task not found.',
      code: 'TASK_NOT_FOUND'
    });

  if (
    task.branchId.toString() !== String(req.user.branchId) ||
    task.assignedTo.toString() !== req.user.id
  )
    return sendError(res, {
      statusCode: 403,
      message: 'Only the assigned employee can update this task checklist.',
      code: 'FORBIDDEN'
    });

  if (['SUBMITTED', 'APPROVED'].includes(task.status))
    return sendError(res, {
      statusCode: 409,
      message: 'Checklist is locked while the task is under review or approved.',
      code: 'TASK_LOCKED'
    });

  const { index, completed } = req.body || {};
  if (
    !Number.isInteger(Number(index)) ||
    Number(index) < 0 ||
    Number(index) >= task.checklist.length ||
    typeof completed !== 'boolean'
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Valid checklist index and completed boolean are required.',
      code: 'VALIDATION_ERROR'
    });

  task.checklist[Number(index)].completed = completed;
  task.checklist[Number(index)].completedAt = completed ? new Date() : null;

  const done = task.checklist.filter(x => x.completed).length;
  task.progress = task.checklist.length
    ? Math.round((done / task.checklist.length) * 100)
    : task.progress;

  task.status = task.progress === 0 ? 'TODO' : 'IN_PROGRESS';
  recordTaskActivity(
    task,
    req.user.id,
    'CHECKLIST_UPDATED',
    `${completed ? 'Completed' : 'Reopened'} checklist item: ${task.checklist[Number(index)].title}. Progress is ${task.progress}%.`
  );

  await task.save();

  return sendSuccess(res, {
    message: 'Task checklist updated.',
    data: task
  });
}

module.exports = {
  list,
  reviews,
  reviewers,
  create,
  update,
  archive,
  submit,
  review,
  progress,
  updateChecklist
};