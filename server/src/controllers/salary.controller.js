const Salary=require('../models/Salary');const User=require('../models/User');const {sendSuccess,sendError}=require('../utils/apiResponse');
const { hasPermission } = require('../utils/permissions');
function canManageSalary(user) { return hasPermission(user, 'employee.salary.manage'); }
const {
  calculateAttendanceDeduction,
  calculateAttendanceDeductions
} = require('../services/payroll');
async function list(req, res) {
  if (req.user.role === 'SUPER_ADMIN')
    return sendError(res, {
      statusCode: 403,
      message: 'Superadmin manages branches, not private salary records.',
      code: 'FORBIDDEN'
    });

  if (!hasPermission(req.user, 'employee.salary.view') && !canManageSalary(req.user))
    return sendError(res, {
      statusCode: 403,
      message: 'You do not have permission to view salary records.',
      code: 'FORBIDDEN'
    });

  if (!req.user.branchId)
    return sendError(res, {
      statusCode: 403,
      message: 'Salary records are available only to branch users.',
      code: 'BRANCH_ACCESS_DENIED'
    });

  const filter = { branchId: req.user.branchId };
  if (!canManageSalary(req.user)) {
    filter.userId = req.user.id;
  } else if (req.query.userId) {
    filter.userId = req.query.userId;
  }

  const rows = await Salary.find(filter)
    .populate({
      path: 'userId',
      select: 'firstName lastName employeeCode email joiningDate shiftId',
      populate: { path: 'shiftId', select: 'name startTime endTime graceMinutes' }
    })
    .populate('createdBy', 'firstName lastName')
    .populate('adjustmentHistory.changedBy', 'firstName lastName')
    .sort({ month: -1 })
    .limit(200)
    .lean();

  const dynamicRows = rows.filter(
    row => !(row.status === 'PAID' && Number.isFinite(row.attendanceDeduction))
  );
  const dynamicPayroll = await calculateAttendanceDeductions(dynamicRows);
  const payrollById = new Map(
    dynamicRows.map((row, index) => [String(row._id), dynamicPayroll[index]])
  );

  const data = rows.map(row => {
    const monthlyNet = Math.max(
      0,
      row.baseSalary + row.allowances + row.bonus - row.deductions
    );
    const payroll = row.status === 'PAID' && Number.isFinite(row.attendanceDeduction)
      ? {
          attendanceDeduction: row.attendanceDeduction,
          payableSalary: Math.max(0, monthlyNet - row.attendanceDeduction),
          attendanceSummary: row.attendanceSummary || {
            scheduledWorkingDays: 0,
            absentDays: 0,
            leaveDays: 0,
            halfDays: 0
          },
          shiftMissing: !row.userId?.shiftId
        }
      : payrollById.get(String(row._id));

    return { ...row, netSalary: monthlyNet, ...payroll };
  });

  return sendSuccess(res, {
    message: 'Salary records loaded.',
    data
  });
}
async function create(req,res){if(!canManageSalary(req.user))return sendError(res,{statusCode:403,message:'Only authorized HR admins can create salary records.',code:'FORBIDDEN'});const {userId,month,baseSalary,allowances=0,deductions=0,bonus=0,status='DRAFT',notes=''}=req.body||{};const employee=await User.findById(userId);if(!employee||employee.branchId?.toString()!==req.user.branchId)return sendError(res,{statusCode:400,message:'Employee is not in your permitted scope.',code:'INVALID_EMPLOYEE'});if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||[baseSalary,allowances,deductions,bonus].some(v=>!Number.isFinite(Number(v))||Number(v)<0)||Number(baseSalary)>100000000)return sendError(res,{statusCode:400,message:'Provide a valid month and non-negative salary amounts.',code:'VALIDATION_ERROR'});try{const row=await Salary.create({branchId:employee.branchId,userId,month,baseSalary:Number(baseSalary),allowances:Number(allowances),deductions:Number(deductions),bonus:Number(bonus),status,notes,createdBy:req.user.id});return sendSuccess(res,{statusCode:201,message:'Salary record created.',data:{...row.toObject(),netSalary:row.netSalary}});}catch(e){if(e.code===11000)return sendError(res,{statusCode:409,message:'Salary for this employee and month already exists.',code:'SALARY_EXISTS'});throw e;}}
async function updateStatus(req,res){if(!canManageSalary(req.user))return sendError(res,{statusCode:403,message:'Only authorized HR admins can update salary status.',code:'FORBIDDEN'});const {status}=req.body||{};if(!['DRAFT','PROCESSED','PAID'].includes(status))return sendError(res,{statusCode:400,message:'Invalid salary status.',code:'VALIDATION_ERROR'});const row=await Salary.findOne({_id:req.params.id,branchId:req.user.branchId});if(!row)return sendError(res,{statusCode:404,message:'Salary record not found in your branch.',code:'NOT_FOUND'});if(status==='PAID'){const employee=await User.findById(row.userId).populate('shiftId','name startTime endTime graceMinutes').lean();const payroll=await calculateAttendanceDeduction(row,employee);row.attendanceDeduction=payroll.attendanceDeduction;row.attendanceSummary=payroll.attendanceSummary;row.payrollCalculatedAt=new Date();}row.status=status;row.paidAt=status==='PAID'?new Date():null;await row.save();return sendSuccess(res,{message:status==='PAID'?'Salary marked paid and payroll snapshot saved.':'Salary status updated.',data:row});}

async function adjust(req,res){
  if(!canManageSalary(req.user))return sendError(res,{statusCode:403,message:'Only authorized HR admins can adjust salary records.',code:'FORBIDDEN'});
  const row=await Salary.findOne({_id:req.params.id,branchId:req.user.branchId});
  if(!row)return sendError(res,{statusCode:404,message:'Salary record not found in your branch.',code:'NOT_FOUND'});
  if(row.status==='PAID')return sendError(res,{statusCode:409,message:'A paid salary record cannot be edited. Create a correction record through your payroll process.',code:'SALARY_ALREADY_PAID'});
  const {baseSalary,allowances,deductions,bonus,reason}=req.body||{};
  const next={baseSalary:Number(baseSalary??row.baseSalary),allowances:Number(allowances??row.allowances),deductions:Number(deductions??row.deductions),bonus:Number(bonus??row.bonus)};
  if(!String(reason||'').trim()||String(reason).trim().length<3||Object.values(next).some(v=>!Number.isFinite(v)||v<0||v>100000000))return sendError(res,{statusCode:400,message:'Provide valid non-negative salary amounts and a reason for the adjustment.',code:'VALIDATION_ERROR'});
  row.adjustmentHistory.push({changedBy:req.user.id,changedAt:new Date(),reason:String(reason).trim().slice(0,500),previous:{baseSalary:row.baseSalary,allowances:row.allowances,deductions:row.deductions,bonus:row.bonus},updated:next});
  row.baseSalary=next.baseSalary;row.allowances=next.allowances;row.deductions=next.deductions;row.bonus=next.bonus;row.notes=String(reason).trim().slice(0,1000);await row.save();
  return sendSuccess(res,{message:'Salary adjustment saved with history.',data:{...row.toObject(),netSalary:row.netSalary}});
}
module.exports={list,create,updateStatus,adjust};
