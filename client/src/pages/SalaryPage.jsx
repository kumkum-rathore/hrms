import React, { useState } from 'react';
import { BriefcaseBusiness, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { niceDate, titleCase } from '../utils/labels.js';
import { EmptyState, Field, LoadingRows, Status } from '../components/common.jsx';
import FormModal from '../components/FormModal.jsx';

function formatMoney(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function SalaryPage({ salaries, user, loading, notify, employees, onRefresh }) {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({
    userId: '',
    month: new Date().toISOString().slice(0, 7),
    baseSalary: '',
    allowances: '0',
    deductions: '0',
    bonus: '0'
  });
  const [adjustForm, setAdjustForm] = useState({
    baseSalary: '',
    allowances: '0',
    deductions: '0',
    bonus: '0'
  });
  const admin = user.permissions?.includes('employee.salary.manage');
  const canManage = admin;

  async function create(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api('/salaries', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          baseSalary: Number(form.baseSalary),
          allowances: Number(form.allowances),
          deductions: Number(form.deductions),
          bonus: Number(form.bonus)
        })
      });
      notify('Monthly salary record created.');
      setShow(false);
      onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function beginAdjust(row) {
    setAdjusting(row._id);
    setReason('');
    setAdjustForm({
      baseSalary: String(row.baseSalary),
      allowances: String(row.allowances || 0),
      deductions: String(row.deductions || 0),
      bonus: String(row.bonus || 0)
    });
  }

  async function saveAdjustment(event, id) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api(`/salaries/${id}/adjustment`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...adjustForm,
          baseSalary: Number(adjustForm.baseSalary),
          allowances: Number(adjustForm.allowances),
          deductions: Number(adjustForm.deductions),
          bonus: Number(adjustForm.bonus),
          reason
        })
      });
      notify('Salary increment/decrement saved with history.');
      setAdjusting(null);
      onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function markAsPaid(salary) {
    try {
      await api(`/salaries/${salary._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PAID' })
      });
      notify('Salary marked as paid.');
      onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <h3>{admin ? 'Branch salary records' : 'My salary reports'}</h3>
          <p>
            {admin
              ? 'View and manage monthly salary records for employees in your branch.'
              : 'View your monthly salary records, changes and payment status.'}
          </p>
        </div>
        {canManage && (
          <button className="button button-primary" onClick={() => setShow(!show)}>
            <Plus size={16} /> Add salary
          </button>
        )}
      </div>

      {show && admin && (
        <FormModal
          title="Add salary record"
          description="Create a monthly salary record for an active employee."
          onClose={() => setShow(false)}
          onSubmit={create}
          submitLabel="Save salary"
          busy={saving}
        >
          <div className="form-grid">
            <Field label="Employee" required>
              <select
                value={form.userId}
                onChange={event =>
                  setForm(current => ({ ...current, userId: event.target.value }))
                }
                required
              >
                <option value="">Select employee</option>
                {employees
                  .filter(employee => employee.role === 'EMPLOYEE')
                  .map(employee => (
                    <option
                      key={employee.id || employee._id}
                      value={employee.id || employee._id}
                    >
                      {employee.firstName} {employee.lastName} — {employee.email}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Month" required>
              <input
                type="month"
                value={form.month}
                onChange={event =>
                  setForm(current => ({ ...current, month: event.target.value }))
                }
                required
              />
            </Field>
            {['baseSalary', 'allowances', 'deductions', 'bonus'].map(key => (
              <Field key={key} label={titleCase(key)} required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[key]}
                  onChange={event =>
                    setForm(current => ({ ...current, [key]: event.target.value }))
                  }
                  required
                />
              </Field>
            ))}
          </div>
        </FormModal>
      )}

      {loading ? (
        <LoadingRows />
      ) : salaries.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {admin && <th>EMPLOYEE</th>}
                <th>MONTH</th>
                <th>BASIC</th>
                <th>ADJUSTMENTS</th>
                <th>NET</th>
                <th>PAYABLE</th>
                <th>STATUS</th>
                <th>RECORD</th>
                {canManage && <th>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {salaries.map(salary => {
                const expanded = expandedId === salary._id;
                const changes = [...(salary.adjustmentHistory || [])].reverse();
                const columnCount = admin ? (canManage ? 9 : 8) : 7;

                return (
                  <React.Fragment key={salary._id}>
                    <tr>
                      {canManage && (
                        <td>
                          {salary.userId?.firstName} {salary.userId?.lastName}
                        </td>
                      )}
                      <td>{salary.month}</td>
                      <td>{formatMoney(salary.baseSalary)}</td>
                      <td>
                        {formatMoney(
                          Number(salary.allowances || 0) +
                            Number(salary.bonus || 0) -
                            Number(salary.deductions || 0)
                        )}
                        {changes.length > 0 && (
                          <span className="table-secondary">
                            {changes.length} changes
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {formatMoney(
                            salary.netSalary ??
                              (salary.baseSalary +
                                salary.allowances +
                                salary.bonus -
                                salary.deductions)
                          )}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatMoney(salary.payableSalary)}</strong>
                        {Number(salary.attendanceDeduction) > 0 && (
                          <span className="table-secondary">
                            −{formatMoney(salary.attendanceDeduction)} attendance
                          </span>
                        )}
                      </td>
                      <td>
                        <Status value={salary.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-quiet"
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedId(expanded ? null : salary._id)
                          }
                        >
                          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          {expanded ? 'Hide details' : 'View details'}
                        </button>
                      </td>
                      {admin && (
                        <td>
                          <div className="document-review-actions">
                            {salary.status !== 'PAID' && (
                              <button
                                type="button"
                                className="button button-primary"
                                onClick={() => markAsPaid(salary)}
                              >
                                Mark paid
                              </button>
                            )}
                            {salary.status !== 'PAID' && (
                              <button
                                type="button"
                                className="button button-quiet"
                                onClick={() => beginAdjust(salary)}
                              >
                                Adjust
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="salary-detail-row">
                        <td colSpan={columnCount}>
                          <div className="submission-history">
                            <strong>{salary.month} salary details</strong>
                            <div className="task-meta">
                              <span>Basic: {formatMoney(salary.baseSalary)}</span>
                              <span>Allowances: {formatMoney(salary.allowances)}</span>
                              <span>Bonus: {formatMoney(salary.bonus)}</span>
                              <span>Deductions: {formatMoney(salary.deductions)}</span>
                              <span>
                                Attendance deduction:{' '}
                                {formatMoney(salary.attendanceDeduction)}
                              </span>
                              <span>
                                Payable after attendance:{' '}
                                {formatMoney(salary.payableSalary)}
                              </span>
                              {salary.shiftMissing && (
                                <span>
                                  No shift assigned; absence and late deductions are not calculated.
                                </span>
                              )}
                              {salary.attendanceSummary && (
                                <span>
                                  Attendance: {salary.attendanceSummary.absentDays || 0} absent ·{' '}
                                  {salary.attendanceSummary.leaveDays || 0} leave ·{' '}
                                  {salary.attendanceSummary.halfDays || 0} half-day ·{' '}
                                  {salary.attendanceSummary.scheduledWorkingDays || 0} working days
                                </span>
                              )}
                              <span>
                                Payment: {salary.status === 'PAID' ? 'Paid' : 'Not paid'}
                                {salary.status === 'PAID' && salary.paidAt
                                  ? ` on ${niceDate(salary.paidAt)}`
                                  : ''}
                              </span>
                              {salary.createdBy && (
                                <span>
                                  Record created by: {salary.createdBy.firstName || ''}{' '}
                                  {salary.createdBy.lastName || ''}
                                </span>
                              )}
                              {salary.notes && <span>Note: {salary.notes}</span>}
                            </div>

                            <strong>Salary changes</strong>
                            {changes.length ? (
                              changes.map((change, index) => (
                                <div
                                  className="submission-item"
                                  key={`${change.changedAt || index}-${index}`}
                                >
                                  <span>
                                    {niceDate(change.changedAt)}
                                    {change.changedBy &&
                                      ` · Changed by ${change.changedBy.firstName || ''} ${change.changedBy.lastName || ''}`}
                                  </span>
                                  <p>{change.reason}</p>
                                  <div className="task-meta">
                                    {['baseSalary', 'allowances', 'deductions', 'bonus'].map(
                                      key => (
                                        <span key={key}>
                                          {titleCase(key)}:{' '}
                                          {formatMoney(change.previous?.[key])}
                                          {' → '}
                                          {formatMoney(change.updated?.[key])}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="submission-item">
                                No salary changes recorded for this month.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No salary records"
          description={
            admin
              ? 'Create monthly salary records for employees in your branch.'
              : 'Your salary reports will appear here.'
          }
        />
      )}

      {adjusting && admin && (
        <FormModal
          title="Salary increment / decrement"
          description="Update the current month's salary values and record a reason for the change."
          onClose={() => setAdjusting(null)}
          onSubmit={event => saveAdjustment(event, adjusting)}
          submitLabel="Save adjustment"
          busy={saving}
        >
          <p className="table-secondary">
            Update the current month's salary values. Previous and updated values
            are stored in adjustment history.
          </p>
          <div className="form-grid">
            {['baseSalary', 'allowances', 'deductions', 'bonus'].map(key => (
              <Field key={key} label={titleCase(key)} required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustForm[key]}
                  onChange={event =>
                    setAdjustForm(current => ({
                      ...current,
                      [key]: event.target.value
                    }))
                  }
                  required
                />
              </Field>
            ))}
            <Field label="Reason for change" required wide>
              <textarea
                rows="2"
                value={reason}
                onChange={event => setReason(event.target.value)}
                minLength="3"
                required
                placeholder="e.g. monthly increment / correction / deduction adjustment"
              />
            </Field>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default SalaryPage;
