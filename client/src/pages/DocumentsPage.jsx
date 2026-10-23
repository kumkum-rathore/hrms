import React, { useEffect, useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  X,
  AlertCircle
} from 'lucide-react';

import { api, downloadFile, fetchFileBlob } from '../lib/api';

import { titleCase, niceDate } from '../utils/labels.js';

import {
  Field,
  Status,
  EmptyState,
  LoadingRows
} from '../components/common.jsx';
import FormModal from '../components/FormModal.jsx';

const PREVIEWABLE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt'];

function getExt(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

function isPreviewable(doc) {
  return PREVIEWABLE_EXT.includes(
    getExt(doc.fileName || doc.title || '')
  );
}

function PreviewRenderer({ url, ext }) {
  if (ext === 'pdf') {
    return (
      <iframe
        src={url}
        title="Document preview"
        className="document-preview-frame"
      />
    );
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return (
      <img
        src={url}
        alt="Document preview"
        className="document-preview-image"
      />
    );
  }

  if (ext === 'txt') {
    return (
      <iframe
        src={url}
        title="Text preview"
        className="document-preview-frame"
      />
    );
  }

  return <p>Preview not available.</p>;
}

function DocumentsPage({
  documents = [],
  user,
  loading = false,
  notify,
  onRefresh
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('EXPERIENCE');
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const canReviewDocuments =
    user?.permissions?.includes('document.verify');
  const canUploadDocuments = user?.permissions?.includes('document.upload');

  const pendingStatuses = ['PENDING', 'SUBMITTED'];

  // Cleanup blob URL on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function review(doc, status) {
    if (!canReviewDocuments) {
      notify?.('You do not have permission to review documents.', 'error');
      return;
    }

    if (!doc?._id) {
      notify?.('Document ID is missing.', 'error');
      return;
    }

    if (!pendingStatuses.includes(doc.status)) {
      notify?.('Only pending documents can be reviewed.', 'error');
      return;
    }

    setReviewingId(doc._id);

    try {
      await api(`/documents/${encodeURIComponent(doc._id)}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      notify?.(
        status === 'VERIFIED'
          ? 'Document verified successfully.'
          : 'Document rejected.',
        'success'
      );

      await onRefresh?.();
    } catch (err) {
      notify?.(err.message || 'Failed to review document.', 'error');
    } finally {
      setReviewingId(null);
    }
  }

  async function upload(event) {
    event.preventDefault();

    if (!file) {
      notify?.('Choose a file first.', 'error');
      return;
    }

    // Client-side size check: 25 MB.
    if (file.size > 25 * 1024 * 1024) {
      notify?.('File size must not exceed 25 MB.', 'error');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploaded = await api('/uploads', {
        method: 'POST',
        body: formData
      });

      const uploadedFile = uploaded.data;

      await api('/documents', {
        method: 'POST',
        body: JSON.stringify({
          category,
          title: title.trim() || file.name,
          fileName: uploadedFile.fileName,
          storageKey: uploadedFile.storageKey,
          mimeType: uploadedFile.mimeType,
          size: uploadedFile.size
        })
      });

      notify?.('Document uploaded successfully.', 'success');

      setFile(null);
      setTitle('');
      setCategory('EXPERIENCE');
      setShowUpload(false);

      const fileInput = document.getElementById('employee-document-file');
      if (fileInput) fileInput.value = '';

      await onRefresh?.();
    } catch (err) {
      notify?.(err.message || 'Document upload failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(doc) {
    if (!doc?.storageKey) {
      notify?.('File location is unavailable.', 'error');
      return;
    }

    try {
      await downloadFile(
        `/uploads/${encodeURIComponent(doc.storageKey)}`,
        doc.fileName || doc.title || 'document'
      );
    } catch (err) {
      notify?.(err.message || 'File download failed.', 'error');
    }
  }

  async function openPreview(doc) {
    if (!doc?.storageKey) {
      notify?.('File location is unavailable.', 'error');
      return;
    }

    if (!isPreviewable(doc)) {
      notify?.(
        'Preview is not available for this file type. Please download it instead.',
        'error'
      );
      return;
    }

    // Reset state
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewDoc(doc);
    setPreviewError('');
    setPreviewUrl(null);
    setPreviewLoading(true);

    try {
      const blob = await fetchFileBlob(
        `/uploads/${encodeURIComponent(doc.storageKey)}/preview`
      );
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err.message || 'Preview failed.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewDoc(null);
    setPreviewError('');
    setPreviewLoading(false);
  }

  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <h3>Documents</h3>
          <p>Private employee and project files, with verification tools</p>
        </div>

        <div className="heading-actions">
          <span className="count-pill">{documents.length} files</span>
          {canUploadDocuments && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setShowUpload(true)}
            >
              <Upload size={16} /> Upload document
            </button>
          )}
        </div>
      </div>

      {canUploadDocuments && showUpload && (
        <FormModal
          title="Upload employee document"
          description="Choose a category and add a private document to your employee record."
          onClose={() => setShowUpload(false)}
          onSubmit={upload}
          submitLabel="Upload document"
          busyLabel="Uploading…"
          busy={busy}
        >
          <div className="form-grid">
          <Field label="Document title">
            <input
              type="text"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Experience certificate"
              maxLength={150}
            />
          </Field>

          <Field label="Category" required>
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
              required
            >
              <option value="IDENTITY">Identity</option>
              <option value="EDUCATION">Education</option>
              <option value="EXPERIENCE">Experience</option>
              <option value="CONTRACT">Contract</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>

          <Field label="Choose file (max 25 MB)" required wide>
            <input
              id="employee-document-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.xlsx,.zip,.apk"
              onChange={event =>
                setFile(event.target.files?.[0] || null)
              }
              required
            />
          </Field>
          </div>
        </FormModal>
      )}

      {/* Documents table */}
      {loading ? (
        <LoadingRows />
      ) : documents.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DOCUMENT</th>
                <th>{documents.some(doc => doc.projectId) ? 'EMPLOYEE / PROJECT' : 'EMPLOYEE'}</th>
                <th>CATEGORY</th>
                <th>UPLOADED</th>
                <th>STATUS</th>
                <th>FILE</th>

                {canReviewDocuments && <th>REVIEW</th>}
              </tr>
            </thead>

            <tbody>
              {documents.map(doc => {
                const canReviewThisDocument =
                  canReviewDocuments &&
                  pendingStatuses.includes(doc.status);

                const isReviewing = reviewingId === doc._id;
                const previewable = isPreviewable(doc);

                return (
                  <tr key={doc._id}>
                    <td>
                      <div className="document-title-cell">
                        <FileText size={17} />
                        <span>
                          {doc.title || doc.fileName || 'Untitled document'}
                        </span>
                      </div>
                    </td>

                    <td>
                      {doc.projectId
                        ? <span className="project-document-label">{doc.projectId.name}</span>
                        : doc.userId
                        ? `${doc.userId.firstName || ''} ${
                            doc.userId.lastName || ''
                          }`.trim() || '—'
                        : '—'}
                    </td>

                    <td>{titleCase(doc.category || 'OTHER')}</td>

                    <td>{niceDate(doc.createdAt)}</td>

                    <td>
                      <Status value={doc.status} />
                    </td>

                    <td>
                      <div className="document-file-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => openPreview(doc)}
                          disabled={!previewable}
                          title={
                            previewable
                              ? 'Preview document'
                              : 'Preview not available for this file type'
                          }
                        >
                          <Eye size={15} /> Preview
                        </button>

                        <button
                          type="button"
                          className="text-button"
                          onClick={() => handleDownload(doc)}
                          title="Download document"
                        >
                          <Download size={15} /> Download
                        </button>
                      </div>
                    </td>

                    {canReviewDocuments && (
                      <td>
                        {canReviewThisDocument ? (
                          <div className="document-review-actions">
                            <button
                              type="button"
                              className="button button-primary"
                              onClick={() => review(doc, 'VERIFIED')}
                              disabled={isReviewing}
                              title="Verify document"
                            >
                              <CheckCircle2 size={15} />
                              {isReviewing ? 'Please wait…' : 'Verify'}
                            </button>

                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => review(doc, 'REJECTED')}
                              disabled={isReviewing}
                              title="Reject document"
                            >
                              <XCircle size={15} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="document-reviewed-label">
                            {doc.status === 'VERIFIED'
                              ? 'Verified'
                              : doc.status === 'REJECTED'
                                ? 'Rejected'
                                : 'No action'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No documents uploaded"
          description="Upload experience certificates and other employee documents here."
        />
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="document-preview-backdrop" onClick={closePreview}>
          <div
            className="document-preview-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="document-preview-header">
              <div>
                <h4>{previewDoc.title || previewDoc.fileName}</h4>
                <small>{titleCase(previewDoc.category || 'OTHER')}</small>
              </div>

              <div className="document-preview-header-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleDownload(previewDoc)}
                >
                  <Download size={15} /> Download
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
            </div>

            <div className="document-preview-body">
              {previewLoading && (
                <div className="document-preview-loading">
                  <AlertCircle size={20} /> Loading preview…
                </div>
              )}

              {previewError && (
                <div className="document-preview-error">
                  <AlertCircle size={20} />
                  <p>{previewError}</p>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => handleDownload(previewDoc)}
                  >
                    <Download size={15} /> Download instead
                  </button>
                </div>
              )}

              {previewUrl && !previewLoading && !previewError && (
                <PreviewRenderer
                  url={previewUrl}
                  ext={getExt(previewDoc.fileName || previewDoc.title || '')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsPage;