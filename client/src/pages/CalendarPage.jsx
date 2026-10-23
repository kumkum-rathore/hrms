import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Field, LoadingRows } from '../components/common.jsx';
import FormModal from '../components/FormModal.jsx';
import { niceDate } from '../utils/labels.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarPage({ user, employees = [], notify }) {
  const admin = user.permissions?.includes('calendar.manage');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(currentMonth);
  const [holidays, setHolidays] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [myShift, setMyShift] = useState(null);
  const [staff, setStaff] = useState(employees);
  const [loading, setLoading] = useState(true);
  const [holidayDate, setHolidayDate] = useState(`${currentMonth}-01`);
  const [holidayTitle, setHolidayTitle] = useState('');
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '09:00',
    endTime: '17:00'
  });
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  async function loadCalendar() {
    setLoading(true);
    try {
      const response = await api(`/calendar?month=${encodeURIComponent(month)}`);
      setHolidays(response.data?.holidays || []);
      setShifts(response.data?.shifts || []);
      setMyShift(response.data?.myShift || null);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendar();
  }, [month]);

  useEffect(() => {
    setStaff(employees);
  }, [employees]);

  useEffect(() => {
    if (!employeeId && employees.length) {
      setEmployeeId(String(employees[0].id || employees[0]._id));
    }
  }, [employees, employeeId]);

  const holidayByDate = useMemo(
    () => new Map(holidays.map(holiday => [holiday.date, holiday])),
    [holidays]
  );

  const monthDate = new Date(`${month}-01T00:00:00`);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1)
  ];

  function changeMonth(amount) {
    const next = new Date(year, monthIndex + amount, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setMonth(nextMonth);
    setHolidayDate(`${nextMonth}-01`);
  }

  async function addHoliday(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/calendar/holidays', {
        method: 'POST',
        body: JSON.stringify({ date: holidayDate, title: holidayTitle })
      });
      setHolidayTitle('');
      setShowHolidayForm(false);
      await loadCalendar();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id) {
    setBusy(true);
    try {
      await api(`/calendar/holidays/${id}`, { method: 'DELETE' });
      await loadCalendar();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createShift(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/calendar/shifts', {
        method: 'POST',
        body: JSON.stringify(shiftForm)
      });
      setShiftForm({ name: '', startTime: '09:00', endTime: '17:00' });
      setShowShiftForm(false);
      await loadCalendar();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function assignShift(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/calendar/shifts/assign', {
        method: 'PATCH',
        body: JSON.stringify({ userId: employeeId, shiftId: shiftId || null })
      });
      const employeeResponse = await api('/employees?limit=100');
      setStaff(employeeResponse.data || []);
      setEmployeeId('');
      setShiftId('');
      setShowAssignmentForm(false);
      await loadCalendar();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="calendar-layout">
      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h3>Branch holiday calendar</h3>
            <p>Weekends and holidays are excluded from working-day salary calculations.</p>
          </div>
          <div className="heading-actions">
            {admin && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => setShowHolidayForm(true)}
              >
                <Plus size={15} /> Add holiday
              </button>
            )}
            <div className="calendar-month-controls">
              <button
                type="button"
                className="icon-button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <strong>
                {monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingRows />
        ) : (
          <div className="branch-calendar">
            {WEEKDAYS.map(day => (
              <strong className="calendar-weekday" key={day}>{day}</strong>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) return <div className="calendar-day calendar-day-empty" key={`empty-${index}`} />;

              const date = `${month}-${String(day).padStart(2, '0')}`;
              const holiday = holidayByDate.get(date);
              const weekend = [0, 6].includes(new Date(year, monthIndex, day).getDay());
              return (
                <div
                  className={`calendar-day${holiday ? ' calendar-day-holiday' : ''}${weekend ? ' calendar-day-weekend' : ''}`}
                  key={date}
                >
                  <span>{day}</span>
                  {holiday && <small>{holiday.title}</small>}
                  {!holiday && weekend && <small>Weekend</small>}
                </div>
              );
            })}
          </div>
        )}

        {admin && (
          <>
            {holidays.length > 0 && (
              <div className="calendar-holiday-list">
                {holidays.map(holiday => (
                  <div className="calendar-holiday-item" key={holiday._id}>
                    <span><CalendarDays size={15} /> {niceDate(holiday.date)} · {holiday.title}</span>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Remove ${holiday.title}`}
                      disabled={busy}
                      onClick={() => removeHoliday(holiday._id)}
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h3>{admin ? 'Shift setup' : 'Your shift'}</h3>
            <p>
              {admin
                ? 'Employees arriving more than 2 hours after shift start are marked half-day.'
                : myShift
                  ? `${myShift.name}: ${myShift.startTime}–${myShift.endTime}. Arriving more than 2 hours late counts as half-day.`
                  : 'Your shift has not been assigned yet.'}
            </p>
          </div>
          {admin && (
            <div className="heading-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setShowAssignmentForm(true)}
                    disabled={!shifts.length}
                  >
                    Assign employee
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setShowShiftForm(true)}
                  >
                    <Plus size={15} /> Create shift
                  </button>
            </div>
          )}
        </div>

        {admin ? (
          <>
            <div className="calendar-shift-list">
              {shifts.map(shift => (
                <div className="calendar-holiday-item" key={shift._id}>
                  <span><strong>{shift.name}</strong> · {shift.startTime}–{shift.endTime}</span>
                  <small>2-hour grace</small>
                </div>
              ))}
              {!shifts.length && <p className="table-secondary">No shifts created yet.</p>}
            </div>
            <div className="calendar-shift-actions">
              <p className="table-secondary">Manage shifts or assign one to a branch employee.</p>
            </div>
          </>
        ) : (
          <div className="calendar-shift-list">
            {myShift && (
              <div className="calendar-holiday-item">
                <span><strong>{myShift.name}</strong> · {myShift.startTime}–{myShift.endTime}</span>
                <small>2-hour grace</small>
              </div>
            )}
          </div>
        )}
      </section>
      {admin && showHolidayForm && (
        <FormModal
          title="Add branch holiday"
          description="Choose the holiday date and give it a name."
          onClose={() => setShowHolidayForm(false)}
          onSubmit={addHoliday}
          submitLabel="Add holiday"
          busy={busy}
        >
          <div className="form-grid">
            <Field label="Holiday date" required>
              <input
                type="date"
                value={holidayDate}
                onChange={event => setHolidayDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Holiday name" required>
              <input
                value={holidayTitle}
                onChange={event => setHolidayTitle(event.target.value)}
                maxLength="120"
                minLength="2"
                placeholder="e.g. Diwali"
                required
              />
            </Field>
          </div>
        </FormModal>
      )}
      {admin && showShiftForm && (
        <FormModal
          title="Create shift"
          description="Set the work hours for a reusable branch shift."
          onClose={() => setShowShiftForm(false)}
          onSubmit={createShift}
          submitLabel="Create shift"
          busy={busy}
        >
          <div className="form-grid">
            <Field label="Shift name" required>
              <input
                value={shiftForm.name}
                onChange={event => setShiftForm(current => ({ ...current, name: event.target.value }))}
                minLength="2"
                maxLength="100"
                placeholder="Morning shift"
                required
              />
            </Field>
            <Field label="Start time" required>
              <input
                type="time"
                value={shiftForm.startTime}
                onChange={event => setShiftForm(current => ({ ...current, startTime: event.target.value }))}
                required
              />
            </Field>
            <Field label="End time" required>
              <input
                type="time"
                value={shiftForm.endTime}
                onChange={event => setShiftForm(current => ({ ...current, endTime: event.target.value }))}
                required
              />
            </Field>
          </div>
        </FormModal>
      )}
      {admin && showAssignmentForm && (
        <FormModal
          title="Assign shift to employee"
          description="Select an employee and the branch shift they will follow."
          onClose={() => setShowAssignmentForm(false)}
          onSubmit={assignShift}
          submitLabel="Save assignment"
          busy={busy}
        >
          <div className="form-grid">
            <Field label="Employee" required>
              <select
                value={employeeId}
                onChange={event => setEmployeeId(event.target.value)}
                required
              >
                <option value="">Select employee</option>
                {staff.filter(employee => employee.role === 'EMPLOYEE').map(employee => (
                  <option key={employee.id || employee._id} value={employee.id || employee._id}>
                    {employee.firstName} {employee.lastName}
                    {employee.shiftId?.name ? ` · ${employee.shiftId.name}` : ' · No shift'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shift" required>
              <select value={shiftId} onChange={event => setShiftId(event.target.value)} required>
                <option value="">Select shift</option>
                {shifts.map(shift => (
                  <option key={shift._id} value={shift._id}>
                    {shift.name} · {shift.startTime}–{shift.endTime}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormModal>
      )}
    </div>
  );
}

export default CalendarPage;
