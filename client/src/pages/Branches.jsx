import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  X,
  Pencil,
  Trash2,
  Save,
  Mail,
  Phone,
  Clock,
  ShieldCheck,
  CalendarDays,
  Globe,
  Users,
  AlertTriangle,
  CheckCircle2,
  MapPinned,
  Fingerprint,
  Power,
  KeyRound,
} from 'lucide-react';

import { api } from '../lib/api';
import {
  Status,
  EmptyState,
  LoadingRows,
  PhoneInput,
  SearchableSelect,
} from '../components/common.jsx';
import { PERMISSION_OPTIONS } from '../utils/permissions.js';
import {
  COUNTRIES,
  getCitiesForCountryState,
  getStatesForCountry,
} from '../utils/locationOptions.js';

const ADMIN_PERMISSION_OPTIONS = PERMISSION_OPTIONS;

export default function Branches({
  branches = [],
  loading = false,
  query = '',
  user,
  onViewEmployees,
}) {
  const [branchRows, setBranchRows] = useState(branches);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminPermissions, setAdminPermissions] = useState([]);
  const [branchCities, setBranchCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState({
    name: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
    contactEmail: '',
    contactPhone: '',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
    geofenceRadiusMeters: 100,
    longitude: '',
    latitude: '',
  });

  useEffect(() => {
    setBranchRows(branches);
  }, [branches]);

  useEffect(() => {
    const country = formData.address.country;
    const state = formData.address.state;

    if (!editing || !country || !state) {
      setBranchCities([]);
      setCitiesLoading(false);
      return undefined;
    }

    let active = true;
    setCitiesLoading(true);
    getCitiesForCountryState(country, state)
      .then(cities => {
        if (active) setBranchCities(cities);
      })
      .catch(loadError => {
        if (active) setError(loadError.message || 'Unable to load cities.');
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editing, formData.address.country, formData.address.state]);

  function getId(branch) {
    return branch?._id || branch?.id;
  }

  function getAdmin(branch) {
    const admin = branch?.branchAdminId || branch?.branchAdmin;
    return admin && typeof admin === 'object' ? admin : null;
  }

  function getAdminName(branch) {
    const admin = getAdmin(branch);

    if (!admin) return 'No admin linked';

    return (
      `${admin.firstName || ''} ${admin.lastName || ''}`.trim() ||
      admin.email ||
      'Branch Admin'
    );
  }

  function openDetails(branch) {
    setSelectedBranch(branch);
    setEditing(false);
    setConfirmDelete(false);
    setError('');
    setSuccess('');

    const address = branch.address || {};
    const coordinates = branch.officeLocation?.coordinates || [];
    const admin = getAdmin(branch);

    setAdminPermissions(
      Array.isArray(admin?.permissions) ? admin.permissions : []
    );

    setFormData({
      name: branch.name || '',
      address: {
        line1: address.line1 || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || 'India',
      },
      contactEmail: branch.contactEmail || '',
      contactPhone: branch.contactPhone || '',
      timezone: branch.timezone || 'Asia/Kolkata',
      status: branch.status || 'ACTIVE',
      geofenceRadiusMeters: branch.geofenceRadiusMeters ?? 100,
      longitude: coordinates[0] ?? '',
      latitude: coordinates[1] ?? '',
    });
  }

  function closeDetails() {
    if (saving) return;

    setSelectedBranch(null);
    setEditing(false);
    setConfirmDelete(false);
    setError('');
    setSuccess('');
    setAdminPermissions([]);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData(previous => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleAddressChange(event) {
    const { name, value } = event.target;

    setFormData(previous => ({
      ...previous,
      address: {
        ...previous.address,
        [name]: value,
      },
    }));
  }

  function handleCountryChange(event) {
    const country = event.target.value;

    setFormData(previous => ({
      ...previous,
      address: {
        ...previous.address,
        country,
        state: '',
        city: '',
      },
    }));
  }

  function handleStateChange(event) {
    const state = event.target.value;

    setFormData(previous => ({
      ...previous,
      address: {
        ...previous.address,
        state,
        city: '',
      },
    }));
  }

  function togglePermission(permission, checked) {
    setAdminPermissions(previous => {
      if (checked) {
        return [...new Set([...previous, permission])];
      }

      return previous.filter(item => item !== permission);
    });
  }

  // FIX: moved out of togglePermission so it's accessible in JSX
  function setAllAdminPermissions() {
    const allPermissions = ADMIN_PERMISSION_OPTIONS.map(([permission]) => permission);
    setAdminPermissions(allPermissions);
  }

  function validateForm() {
    if (formData.name.trim().length < 2) {
      return 'Branch name must contain at least 2 characters.';
    }

    if (
      !formData.address.line1.trim() ||
      !formData.address.city.trim() ||
      !formData.address.state.trim()
    ) {
      return 'Address line 1, city and state are required.';
    }

    const radius = Number(formData.geofenceRadiusMeters);

    if (!Number.isFinite(radius) || radius < 20 || radius > 2000) {
      return 'Geofence radius must be between 20 and 2000 metres.';
    }

    const longitude = Number(formData.longitude);
    const latitude = Number(formData.latitude);

    if (
      formData.longitude === '' ||
      formData.latitude === '' ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      return 'Enter valid longitude and latitude coordinates.';
    }

    if (
      formData.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)
    ) {
      return 'Enter a valid branch contact email.';
    }

    return '';
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!isSuperAdmin) {
      setError('Only Super Admin can edit branch details.');
      return;
    }

    const id = getId(selectedBranch);

    if (!id) {
      setError('Branch ID is missing.');
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: formData.name.trim(),
      address: {
        line1: formData.address.line1.trim(),
        city: formData.address.city.trim(),
        state: formData.address.state.trim(),
        postalCode: formData.address.postalCode.trim(),
        country: formData.address.country.trim() || 'India',
      },
      contactEmail: formData.contactEmail.trim() || null,
      contactPhone: formData.contactPhone.trim() || null,
      timezone: formData.timezone.trim() || 'Asia/Kolkata',
      status: formData.status,
      geofenceRadiusMeters: Number(formData.geofenceRadiusMeters),
      officeLocation: {
        coordinates: [
          Number(formData.longitude),
          Number(formData.latitude),
        ],
      },
      permissions: adminPermissions,
    };

    try {
      const result = await api(
        `/branches/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      const updatedAdmin =
        result.data?.branchAdminId ||
        result.data?.branchAdmin ||
        getAdmin(selectedBranch);

      const updatedBranch = {
        ...selectedBranch,
        ...result.data,
        _id: getId(selectedBranch),
        branchAdminId: updatedAdmin,
        branchAdmin: updatedAdmin,
      };

      setBranchRows(previous =>
        previous.map(branch =>
          String(getId(branch)) === String(id)
            ? { ...branch, ...updatedBranch }
            : branch
        )
      );

      setSelectedBranch(updatedBranch);

      setAdminPermissions(
        Array.isArray(updatedAdmin?.permissions)
          ? updatedAdmin.permissions
          : adminPermissions
      );

      setEditing(false);
      setSuccess(result.message || 'Branch updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update branch.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isSuperAdmin) {
      setError('Only Super Admin can delete a branch.');
      return;
    }

    const id = getId(selectedBranch);

    if (!id) {
      setError('Branch ID is missing.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await api(
        `/branches/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );

      setBranchRows(previous =>
        previous.filter(branch => String(getId(branch)) !== String(id))
      );

      setSelectedBranch(null);
      setConfirmDelete(false);
      setSuccess(result.message || 'Branch deleted successfully.');
    } catch (err) {
      setError(
        err.message ||
        'Branch could not be deleted. Check whether users are still linked to it.'
      );
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!isSuperAdmin) return;

    if (selectedBranch?.status === 'INACTIVE') {
      setError('This branch is already inactive.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const id = getId(selectedBranch);

    try {
      const result = await api(
        `/branches/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'INACTIVE' }),
        }
      );

      const updatedBranch = {
        ...selectedBranch,
        ...result.data,
        _id: getId(selectedBranch),
        branchAdminId:
          selectedBranch.branchAdminId || result.data?.branchAdminId,
        branchAdmin:
          selectedBranch.branchAdmin || result.data?.branchAdmin,
      };

      setBranchRows(previous =>
        previous.map(branch =>
          String(getId(branch)) === String(id)
            ? { ...branch, ...updatedBranch }
            : branch
        )
      );

      setSelectedBranch(updatedBranch);
      setFormData(previous => ({ ...previous, status: 'INACTIVE' }));
      setSuccess(result.message || 'Branch deactivated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to deactivate branch.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = branchRows.filter(branch => {
    const address = branch.address || {};

    const searchText = [
      branch.name,
      branch.branchCode,
      address.city,
      address.state,
      branch.contactEmail,
      getAdminName(branch),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchText.includes((query || '').toLowerCase());
  });
  const branchStates = getStatesForCountry(formData.address.country);
  return (
    <>
      <div className="panel data-panel">
        <div className="panel-heading">
          <div>
            <h3>
              {user?.role === 'BRANCH_ADMIN'
                ? 'My branch details'
                : 'Office locations'}
            </h3>
            <p>
              {user?.role === 'BRANCH_ADMIN'
                ? 'Only your assigned branch is shown here.'
                : `${branchRows.length} locations in your workspace`}
            </p>
          </div>

          <span className="count-pill">
            {user?.role === 'BRANCH_ADMIN'
              ? 'Assigned branch'
              : `${branchRows.length} total`}
          </span>
        </div>

        {loading ? (
          <LoadingRows />
        ) : filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>BRANCH</th>
                  <th>BRANCH ADMIN</th>
                  <th>ADDRESS</th>
                  <th>CONTACT</th>
                  <th>GEOFENCE</th>
                  <th>STATUS</th>
                  <th>TIMEZONE</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(branch => {
                  const address = branch.address || {};

                  return (
                    <tr
                      key={getId(branch)}
                      className="branch-clickable-row"
                      onClick={() => openDetails(branch)}
                      title="Click to view branch details"
                    >
                      <td>
                        <div className="branch-cell">
                          <div className="branch-symbol">
                            <Building2 size={17} />
                          </div>
                          <div>
                            <button
                              type="button"
                              className="text-button"
                              onClick={event => {
                                event.stopPropagation();
                                openDetails(branch);
                              }}
                            >
                              {branch.name}
                            </button>
                            <span>{branch.branchCode || 'No code'}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong>{getAdminName(branch)}</strong>
                          <span className="table-secondary">
                            {getAdmin(branch)?.email || 'No admin linked'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="location-cell">
                          <MapPin size={14} />
                          <span>
                            {[
                              address.line1,
                              address.city,
                              address.state,
                              address.postalCode,
                              address.country || 'India',
                            ]
                              .filter(Boolean)
                              .join(', ') || 'Address not available'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong>{branch.contactEmail || '—'}</strong>
                          <span className="table-secondary">
                            {branch.contactPhone || 'No phone'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="radius-chip">
                          {branch.geofenceRadiusMeters ?? 100} m radius
                        </span>
                      </td>

                      <td>
                        <Status value={branch.status} />
                      </td>

                      <td>{branch.timezone || 'Asia/Kolkata'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="No branches found"
            description="Try a different search or check your branch access."
          />
        )}
      </div>

      {selectedBranch && (
        <div
          className="branch-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <section
            className="branch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-modal-title"
          >
            <header className="branch-modal-header">
              <div>
                <h2 id="branch-modal-title">
                  {editing ? 'Edit Branch' : 'Branch Details'}
                </h2>
                <p>{selectedBranch.branchCode || 'Office location'}</p>
              </div>

              <button
                type="button"
                className="branch-icon-button"
                onClick={closeDetails}
                disabled={saving}
                aria-label="Close branch details"
              >
                <X size={20} />
              </button>
            </header>

            <div className="branch-profile">
              <div className="branch-large-symbol">
                <Building2 size={28} />
              </div>
              <div className="branch-profile-info">
                <h3>{selectedBranch.name}</h3>
                <p>{selectedBranch.branchCode || 'Branch code unavailable'}</p>
                <Status value={selectedBranch.status} />
              </div>
            </div>

            {error && (
              <div className="branch-message branch-error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="branch-message branch-success" role="status">
                <CheckCircle2 size={18} />
                <span>{success}</span>
              </div>
            )}

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="branch-form-grid">
                  <label>
                    Branch code
                    <input value={selectedBranch.branchCode || ''} disabled />
                    <small>Branch code cannot be changed by this API.</small>
                  </label>

                  <label>
                    Branch name *
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      minLength={2}
                    />
                  </label>

                  <label>
                    Country *
                    <SearchableSelect
                      options={COUNTRIES.map(country => ({ value: country.name, label: country.name }))}
                      name="country"
                      value={formData.address.country}
                      onChange={handleCountryChange}
                      placeholder="Choose a country"
                      searchPlaceholder="Search countries"
                    >
                    </SearchableSelect>
                  </label>

                  <label>
                    State *
                    {branchStates.length ? (
                      <SearchableSelect
                        options={branchStates.map(state => ({ value: state.name, label: state.name }))}
                        value={formData.address.state}
                        onChange={handleStateChange}
                        placeholder="Choose a state"
                        searchPlaceholder="Search states"
                      >
                      </SearchableSelect>
                    ) : (
                      <input
                        name="state"
                        value={formData.address.state}
                        onChange={handleStateChange}
                        placeholder="Enter state or region"
                        required
                      />
                    )}
                  </label>

                  <label>
                    City *
                    {branchCities.length || citiesLoading ? (
                      <SearchableSelect
                        options={branchCities.map((city, index) => ({ value: city.name, label: city.name, key: `${city.name}-${index}` }))}
                        value={formData.address.city}
                        onChange={handleAddressChange}
                        disabled={citiesLoading}
                        placeholder={citiesLoading ? 'Loading cities…' : 'Choose a city'}
                        searchPlaceholder="Search cities"
                      >
                      </SearchableSelect>
                    ) : (
                      <input
                        name="city"
                        value={formData.address.city}
                        onChange={handleAddressChange}
                        placeholder="Enter city"
                        required
                      />
                    )}
                  </label>

                  <label className="branch-full-width">
                    Address line 1 *
                    <input
                      name="line1"
                      value={formData.address.line1}
                      onChange={handleAddressChange}
                      required
                    />
                  </label>

                  <label>
                    Postal code
                    <input
                      name="postalCode"
                      value={formData.address.postalCode}
                      onChange={handleAddressChange}
                    />
                  </label>

                  <label>
                    Contact email
                    <input
                      type="email"
                      name="contactEmail"
                      value={formData.contactEmail}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Contact phone
                    <PhoneInput
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Geofence radius (metres)
                    <input
                      type="number"
                      name="geofenceRadiusMeters"
                      min="20"
                      max="2000"
                      value={formData.geofenceRadiusMeters}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Timezone
                    <input
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Longitude
                    <input
                      type="number"
                      name="longitude"
                      min="-180"
                      max="180"
                      step="any"
                      value={formData.longitude}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Latitude
                    <input
                      type="number"
                      name="latitude"
                      min="-90"
                      max="90"
                      step="any"
                      value={formData.latitude}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Branch status
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                </div>

                <section className="branch-permissions-section">
                  <div className="branch-permissions-heading">
                    <KeyRound size={18} />
                    <div>
                      <h3>Branch Admin Permissions</h3>
                      <p>
                        Select the permissions that this Branch Admin should
                        have.
                      </p>
                    </div>
                  </div>

                  <div className="permission-bulk-actions">
                    <button type="button" onClick={setAllAdminPermissions} disabled={saving}>Select all</button>
                    <button type="button" onClick={() => setAdminPermissions([])} disabled={saving}>Clear all</button>
                  </div>
                  <div className="branch-permissions-grid">
                    {ADMIN_PERMISSION_OPTIONS.map(([permission, label]) => (
                      <label
                        key={permission}
                        className="branch-permission-option"
                      >
                        <input
                          type="checkbox"
                          checked={adminPermissions.includes(permission)}
                          onChange={event =>
                            togglePermission(
                              permission,
                              event.target.checked
                            )
                          }
                          disabled={saving}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <footer className="branch-modal-actions">
                  <button
                    type="button"
                    className="branch-btn branch-btn-secondary"
                    onClick={() => {
                      setEditing(false);
                      setError('');
                      setAdminPermissions(
                        Array.isArray(getAdmin(selectedBranch)?.permissions)
                          ? getAdmin(selectedBranch).permissions
                          : []
                      );
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="branch-btn branch-btn-primary"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </footer>
              </form>
            ) : (
              <>
                <div className="branch-details-grid">
                  <BranchDetail
                    icon={Fingerprint}
                    label="Branch Code"
                    value={selectedBranch.branchCode}
                  />

                  <BranchDetail
                    icon={Mail}
                    label="Contact Email"
                    value={selectedBranch.contactEmail}
                  />

                  <BranchDetail
                    icon={Phone}
                    label="Contact Phone"
                    value={selectedBranch.contactPhone}
                  />

                  <BranchDetail
                    icon={ShieldCheck}
                    label="Branch Admin"
                    value={getAdminName(selectedBranch)}
                    secondary={getAdmin(selectedBranch)?.email}
                  />

                  <BranchDetail
                    icon={MapPin}
                    label="Address"
                    value={[
                      selectedBranch.address?.line1,
                      selectedBranch.address?.city,
                      selectedBranch.address?.state,
                      selectedBranch.address?.postalCode,
                      selectedBranch.address?.country || 'India',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  />

                  <BranchDetail
                    icon={MapPinned}
                    label="Office Coordinates"
                    value={
                      selectedBranch.officeLocation?.coordinates?.length === 2
                        ? `Longitude: ${selectedBranch.officeLocation.coordinates[0]}, Latitude: ${selectedBranch.officeLocation.coordinates[1]}`
                        : 'Coordinates not available'
                    }
                  />

                  <BranchDetail
                    icon={Globe}
                    label="Geofence Radius"
                    value={`${selectedBranch.geofenceRadiusMeters ?? 100} metres`}
                  />

                  <BranchDetail
                    icon={Clock}
                    label="Timezone"
                    value={selectedBranch.timezone || 'Asia/Kolkata'}
                  />

                  <BranchDetail
                    icon={CalendarDays}
                    label="Created On"
                    value={
                      selectedBranch.createdAt
                        ? new Date(selectedBranch.createdAt).toLocaleDateString(
                            'en-IN'
                          )
                        : '—'
                    }
                  />

                  <BranchDetail
                    icon={CalendarDays}
                    label="Last Updated"
                    value={
                      selectedBranch.updatedAt
                        ? new Date(selectedBranch.updatedAt).toLocaleDateString(
                            'en-IN'
                          )
                        : '—'
                    }
                  />
                </div>

                {confirmDelete && (
                  <div className="branch-delete-confirm">
                    <strong>
                      Are you sure you want to delete this branch?
                    </strong>
                    <p>
                      The backend will block deletion if users are still linked
                      to this branch. Deactivate the branch instead if you need
                      to retain its HR history.
                    </p>

                    <div className="branch-modal-actions">
                      <button
                        type="button"
                        className="branch-btn branch-btn-secondary"
                        onClick={() => setConfirmDelete(false)}
                        disabled={saving}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="branch-btn branch-btn-danger"
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                        {saving ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                )}

                {!confirmDelete && (
                  <footer className="branch-modal-actions">
                    {isSuperAdmin && selectedBranch.status !== 'INACTIVE' && (
                      <button
                        type="button"
                        className="branch-btn branch-btn-secondary"
                        onClick={handleDeactivate}
                        disabled={saving}
                      >
                        <Power size={16} />
                        Deactivate
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="branch-btn branch-btn-danger"
                        onClick={() => {
                          setConfirmDelete(true);
                          setError('');
                          setSuccess('');
                        }}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="branch-btn branch-btn-primary"
                        onClick={() => {
                          setEditing(true);
                          setConfirmDelete(false);
                          setError('');
                          setSuccess('');

                          const admin = getAdmin(selectedBranch);
                          setAdminPermissions(
                            Array.isArray(admin?.permissions)
                              ? admin.permissions
                              : []
                          );
                        }}
                        disabled={saving}
                      >
                        <Pencil size={16} />
                        Edit Branch
                      </button>
                    )}

                    {typeof onViewEmployees === 'function' && (
                      <button
                        type="button"
                        className="branch-btn branch-btn-secondary"
                        onClick={() => onViewEmployees(selectedBranch)}
                      >
                        <Users size={16} />
                        View Employees
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

function BranchDetail({ icon: Icon, label, value, secondary }) {
  return (
    <div className="branch-detail-item">
      <div className="branch-detail-icon">
        <Icon size={18} />
      </div>
      <div className="branch-detail-content">
        <span>{label}</span>
        <strong>{value || '—'}</strong>
        {secondary && <small>{secondary}</small>}
      </div>
    </div>
  );
}