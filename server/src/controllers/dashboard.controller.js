const User = require('../models/User');
const Branch = require('../models/Branch');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');
async function summary(req, res) {
  if (req.user.role === 'SUPER_ADMIN') { const branches = await Branch.find({}).sort({createdAt:-1}).lean(); return sendSuccess(res, { message: 'Branch overview loaded.', data: { branches: branches.length, branchList: branches, employees: null, activeEmployees: null, presentToday: null, pendingLeaves: null, attendanceRate: null, recentLeaves: [] } }); }
  if (!['branch.view', 'employee.view', 'attendance.view', 'leave.view'].every(permission => hasPermission(req.user, permission)))
    return sendError(res, { statusCode: 403, message: 'Dashboard requires branch, employee, attendance and leave view permissions.', code: 'FORBIDDEN' });
  const branchFilter = req.user.role === 'SUPER_ADMIN' ? {} : { branchId: req.user.branchId };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const attendanceFilter = { workDate: today, ...branchFilter };
  const [employees, activeEmployees, branches, presentToday, pendingLeaves, recentLeaves] = await Promise.all([
    User.countDocuments({ ...branchFilter, role: { $nin: ['SUPER_ADMIN', 'BRANCH_ADMIN'] }, isArchived: { $ne: true } }),
    User.countDocuments({ ...branchFilter, role: { $nin: ['SUPER_ADMIN', 'BRANCH_ADMIN'] }, status: 'ACTIVE', isArchived: { $ne: true } }),
    Branch.countDocuments({ ...(req.user.role === 'SUPER_ADMIN' ? {} : { _id: req.user.branchId }), status: 'ACTIVE' }),
    Attendance.countDocuments({ ...attendanceFilter, checkInAt: { $ne: null } }),
    LeaveRequest.countDocuments({ ...branchFilter, status: 'PENDING' }),
    LeaveRequest.find(branchFilter).populate('userId', 'firstName lastName employeeCode').sort({ createdAt: -1 }).limit(5).lean()
  ]);
  return sendSuccess(res, { message: 'Dashboard summary loaded.', data: { employees, activeEmployees, branches, presentToday, pendingLeaves, attendanceRate: activeEmployees ? Math.round((presentToday / activeEmployees) * 100) : 0, recentLeaves } });
}
module.exports = { summary };
