
import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Field, EmptyState, LoadingRows } from '../components/common.jsx';
import FormModal from '../components/FormModal.jsx';

function DepartmentsPage({ rows = [], user, loading, notify, onRefresh }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  async function save(e) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      const id = editingDepartment?._id || editingDepartment?.id;
      await api(id ? `/departments/${encodeURIComponent(id)}` : '/departments', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      notify(id ? 'Department updated.' : 'Department created.');
      setShow(false);
      setName('');
      setDescription('');
      setEditingDepartment(null);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      notify(err.message || 'Unable to create department.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const canCreate = user?.permissions?.includes('department.create');

  function editDepartment(department) {
    setEditingDepartment(department);
    setName(department.name || '');
    setDescription(department.description || '');
    setShow(true);
  }

  function closeForm() {
    setShow(false);
    setEditingDepartment(null);
    setName('');
    setDescription('');
  }

  async function archiveDepartment(department) {
    if (!window.confirm(`Archive "${department.name}"? Employee records and department history will be retained.`)) return;
    try {
      await api(`/departments/${encodeURIComponent(department._id || department.id)}`, { method: 'DELETE' });
      notify('Department archived.');
      if (onRefresh) await onRefresh();
    } catch (error) {
      notify(error.message || 'Unable to archive department.', 'error');
    }
  }

  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <h3>Departments</h3>
          <p>Branch-scoped teams and department ownership</p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => show ? closeForm() : setShow(true)}
          >
            <Plus size={16} />
            {show ? 'Cancel' : 'Add department'}
          </button>
        )}
      </div>

      {show && (
        <FormModal
          title={editingDepartment ? 'Edit department' : 'Create department'}
          description="Set up a department for your branch and its employees."
          onClose={closeForm}
          onSubmit={save}
          submitLabel={editingDepartment ? 'Save changes' : 'Create department'}
          busy={saving}
        >
          <div className="form-grid">
            <Field label="Department name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </Field>

            <Field label="Department code">
              <input value={editingDepartment?.code || 'Generated automatically on save'} readOnly aria-readonly="true" />
            </Field>

            <Field label="Description" wide>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>

        </FormModal>
      )}

      <div className="department-directory">
        <div className="panel-heading">
          <div>
            <h3>Department directory</h3>
            <p>Current departments</p>
          </div>
        </div>

        {loading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No departments found"
            description="Departments will appear here once they are created."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department name</th>
                  <th>Code</th>
                  <th>Description</th>
                  {canCreate && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {rows.map((department) => (
                  <tr key={department._id || department.id || department.code}>
                    <td>{department.name || '-'}</td>
                    <td>{department.code || '-'}</td>
                    <td>{department.description || '-'}</td>
                    {canCreate && (
                      <td>
                        <div className="employee-row-actions">
                          <button type="button" className="icon-button employee-action-icon" onClick={() => editDepartment(department)} aria-label={`Edit ${department.name}`} title="Edit department"><Pencil size={16} /></button>
                          <button type="button" className="icon-button employee-action-icon employee-action-danger" onClick={() => archiveDepartment(department)} aria-label={`Archive ${department.name}`} title="Archive department"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentsPage;
