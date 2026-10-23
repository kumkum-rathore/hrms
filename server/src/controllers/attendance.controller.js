const Attendance = require('../models/Attendance');
const Branch = require('../models/Branch');
const BranchHoliday = require('../models/BranchHoliday');
const Shift = require('../models/Shift');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');
function todayInKolkata() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function distanceMeters(lat1, lon1, lat2, lon2) {
  const r = 6371000; const rad = n => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1); const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function coordinates(body) {
  const latitude = Number(body.latitude); const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN') return sendError(res, { statusCode: 403, message: 'Superadmin manages branches only; attendance is private branch data.', code: 'FORBIDDEN' });
  if (!hasPermission(req.user, 'attendance.self') && !hasPermission(req.user, 'attendance.view') && !hasPermission(req.user, 'attendance.manage'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to view attendance.', code: 'FORBIDDEN' });
  const filter = {};
  if (!hasPermission(req.user, 'attendance.view') && !hasPermission(req.user, 'attendance.manage')) filter.userId = req.user.id;
  else if (req.user.role !== 'SUPER_ADMIN') filter.branchId = req.user.branchId;
  else if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.date) filter.workDate = String(req.query.date).slice(0, 10);
  const records = await Attendance.find(filter).populate('userId', 'firstName lastName employeeCode').populate('branchId', 'name branchCode').sort({ workDate: -1, createdAt: -1 }).limit(100).lean();
  return sendSuccess(res, { message: 'Attendance records loaded.', data: records });
}
async function checkIn(req, res) {
  if (!hasPermission(req.user, 'attendance.self') && !hasPermission(req.user, 'attendance.view') && !hasPermission(req.user, 'attendance.manage'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to record attendance.', code: 'FORBIDDEN' });
  const point = coordinates(req.body || {}); if (!point) return sendError(res, { statusCode: 400, message: 'Valid latitude and longitude are required.', code: 'INVALID_COORDINATES' });
  const user = req.user;
  if (!user.branchId) return sendError(res, { statusCode: 400, message: 'Your account is not assigned to a branch.', code: 'BRANCH_NOT_ASSIGNED' });
  const branch = await Branch.findOne({ _id: user.branchId, status: 'ACTIVE' });
  if (!branch) return sendError(res, { statusCode: 400, message: 'Your assigned branch is not active.', code: 'BRANCH_NOT_ACTIVE' });
  const [longitude, latitude] = branch.officeLocation.coordinates;
  const distance = distanceMeters(point.latitude, point.longitude, latitude, longitude);
  if (distance > branch.geofenceRadiusMeters) return sendError(res, { statusCode: 403, message: `You are outside the office geofence (${Math.round(distance)} m away).`, code: 'OUTSIDE_GEOFENCE', details: [{ allowedRadiusMeters: branch.geofenceRadiusMeters, distanceMeters: Math.round(distance) }] });
  const workDate = todayInKolkata();
  const holiday = await BranchHoliday.findOne({ branchId: branch._id, date: workDate });
  if (holiday)
    return sendError(res, {
      statusCode: 409,
      message: `Today is a branch holiday: ${holiday.title}. Attendance is not required.`,
      code: 'BRANCH_HOLIDAY'
    });

  const employee = await User.findById(user.id).select('shiftId').lean();
  const assignedShift = employee?.shiftId
    ? await Shift.findOne({ _id: employee.shiftId, branchId: branch._id }).lean()
    : null;
  const existing = await Attendance.findOne({ userId: user.id, workDate });
  if (existing?.checkInAt) return sendError(res, { statusCode: 409, message: 'You have already checked in today.', code: 'ALREADY_CHECKED_IN' });
  const record = existing || new Attendance({ userId: user.id, branchId: branch._id, workDate });
  const checkInAt = new Date();
  let isHalfDay = false;
  if (assignedShift) {
    const [shiftHour, shiftMinute] = assignedShift.startTime.split(':').map(Number);
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(checkInAt);
    const [checkInHour, checkInMinute, checkInSecond] = localTime.split(':').map(Number);
    let secondsLate =
      checkInHour * 3600 + checkInMinute * 60 + checkInSecond -
      (shiftHour * 3600 + shiftMinute * 60);
    const [endHour, endMinute] = assignedShift.endTime.split(':').map(Number);
    if (
      endHour * 60 + endMinute < shiftHour * 60 + shiftMinute &&
      checkInHour * 60 + checkInMinute < endHour * 60 + endMinute
    )
      secondsLate += 24 * 60 * 60;
    isHalfDay = secondsLate > (assignedShift.graceMinutes ?? 120) * 60;
  }
  record.checkInAt = checkInAt; record.checkInLocation = { ...point, distanceMeters: Math.round(distance) }; record.status = isHalfDay ? 'HALF_DAY' : 'INCOMPLETE';
  await record.save(); return sendSuccess(res, { statusCode: 201, message: 'Check-in recorded.', data: record });
}
async function checkOut(req, res) {
  if (!hasPermission(req.user, 'attendance.self') && !hasPermission(req.user, 'attendance.view') && !hasPermission(req.user, 'attendance.manage'))
    return sendError(res, { statusCode: 403, message: 'You do not have permission to record attendance.', code: 'FORBIDDEN' });
  const point = coordinates(req.body || {}); if (!point) return sendError(res, { statusCode: 400, message: 'Valid latitude and longitude are required.', code: 'INVALID_COORDINATES' });
  const record = await Attendance.findOne({ userId: req.user.id, workDate: todayInKolkata() });
  if (!record || !record.checkInAt) return sendError(res, { statusCode: 409, message: 'Check in before checking out.', code: 'CHECK_IN_REQUIRED' });
  if (record.checkOutAt) return sendError(res, { statusCode: 409, message: 'You have already checked out today.', code: 'ALREADY_CHECKED_OUT' });
  const branch = await Branch.findById(record.branchId);
  const [longitude, latitude] = branch.officeLocation.coordinates;
  const distance = distanceMeters(point.latitude, point.longitude, latitude, longitude);
  if (distance > branch.geofenceRadiusMeters) return sendError(res, { statusCode: 403, message: `You are outside the office geofence (${Math.round(distance)} m away).`, code: 'OUTSIDE_GEOFENCE' });
  record.checkOutAt = new Date(); record.checkOutLocation = { ...point, distanceMeters: Math.round(distance) }; if (record.status !== 'HALF_DAY') record.status = 'PRESENT';
  await record.save(); return sendSuccess(res, { message: 'Check-out recorded.', data: record });
}
module.exports = { list, checkIn, checkOut };
