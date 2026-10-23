// import React, { useEffect, useState } from 'react';
// import { Activity, ArrowDownRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, Download, FileText, Fingerprint, LayoutDashboard, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, Users, X, MapPin, LoaderCircle, BriefcaseBusiness, CheckCircle2, AlertCircle, Moon, MoreHorizontal, Sparkles, CalendarCheck, UserRoundCog, ArrowUpRight as ArrowUpRightIcon } from 'lucide-react';
// import { api, login, logout, restoreSession, getAccessToken, downloadFile } from '../lib/api';
// import { roleLabel, pageLabel, heading, subheading, canManage, titleCase, initials, niceDate } from '../utils/labels.js';
// import { Field, Status, EmptyState, LoadingRows, ComingSoon } from '../components/common.jsx';

// function Employees({ employees, loading, query, user }) { const filtered = employees.filter(e => `${e.firstName} ${e.lastName} ${e.email} ${e.employeeCode} ${e.role}`.toLowerCase().includes(query.toLowerCase())); return <div className="panel data-panel"><div className="panel-heading"><div><h3>All employees</h3><p>Your people directory and account status</p></div><span className="count-pill">{employees.length} people</span></div>{loading ? <LoadingRows/> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th>{user?.role === 'SUPER_ADMIN' && <th>BRANCH</th>}<th>ROLE</th><th>EMPLOYEE ID</th><th>JOINED</th><th>STATUS</th></tr></thead><tbody>{filtered.map(e => <tr key={e.id || e._id}><td><div className="table-person"><div className="avatar avatar-soft">{initials(e)}</div><div><strong>{e.firstName} {e.lastName}</strong><span>{e.email}</span></div></div></td>{user?.role === 'SUPER_ADMIN' && <td>{e.branch?.name || '—'} <span className="table-secondary">{e.branch?.branchCode || ''}</span></td>}<td><span className="role-pill">{e.customRole?.name || roleLabel(e.role)}</span></td><td className="mono">{e.employeeCode || '—'}</td><td>{niceDate(e.joiningDate)}</td><td><Status value={e.status}/></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No matching employees" description="Try a different search or add your first employee."/>}</div>; }

// export default Employees;



import React, { useEffect, useState } from 'react';
import {
  Users,
  Archive,
  X,
  Pencil,
  Trash2,
  Mail,
  CalendarDays,
  Building2,
  BriefcaseBusiness,
  Fingerprint,
  Phone,
  MapPin,
  Save,
  AlertTriangle,
  UserRound,
  Clock,
  FileText,
  Eye,
  UserRoundCheck
} from 'lucide-react';
import { PhoneInput } from '../components/common.jsx';

import { api } from '../lib/api';
import {
  roleLabel,
  initials,
  niceDate
} from '../utils/labels.js';

import {
  Status,
  EmptyState,
  LoadingRows
} from '../components/common.jsx';
import { PERMISSION_OPTIONS } from '../utils/permissions.js';

export default function Employees({
  employees = [],
  loading = false,
  query = '',
  user,
  notify,
  onRefresh
}) {
  const [employeeRows, setEmployeeRows] = useState(employees);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formData, setFormData] = useState({
    phone: '',
    status: 'ACTIVE',
    experienceYears: 0,
    hasPreviousExperience: false,
    previousCompanyName: '',
    previousCompanyLeavingDate: '',
    previousCompanyLeavingReason: '',
    leavingDate: '',
    permissions: []
  });

  const canEdit = user?.permissions?.includes('employee.update');
  const canEditEmployee = employee =>
    canEdit &&
    !(user?.role === 'BRANCH_ADMIN' &&
      String(getEmployeeId(employee)) === String(user.id));

  useEffect(() => {
    setEmployeeRows(employees);
  }, [employees]);

  const departments = [...new Map(employeeRows
    .filter(employee => employee.departmentId)
    .map(employee => {
      const department = employee.departmentId;
      const id = String(department._id || department);
      return [id, { id, name: department.name || 'Department' }];
    })).values()];
  const roles = [...new Set(employeeRows.map(employee =>
    employee.customRole?.name || roleLabel(employee.role)
  ).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const filtered = employeeRows.filter(employee => {
    const searchText = [
      employee.firstName,
      employee.lastName,
      employee.email,
      employee.employeeCode,
      employee.role,
      employee.customRole?.name,
      employee.branch?.name
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const departmentId = employee.departmentId?._id || employee.departmentId;
    const role = employee.customRole?.name || roleLabel(employee.role);
    return searchText.includes(query.toLowerCase()) &&
      `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase().includes(nameFilter.toLowerCase()) &&
      (departmentFilter === 'ALL' || String(departmentId) === departmentFilter) &&
      (roleFilter === 'ALL' || role === roleFilter) &&
      (statusFilter === 'ALL' || employee.status === statusFilter);
  });

  function getEmployeeId(employee) {
    return employee?.id || employee?._id;
  }

  function openDetails(employee, startEditing = false, confirmDeactivate = false) {
    setSelectedEmployee(employee);
    setFormData({
      phone: employee.phone || '',
      status: employee.status || 'ACTIVE',
      experienceYears: employee.experienceYears ?? 0,
      hasPreviousExperience: employee.hasPreviousExperience || false,
      previousCompanyName: employee.previousCompanyName || '',
      previousCompanyLeavingDate: employee.previousCompanyLeavingDate
        ? String(employee.previousCompanyLeavingDate).slice(0, 10)
        : '',
      previousCompanyLeavingReason: employee.previousCompanyLeavingReason || '',
      permissions: employee.permissions || [],
      leavingDate: employee.leavingDate
        ? String(employee.leavingDate).slice(0, 10)
        : ''
    });

    setEditing(startEditing);
    setDeleting(confirmDeactivate);
    setError('');
    setSuccess('');
  }

  function closeDetails() {
    if (saving) return;

    setSelectedEmployee(null);
    setEditing(false);
    setDeleting(false);
    setError('');
    setSuccess('');
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData(previous => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!canEditEmployee(selectedEmployee)) {
      setError('You do not have permission to update employee records.');
      return;
    }

    const id = getEmployeeId(selectedEmployee);

    if (!id) {
      setError('Employee ID is missing.');
      return;
    }

    const experience = Number(formData.experienceYears);

    if (
      !Number.isFinite(experience) ||
      experience < (formData.hasPreviousExperience ? 0.5 : 0) ||
      experience > 70
    ) {
      setError(
        formData.hasPreviousExperience
          ? 'Experience must be between 0.5 and 70 years when previous experience is selected.'
          : 'Experience must be between 0 and 70 years.'
      );
      return;
    }

    if (
      formData.hasPreviousExperience &&
      (!formData.previousCompanyName.trim() ||
        !formData.previousCompanyLeavingDate ||
        !formData.previousCompanyLeavingReason.trim())
    ) {
      setError('Complete all previous experience details.');
      return;
    }

    if (
      formData.status === 'INACTIVE' &&
      !formData.leavingDate &&
      selectedEmployee.leavingDate
    ) {
      // Existing leaving date may be retained.
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        phone: formData.phone,
        status: formData.status,
        experienceYears: experience,
        hasPreviousExperience: formData.hasPreviousExperience,
        previousCompanyName: formData.hasPreviousExperience
          ? formData.previousCompanyName.trim()
          : '',
        previousCompanyLeavingDate: formData.hasPreviousExperience
          ? formData.previousCompanyLeavingDate
          : null,
        previousCompanyLeavingReason: formData.hasPreviousExperience
          ? formData.previousCompanyLeavingReason.trim()
          : '',
        leavingDate: formData.leavingDate || null
      };
      payload.permissions = formData.permissions;

      const result = await api(
        `/employees/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }
      );

      const updatedEmployee = result.data;

      setEmployeeRows(previous =>
        previous.map(employee =>
          String(getEmployeeId(employee)) === String(id)
            ? {
                ...employee,
                ...updatedEmployee,
                id: updatedEmployee.id || employee.id,
                branch: employee.branch,
                customRole: employee.customRole
              }
            : employee
        )
      );

      setSelectedEmployee(previous => ({
        ...previous,
        ...updatedEmployee,
        id: updatedEmployee.id || previous.id,
        branch: previous.branch,
        customRole: previous.customRole
      }));

      setFormData(previous => ({
        ...previous,
        phone: updatedEmployee.phone ?? previous.phone,
        status: updatedEmployee.status ?? previous.status,
        experienceYears:
          updatedEmployee.experienceYears ?? previous.experienceYears,
        hasPreviousExperience:
          updatedEmployee.hasPreviousExperience ?? previous.hasPreviousExperience,
        previousCompanyName:
          updatedEmployee.previousCompanyName ?? previous.previousCompanyName,
        previousCompanyLeavingDate: updatedEmployee.previousCompanyLeavingDate
          ? String(updatedEmployee.previousCompanyLeavingDate).slice(0, 10)
          : '',
        previousCompanyLeavingReason:
          updatedEmployee.previousCompanyLeavingReason ??
          previous.previousCompanyLeavingReason,
        permissions: updatedEmployee.permissions ?? previous.permissions,
        leavingDate: updatedEmployee.leavingDate
          ? String(updatedEmployee.leavingDate).slice(0, 10)
          : previous.leavingDate
      }));

      setEditing(false);
      setDeleting(false);
      setSuccess(result.message || 'Employee updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update employee.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canEditEmployee(selectedEmployee)) {
      setError('Only a Branch Admin can deactivate employee accounts.');
      return;
    }

    const id = getEmployeeId(selectedEmployee);

    if (!id) {
      setError('Employee ID is missing.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await api(
        `/employees/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'INACTIVE',
            leavingDate: selectedEmployee.leavingDate || new Date().toISOString().slice(0, 10)
          })
        }
      );

      const updatedEmployee = result.data;

      setEmployeeRows(previous =>
        previous.map(employee =>
          String(getEmployeeId(employee)) === String(id)
            ? {
                ...employee,
                ...updatedEmployee,
                branch: employee.branch,
                customRole: employee.customRole
              }
            : employee
        )
      );

      setSelectedEmployee(previous => ({
        ...previous,
        ...updatedEmployee,
        branch: previous.branch,
        customRole: previous.customRole
      }));

      setFormData(previous => ({
        ...previous,
        status: updatedEmployee.status || 'INACTIVE',
        leavingDate: updatedEmployee.leavingDate
          ? String(updatedEmployee.leavingDate).slice(0, 10)
          : previous.leavingDate
      }));

      setDeleting(false);
      setEditing(false);
      setSuccess(
        result.message ||
          'Employee deactivated. Historical records have been retained.'
      );
      if (notify) notify('Employee deactivated.');
    } catch (err) {
      setError(err.message || 'Failed to deactivate employee.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveEmployee(employee) {
    if (!canEditEmployee(employee)) return;
    const id = getEmployeeId(employee);
    if (!id || !window.confirm(`Archive ${employee.firstName} ${employee.lastName}? This hides the employee from the directory while retaining HR history.`)) return;
    setSaving(true);
    try {
      const result = await api(`/employees/${encodeURIComponent(id)}/archive`, { method: 'DELETE' });
      setEmployeeRows(previous => previous.filter(row => String(getEmployeeId(row)) !== String(id)));
      if (String(getEmployeeId(selectedEmployee)) === String(id)) closeDetails();
      if (notify) notify(result.message || 'Employee archived.');
      if (onRefresh) await onRefresh();
    } catch (err) {
      if (notify) notify(err.message || 'Failed to archive employee.', 'error');
      else setError(err.message || 'Failed to archive employee.');
    } finally {
      setSaving(false);
    }
  }

  async function reactivateEmployee(employee) {
    if (!canEditEmployee(employee)) return;
    const id = getEmployeeId(employee);
    if (!id) return;

    setSaving(true);
    try {
      const result = await api(`/employees/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE', leavingDate: null })
      });
      const updatedEmployee = result.data;
      setEmployeeRows(previous => previous.map(row =>
        String(getEmployeeId(row)) === String(id)
          ? { ...row, ...updatedEmployee, branch: row.branch, customRole: row.customRole }
          : row
      ));
      if (String(getEmployeeId(selectedEmployee)) === String(id)) {
        setSelectedEmployee(previous => ({ ...previous, ...updatedEmployee }));
        setFormData(previous => ({ ...previous, status: 'ACTIVE', leavingDate: '' }));
      }
      if (notify) notify('Employee reactivated.');
      if (onRefresh) await onRefresh();
    } catch (err) {
      if (notify) notify(err.message || 'Unable to reactivate employee.', 'error');
      else setError(err.message || 'Unable to reactivate employee.');
    } finally {
      setSaving(false);
    }
  }

  const availablePermissions = PERMISSION_OPTIONS.filter(([permission]) =>
    (user.permissions || []).includes(permission)
  );

  return (
    <>
      <div className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h3>All employees</h3>
            <p>Your people directory and account status</p>
          </div>

          <span className="count-pill">
            {employeeRows.length} people
          </span>
        </div>

        <div className="employee-directory-filters">
          <input
            type="search"
            value={nameFilter}
            onChange={event => setNameFilter(event.target.value)}
            placeholder="Search employee name"
            aria-label="Search employee name"
          />
          <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)} aria-label="Filter by department">
            <option value="ALL">All departments</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filter by role">
            <option value="ALL">All roles</option>
            {roles.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED'].map(status => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingRows />
        ) : filtered.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  {user?.role === 'SUPER_ADMIN' && <th>BRANCH</th>}
                  <th>ROLE</th>
                  <th>EMPLOYEE ID</th>
                  <th>JOINED</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(employee => (
                  <tr
                    key={getEmployeeId(employee)}
                    onClick={() => openDetails(employee)}
                    className="employee-clickable-row"
                    title="Click to view employee details"
                  >
                    <td>
                      <div className="table-person">
                        <div className="avatar avatar-soft">
                          {initials(employee)}
                        </div>

                        <div>
                          <strong>
                            {employee.firstName} {employee.lastName}
                          </strong>
                          <span>{employee.email}</span>
                        </div>
                      </div>
                    </td>

                    {user?.role === 'SUPER_ADMIN' && (
                      <td>
                        {employee.branch?.name || '—'}
                        <span className="table-secondary">
                          {employee.branch?.branchCode || ''}
                        </span>
                      </td>
                    )}

                    <td>
                      <span className="role-pill">
                        {employee.customRole?.name ||
                          roleLabel(employee.role)}
                      </span>
                    </td>

                    <td className="mono">
                      {employee.employeeCode || '—'}
                    </td>

                    <td>{niceDate(employee.joiningDate)}</td>

                    <td>
                      <Status value={employee.status} />
                    </td>

                    <td>
                      <div className="employee-row-actions" onClick={event => event.stopPropagation()}>
                        <button type="button" className="icon-button employee-action-icon" onClick={() => openDetails(employee)} title="View employee" aria-label={`View ${employee.firstName} ${employee.lastName}`}>
                          <Eye size={17} />
                        </button>
                        {canEditEmployee(employee) && (
                          <>
                            <button type="button" className="icon-button employee-action-icon" onClick={() => openDetails(employee, true)} title="Edit employee" aria-label={`Edit ${employee.firstName} ${employee.lastName}`}>
                              <Pencil size={16} />
                            </button>
                            {employee.status === 'ACTIVE' ? (
                              <button type="button" className="icon-button employee-action-icon employee-action-danger" onClick={() => openDetails(employee, false, true)} title="Deactivate employee" aria-label={`Deactivate ${employee.firstName} ${employee.lastName}`}>
                                <Trash2 size={16} />
                              </button>
                            ) : (
                              <button type="button" className="icon-button employee-action-icon employee-action-activate" onClick={() => reactivateEmployee(employee)} disabled={saving} title="Activate employee" aria-label={`Activate ${employee.firstName} ${employee.lastName}`}>
                                <UserRoundCheck size={17} />
                              </button>
                            )}
                            <button type="button" className="icon-button employee-action-icon employee-action-danger" onClick={() => archiveEmployee(employee)} disabled={saving} title="Archive employee" aria-label={`Archive ${employee.firstName} ${employee.lastName}`}>
                              <Archive size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No matching employees"
            description="Try a different search or add your first employee."
          />
        )}
      </div>

      {selectedEmployee && (
        <div
          className="employee-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeDetails();
            }
          }}
        >
          <section
            className="employee-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
          >
            <header className="employee-modal-header">
              <div>
                <h2 id="employee-modal-title">
                  {editing ? 'Edit Employee' : 'Employee Details'}
                </h2>

                <p>
                  {selectedEmployee.employeeCode || 'Employee profile'}
                </p>
              </div>

              <button
                type="button"
                className="employee-icon-button"
                onClick={closeDetails}
                disabled={saving}
                aria-label="Close employee details"
              >
                <X size={20} />
              </button>
            </header>

            <div className="employee-profile">
              <div className="avatar avatar-soft employee-large-avatar">
                {initials(selectedEmployee)}
              </div>

              <div className="employee-profile-info">
                <h3>
                  {selectedEmployee.firstName}{' '}
                  {selectedEmployee.lastName}
                </h3>

                <p>
                  {selectedEmployee.customRole?.name ||
                    roleLabel(selectedEmployee.role)}
                </p>

                <Status value={selectedEmployee.status} />
              </div>
            </div>

            {error && (
              <div className="employee-error" role="alert">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="employee-success" role="status">
                {success}
              </div>
            )}

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="employee-form-grid">
                  <label>
                    Phone
                    <PhoneInput
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Has previous work experience?
                    <select
                      name="hasPreviousExperience"
                      value={formData.hasPreviousExperience ? 'yes' : 'no'}
                      onChange={event => {
                        const hasPreviousExperience = event.target.value === 'yes';
                        setFormData(previous => ({
                          ...previous,
                          hasPreviousExperience,
                          experienceYears: hasPreviousExperience
                            ? previous.experienceYears || 0.5
                            : 0,
                          previousCompanyName: hasPreviousExperience
                            ? previous.previousCompanyName
                            : '',
                          previousCompanyLeavingDate: hasPreviousExperience
                            ? previous.previousCompanyLeavingDate
                            : '',
                          previousCompanyLeavingReason: hasPreviousExperience
                            ? previous.previousCompanyLeavingReason
                            : ''
                        }));
                      }}
                    >
                      <option value="no">No previous experience</option>
                      <option value="yes">Yes, has previous experience</option>
                    </select>
                  </label>

                  {formData.hasPreviousExperience && (
                    <>
                      <label>
                        Previous company name
                        <input
                          name="previousCompanyName"
                          value={formData.previousCompanyName}
                          onChange={handleChange}
                          maxLength={120}
                          required
                        />
                      </label>

                      <label>
                        Previous company leaving date
                        <input
                          name="previousCompanyLeavingDate"
                          type="date"
                          value={formData.previousCompanyLeavingDate}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={handleChange}
                          required
                        />
                      </label>

                      <label className="employee-full-width">
                        Reason for leaving
                        <textarea
                          name="previousCompanyLeavingReason"
                          value={formData.previousCompanyLeavingReason}
                          onChange={handleChange}
                          maxLength={1000}
                          rows={3}
                          required
                        />
                      </label>

                      <label>
                        Total experience (years)
                        <input
                          name="experienceYears"
                          type="number"
                          min="0.5"
                          max="70"
                          step="0.5"
                          value={formData.experienceYears}
                          onChange={handleChange}
                          required
                        />
                      </label>
                    </>
                  )}

                  <label>
                    Status
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </label>

                  <label>
                    Leaving date
                    <input
                      name="leavingDate"
                      type="date"
                      value={formData.leavingDate}
                      onChange={handleChange}
                    />
                  </label>

                  <fieldset className="employee-permissions-section">
                    <legend>Employee access permissions</legend>
                    <p>Permissions belong to this employee and are independent of their job title.</p>
                    <div className="employee-permissions-grid">
                      {availablePermissions.length ? (
                        availablePermissions.map(([permission, label]) => (
                          <label key={permission}>
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission)}
                              onChange={event =>
                                setFormData(previous => ({
                                  ...previous,
                                  permissions: event.target.checked
                                    ? [...new Set([...previous.permissions, permission])]
                                    : previous.permissions.filter(item => item !== permission)
                                }))
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ))
                      ) : (
                        <p>No permissions are delegated to your account to assign.</p>
                      )}
                    </div>
                  </fieldset>
                </div>

                <footer className="employee-modal-actions">
                  <button
                    type="button"
                    className="employee-btn employee-btn-secondary"
                    onClick={() => {
                      setEditing(false);
                      setError('');
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="employee-btn employee-btn-primary"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </footer>
              </form>
            ) : (
              <>
                <div className="employee-details-grid">
                  <Detail
                    icon={Mail}
                    label="Email"
                    value={selectedEmployee.email}
                  />

                  <Detail
                    icon={Fingerprint}
                    label="Employee ID"
                    value={selectedEmployee.employeeCode}
                  />

                  <Detail
                    icon={CalendarDays}
                    label="Joining Date"
                    value={niceDate(selectedEmployee.joiningDate)}
                  />

                  <Detail
                    icon={Building2}
                    label="Branch"
                    value={
                      selectedEmployee.branch?.name ||
                      selectedEmployee.branchId?.name
                    }
                  />

                  <Detail
                    icon={BriefcaseBusiness}
                    label="Department"
                    value={
                      selectedEmployee.department?.name ||
                      selectedEmployee.departmentId?.name
                    }
                  />

                  <Detail
                    icon={Phone}
                    label="Phone"
                    value={selectedEmployee.phone}
                  />

                  <Detail
                    icon={UserRound}
                    label="Account Role"
                    value={roleLabel(selectedEmployee.role)}
                  />

                  <Detail
                    icon={Clock}
                    label="Experience"
                    value={
                      selectedEmployee.experienceYears > 0
                        ? `${selectedEmployee.experienceYears} years`
                        : 'No previous experience'
                    }
                  />

                  {selectedEmployee.hasPreviousExperience && (
                    <>
                      <Detail
                        icon={Building2}
                        label="Previous company"
                        value={selectedEmployee.previousCompanyName}
                      />
                      <Detail
                        icon={CalendarDays}
                        label="Previous company leaving date"
                        value={niceDate(selectedEmployee.previousCompanyLeavingDate)}
                      />
                      <Detail
                        icon={FileText}
                        label="Reason for leaving"
                        value={selectedEmployee.previousCompanyLeavingReason}
                      />
                    </>
                  )}

                  <Detail
                    icon={CalendarDays}
                    label="Leaving Date"
                    value={
                      selectedEmployee.leavingDate
                        ? niceDate(selectedEmployee.leavingDate)
                        : '—'
                    }
                  />

                </div>

                {deleting && (
                  <div className="employee-delete-confirm">
                    <strong>Deactivate this employee?</strong>

                    <p>
                      The account will become inactive. Historical
                      attendance, salary and task records will be retained.
                    </p>

                    <div className="employee-modal-actions">
                      <button
                        type="button"
                        className="employee-btn employee-btn-secondary"
                        onClick={() => {
                          setDeleting(false);
                          setError('');
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="employee-btn employee-btn-danger"
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                        {saving ? 'Deactivating...' : 'Confirm Deactivation'}
                      </button>
                    </div>
                  </div>
                )}

                {!deleting && (
                  <footer className="employee-modal-actions">
                    {canEditEmployee(selectedEmployee) && selectedEmployee.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="employee-btn employee-btn-danger"
                        onClick={() => {
                          setDeleting(true);
                          setError('');
                          setSuccess('');
                        }}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                        Deactivate
                      </button>
                    )}
                    {canEditEmployee(selectedEmployee) && selectedEmployee.status !== 'ACTIVE' && (
                      <button
                        type="button"
                        className="employee-btn employee-btn-primary"
                        onClick={() => reactivateEmployee(selectedEmployee)}
                        disabled={saving}
                      >
                        <UserRoundCheck size={16} />
                        Activate
                      </button>
                    )}

                    {canEditEmployee(selectedEmployee) && (
                      <button
                        type="button"
                        className="employee-btn employee-btn-primary"
                        onClick={() => {
                          setEditing(true);
                          setError('');
                          setSuccess('');
                          setDeleting(false);
                        }}
                        disabled={saving}
                      >
                        <Pencil size={16} />
                        Edit Employee
                      </button>
                    )}
                  </footer>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="employee-detail-item">
      <div className="employee-detail-icon">
        <Icon size={17} />
      </div>

      <div className="employee-detail-content">
        <span>{label}</span>
        <strong>{value || '—'}</strong>
      </div>
    </div>
  );
}
