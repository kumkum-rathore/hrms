const PERMISSION_KEYS = [
  'branch.view',
  'employee.view',
  'employee.create',
  'employee.update',
  'employee.salary.view',
  'employee.salary.manage',
  'task.view',
  'task.assign',
  'task.submit',
  'task.review',
  'attendance.view',
  'attendance.self',
  'attendance.manage',
  'leave.apply',
  'leave.view',
  'leave.approve',
  'document.upload',
  'document.view',
  'document.verify',
  'calendar.view',
  'calendar.manage',
  'department.create',
  'department.view',
  'role.create',
  'project.view',
  'project.manage'
];

function hasPermission(user, permission) {
  return user?.role === 'SUPER_ADMIN' ||
    user?.role === 'BRANCH_ADMIN' && user.permissions?.includes(permission) ||
    user?.permissions?.includes(permission);
}

function validatePermissionList(permissions) {
  return Array.isArray(permissions) &&
    permissions.every(permission =>
      typeof permission === 'string' && PERMISSION_KEYS.includes(permission)
    );
}

module.exports = { PERMISSION_KEYS, hasPermission, validatePermissionList };
