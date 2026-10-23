const mongoose = require('mongoose');
const BranchHoliday = require('../models/BranchHoliday');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');

function isBranchAdmin(req) {
  return hasPermission(req.user, 'calendar.manage') && !!req.user.branchId;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

async function list(req, res) {
  if (!req.user.branchId)
    return sendError(res, {
      statusCode: 403,
      message: 'Calendar is available only to branch users.',
      code: 'BRANCH_ACCESS_DENIED'
    });
  if (!hasPermission(req.user, 'calendar.view') && !hasPermission(req.user, 'calendar.manage') && !hasPermission(req.user, 'employee.create'))
    return sendError(res, {
      statusCode: 403,
      message: 'You do not have permission to view the branch calendar.',
      code: 'FORBIDDEN'
    });

  const month = String(req.query.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return sendError(res, {
      statusCode: 400,
      message: 'A valid calendar month (YYYY-MM) is required.',
      code: 'VALIDATION_ERROR'
    });

  const [holidays, shifts, employee] = await Promise.all([
    BranchHoliday.find({
      branchId: req.user.branchId,
      date: { $gte: `${month}-01`, $lte: `${month}-31` }
    })
      .sort({ date: 1 })
      .lean(),
    Shift.find({ branchId: req.user.branchId }).sort({ startTime: 1 }).lean(),
    User.findById(req.user.id)
      .populate('shiftId', 'name startTime endTime graceMinutes')
      .select('shiftId')
      .lean()
  ]);

  return sendSuccess(res, {
    message: 'Branch calendar loaded.',
    data: {
      holidays,
      shifts: hasPermission(req.user, 'calendar.manage') || hasPermission(req.user, 'employee.create')
        ? shifts
        : shifts.filter(
            shift => String(shift._id) === String(employee?.shiftId?._id || employee?.shiftId)
          ),
      myShift: employee?.shiftId || null
    }
  });
}

async function createHoliday(req, res) {
  if (!isBranchAdmin(req))
    return sendError(res, {
      statusCode: 403,
      message: 'Only the Branch Admin can add branch holidays.',
      code: 'FORBIDDEN'
    });

  const { date, title } = req.body || {};
  if (
    !isValidDateKey(date) ||
    typeof title !== 'string' ||
    title.trim().length < 2 ||
    title.trim().length > 120
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Provide a valid holiday date and title.',
      code: 'VALIDATION_ERROR'
    });

  try {
    const holiday = await BranchHoliday.create({
      branchId: req.user.branchId,
      date,
      title: title.trim(),
      createdBy: req.user.id
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Holiday added to branch calendar.',
      data: holiday
    });
  } catch (error) {
    if (error.code === 11000)
      return sendError(res, {
        statusCode: 409,
        message: 'A holiday is already set for this date.',
        code: 'HOLIDAY_EXISTS'
      });
    throw error;
  }
}

async function deleteHoliday(req, res) {
  if (!isBranchAdmin(req))
    return sendError(res, {
      statusCode: 403,
      message: 'Only the Branch Admin can remove branch holidays.',
      code: 'FORBIDDEN'
    });

  if (!mongoose.isValidObjectId(req.params.id))
    return sendError(res, {
      statusCode: 404,
      message: 'Holiday not found in your branch.',
      code: 'NOT_FOUND'
    });

  const holiday = await BranchHoliday.findOneAndDelete({
    _id: req.params.id,
    branchId: req.user.branchId
  });
  if (!holiday)
    return sendError(res, {
      statusCode: 404,
      message: 'Holiday not found in your branch.',
      code: 'NOT_FOUND'
    });

  return sendSuccess(res, {
    message: 'Holiday removed from branch calendar.',
    data: holiday
  });
}

async function createShift(req, res) {
  if (!isBranchAdmin(req))
    return sendError(res, {
      statusCode: 403,
      message: 'Only the Branch Admin can manage shifts.',
      code: 'FORBIDDEN'
    });

  const { name, startTime, endTime } = req.body || {};
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    !timePattern.test(startTime || '') ||
    !timePattern.test(endTime || '') ||
    startTime === endTime
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Provide a shift name, start time and a different end time.',
      code: 'VALIDATION_ERROR'
    });

  try {
    const shift = await Shift.create({
      branchId: req.user.branchId,
      name: name.trim(),
      startTime,
      endTime,
      graceMinutes: 120
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Shift created. The grace period is 2 hours.',
      data: shift
    });
  } catch (error) {
    if (error.code === 11000)
      return sendError(res, {
        statusCode: 409,
        message: 'A shift with this name already exists in your branch.',
        code: 'SHIFT_EXISTS'
      });
    throw error;
  }
}

async function assignShift(req, res) {
  if (!isBranchAdmin(req))
    return sendError(res, {
      statusCode: 403,
      message: 'Only the Branch Admin can assign employee shifts.',
      code: 'FORBIDDEN'
    });

  const { userId, shiftId } = req.body || {};
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(shiftId)
  )
    return sendError(res, {
      statusCode: 400,
      message: 'Select a valid employee and shift.',
      code: 'VALIDATION_ERROR'
    });

  const employee = await User.findOne({
    _id: userId,
    branchId: req.user.branchId,
    role: 'EMPLOYEE'
  });
  if (!employee)
    return sendError(res, {
      statusCode: 404,
      message: 'Employee not found in your branch.',
      code: 'EMPLOYEE_NOT_FOUND'
    });

  const shift = await Shift.findOne({
    _id: shiftId,
    branchId: req.user.branchId
  });
  if (!shift)
    return sendError(res, {
      statusCode: 400,
      message: 'Select a shift from your branch.',
      code: 'INVALID_SHIFT'
    });

  employee.shiftId = shift._id;
  await employee.save();

  return sendSuccess(res, {
    message: 'Employee shift assigned.',
    data: { userId: employee._id, shiftId: employee.shiftId }
  });
}

module.exports = { list, createHoliday, deleteHoliday, createShift, assignShift };
