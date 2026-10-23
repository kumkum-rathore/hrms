# Bugsbon HRMS — MERN HRMS

Responsive React/Vite frontend and versioned Express/MongoDB REST API for branch-scoped HR operations. The same `/api/v1` API can be reused by a future Android/iOS client.

## Implemented modules

- Secure login, short-lived access JWT, HttpOnly refresh cookie/session rotation, password change and rate limiting.
- Superadmin branch creation and branch directory; branch creation also creates the initial Branch Admin account.
- Branch-scoped employee onboarding with initial password, joining date, experience details, optional experience-document upload and initial monthly salary record. Leaving date remains empty until an authorized branch admin records an exit.
- Departments, branch-scoped job-title roles and an explicit employee permission catalogue.
- Project portfolio with client/contact details, project timelines, priority/status, active team membership and task summary metrics. Branch Admin/Subadmin creates projects; authorized HODs/Team Leads assign tasks within their branch.
- Professional task management with project-linked assignments, progress percentage, estimated/actual hours, work logs, checklist, private attachments (PDF/images/DOCX/XLSX/ZIP/APK), manager approval and change-request/re-submit cycle.
- Office geofence attendance check-in/check-out, leave requests and approval, monthly salary records/status, private employee document uploads and verification.
- Responsive dashboard, employees/branches/attendance/leaves/projects/tasks/salary/departments/documents/roles/settings views.
- API docs and Postman collection under `docs/`.

## Local setup

Requirements: Node.js 20.19+ recommended, npm, MongoDB local or Atlas.

### 1. Server

```powershell
cd server
Copy-Item .env.example .env
npm install
```

Set `MONGODB_URI`, `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_PEPPER` in `server/.env` to unique secret values (at least 32 characters for secrets). Keep `.env` private.

Create the first Superadmin using temporary values in `.env`:

```text
BOOTSTRAP_ADMIN_NAME=System Admin
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=Use-A-Unique-Password-Here-123!
```

Then run:

```powershell
npm run create-super-admin
npm run dev
```

Remove `BOOTSTRAP_ADMIN_*` values after bootstrap. Health endpoint: `http://localhost:5000/api/v1/health`.

### 2. Frontend (second terminal)

```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with the Superadmin account. Superadmin can create a branch and the first Branch Admin together. Branch Admin then creates departments, roles and employees, creates projects and adds active team members. HOD/Team Lead assigns project tasks; employees log progress and hours, submit work, and receive review feedback.

## Project and task workflow\n\n1. Sign in as a Branch Admin and open **Projects**. Create a project, add its client details, dates, priority and active team members.\n2. Open the project’s **Task board** and assign work to an active employee. HOD/Team Lead accounts can also assign and review tasks within their branch.\n3. Employees open **Tasks**, update progress and log hours/notes, then submit their work with optional attachments.\n4. HOD/Team Lead/Branch Admin reviews submissions, approves them or requests changes. Project progress counts approved tasks; overdue tasks are highlighted.\n5. Projects with linked tasks cannot be deleted, preserving work history; mark them Completed or Cancelled instead.\n\n## Role boundaries

- **Superadmin:** branch directory and branch creation. Employee HR data, tasks, attendance, leave and salary endpoints are blocked.
- **Branch Admin:** manages their own branch's departments, employee onboarding, salary and branch operations.
- **HOD / Team Lead:** can manage/review permitted team workflows; branch scope is enforced by the API.
- **Employee:** can access their own attendance, leave, salary and documents, and their assigned tasks.
- Employee permissions are stored on each employee account and checked by the relevant module handlers. Continue to apply least privilege when adding new endpoints.

## API surface

- `/api/v1/auth` — login, refresh, logout, current user
- `/api/v1/branches` — list/create branch (Superadmin create)
- `/api/v1/employees` — list/create/update employee lifecycle
- `/api/v1/departments`, `/api/v1/roles` — departments and branch-scoped job-title roles
- `/api/v1/tasks` — task assignment, progress, submission, review
- `/api/v1/attendance`, `/api/v1/leaves` — attendance and leave workflow
- `/api/v1/salaries` — monthly salary records and status
- `/api/v1/documents`, `/api/v1/uploads` — private uploads, metadata and authorized download
- `/api/v1/account` — password change and role assignment

## Important notes

This is a functional starter implementation, not a guarantee of zero bugs or production certification. Dependency installation, MongoDB integration, end-to-end workflows, security review and deployment were not fully executable in the generation environment. Test in a development database before real use. For production, use private object storage, malware scanning, audit logs, backups, MFA/password recovery, HTTPS, strict CORS, monitoring and a reviewed payroll/legal process. Local uploaded files are stored under `server/private-uploads` and must never be served as public static assets. GPS geofencing is not proof against spoofed locations.


### Branch isolation
Superadmin can create branches and view all branch records. A Branch Admin sees only their own assigned branch and cannot create branches. Branch Admins can create departments and custom roles only within their own branch; the API enforces this scope server-side.


## Role and branch rules (current)
- Superadmin can create branches and view all branches and the basic employee directory. Superadmin cannot create employees, departments, or roles and cannot view salary records.
- Branch Admin can see only their own branch and create departments, custom roles, and employees for that branch. The Branch Admin sets initial passwords for employees.
- When creating a branch, Superadmin sets the Branch Admin account's initial password.
- Job titles such as Manager, HOD, Developer, and Tester are branch-created custom roles. Roles are labels only; permissions are chosen for each employee during employee creation.
- Monthly salary records support basic salary changes with an adjustment reason and history. Employee salary views are scoped to the signed-in employee; Branch Admin salary views are scoped to their branch.


## Latest workflow additions
- Superadmin can update branch details with `PATCH /api/v1/branches/:id`; branch deletion is guarded and only allowed when no users remain linked.
- Clicking a branch name in the Superadmin branch directory opens the employee directory filtered to that branch.
- Branch Admin can deactivate an employee with `DELETE /api/v1/employees/:id`; this preserves HR history rather than hard-deleting related records.
- Tasks support optional checklist items; employees can check items off and task progress is calculated from checklist completion.
- Updated Postman collection includes these additional requests.

Note: This build has static syntax/integrity checks only. Run the frontend build and test against a non-production database before deployment.

## Frontend folder structure (editable modules)

The React frontend is split by page so future UI changes can be made without editing one large App file:

- `client/src/pages/LoginPage.jsx` — sign-in screen
- `client/src/pages/Overview.jsx` — dashboard
- `client/src/pages/Branches.jsx` — branch directory
- `client/src/pages/Employees.jsx` — employee directory
- `client/src/pages/AttendancePage.jsx` — attendance and check-in/out
- `client/src/pages/Leaves.jsx` — leave requests
- `client/src/pages/TasksPage.jsx` — task assignment, checklist, submission and review
- `client/src/pages/SalaryPage.jsx` — salary records and adjustments
- `client/src/pages/DepartmentsPage.jsx` — department management
- `client/src/pages/DocumentsPage.jsx` — document upload and verification
- `client/src/pages/RolesPage.jsx` — branch job-title roles
- `client/src/pages/SettingsPage.jsx` — account password settings
- `client/src/pages/Modal.jsx` — create branch, employee, or leave modal
- `client/src/components/common.jsx` — reusable form field, status, empty and loading components
- `client/src/utils/labels.js` — shared labels and date/name helpers
- `client/src/App.jsx` — application shell, navigation, auth state, and page routing

To customize a page, edit its corresponding file under `client/src/pages/`. Shared styling is in `client/src/styles.css`.
