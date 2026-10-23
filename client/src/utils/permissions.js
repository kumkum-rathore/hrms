const PERMISSION_OPTIONS = [
  ['branch.view', 'View branch details'],
  ['employee.view', 'View employees'],
  ['employee.create', 'Create employees'],
  ['employee.update', 'Edit employees'],
  ['employee.salary.view', 'View salary records'],
  ['employee.salary.manage', 'Manage salary records'],
  ['task.view', 'View tasks'],
  ['task.assign', 'Assign tasks'],
  ['task.submit', 'Submit assigned tasks'],
  ['task.review', 'Review task submissions'],
  ['attendance.view', 'View branch attendance'],
  ['attendance.self', 'View own attendance'],
  ['attendance.manage', 'Manage attendance'],
  ['leave.apply', 'Apply for leave'],
  ['leave.view', 'View leave requests'],
  ['leave.approve', 'Approve/reject leave requests'],
  ['document.upload', 'Upload documents'],
  ['document.view', 'View branch documents'],
  ['document.verify', 'Verify documents'],
  ['calendar.view', 'View calendar and shifts'],
  ['calendar.manage', 'Manage holidays and shifts'],
  ['department.create', 'Manage departments'],
  ['department.view', 'View departments'],
  ['role.create', 'Create and assign custom roles'],
  ['project.view', 'View projects'],
  ['project.manage', 'Manage projects']
];

const EMPLOYEE_DEFAULT_PERMISSIONS = [
  'task.view',
  'task.submit',
  'attendance.self',
  'leave.apply',
  'employee.salary.view',
  'document.upload',
  'calendar.view'
];

export { PERMISSION_OPTIONS, EMPLOYEE_DEFAULT_PERMISSIONS };
