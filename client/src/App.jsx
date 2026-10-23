import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderKanban, Activity, ArrowDownRight, ArrowUpRight, ArrowLeft, Building2, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, Download, FileText, Fingerprint, LayoutDashboard, LogOut, Menu, Plus, Settings2, Users, X, MapPin, LoaderCircle, BriefcaseBusiness, CheckCircle2, AlertCircle, MoreHorizontal, Sparkles, CalendarCheck, UserRoundCog, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { api, login, logout, restoreSession, getAccessToken, downloadFile } from './lib/api';

const nav = [
  { label: 'WORKSPACE', items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'employees', label: 'Employees', icon: Users, count: '128' }, { id: 'branches', label: 'Branches', icon: Building2 }, { id: 'attendance', label: 'Attendance', icon: Fingerprint }, { id: 'calendar', label: 'Calendar', icon: CalendarDays }, { id: 'leaves', label: 'Time off', icon: CalendarDays }, { id: 'projects', label: 'Projects', icon: FolderKanban }, { id: 'tasks', label: 'Tasks', icon: CheckCircle2 }, { id: 'reviews', label: 'Reviews', icon: ClipboardCheck }, { id: 'salary', label: 'Salary', icon: BriefcaseBusiness }] },
{ label: 'MANAGE', items: [{ id: 'departments', label: 'Departments', icon: BriefcaseBusiness }, { id: 'roles', label: 'Job titles', icon: ShieldCheck }, { id: 'documents', label: 'Documents', icon: FileText }, { id: 'settings', label: 'Settings', icon: Settings2 }] }];
function canAccessPage(user, page) {
  if (user?.role === 'SUPER_ADMIN')
    return ['overview', 'branches', 'employees', 'roles', 'settings'].includes(page);
  const permissions = user.permissions || [];
  const permissionPages = {
    branches: ['branch.view'],
    employees: ['employee.view', 'employee.create', 'employee.update'],
    tasks: ['task.view', 'task.assign', 'task.submit', 'task.review'],
    reviews: ['task.review'],
    attendance: ['attendance.self', 'attendance.view', 'attendance.manage'],
    calendar: ['calendar.view', 'calendar.manage'],
    leaves: ['leave.apply', 'leave.view', 'leave.approve'],
    projects: ['project.view', 'project.manage'],
    departments: ['department.view', 'department.create'],
    roles: ['role.create'],
    documents: ['document.upload', 'document.view', 'document.verify', 'project.manage'],
    salary: ['employee.salary.view', 'employee.salary.manage']
  };
  if (page === 'overview')
    return ['branch.view', 'employee.view', 'attendance.view', 'leave.view'].every(permission => permissions.includes(permission));
  if (page === 'roles') return user.role === 'BRANCH_ADMIN' && permissions.includes('role.create');
  if (page === 'settings') return true;
  return permissionPages[page]?.some(permission => permissions.includes(permission)) || false;
}
const initials = user => `${user?.firstName?.[0] || 'A'}${user?.lastName?.[0] || ''}`.toUpperCase();
const niceDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

import LoginPage from './pages/LoginPage.jsx';
import Overview from './pages/Overview.jsx';
import Branches from './pages/Branches.jsx';
import Employees from './pages/Employees.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import Leaves from './pages/Leaves.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import RolesPage from './pages/RolesPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import ReviewsPage from './pages/ReviewsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import SalaryPage from './pages/SalaryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Modal from './pages/Modal.jsx';
import { roleLabel, pageLabel, heading, subheading, canManage, titleCase } from './utils/labels.js';

function App() {
  const [user, setUser] = useState(null); const [page, setPage] = useState('overview'); const [mobileOpen, setMobileOpen] = useState(false); const [booting, setBooting] = useState(true); const [notice, setNotice] = useState(null);
  const pageHistory = useRef([]); const [historySize, setHistorySize] = useState(0); const [profileOpen, setProfileOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState(''); const [loginPassword, setLoginPassword] = useState(''); const [loginBusy, setLoginBusy] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(''); const [summary, setSummary] = useState(null); const [employees, setEmployees] = useState([]); const [branches, setBranches] = useState([]); const [attendance, setAttendance] = useState([]); const [leaves, setLeaves] = useState([]); const [tasks, setTasks] = useState([]); const [reviews, setReviews] = useState([]); const [projects, setProjects] = useState([]); const [selectedProject, setSelectedProject] = useState(null); const [salaries, setSalaries] = useState([]); const [departments, setDepartments] = useState([]); const [roles, setRoles] = useState([]); const [documents, setDocuments] = useState([]); const [loading, setLoading] = useState(false); const [modal, setModal] = useState(null); const [query, setQuery] = useState('');
  const notify = useCallback((message, type = 'success') => { setNotice({ message, type }); window.setTimeout(() => setNotice(null), 3600); }, []);
  const loadData = useCallback(async (section = page) => {
    if (!getAccessToken()) return;
    setLoading(true);
    try {
      if (section === 'overview') { const r = await api('/dashboard/summary'); setSummary(r.data); }
      if (section === 'branches') { const r = await api('/branches'); setBranches(r.data || []); }
      if (section === 'employees') { const r = await api(`/employees?limit=100${selectedBranchId ? `&branchId=${encodeURIComponent(selectedBranchId)}` : ''}`); setEmployees(r.data || []); }
      if (section === 'attendance') { const r = await api('/attendance'); setAttendance(r.data || []); }
      if (section === 'calendar' && user?.permissions?.includes('calendar.manage')) { const e = await api('/employees?limit=100'); setEmployees(e.data || []); }
      if (section === 'leaves') { const r = await api('/leaves'); setLeaves(r.data || []); }
      if (section === 'tasks') { const r = await api('/tasks'); setTasks(r.data || []); const pr = await api('/projects'); setProjects(pr.data || []); if (user?.permissions?.some(p => ['task.assign','task.review'].includes(p))) { const e = await api('/employees?limit=100'); setEmployees(e.data || []); } else setEmployees([]); }
      if (section === 'reviews') { const r = await api('/tasks/reviews'); setReviews(r.data || []); }
      if (section === 'projects') { const pr = await api('/projects'); setProjects(pr.data || []); if (user?.role !== 'EMPLOYEE' && user?.role !== 'SUPER_ADMIN') { const e = await api('/employees?limit=100'); setEmployees(e.data || []); } }
      if (section === 'salary') { const r = await api('/salaries'); setSalaries(r.data || []); if (user?.permissions?.includes('employee.salary.manage') && user?.permissions?.includes('employee.view')) { const e = await api('/employees?limit=100'); setEmployees(e.data || []); } else setEmployees([]); }
      if (section === 'departments') { const r = await api('/departments'); setDepartments(r.data || []); }
      if (section === 'roles') { const r = await api('/roles'); setRoles(r.data || []); if (user?.permissions?.includes('role.create')) { const e = await api('/employees?limit=100'); setEmployees(e.data || []); } }
      if (section === 'documents') { const r = await api('/documents'); setDocuments(r.data || []); }
    } catch (e) { notify(e.message, 'error'); }
    finally { setLoading(false); }
  }, [page, notify, user, selectedBranchId]);
  useEffect(() => { (async () => { const session = await restoreSession(); if (session?.user) { setUser(session.user); if (session.user.role === 'EMPLOYEE') setPage('tasks'); } setBooting(false); })(); }, []);
  useEffect(() => { if (user && !canAccessPage(user, page)) { setPage(canAccessPage(user, 'tasks') ? 'tasks' : 'settings'); return; } if (user) loadData(page); }, [user, page, loadData]);
  async function submitLogin(e) { e.preventDefault(); setLoginBusy(true); try { const data = await login(loginEmail, loginPassword); pageHistory.current = []; setHistorySize(0); setUser(data.user); setPage(data.user.role === 'EMPLOYEE' ? 'tasks' : 'overview'); notify(`Welcome back, ${data.user.firstName}.`); } catch (err) { notify(err.message, 'error'); } finally { setLoginBusy(false); } }
  async function signOut() { await logout(); setUser(null); setSummary(null); pageHistory.current = []; setHistorySize(0); setProfileOpen(false); setPage('overview'); }
  function navigate(id, { preserveBranchSelection = false, preserveProject = false } = {}) { if (id !== page) { pageHistory.current.push(page); setHistorySize(pageHistory.current.length); } if (id === 'employees' && user?.role === 'SUPER_ADMIN' && !preserveBranchSelection) setSelectedBranchId(''); if (id === 'tasks' && !preserveProject) setSelectedProject(null); setPage(id); setMobileOpen(false); setQuery(''); }
  function navigateBack() { const previousPage = pageHistory.current.pop(); if (previousPage) { setHistorySize(pageHistory.current.length); setPage(previousPage); setQuery(''); } }
  const profileBranch = branches.find(branch => String(branch._id || branch.id) === String(user?.branchId));
  if (booting) return <div className="boot-screen"><div className="brand-mark"><Command size={23}/></div><LoaderCircle className="spin" size={22}/><span>Preparing your workspace</span></div>;
  if (!user) return <LoginPage email={loginEmail} setEmail={setLoginEmail} password={loginPassword} setPassword={setLoginPassword} onSubmit={submitLogin} busy={loginBusy} notice={notice} />;
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark brand-letter">B</div><div className="brand-word">Bugsbon<span>HRMS</span><small>PEOPLE WORKSPACE</small></div><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      {user.role !== 'EMPLOYEE' && <div className="org-switch"><div className="org-symbol">B</div><div className="org-copy"><strong>Bugsbon HRMS</strong><span>People workspace</span></div><ChevronDown size={16} className="muted-icon"/></div>}
      <div className="nav-scroll">{nav.map(group => { const visibleItems = group.items.filter(item => canAccessPage(user, item.id)
         ); return visibleItems.length ? <div className="nav-group" key={group.label}><div className="nav-label">{user.role === 'EMPLOYEE' ? 'MY WORK' : group.label}</div>{visibleItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={18} strokeWidth={1.8}/><span>{item.id === 'branches' && user.role === 'BRANCH_ADMIN' ? 'My Branch' : item.id === 'leaves' && user.role === 'EMPLOYEE' ? 'Apply for leave' : item.label}</span>{item.count && <small>{item.count}</small>}{page === item.id && <i/>}</button>)}</div> : null; })}</div>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><strong>Need a hand?</strong><span>Visit our help center</span></div><ArrowUpRight size={15}/></div><div className="sidebar-user"><div className="avatar avatar-indigo">{initials(user)}</div><div className="user-copy"><strong>{user.firstName} {user.lastName}</strong><span>{user.customRoleName || roleLabel(user.role)}</span></div><button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageLabel(page)}</strong></div></div><div className="topbar-right"><button className="top-profile" onClick={() => setProfileOpen(true)} title="View profile"><div className="avatar avatar-indigo">{initials(user)}</div><ChevronDown size={14}/></button></div></header>
      <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> PEOPLE & OPERATIONS</div><h1>{heading(page, user)}</h1><p>{subheading(page)}</p></div><div className="heading-actions">{historySize > 0 && <button className="button button-quiet" onClick={navigateBack}><ArrowLeft size={16}/> Back</button>}<button className="button button-quiet" onClick={() => loadData(page)}><Activity size={16}/> Refresh</button>{(page === 'branches' || page === 'employees' || page === 'leaves') && canManage(user, page) && <button className="button button-primary" onClick={() => setModal(page)}><Plus size={17}/>{page === 'branches' ? 'Add branch' : page === 'employees' ? 'Add employee' : 'Request time off'}</button>}</div></div>
        {page === 'overview' && user.role !== 'EMPLOYEE' && <Overview summary={summary} user={user} leaves={summary?.recentLeaves || []} loading={loading} onNavigate={navigate} />}
        {page === 'branches' && <Branches branches={branches} loading={loading} query={query} user={user} onAdd={() => setModal('branches')} onViewEmployees={b => { setSelectedBranchId(b._id); navigate('employees', { preserveBranchSelection: true }); }} />}
        {page === 'employees' && <Employees employees={employees} loading={loading} query={query} user={user} notify={notify} onRefresh={() => loadData('employees')} />}
        {page === 'attendance' && <AttendancePage records={attendance} loading={loading} user={user} notify={notify} onRefresh={() => loadData('attendance')} />}
        {page === 'calendar' && <CalendarPage user={user} employees={employees} notify={notify} />}
        {page === 'leaves' && <Leaves leaves={leaves} loading={loading} query={query} user={user} onDecision={async (id, status) => { try { await api(`/leaves/${id}/decision`, { method: 'PATCH', body: JSON.stringify({ status }) }); notify(`Request ${status.toLowerCase()}.`); loadData('leaves'); } catch (e) { notify(e.message, 'error'); } }} />}
        {page === 'projects' && <ProjectsPage projects={projects} employees={employees} user={user} loading={loading} notify={notify} onRefresh={() => loadData('projects')} onOpenTasks={(project) => { setSelectedProject(project); navigate('tasks', { preserveProject: true }); }} />}
        {page === 'tasks' && <TasksPage tasks={tasks} employees={employees} projects={projects} selectedProject={selectedProject} user={user} loading={loading} notify={notify} onRefresh={() => loadData('tasks')} />}
        {page === 'reviews' && <ReviewsPage reviews={reviews} loading={loading} notify={notify} onRefresh={() => loadData('reviews')} />}
        {page === 'salary' && <SalaryPage salaries={salaries} user={user} loading={loading} notify={notify} employees={employees} onRefresh={() => loadData('salary')} />}
        {page === 'departments' && <DepartmentsPage rows={departments} user={user} loading={loading} notify={notify} onRefresh={() => loadData('departments')} />}
        {page === 'roles' && <RolesPage rows={roles} employees={employees} user={user} loading={loading} notify={notify} onRefresh={() => loadData('roles')} />}
        {page === 'documents' && <DocumentsPage documents={documents} user={user} loading={loading} notify={notify} onRefresh={() => loadData('documents')} />}
        {page === 'settings' && <SettingsPage user={user} notify={notify} />} 
        <footer className="footer"><span>© 2026 Bugsbon HRMS · People, thoughtfully managed.</span><span><span className="live-dot"/> All systems operational <span className="footer-sep">·</span> v1.0.0</span></footer>
      </div>
    </main>
    {profileOpen && (
      <div className="profile-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
        <section className="profile-card" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <header className="profile-card-header">
            <div><span className="eyebrow">ACCOUNT</span><h2 id="profile-title">Profile information</h2></div>
            <button className="icon-button" onClick={() => setProfileOpen(false)} aria-label="Close profile"><X size={18}/></button>
          </header>
          <div className="profile-card-identity"><div className="avatar avatar-indigo">{initials(user)}</div><div><strong>{user.firstName} {user.lastName}</strong><span>{user.customRoleName || roleLabel(user.role)}</span></div></div>
          <dl className="profile-info-grid">
            <div><dt>Email</dt><dd>{user.email || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{user.phone || '—'}</dd></div>
            <div><dt>Role</dt><dd>{roleLabel(user.role)}</dd></div>
            <div><dt>Employee code</dt><dd>{user.employeeCode || '—'}</dd></div>
            <div><dt>Status</dt><dd>{titleCase(user.status || 'ACTIVE')}</dd></div>
            <div><dt>Joining date</dt><dd>{niceDate(user.joiningDate)}</dd></div>
            {profileBranch && (
              <div className="profile-info-wide"><dt>Branch</dt><dd>{profileBranch.name} {profileBranch.branchCode ? `· ${profileBranch.branchCode}` : ''}</dd></div>
            )}
          </dl>
          {user.role === 'BRANCH_ADMIN' && <p className="profile-readonly-note">Branch Admin profile details are read-only.</p>}
        </section>
      </div>
    )}
    {modal && <Modal type={modal} user={user} branches={branches} onClose={() => setModal(null)} onSuccess={(message) => { setModal(null); notify(message); loadData(modal); }} />}
    {notice && <div className={`toast ${notice.type}`}><span className="toast-symbol">{notice.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}</span>{notice.message}<button onClick={() => setNotice(null)}><X size={16}/></button></div>}
  </div>;
}

export default App;
