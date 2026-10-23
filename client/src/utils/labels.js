const initials = user => `${user?.firstName?.[0] || 'A'}${user?.lastName?.[0] || ''}`.toUpperCase();
const niceDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function roleLabel(role) { return ({ SUPER_ADMIN: 'Super administrator', BRANCH_ADMIN: 'Branch administrator', HOD: 'Department head', TEAM_LEAD: 'Team lead', EMPLOYEE: 'Employee' })[role] || role; }
function pageLabel(page) { return ({ overview: 'Overview', employees: 'Employees', branches: 'Branches', attendance: 'Attendance', calendar: 'Calendar', leaves: 'Time off', projects: 'Projects', tasks: 'Tasks', reviews: 'Reviews', salary: 'Salary', departments: 'Departments', documents: 'Documents', roles: 'Job titles', settings: 'Settings' })[page] || 'Overview'; }
function heading(page, user) { return ({ overview: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user.firstName}.`, employees: 'Your people, at a glance.', branches: user.role === 'BRANCH_ADMIN' ? 'Your branch, in one place.' : 'Every location, connected.', attendance: 'Time, tracked thoughtfully.', calendar: 'Holidays and shifts, in one place.', leaves: 'A little time to recharge.', projects: 'Projects with clear ownership and delivery.', tasks: 'Work moves forward, together.', reviews: 'Review work sent to you.', salary: 'Clear and consistent compensation.', departments: 'Teams that make it happen.', documents: 'Everything in its place.', roles: 'Job titles for your branch.', settings: 'Make Bugsbon work for you.' })[page]; }
function subheading(page) { return ({ overview: 'Here’s what’s happening across your workspace today.', employees: 'Manage your team, roles and employee information in one place.', projects: 'Plan projects, manage client details and track team delivery.', tasks: 'View your assignments and track your progress.', reviews: 'Review submissions in a separate place from your assigned tasks.', salary: 'Manage monthly salary records and view your own pay.', branches: 'View only the branch details available to your account.', attendance: 'Keep track of arrivals, departures and today’s attendance.', calendar: 'See branch holidays and assigned shifts. Holidays and weekends are excluded from attendance-based salary calculations.', leaves: 'Review requests and keep everyone in the loop.', departments: 'Organize people around the work they do.', documents: 'Employee documents and important records, together.', settings: 'Manage your account and workspace preferences.', roles: 'Create branch job titles; select permissions separately for each employee.' })[page]; }
function canManage(user, page) {
  if (page === 'branches') return user.role === 'SUPER_ADMIN';
  if (page === 'employees') return user.permissions?.includes('employee.create');
  if (page === 'leaves') return user.permissions?.includes('leave.apply');
  return false;
}
function titleCase(value = '') { return String(value).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export { roleLabel, pageLabel, heading, subheading, canManage, titleCase, initials, niceDate };
