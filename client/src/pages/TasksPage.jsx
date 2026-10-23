import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Download,
  Plus,
  FolderKanban,
  Clock3,
  Send,
  BarChart3,
  Link as LinkIcon,
  Eye,
  X,
  Pencil,
  Trash2
} from 'lucide-react';
import { api, downloadFile, fetchFileBlob } from '../lib/api';
import FormModal from '../components/FormModal.jsx';
import { titleCase, niceDate } from '../utils/labels.js';
import { Field, Status, EmptyState, LoadingRows } from '../components/common.jsx';
import TaskActivity from '../components/TaskActivity.jsx';

const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt'];

function getFileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

function TaskFilePreview({ url, extension }) {
  if (extension === 'pdf' || extension === 'txt') {
    return (
      <iframe
        src={url}
        title="Task attachment preview"
        className="document-preview-frame"
      />
    );
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    return (
      <img
        src={url}
        alt="Task attachment preview"
        className="document-preview-image"
      />
    );
  }

  return <p>Preview is not available for this file type. Download the file to open it.</p>;
}

function TasksPage({
  tasks = [],
  employees: initialEmployees = [], 
  users = [], // 🆕 Parent se aane wale saare branch users
  projects = [],
  user,
  loading,
  notify,
  onRefresh,
  selectedProject = null
}) {
  const [show, setShow] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [projectId, setProjectId] = useState(selectedProject?._id || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [taskTitleFilter, setTaskTitleFilter] = useState('');
  const [taskCompletionFilter, setTaskCompletionFilter] = useState('ALL');

  const [note, setNote] = useState({});
  const [taskFiles, setTaskFiles] = useState({});
  const [taskUrls, setTaskUrls] = useState({});
  const [submittedTo, setSubmittedTo] = useState({});
  const [reviewerUsers, setReviewerUsers] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewRequestId = useRef(0);
  const [progress, setProgress] = useState({});
  const [hours, setHours] = useState({});
  const [workNote, setWorkNote] = useState({});

  useEffect(() => {
    let active = true;

    api('/tasks/reviewers')
      .then(response => {
        if (active) setReviewerUsers(response.data || []);
      })
      .catch(error => {
        if (active) notify(error.message, 'error');
      });

    return () => {
      active = false;
    };
  }, [user.id, notify]);

  useEffect(() => {
    if (!user.permissions?.includes('task.assign')) return undefined;
    let active = true;
    api('/departments')
      .then(response => {
        if (active) setDepartments(response.data || []);
      })
      .catch(error => {
        if (active) notify(error.message, 'error');
      });
    return () => {
      active = false;
    };
  }, [user.id, user.permissions, notify]);

  useEffect(() => {
    if (selectedProject?.departmentId) {
      setDepartmentId(selectedProject.departmentId._id || selectedProject.departmentId);
      setAssignedTo('');
    }
  }, [selectedProject?._id, selectedProject?.departmentId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function openPreview(file) {
    const extension = getFileExtension(file.name);
    const requestId = ++previewRequestId.current;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(null);
    setPreviewError('');

    if (!PREVIEWABLE_EXTENSIONS.includes(extension)) {
      setPreviewError('Preview is not available for this file type. Download the file to open it.');
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);

    try {
      const blob = await fetchFileBlob(
        `/uploads/${encodeURIComponent(file.url)}/preview`
      );
      const url = URL.createObjectURL(blob);
      if (previewRequestId.current === requestId) {
        setPreviewUrl(url);
      } else {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (previewRequestId.current === requestId) {
        setPreviewError(error.message || 'File preview failed.');
      }
    } finally {
      if (previewRequestId.current === requestId) {
        setPreviewLoading(false);
      }
    }
  }

  function closePreview() {
    previewRequestId.current += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewError('');
    setPreviewLoading(false);
  }

  const manager =
    user.permissions?.includes('task.assign') ||
    user.permissions?.includes('task.review');

  const isEmployee = user.role === 'EMPLOYEE';

  const visibleTasks = (selectedProject
    ? tasks.filter(t => (t.projectId?._id || t.projectId) === selectedProject._id)
    : tasks
  ).filter(task => {
    if (String(task.assignedTo?._id || task.assignedTo) === String(user.id))
      return true;

    const latestSubmission = task.submissions?.[task.submissions.length - 1];
    const reviewerId =
      latestSubmission?.submittedTo?._id || latestSubmission?.submittedTo;
    return !(
      task.status === 'SUBMITTED' &&
      latestSubmission?.status === 'SUBMITTED' &&
      String(reviewerId) === String(user.id)
    );
  }).filter(task =>
    task.title?.toLowerCase().includes(taskTitleFilter.toLowerCase()) &&
    (taskCompletionFilter === 'ALL' ||
      (taskCompletionFilter === 'COMPLETED' && task.status === 'APPROVED') ||
      (taskCompletionFilter === 'INCOMPLETE' && task.status !== 'APPROVED'))
  );

  const allUsers = useMemo(
    () => reviewerUsers ?? (users.length > 0 ? users : initialEmployees),
    [reviewerUsers, users, initialEmployees]
  );

  const reviewerOptions = useMemo(() => {
    return allUsers.filter(u => {
      const id = u.id || u._id;
      return id && u.role !== 'SUPER_ADMIN' && u.status === 'ACTIVE';
    });
  }, [allUsers]);

  const assigneeOptions = useMemo(() => {
    const directory = initialEmployees.length ? initialEmployees : users;
    const activeEmployees = directory.filter(employee =>
      employee.status === 'ACTIVE' &&
      employee.role === 'EMPLOYEE' &&
      String(employee.departmentId?._id || employee.departmentId) === String(departmentId) &&
      String(employee.id || employee._id) !== String(user.id)
    );
    const selectedAssignmentProject =
      projects.find(project => String(project._id) === String(projectId)) ||
      (String(selectedProject?._id) === String(projectId) ? selectedProject : null);

    if (!selectedAssignmentProject) return activeEmployees;

    const projectMemberIds = new Set(
      (selectedAssignmentProject.members || []).map(member =>
        String(member?._id || member?.id || member)
      )
    );
    return activeEmployees.filter(employee =>
      projectMemberIds.has(String(employee.id || employee._id))
    );
  }, [initialEmployees, users, user.id, selectedProject, projects, projectId, departmentId]);

  function editTask(task) {
    setEditingTask(task);
    setTitle(task.title || '');
    setDescription(task.description || '');
    setAssignedTo(task.assignedTo?._id || task.assignedTo || '');
    setDepartmentId(
      task.departmentId?._id ||
      task.departmentId ||
      task.assignedTo?.departmentId?._id ||
      task.assignedTo?.departmentId ||
      ''
    );
    setProjectId(task.projectId?._id || task.projectId || '');
    setDueDate(task.dueDate ? String(task.dueDate).slice(0, 10) : '');
    setPriority(task.priority || 'MEDIUM');
    setEstimatedHours(String(task.estimatedHours || ''));
    setChecklistText((task.checklist || []).map(item => item.title).join('\n'));
    setShow(true);
  }

  function closeTaskForm() {
    setShow(false);
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDepartmentId('');
    setProjectId(selectedProject?._id || '');
    setDueDate('');
    setPriority('MEDIUM');
    setEstimatedHours('');
    setChecklistText('');
  }

  async function saveTask(e) {
    e.preventDefault();
    if (savingTask) return;
    setSavingTask(true);
    try {
      await api(editingTask ? `/tasks/${encodeURIComponent(editingTask._id)}` : '/tasks', {
        method: editingTask ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title,
          description,
          assignedTo,
          departmentId,
          projectId: projectId || null,
          dueDate: dueDate || null,
          priority,
          estimatedHours: Number(estimatedHours) || 0,
          taskType: 'GENERAL',
          checklist: checklistText
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean)
            .map(title => ({ title }))
        })
      });
      notify(editingTask ? 'Task updated successfully.' : 'Task assigned successfully.');
      closeTaskForm();
      await onRefresh();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingTask(false);
    }
  }

  async function archiveTask(task) {
    if (!window.confirm(`Archive "${task.title}"? Submissions, work logs, and activity history will be retained.`)) return;
    try {
      await api(`/tasks/${encodeURIComponent(task._id)}`, { method: 'DELETE' });
      notify('Task archived.');
      await onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function act(task, decision) {
    try {
      if (decision === 'SUBMIT') {
        const reviewerId = submittedTo[task._id];
        if (!reviewerId) {
          notify('Please select who you want to submit this task to.', 'error');
          return;
        }

        let files = [];
        const selected = taskFiles[task._id];
        if (selected) {
          const fd = new FormData();
          fd.append('file', selected);
          const upload = await api('/uploads', { method: 'POST', body: fd });
          files.push({
            name: upload.data.fileName,
            url: upload.data.storageKey,
            mimeType: upload.data.mimeType,
            size: upload.data.size
          });
        }

        const externalUrl = (taskUrls[task._id] || '').trim();
        if (externalUrl) {
          if (!/^https?:\/\/.+/i.test(externalUrl)) {
            notify('Please enter a valid URL starting with http:// or https://', 'error');
            return;
          }
          files.push({
            name: externalUrl,
            url: externalUrl,
            externalUrl,
            mimeType: 'text/uri-list'
          });
        }

        await api(`/tasks/${task._id}/submit`, {
          method: 'PATCH',
          body: JSON.stringify({
            note: note[task._id] || '',
            files,
            submittedTo: reviewerId
          })
        });

        notify('Task submitted for review.');
        setTaskFiles(v => ({ ...v, [task._id]: null }));
        setTaskUrls(v => ({ ...v, [task._id]: '' }));
        setNote(v => ({ ...v, [task._id]: '' }));
      } else {
        await api(`/tasks/${task._id}/review`, {
          method: 'PATCH',
          body: JSON.stringify({ decision, note: note[task._id] || '' })
        });
        notify(decision === 'APPROVED' ? 'Task approved.' : 'Changes requested.');
      }
      onRefresh();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function saveProgress(task) {
    try {
      await api(`/tasks/${task._id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({
          progress: Number(progress[task._id] ?? task.progress ?? 0),
          hours: Number(hours[task._id] || 0),
          note: workNote[task._id] || ''
        })
      });
      notify('Progress and work log saved.');
      setWorkNote(v => ({ ...v, [task._id]: '' }));
      setHours(v => ({ ...v, [task._id]: '' }));
      onRefresh();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div className="panel data-panel task-management-panel">
      <div className="panel-heading">
        <div>
          <h3>{selectedProject ? selectedProject.name + ' · Task board' : 'Task management'}</h3>
          <p>Assignments, delivery progress, work logs and review workflow</p>
        </div>
        {manager && (
          <button
            className="button button-primary"
            onClick={() => {
              if (show) closeTaskForm();
              else {
                setEditingTask(null);
                setProjectId(selectedProject?._id || '');
              setDepartmentId(selectedProject?.departmentId?._id || selectedProject?.departmentId || '');
              setAssignedTo('');
              setShow(true);
              }
            }}
          >
            <Plus size={16} /> Assign task
          </button>
        )}
      </div>

      {selectedProject && (
        <div className="task-project-context">
          <FolderKanban size={16} />
          <span>Project deadline: <strong>{niceDate(selectedProject.dueDate)}</strong></span>
          <span>Priority: <strong>{titleCase(selectedProject.priority || 'MEDIUM')}</strong></span>
        </div>
      )}

      <div className="task-list-filters">
        <input
          type="search"
          value={taskTitleFilter}
          onChange={event => setTaskTitleFilter(event.target.value)}
          placeholder="Search task title"
          aria-label="Search task title"
        />
        <select
          value={taskCompletionFilter}
          onChange={event => setTaskCompletionFilter(event.target.value)}
          aria-label="Filter tasks by completion"
        >
          <option value="ALL">All tasks</option>
          <option value="COMPLETED">Completed</option>
          <option value="INCOMPLETE">Incomplete</option>
        </select>
      </div>

      {show && (
        <FormModal
          title={editingTask ? 'Edit task' : 'Assign a task'}
          description="Choose the project, department and employee responsible for this task."
          onClose={closeTaskForm}
          onSubmit={saveTask}
          submitLabel={editingTask ? 'Save changes' : 'Assign task'}
          busy={savingTask}
        >
          <div className="form-grid">
            <Field label="Task title" required>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                minLength="3"
                maxLength="180"
                required
                placeholder="e.g. Build employee dashboard"
              />
            </Field>

            <Field label="Project" required={!selectedProject && !editingTask}>
              <select
                value={projectId}
                onChange={e => {
                  setProjectId(e.target.value);
                  setAssignedTo('');
                  const project = projects.find(item => String(item._id) === String(e.target.value));
                  setDepartmentId(project?.departmentId?._id || project?.departmentId || '');
                }}
                required={!selectedProject && !editingTask}
              >
                <option value="">Select project</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Department" required>
              <select
                value={departmentId}
                onChange={event => {
                  setDepartmentId(event.target.value);
                  setAssignedTo('');
                }}
                required
                disabled={Boolean(selectedProject?.departmentId || projects.find(project => String(project._id) === String(projectId))?.departmentId)}
              >
                <option value="">Select department first</option>
                {departments.map(department => (
                  <option key={department._id} value={department._id}>{department.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Assignee" required>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                required
                disabled={!departmentId}
              >
                <option value="">
                  {assigneeOptions.length ? 'Select project member' : 'No active project members available'}
                </option>
                {assigneeOptions.map(x => (
                  <option key={x.id || x._id} value={x.id || x._id}>
                    {x.firstName} {x.lastName} — {x.email}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Deadline">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Field>

            <Field label="Priority">
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(x => <option key={x}>{x}</option>)}
              </select>
            </Field>

            <Field label="Estimated hours">
              <input
                type="number"
                min="0"
                max="10000"
                step="0.5"
                value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4"
              />
            </Field>

            <Field label="Description" required wide>
              <textarea
                rows="3"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                minLength="3"
                placeholder="Expected output and acceptance criteria"
              />
            </Field>

            <Field label="Checklist (one item per line)" wide>
              <textarea
                rows="3"
                value={checklistText}
                onChange={e => setChecklistText(e.target.value)}
                placeholder={'Build page\nTest API\nReview with team lead'}
              />
            </Field>
          </div>
        </FormModal>
      )}

      {loading ? (
        <LoadingRows />
      ) : visibleTasks.length ? (
        <div className="task-list">
          {visibleTasks.map(t => {
            const overdue =
              t.dueDate &&
              new Date(t.dueDate) < new Date() &&
              !['APPROVED'].includes(t.status);

            const canSubmit =
              isEmployee && !['APPROVED', 'SUBMITTED'].includes(t.status);

            return (
              <article className="task-row professional-task-row" key={t._id}>
                <div className="task-main">
                  <div className="task-title-line">
                    <strong>{t.title}</strong>
                    <Status value={t.status} />
                    {user.permissions?.includes('task.assign') && (
                      <div className="employee-row-actions">
                        {!['SUBMITTED', 'APPROVED'].includes(t.status) && (
                          <button type="button" className="icon-button employee-action-icon" onClick={() => editTask(t)} title="Edit task" aria-label={`Edit ${t.title}`}><Pencil size={16} /></button>
                        )}
                        <button type="button" className="icon-button employee-action-icon employee-action-danger" onClick={() => archiveTask(t)} title="Archive task" aria-label={`Archive ${t.title}`}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>

                  <p>{t.description}</p>

                  {t.projectId?.name && (
                    <div className="task-project-label">
                      <FolderKanban size={13} /> {t.projectId.name}
                    </div>
                  )}

                  <div className="task-progress-line">
                    <div className="task-progress-copy">
                      <span><BarChart3 size={14} /> Progress</span>
                      <strong>{t.progress || 0}%</strong>
                    </div>
                    <div className="project-progress-track">
                      <i style={{ width: `${Math.min(100, t.progress || 0)}%` }} />
                    </div>
                  </div>

                  {t.checklist?.length > 0 && (
                    <div className="task-checklist">
                      <strong>
                        Checklist
                        <span className="task-checklist-count">
                          {t.checklist.filter(item => item.completed).length}/{t.checklist.length} complete
                        </span>
                      </strong>
                      {t.checklist.map((item, index) => (
                        <label key={`${t._id}-check-${index}`}>
                          <input
                            type="checkbox"
                            checked={!!item.completed}
                            disabled={
                              String(t.assignedTo?._id || t.assignedTo) !== String(user.id) ||
                              ['APPROVED', 'SUBMITTED'].includes(t.status)
                            }
                            onChange={async e => {
                              try {
                                await api(`/tasks/${t._id}/checklist`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    index,
                                    completed: e.target.checked
                                  })
                                });
                                onRefresh();
                              } catch (err) {
                                notify(err.message, 'error');
                              }
                            }}
                          />
                          {item.title}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="task-meta">
                    <span>
                      Assigned to: {t.assignedTo?.firstName || 'Employee'}{' '}
                      {t.assignedTo?.lastName || ''}
                    </span>
                    <span>Assigned by: {t.assignedBy?.firstName || '—'}</span>
                    <span>Priority: {titleCase(t.priority)}</span>
                    <span className={overdue ? 'task-overdue' : ''}>
                      Due: {niceDate(t.dueDate)}{overdue ? ' · Overdue' : ''}
                    </span>
                    <span>
                      Time: {t.actualHours || 0}h / {t.estimatedHours || 0}h
                    </span>
                  </div>

                  <TaskActivity entries={t.activityLog || []} />

                  {!isEmployee && t.workLogs?.length > 0 && (
                    <div className="task-worklogs">
                      <strong>Recent work logs</strong>
                      {t.workLogs.slice(-3).reverse().map((log, i) => (
                        <div key={log._id || i}>
                          <span>
                            {niceDate(log.createdAt)} · {log.hours || 0}h ·{' '}
                            {log.progress || 0}%
                          </span>
                          {log.note && <p>{log.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {isEmployee && !['APPROVED', 'SUBMITTED'].includes(t.status) && (
                    <div className="task-progress-editor">
                      {t.checklist?.length ? (
                        <p className="task-checklist-progress-note">
                          Progress is calculated from completed checklist items.
                        </p>
                      ) : (
                        <div className="task-progress-editor-top">
                          <label>
                            Update progress{' '}
                            <strong>{progress[t._id] ?? t.progress ?? 0}%</strong>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="99"
                            value={progress[t._id] ?? t.progress ?? 0}
                            onChange={e =>
                              setProgress(v => ({
                                ...v,
                                [t._id]: Number(e.target.value)
                              }))
                            }
                          />
                        </div>
                      )}
                      <div className="task-progress-entry">
                        <Field label="Hours worked">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={hours[t._id] || ''}
                            onChange={e =>
                              setHours(v => ({ ...v, [t._id]: e.target.value }))
                            }
                            placeholder="e.g. 1.5"
                          />
                        </Field>
                        <Field label="Work log note">
                          <input
                            value={workNote[t._id] || ''}
                            onChange={e =>
                              setWorkNote(v => ({
                                ...v,
                                [t._id]: e.target.value
                              }))
                            }
                            placeholder="What did you complete today?"
                          />
                        </Field>
                        <button
                          className="button button-quiet"
                          type="button"
                          onClick={() => saveProgress(t)}
                        >
                          Save work log
                        </button>
                      </div>
                    </div>
                  )}

                  {t.submissions?.length > 0 && (
                    <div className="submission-history">
                      <strong>Submission history</strong>
                      {t.submissions.slice(-3).reverse().map(sub => (
                        <div className="submission-item" key={sub._id}>
                          <span>
                            {niceDate(sub.submittedAt)} · {titleCase(sub.status)}
                            {sub.submittedTo && (
                              <>
                                {' '}· <em>To: {sub.submittedTo.firstName || ''} {sub.submittedTo.lastName || ''}</em>
                              </>
                            )}
                          </span>
                          {sub.note && <p>{sub.note}</p>}
                          {sub.reviewNote && (
                            <p className="review-note">Review: {sub.reviewNote}</p>
                          )}

                          {sub.files?.map((f, idx) => {
                            const isExternal =
                              !!f.externalUrl || f.mimeType === 'text/uri-list';
                            return (
                              <span className="submission-file-actions" key={`${f.url}-${idx}`}>
                                {isExternal ? (
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => window.open(f.url, '_blank', 'noopener,noreferrer')}
                                  >
                                    <LinkIcon size={13} /> {f.name}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="text-button"
                                      onClick={() => openPreview(f)}
                                    >
                                      <Eye size={13} /> Preview
                                    </button>
                                    <button
                                      type="button"
                                      className="text-button"
                                      onClick={async () => {
                                        try {
                                          await downloadFile(
                                            `/uploads/${encodeURIComponent(f.url)}`,
                                            f.name
                                          );
                                        } catch (err) {
                                          notify(err.message, 'error');
                                        }
                                      }}
                                    >
                                      <Download size={13} /> Download
                                    </button>
                                  </>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {canSubmit && (
                    <div className="task-submit">
                      <div className="task-submit-field">
                        <Field label="Submit to" required>
                          <select
                            value={submittedTo[t._id] || ''}
                            onChange={e =>
                              setSubmittedTo(v => ({
                                ...v,
                                [t._id]: e.target.value
                              }))
                            }
                            required
                          >
                            <option value="">Select reviewer</option>
                            {reviewerOptions.map(r => (
                              <option key={r.id || r._id} value={r.id || r._id}>
                                {r.firstName} {r.lastName} — {titleCase(r.role)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <div className="task-submit-field">
                        <Field label="Reference URL (optional)">
                          <input
                            type="url"
                            value={taskUrls[t._id] || ''}
                            onChange={e =>
                              setTaskUrls(v => ({
                                ...v,
                                [t._id]: e.target.value
                              }))
                            }
                            placeholder="https://github.com/... or demo link"
                          />
                        </Field>
                      </div>

                      <textarea
                        rows="2"
                        placeholder="Submission notes / test result / completed work summary"
                        value={note[t._id] || ''}
                        onChange={e =>
                          setNote(v => ({ ...v, [t._id]: e.target.value }))
                        }
                      />

                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.zip"
                        onChange={e =>
                          setTaskFiles(v => ({
                            ...v,
                            [t._id]: e.target.files?.[0] || null
                          }))
                        }
                      />

                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => act(t, 'SUBMIT')}
                      >
                        <Send size={14} /> Submit for review
                      </button>
                    </div>
                  )}

                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title="No tasks yet"
          description={
            manager
              ? 'Create a project and assign tasks to your team.'
              : 'Your assigned tasks will appear here.'
          }
        />
      )}
      {previewFile && (
        <div className="document-preview-backdrop" onClick={closePreview}>
          <section
            className="document-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${previewFile.name}`}
            onClick={event => event.stopPropagation()}
          >
            <header className="document-preview-header">
              <h4>{previewFile.name}</h4>
              <div className="document-preview-header-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={async () => {
                    try {
                      await downloadFile(
                        `/uploads/${encodeURIComponent(previewFile.url)}`,
                        previewFile.name
                      );
                    } catch (error) {
                      notify(error.message, 'error');
                    }
                  }}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closePreview}
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="document-preview-body">
              {previewLoading && <p>Loading preview...</p>}
              {previewError && <p role="alert">{previewError}</p>}
              {previewUrl && !previewLoading && !previewError && (
                <TaskFilePreview
                  url={previewUrl}
                  extension={getFileExtension(previewFile.name)}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default TasksPage;