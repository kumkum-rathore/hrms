const Attendance = require('../models/Attendance');
const BranchHoliday = require('../models/BranchHoliday');
const LeaveRequest = require('../models/LeaveRequest');

function monthDates(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    return `${month}-${String(day).padStart(2, '0')}`;
  });
}

function isWeekend(dateKey) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function todayInKolkata() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function wasLateForHalfDay(record, shift) {
  if (!record || !record.checkInAt || !shift) return false;
  const [shiftHour, shiftMinute] = shift.startTime.split(':').map(Number);
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(record.checkInAt);
  const [checkInHour, checkInMinute, checkInSecond] = localTime.split(':').map(Number);
  let secondsLate =
    checkInHour * 3600 + checkInMinute * 60 + checkInSecond -
    (shiftHour * 3600 + shiftMinute * 60);
  const [endHour, endMinute] = shift.endTime.split(':').map(Number);
  if (
    endHour * 60 + endMinute < shiftHour * 60 + shiftMinute &&
    checkInHour * 60 + checkInMinute < endHour * 60 + endMinute
  )
    secondsLate += 24 * 60 * 60;
  return secondsLate > (shift.graceMinutes ?? 120) * 60;
}

async function calculateAttendanceDeduction(salary, employee, context) {
  const dates = monthDates(salary.month);
  const monthStart = dates[0];
  const monthEnd = dates[dates.length - 1];
  const userId = salary.userId?._id || salary.userId;
  if (!userId) {
    const monthlyNet = Math.max(
      0,
      salary.baseSalary + salary.allowances + salary.bonus - salary.deductions
    );
    return {
      attendanceDeduction: 0,
      payableSalary: monthlyNet,
      attendanceSummary: {
        scheduledWorkingDays: 0,
        absentDays: 0,
        leaveDays: 0,
        halfDays: 0
      },
      shiftMissing: true
    };
  }
  const [holidays, attendance, leaves] = context
    ? [context.holidays, context.attendanceByUser.get(String(userId)) || [], context.leavesByUser.get(String(userId)) || []]
    : await Promise.all([
        BranchHoliday.find({
          branchId: salary.branchId,
          date: { $gte: monthStart, $lte: monthEnd }
        })
          .select('date')
          .lean(),
        Attendance.find({
          userId,
          workDate: { $gte: monthStart, $lte: monthEnd }
        })
          .select('workDate status checkInAt')
          .lean(),
        LeaveRequest.find({
          userId,
          branchId: salary.branchId,
          status: 'APPROVED',
          startDate: { $lte: new Date(`${monthEnd}T23:59:59.999Z`) },
          endDate: { $gte: new Date(`${monthStart}T00:00:00.000Z`) }
        })
          .select('startDate endDate')
          .lean()
      ]);

  const holidayDates = new Set(holidays.map(holiday => holiday.date));
  const attendanceByDate = new Map(
    attendance.map(record => [record.workDate, record])
  );
  const leaveDates = new Set();
  const joiningDate = employee?.joiningDate ? dateKey(employee.joiningDate) : monthStart;
  const today = todayInKolkata();
  const currentMonth = today.slice(0, 7);
  const throughDate = salary.month < currentMonth
    ? monthEnd
    : salary.month > currentMonth
      ? ''
      : today;

  for (const leave of leaves) {
    const first = dateKey(leave.startDate);
    const last = dateKey(leave.endDate);
    for (const date of dates) {
      if (date >= first && date <= last) leaveDates.add(date);
    }
  }

  const scheduledDates = dates.filter(
    date => !isWeekend(date) && !holidayDates.has(date)
  );
  let absentDays = 0;
  let leaveDays = 0;
  let halfDays = 0;

  if (employee?.shiftId) {
    for (const date of scheduledDates) {
      if (!throughDate || date > throughDate || date < joiningDate) continue;
      const record = attendanceByDate.get(date);
      const status = record?.status;
      if (record && (status === 'HALF_DAY' || wasLateForHalfDay(record, employee.shiftId))) {
        halfDays += 1;
      } else if (status === 'PRESENT') {
        continue;
      } else if (leaveDates.has(date)) {
        leaveDays += 1;
      } else if (
        status === 'ABSENT' ||
        (!status && (salary.month !== currentMonth || date < throughDate))
      ) {
        absentDays += 1;
      }
    }
  }

  const monthlyNet = Math.max(
    0,
    salary.baseSalary + salary.allowances + salary.bonus - salary.deductions
  );
  const dailyRate = scheduledDates.length ? monthlyNet / scheduledDates.length : 0;
  const deduction = Math.min(
    monthlyNet,
    dailyRate * (absentDays + leaveDays + halfDays * 0.5)
  );

  return {
    attendanceDeduction: Math.round(deduction * 100) / 100,
    payableSalary: Math.round((monthlyNet - deduction) * 100) / 100,
    attendanceSummary: {
      scheduledWorkingDays: scheduledDates.length,
      absentDays,
      leaveDays,
      halfDays
    },
    shiftMissing: !employee?.shiftId
  };
}

async function calculateAttendanceDeductions(salaries) {
  const groups = new Map();
  for (const salary of salaries) {
    if (!groups.has(salary.month)) groups.set(salary.month, []);
    groups.get(salary.month).push(salary);
  }

  const contexts = new Map(
    await Promise.all([...groups.entries()].map(async ([month, rows]) => {
      const dates = monthDates(month);
      const userIds = rows
        .map(row => row.userId?._id || row.userId)
        .filter(Boolean);
      const query = {
        $in: userIds
      };
      const [holidays, attendance, leaves] = await Promise.all([
        BranchHoliday.find({
          branchId: rows[0].branchId,
          date: { $gte: dates[0], $lte: dates[dates.length - 1] }
        })
          .select('date')
          .lean(),
        Attendance.find({
          userId: query,
          workDate: { $gte: dates[0], $lte: dates[dates.length - 1] }
        })
          .select('userId workDate status checkInAt')
          .lean(),
        LeaveRequest.find({
          userId: query,
          branchId: rows[0].branchId,
          status: 'APPROVED',
          startDate: { $lte: new Date(`${dates[dates.length - 1]}T23:59:59.999Z`) },
          endDate: { $gte: new Date(`${dates[0]}T00:00:00.000Z`) }
        })
          .select('userId startDate endDate')
          .lean()
      ]);

      const byUser = records => records.reduce((map, record) => {
        const key = String(record.userId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(record);
        return map;
      }, new Map());

      return [
        month,
        {
          holidays,
          attendanceByUser: byUser(attendance),
          leavesByUser: byUser(leaves)
        }
      ];
    }))
  );

  return Promise.all(salaries.map(salary =>
    calculateAttendanceDeduction(
      salary,
      salary.userId,
      contexts.get(salary.month)
    )
  ));
}

module.exports = { calculateAttendanceDeduction, calculateAttendanceDeductions };