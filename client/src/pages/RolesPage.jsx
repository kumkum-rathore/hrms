import React, { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Field, EmptyState, LoadingRows } from '../components/common.jsx';
import FormModal from '../components/FormModal.jsx';

function RolesPage({ rows = [], user, loading, notify, onRefresh }) {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [savingRole, setSavingRole] = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [show, setShow] = useState(false);
  const canManageRoles = user.role === 'BRANCH_ADMIN' && user.permissions?.includes('role.create');

  async function saveRole(event) {
    event.preventDefault();
    const currentId = editingRole?._id;
    setSavingRole(currentId || 'new');
    try {
      await api(currentId ? `/roles/${encodeURIComponent(currentId)}` : '/roles', {
        method: currentId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: roleName.trim(),
          description: description.trim(),
        })
      });
      notify(currentId ? 'Role updated.' : 'Custom role created and ready to assign.');
      setRoleName('');
      setDescription('');
      setEditingRole(null);
      setShow(false);
      await onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSavingRole('');
    }
  }

  async function archiveRole(role) {
    if (!window.confirm(`Archive "${role.name}"? Existing employee records will keep their role history.`)) return;
    try {
      await api(`/roles/${encodeURIComponent(role._id)}`, { method: 'DELETE' });
      notify('Role archived.');
      await onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function startEdit(role) {
    setEditingRole(role);
    setRoleName(role.name);
    setDescription(role.description || '');
    setShow(true);
  }

  function cancelEdit() {
    setShow(false);
    setEditingRole(null);
    setRoleName('');
    setDescription('');
  }

  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <h3>Branch job-title roles</h3>
          <p>{user.role === 'SUPER_ADMIN'
            ? 'Review job-title roles created for each branch.'
            : 'Create reusable job titles and assign them to employees in your branch.'}</p>
        </div>
        {canManageRoles && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setEditingRole(null);
              setRoleName('');
              setDescription('');
              setShow(true);
            }}
          >
            <Plus size={16} /> Add job title
          </button>
        )}
      </div>

      {canManageRoles && show && (
        <FormModal
          title={editingRole ? 'Edit custom role' : 'Create a custom role'}
          description="Create a reusable job title for employees in your branch."
          onClose={cancelEdit}
          onSubmit={saveRole}
          submitLabel={editingRole ? 'Save changes' : 'Create role'}
          busy={!!savingRole}
        >
            <div className="form-grid">
              <Field label="Role name" required>
                <input
                  value={roleName}
                  onChange={event => setRoleName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Description">
                <input
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={500}
                />
              </Field>
            </div>
            <p className="table-secondary">Role is only a job title; employee permissions are selected separately during employee creation. The role code is generated from its name.</p>
        </FormModal>
      )}

      {loading ? <LoadingRows /> : rows.length ? (
        <div className="task-list">
          {rows.map(role => (
            <article className="task-row" key={role._id}>
              <div className="task-main">
                <div className="task-title-line">
                  <strong>{role.name} <span className="mono">{role.code}</span></strong>
                  <span className="count-pill">{role.branchId?.name || 'Your branch'}</span>
                </div>
                <p>{role.description || 'No description provided.'}</p>
                <p className="table-secondary">
                  Created by: {role.createdBy ? `${role.createdBy.firstName || ''} ${role.createdBy.lastName || ''}` : 'Branch Admin'}
                </p>
                <p className="table-secondary">Permissions are assigned to employees individually during employee creation.</p>
              </div>
              {canManageRoles && (
                <div className="employee-row-actions">
                  <button type="button" className="icon-button employee-action-icon" onClick={() => startEdit(role)} aria-label={`Edit ${role.name}`} title="Edit role"><Pencil size={16} /></button>
                  <button type="button" className="icon-button employee-action-icon employee-action-danger" onClick={() => archiveRole(role)} aria-label={`Archive ${role.name}`} title="Archive role"><Trash2 size={16} /></button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No branch roles available"
          description={user.role === 'SUPER_ADMIN'
            ? 'Branch-created job-title roles appear here.'
            : 'Create a custom role above to make it available for employees.'}
        />
      )}
    </div>
  );
}

export default RolesPage;
