
import React, { useEffect, useId, useRef, useState } from 'react';
import { BriefcaseBusiness, ChevronDown, Eye, EyeOff, Search, Sparkles } from 'lucide-react';
import { titleCase, pageLabel } from '../utils/labels.js';

function Field({ label, required, wide, children }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span>
        {label}
        {required && <i>*</i>}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();

  return (
    <span className="password-input-control">
      <input
        {...props}
        id={props.id || generatedId}
        className={className}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-visibility-toggle"
        onClick={() => setVisible(current => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
}

function PasswordField({ label, required, ...props }) {
  const generatedId = useId();

  return (
    <div className="field">
      <label htmlFor={props.id || generatedId}>
        {label}
        {required && <i>*</i>}
      </label>
      <PasswordInput {...props} id={props.id || generatedId} />
    </div>
  );
}

function PhoneInput(props) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]{10}"
      maxLength={10}
      title="Enter exactly 10 digits."
    />
  );
}

function SearchableSelect({
  options,
  name,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listboxId = useId();
  const selectedOption = (options || []).find(option => option.value === value);
  const filteredOptions = (options || []).filter(option =>
    option.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function selectOption(option) {
    onChange({ target: { name, value: option.value } });
    setSearch('');
    setOpen(false);
  }

  return (
    <span className="searchable-select" ref={rootRef}>
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required
        tabIndex={-1}
        aria-hidden="true"
        className="searchable-select-native"
        onInvalid={event => {
          event.preventDefault();
          setOpen(true);
          triggerRef.current?.focus();
        }}
      >
        <option value="">{placeholder}</option>
        {(options || []).map(option => (
          <option value={option.value} key={option.key || option.value}>{option.label}</option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="searchable-select-trigger"
        onClick={() => setOpen(current => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="searchable-select-menu">
          <div className="searchable-select-search">
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onKeyDown={event => {
                if (event.key === 'Escape') setOpen(false);
                if (event.key === 'Enter' && filteredOptions.length === 1) {
                  event.preventDefault();
                  selectOption(filteredOptions[0]);
                }
              }}
            />
          </div>
          <div id={listboxId} className="searchable-select-options" role="listbox">
            {filteredOptions.length ? filteredOptions.map(option => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="searchable-select-option"
                key={option.key || option.value}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            )) : (
              <small className="searchable-select-empty">No matches found.</small>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

function Status({ value }) {
  const v = (value || 'UNKNOWN').toLowerCase();

  return (
    <span className={`status-pill status-${v}`}>
      <i />
      {titleCase(value || 'Unknown')}
    </span>
  );
}

function EmptyState({
  icon: Icon = BriefcaseBusiness,
  title = 'No data found',
  description = 'There is no data to display right now.',
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows">
      {[1, 2, 3, 4].map((n) => (
        <div key={n}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function ComingSoon({ page }) {
  return (
    <div className="panel coming-panel">
      <div className="coming-art">
        <div className="coming-circle">
          <Sparkles size={28} />
        </div>
      </div>

      <span className="eyebrow">IN THE WORKS</span>
      <h2>{pageLabel(page)} are on the roadmap.</h2>
      <p>
        This starter already has the foundations for your people workspace.
        This area can be connected to the next backend module.
      </p>
      <span className="coming-tag">
        FOUNDATION READY · MODULE NEXT
      </span>
    </div>
  );
}

export { Field, PasswordField, PasswordInput, PhoneInput, SearchableSelect, Status, EmptyState, LoadingRows, ComingSoon };
