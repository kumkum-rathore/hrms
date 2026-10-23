
const Branch = require('../models/Branch');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { PERMISSION_KEYS, hasPermission } = require('../utils/permissions');
const {
  nextOfficeBranchCode,
  previewOfficeBranchCode,
} = require('../utils/codeSequence');
const { isValidOptionalPhone } = require('../utils/phoneValidation');

function validate(body) {
  const errors = [];

  for (const key of ['name']) {
    if (
      typeof body[key] !== 'string' ||
      body[key].trim().length < 2
    ) {
      errors.push({
        field: key,
        message: `${key} must contain at least 2 characters.`,
      });
    }
  }

  if (!isValidOptionalPhone(body.contactPhone)) {
    errors.push({
      field: 'contactPhone',
      message: 'Contact phone must contain exactly 10 digits.',
    });
  }

  if (
    !body.address ||
    !body.address.line1 ||
    !body.address.city ||
    !body.address.state ||
    !body.address.country
  ) {
    errors.push({
      field: 'address',
      message: 'Address line1, city, state and country are required.',
    });
  }

  const coordinates = body.officeLocation?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !Number.isFinite(Number(coordinates[0])) ||
    !Number.isFinite(Number(coordinates[1])) ||
    Number(coordinates[0]) < -180 ||
    Number(coordinates[0]) > 180 ||
    Number(coordinates[1]) < -90 ||
    Number(coordinates[1]) > 90
  ) {
    errors.push({
      field: 'officeLocation.coordinates',
      message: 'Coordinates must be [longitude, latitude].',
    });
  }

  const radius =
    body.geofenceRadiusMeters === undefined
      ? 100
      : Number(body.geofenceRadiusMeters);

  if (
    !Number.isFinite(radius) ||
    radius < 20 ||
    radius > 2000
  ) {
    errors.push({
      field: 'geofenceRadiusMeters',
      message: 'Radius must be between 20 and 2000 metres.',
    });
  }

  return errors;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return {
      valid: false,
      permissions: [],
    };
  }

  const valid = permissions.every(
    permission =>
      typeof permission === 'string' &&
      PERMISSION_KEYS.includes(permission.trim())
  );

  return {
    valid,
    permissions: valid
      ? [...new Set(permissions.map(permission => permission.trim()))]
      : [],
  };
}

async function list(req, res) {
  if (req.user.role !== 'SUPER_ADMIN' && !hasPermission(req.user, 'branch.view'))
    return sendError(res, {
      statusCode: 403,
      message: 'You do not have permission to view branch details.',
      code: 'FORBIDDEN'
    });
  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1
  );

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
  );

  const filter = {};

  if (req.user.role !== 'SUPER_ADMIN') {
    filter._id = req.user.branchId || null;
  }

  if (
    req.query.status &&
    ['ACTIVE', 'INACTIVE'].includes(req.query.status)
  ) {
    filter.status = req.query.status;
  }

  if (req.query.search) {
    const search = escapeRegex(
      String(req.query.search).slice(0, 60)
    );

    filter.$or = [
      { name: new RegExp(search, 'i') },
      { branchCode: new RegExp(search, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    Branch.find(filter)
      .populate(
        'branchAdminId',
        'firstName lastName email phone status role permissions'
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Branch.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: 'Branches loaded.',
    data: items,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

async function reserveCode(req, res) {
  return sendSuccess(res, {
    message: 'Branch code preview loaded.',
    data: { branchCode: await previewOfficeBranchCode() },
  });
}

async function create(req, res) {
  const errors = validate(req.body || {});

  if (errors.length) {
    return sendError(res, {
      statusCode: 400,
      message: 'Please correct the branch details.',
      code: 'VALIDATION_ERROR',
      details: errors,
    });
  }

  const body = req.body;
  const admin = body.branchAdmin || {};

  if (!isValidOptionalPhone(admin.phone)) {
    return sendError(res, {
      statusCode: 400,
      message: 'Branch Admin phone must contain exactly 10 digits.',
      code: 'VALIDATION_ERROR',
      details: [{ field: 'branchAdmin.phone' }],
    });
  }

  if (
    typeof admin.firstName !== 'string' ||
    admin.firstName.trim().length < 2 ||
    typeof admin.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email.trim()) ||
    typeof admin.password !== 'string' ||
    admin.password.length < 12 ||
    admin.password.length > 128
  ) {
    return sendError(res, {
      statusCode: 400,
      message:
        'Branch Admin name, valid email and initial password (12–128 characters) are required.',
      code: 'BRANCH_ADMIN_VALIDATION_ERROR',
    });
  }

  const email = admin.email.trim().toLowerCase();

  if (await User.exists({ email })) {
    return sendError(res, {
      statusCode: 409,
      message: 'A user with this email already exists.',
      code: 'EMAIL_ALREADY_EXISTS',
    });
  }

  const permissionResult = validatePermissions(
    admin.permissions === undefined ? [] : admin.permissions
  );

  if (!permissionResult.valid) {
    return sendError(res, {
      statusCode: 400,
      message: 'One or more Branch Admin permissions are invalid.',
      code: 'INVALID_PERMISSIONS',
      details: [{
        field: 'branchAdmin.permissions',
        allowedPermissions: PERMISSION_KEYS,
      }],
    });
  }

  const permissions = permissionResult.permissions;
  let branch;
  let branchAdmin;

  try {
    const { branchCode } = await nextOfficeBranchCode();
    branch = await Branch.create({
      branchCode,
      name: body.name.trim(),
      address: body.address,

      officeLocation: {
        type: 'Point',
        coordinates: body.officeLocation.coordinates.map(Number),
      },

      geofenceRadiusMeters:
        body.geofenceRadiusMeters === undefined
          ? 100
          : Number(body.geofenceRadiusMeters),

      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      timezone: body.timezone || 'Asia/Kolkata',
      status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdBy: req.user.id,
    });

    const passwordHash = await bcrypt.hash(admin.password, 12);

    branchAdmin = await User.create({
      firstName: admin.firstName.trim(),
      lastName: String(admin.lastName || '').trim(),
      email,
      passwordHash,
      phone: admin.phone || null,
      role: 'BRANCH_ADMIN',
      branchId: branch._id,
      permissions,
      status: 'ACTIVE',
      joiningDate: admin.joiningDate || new Date(),
    });

    branch.branchAdminId = branchAdmin._id;
    await branch.save();

    const result = branch.toObject();

    result.branchAdmin = {
      id: branchAdmin._id,
      firstName: branchAdmin.firstName,
      lastName: branchAdmin.lastName,
      email: branchAdmin.email,
      role: branchAdmin.role,
      permissions: branchAdmin.permissions,
    };

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Branch and Branch Admin created.',
      data: result,
    });
  } catch (err) {
    if (branchAdmin?._id) {
      await User.findByIdAndDelete(branchAdmin._id).catch(() => {});
    }

    if (branch?._id) {
      await Branch.findByIdAndDelete(branch._id).catch(() => {});
    }

    if (err.code === 11000) {
      return sendError(res, {
        statusCode: 409,
        message: 'Branch code or admin email already exists.',
        code: 'DUPLICATE_RECORD',
      });
    }

    throw err;
  }
}

async function update(req, res) {
  const body = req.body || {};

  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return sendError(res, {
      statusCode: 404,
      message: 'Branch not found.',
      code: 'BRANCH_NOT_FOUND',
    });
  }

  if (!isValidOptionalPhone(body.contactPhone)) {
    return sendError(res, {
      statusCode: 400,
      message: 'Contact phone must contain exactly 10 digits.',
      code: 'VALIDATION_ERROR',
      details: [{ field: 'contactPhone' }],
    });
  }

  const allowed = [
    'name',
    'address',
    'contactEmail',
    'contactPhone',
    'timezone',
    'status',
    'geofenceRadiusMeters',
  ];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      branch[key] = body[key];
    }
  }

  if (body.officeLocation?.coordinates !== undefined) {
    const coordinates = body.officeLocation.coordinates;

    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !Number.isFinite(Number(coordinates[0])) ||
      !Number.isFinite(Number(coordinates[1])) ||
      Number(coordinates[0]) < -180 ||
      Number(coordinates[0]) > 180 ||
      Number(coordinates[1]) < -90 ||
      Number(coordinates[1]) > 90
    ) {
      return sendError(res, {
        statusCode: 400,
        message: 'Coordinates must be [longitude, latitude].',
        code: 'VALIDATION_ERROR',
      });
    }

    branch.officeLocation = {
      type: 'Point',
      coordinates: coordinates.map(Number),
    };
  }

  let updatedAdmin = null;

  // Update permissions only when the request explicitly includes them.
  // Other PATCH requests, such as branch deactivation, remain unaffected.
  if (Object.prototype.hasOwnProperty.call(body, 'permissions')) {
    const permissionResult = validatePermissions(body.permissions);

    if (!permissionResult.valid) {
      return sendError(res, {
        statusCode: 400,
        message: 'One or more Branch Admin permissions are invalid.',
        code: 'INVALID_PERMISSIONS',
        details: [{
          field: 'permissions',
          allowedPermissions: PERMISSION_KEYS,
        }],
      });
    }

    let admin = branch.branchAdminId
      ? await User.findOne({
          _id: branch.branchAdminId,
          role: 'BRANCH_ADMIN',
          branchId: branch._id,
        })
      : null;

    if (!admin) {
      admin = await User.findOne({
        branchId: branch._id,
        role: 'BRANCH_ADMIN',
      });
    }

    if (!admin) {
      return sendError(res, {
        statusCode: 404,
        message: 'No Branch Admin is linked to this branch.',
        code: 'BRANCH_ADMIN_NOT_FOUND',
      });
    }

    admin.permissions = permissionResult.permissions;
    await admin.save();

    updatedAdmin = {
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone,
      status: admin.status,
      role: admin.role,
      permissions: admin.permissions,
    };
  }

  branch.updatedBy = req.user.id;
  await branch.save();

  const result = branch.toObject();

  if (updatedAdmin) {
    result.branchAdminId = updatedAdmin;
    result.branchAdmin = updatedAdmin;
  } else if (branch.branchAdminId) {
    const admin = await User.findById(branch.branchAdminId)
      .select('firstName lastName email phone status role permissions')
      .lean();

    if (admin) {
      result.branchAdminId = admin;
      result.branchAdmin = admin;
    }
  }

  return sendSuccess(res, {
    message: 'Branch updated.',
    data: result,
  });
}

async function remove(req, res) {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return sendError(res, {
      statusCode: 404,
      message: 'Branch not found.',
      code: 'BRANCH_NOT_FOUND',
    });
  }

  const linkedUsers = await User.countDocuments({
    branchId: branch._id,
  });

  if (linkedUsers > 0) {
    return sendError(res, {
      statusCode: 409,
      message:
        'This branch still has linked users. Set it to INACTIVE and reassign/archive its users before deleting.',
      code: 'BRANCH_HAS_USERS',
    });
  }

  await Branch.findByIdAndDelete(branch._id);

  return sendSuccess(res, {
    message: 'Branch deleted.',
    data: { id: branch._id },
  });
}

module.exports = {
  list,
  reserveCode,
  create,
  update,
  remove,
};
