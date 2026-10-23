import React, { useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus, Search, CalendarDays, Users, CheckCircle2, Clock3, Pencil, Trash2, ArrowUpRight, X } from 'lucide-react';
import { api } from '../lib/api';
import { niceDate, titleCase } from '../utils/labels.js';
import { Field, EmptyState, LoadingRows, PhoneInput, Status } from '../components/common.jsx';

const canManage = user => user.permissions?.includes('project.manage');
const blank = { name:'', description:'', clientName:'', clientPhone:'', clientDetails:'', departmentId:'', startDate:'', dueDate:'', status:'PLANNING', priority:'MEDIUM', members:[] };
function ProjectsPage({ projects=[], employees=[], user, loading, notify, onRefresh, onOpenTasks }) {
  const [show,setShow]=useState(false); const [editing,setEditing]=useState(null); const [form,setForm]=useState(blank); const [search,setSearch]=useState(''); const [statusFilter,setStatusFilter]=useState('ALL'); const [saving,setSaving]=useState(false); const [departments,setDepartments]=useState([]); const [documentFiles,setDocumentFiles]=useState([]); const [documentCategory,setDocumentCategory]=useState('OTHER');
  const manage=canManage(user);
  const filtered=useMemo(()=>projects.filter(p=>(!search || `${p.name} ${p.clientName||''} ${p.description||''}`.toLowerCase().includes(search.toLowerCase()))&&(statusFilter==='ALL'||p.status===statusFilter)),[projects,search,statusFilter]);
  const set=(key,value)=>setForm(v=>({...v,[key]:value}));
  useEffect(() => {
    if (!manage) return undefined;
    let active = true;
    api('/departments')
      .then(response => { if (active) setDepartments(response.data || []); })
      .catch(error => notify(error.message, 'error'));
    return () => { active = false; };
  }, [manage, notify]);
  function openCreate(){setEditing(null);setForm(blank);setDocumentFiles([]);setDocumentCategory('OTHER');setShow(true);}
  function openEdit(p){setEditing(p);setForm({...blank,...p,departmentId:p.departmentId?._id||p.departmentId||'',startDate:p.startDate?.slice(0,10)||'',dueDate:p.dueDate?.slice(0,10)||'',members:(p.members||[]).map(m=>m._id||m)});setDocumentFiles([]);setDocumentCategory('OTHER');setShow(true);}
  async function save(e){
    e.preventDefault();
    if (documentFiles.some(file => file.size > 25 * 1024 * 1024)) {
      notify('Each project document must be 25 MB or smaller.', 'error');
      return;
    }
    setSaving(true);
    let savedProject = null;
    try {
      const payload={...form,startDate:form.startDate||null,dueDate:form.dueDate||null};
      const response=await api(editing?`/projects/${editing._id}`:'/projects',{method:editing?'PATCH':'POST',body:JSON.stringify(payload)});
      savedProject=response.data;
      for (const file of documentFiles) {
        const fileData = new FormData();
        fileData.append('file', file);
        const uploaded = await api('/uploads', { method: 'POST', body: fileData });
        await api('/documents', {
          method: 'POST',
          body: JSON.stringify({
            userId: user.id,
            projectId: savedProject._id,
            category: documentCategory,
            title: file.name,
            fileName: uploaded.data.fileName,
            storageKey: uploaded.data.storageKey,
            mimeType: uploaded.data.mimeType,
            size: uploaded.data.size
          })
        });
      }
      notify(editing?'Project updated.':'Project created.');
      setShow(false);
      await onRefresh();
    } catch(err) {
      if (savedProject) {
        notify(`Project was saved, but its documents could not all be uploaded: ${err.message}`, 'error');
        setShow(false);
        await onRefresh();
      } else {
        notify(err.message,'error');
      }
    } finally {
      setSaving(false);
    }
  }
  async function remove(p){if(!window.confirm(`Delete project “${p.name}”? Projects with tasks cannot be deleted; you can mark them Completed or Cancelled.`))return;try{await api(`/projects/${p._id}`,{method:'DELETE'});notify('Project deleted.');onRefresh();}catch(err){notify(err.message,'error');}}
  const activeEmployees=employees.filter(e=>e.status==='ACTIVE'&&e.role==='EMPLOYEE'&&String(e.departmentId?._id||e.departmentId)===String(form.departmentId));
  return <div className="projects-page">
    <div className="projects-hero"><div><div className="projects-eyebrow"><FolderKanban size={15}/> PROJECT WORKSPACE</div><h2>Projects, in one place.</h2><p>Plan delivery, align the team and track work from kickoff to completion.</p></div>{manage&&<button className="button button-primary" onClick={openCreate}><Plus size={16}/> New project</button>}</div>
    <div className="projects-metrics">
      <div className="project-metric"><span>All projects</span><strong>{projects.length}</strong><small><FolderKanban size={14}/> Across your branch</small></div>
      <div className="project-metric"><span>Active</span><strong>{projects.filter(p=>p.status==='ACTIVE').length}</strong><small><ActivityIcon/> Currently in progress</small></div>
      <div className="project-metric"><span>Tasks completed</span><strong>{projects.reduce((n,p)=>n+(p.taskSummary?.completed||0),0)}</strong><small><CheckCircle2 size={14}/> Approved tasks</small></div>
      <div className="project-metric"><span>Overdue tasks</span><strong>{projects.reduce((n,p)=>n+(p.taskSummary?.overdue||0),0)}</strong><small><Clock3 size={14}/> Needs attention</small></div>
    </div>
    <div className="panel data-panel">
      <div className="panel-heading projects-toolbar"><div><h3>Project portfolio</h3><p>Open a project to view its task board and delivery progress.</p></div><div className="projects-filters"><label className="projects-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All statuses</option>{['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'].map(s=><option key={s} value={s}>{titleCase(s)}</option>)}</select></div></div>
      {loading?<LoadingRows/>:filtered.length?<div className="project-card-grid">{filtered.map(p=>{const stats=p.taskSummary||{total:0,completed:0,overdue:0};const percent=stats.total?Math.round(stats.completed/stats.total*100):0;return <article className="project-card" key={p._id}><div className="project-card-top"><span className="project-icon"><FolderKanban size={19}/></span><Status value={p.status}/>{manage&&<button className="icon-button project-more" title="Edit project" onClick={()=>openEdit(p)}><Pencil size={15}/></button>}</div><h3>{p.name}</h3><p className="project-description">{p.description||'No project description added yet.'}</p><div className="project-client"><span>Client</span><strong>{p.clientName||'Internal project'}</strong></div><div className="project-progress-heading"><span>Delivery progress</span><strong>{percent}%</strong></div><div className="project-progress-track"><i style={{width:`${percent}%`}}/></div><div className="project-stats"><span><CheckCircle2 size={14}/>{stats.completed}/{stats.total} tasks</span><span className={stats.overdue?'project-overdue':''}><Clock3 size={14}/>{stats.overdue} overdue</span></div><div className="project-card-meta"><span><CalendarDays size={14}/> Due {niceDate(p.dueDate)}</span><span><Users size={14}/>{p.members?.length||0} members</span></div><div className="project-card-actions"><button className="button button-primary" onClick={()=>onOpenTasks(p)}>Open task board <ArrowUpRight size={15}/></button>{manage&&<button className="icon-button" title="Delete project" onClick={()=>remove(p)}><Trash2 size={15}/></button>}</div></article>})}</div>:<EmptyState icon={FolderKanban} title="No projects found" description={manage?'Create your first project, add its team and start assigning work.':'Projects you are authorized to access will appear here.'}/>}
    </div>
    {show&&<div className="project-modal-backdrop"><form className="project-modal" onSubmit={save}><div className="project-modal-head"><div><h3>{editing?'Edit project':'Create a project'}</h3><p>Project details, timeline and team access.</p></div><button type="button" className="icon-button" onClick={()=>setShow(false)}><X size={18}/></button></div><div className="project-form-grid">
      <Field label="Project name" required><input value={form.name} minLength="3" maxLength="180" onChange={e=>set('name',e.target.value)} required placeholder="e.g. HRMS Portal Revamp"/></Field>
      <Field label="Priority"><select value={form.priority} onChange={e=>set('priority',e.target.value)}>{['LOW','MEDIUM','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></Field>
      <Field label="Project description" wide><textarea rows="3" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Goals, scope and expected outcome"/></Field>
      <Field label="Client name" required><input value={form.clientName} onChange={e=>set('clientName',e.target.value)} placeholder="Client or internal team" required minLength="2" maxLength="180"/></Field>
      <Field label="Client phone" required><PhoneInput value={form.clientPhone} onChange={e=>set('clientPhone',e.target.value)} placeholder="10-digit contact number" required/></Field>
      <Field label="Department" required>
        <select
          value={form.departmentId}
          onChange={event=>setForm(current=>({...current,departmentId:event.target.value,members:[]}))}
          required
        >
          <option value="">Select department</option>
          {departments.map(department=><option key={department._id} value={department._id}>{department.name}</option>)}
        </select>
      </Field>
      <div className="project-timeline-fields">
        <div className="project-section-heading">
          <strong>Project timeline</strong>
          <span>Set the planned start and deadline.</span>
        </div>
        <div className="project-date-grid">
          <Field label="Start date" required>
            <input
              type="date"
              value={form.startDate}
              onChange={e=>set('startDate',e.target.value)}
              required
            />
          </Field>
          <Field label="Due date" required>
            <input
              type="date"
              min={form.startDate||undefined}
              value={form.dueDate}
              onChange={e=>set('dueDate',e.target.value)}
              required
            />
          </Field>
        </div>
      </div>
      <Field label="Project status"><select value={form.status} onChange={e=>set('status',e.target.value)}>{['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'].map(x=><option key={x}>{x}</option>)}</select></Field>
      <Field label="Client details" wide><textarea rows="2" value={form.clientDetails} onChange={e=>set('clientDetails',e.target.value)} placeholder="Requirements, email or additional notes"/></Field>
      <Field label={`Assign employees to this project (${form.members.length} selected)`} wide>
        <div className="project-members-toolbar">
          <span>{form.departmentId ? 'Select active employees from this department.' : 'Select a department to see its employees.'}</span>
          <div>
            <button
              type="button"
              onClick={() => set('members', activeEmployees.map(employee => String(employee._id || employee.id)))}
              disabled={!form.departmentId || !activeEmployees.length}
            >
              Select all
            </button>
            <button type="button" onClick={() => set('members', [])} disabled={!form.members.length}>
              Clear
            </button>
          </div>
        </div>
        <div className="project-member-picker">
          {activeEmployees.length ? activeEmployees.map(employee => {
            const id = String(employee._id || employee.id);
            const checked = form.members.some(memberId => String(memberId) === id);
            return (
              <label className="project-member-option" key={id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={event => set(
                    'members',
                    event.target.checked
                      ? [...form.members, id]
                      : form.members.filter(memberId => String(memberId) !== id)
                  )}
                />
                <span className="project-member-avatar" aria-hidden="true">
                  {`${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase()}
                </span>
                <span className="project-member-copy">
                  <strong>{employee.firstName} {employee.lastName}</strong>
                  <small>{employee.customRole?.name || employee.role}</small>
                </span>
              </label>
            );
          }) : (
            <p className="project-member-empty">{form.departmentId ? 'No active employees in this department.' : 'Select a department to load available employees.'}</p>
          )}
        </div>
        <small className="project-field-hint">Choose employees who can be assigned project tasks. You can select more than one.</small>
      </Field>
      <Field label="Project documents" wide>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.zip,.apk"
          multiple
          onChange={event=>setDocumentFiles(Array.from(event.target.files||[]))}
        />
        <small>Attach project briefs, contracts or other files (maximum 25 MB per file).</small>
      </Field>
      {documentFiles.length > 0 && (
        <Field label="Document category">
          <select value={documentCategory} onChange={event=>setDocumentCategory(event.target.value)}>
            {['PROJECT','CONTRACT','OTHER'].map(category=><option key={category} value={category}>{titleCase(category)}</option>)}
          </select>
        </Field>
      )}
      </div><div className="project-modal-actions"><button type="button" className="button button-quiet" onClick={()=>setShow(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Create project'}</button></div></form></div>}
  </div>;
}
function ActivityIcon(){return <Clock3 size={14}/>}
export default ProjectsPage;
