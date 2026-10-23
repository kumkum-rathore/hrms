# Frontend structure — Hinglish guide

## Kis file mein kya change karna hai?

- `client/src/App.jsx`: sidebar/navigation, login session, page selection aur overall layout.
- `client/src/pages/LoginPage.jsx`: login screen ka design.
- `client/src/pages/Overview.jsx`: dashboard cards aur overview.
- `client/src/pages/Branches.jsx`: branches ki listing.
- `client/src/pages/Employees.jsx`: employees ki listing.
- `client/src/pages/AttendancePage.jsx`: attendance/check-in/check-out page.
- `client/src/pages/Leaves.jsx`: leave requests.
- `client/src/pages/TasksPage.jsx`: task assign, checklist, submission aur review UI.
- `client/src/pages/SalaryPage.jsx`: salary records aur adjustment UI.
- `client/src/pages/DepartmentsPage.jsx`: department management.
- `client/src/pages/DocumentsPage.jsx`: documents.
- `client/src/pages/RolesPage.jsx`: branch job-title roles.
- `client/src/pages/SettingsPage.jsx`: password update.
- `client/src/pages/Modal.jsx`: branch, employee aur leave create forms.
- `client/src/components/common.jsx`: common reusable UI components.
- `client/src/utils/labels.js`: page names, role labels, date formatting helpers.
- `client/src/styles.css`: colors, spacing, responsive layout, buttons, tables, forms.

## Local run

1. `server/.env` mein MongoDB URI aur secrets configure karo.
2. `server` folder mein `npm install`, phir `npm run dev`.
3. `client` folder mein `npm install`, phir `npm run dev`.
4. Client `.env` mein `VITE_API_URL` ko backend API base URL par set karo.

Page ka UI badalne ke liye usi page ki JSX file edit karo. API endpoint/validation badalne ke liye `server/src/routes/` aur `server/src/controllers/` check karo. Permission rules sirf frontend hide/show se secure nahi hote; backend middleware/controller checks bhi zaroori hain.
