import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { api, downloadFile, fetchFileBlob } from '../lib/api';
import { niceDate } from '../utils/labels.js';
import { EmptyState, LoadingRows, Status } from '../components/common.jsx';
import TaskActivity from '../components/TaskActivity.jsx';

const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt'];

function getFileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

function ReviewsPage({ reviews = [], loading, notify, onRefresh }) {
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyTaskId, setBusyTaskId] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewRequestId = useRef(0);

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

  async function submitReview(task, decision) {
    setBusyTaskId(task._id);
    try {
      await api(`/tasks/${task._id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          note: reviewNotes[task._id] || ''
        })
      });
      notify(decision === 'APPROVED' ? 'Task approved.' : 'Changes requested.');
      setReviewNotes(current => ({ ...current, [task._id]: '' }));
      onRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusyTaskId('');
    }
  }

  return (
    <div className="panel data-panel task-management-panel">
      <div className="panel-heading">
        <div>
          <h3>Reviews</h3>
          <p>Work submitted to you for review</p>
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : reviews.length ? (
        <div className="task-list">
          {reviews.map(task => {
            const submission = task.submissions?.[task.submissions.length - 1];
            if (!submission) return null;

            return (
              <article className="task-row professional-task-row" key={task._id}>
                <div className="task-main">
                  <div className="task-title-line">
                    <strong>{task.title}</strong>
                    <Status value={submission.status} />
                  </div>
                  <p>{task.description}</p>
                  <div className="task-meta">
                    <span>
                      Submitted by: {submission.submittedBy?.firstName || 'Employee'}{' '}
                      {submission.submittedBy?.lastName || ''}
                    </span>
                    <span>Submitted: {niceDate(submission.submittedAt)}</span>
                    {task.projectId?.name && <span>Project: {task.projectId.name}</span>}
                  </div>
                  <TaskActivity entries={task.activityLog || []} />

                  {submission.note && (
                    <div className="submission-history">
                      <strong>Submission notes</strong>
                      <div className="submission-item">{submission.note}</div>
                    </div>
                  )}

                  {submission.files?.length > 0 && (
                    <div className="submission-history">
                      <strong>Submitted files and links</strong>
                      <div className="submission-item">
                        {submission.files.map((file, index) => {
                          const isExternal =
                            !!file.externalUrl || file.mimeType === 'text/uri-list';
                          const canPreview =
                            !isExternal &&
                            PREVIEWABLE_EXTENSIONS.includes(getFileExtension(file.name));

                          return (
                            <div
                              className="submission-file-actions"
                              key={`${file.url}-${index}`}
                            >
                              {isExternal ? (
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() =>
                                    window.open(file.url, '_blank', 'noopener,noreferrer')
                                  }
                                >
                                  <LinkIcon size={13} /> {file.name}
                                </button>
                              ) : (
                                <>
                                  {canPreview && (
                                    <button
                                      type="button"
                                      className="text-button"
                                      onClick={() => openPreview(file)}
                                    >
                                      <Eye size={13} /> Preview
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={async () => {
                                      try {
                                        await downloadFile(
                                          `/uploads/${encodeURIComponent(file.url)}`,
                                          file.name
                                        );
                                      } catch (error) {
                                        notify(error.message, 'error');
                                      }
                                    }}
                                  >
                                    <Download size={13} /> {file.name}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="task-submit">
                    <textarea
                      rows="2"
                      placeholder="Review notes or changes required"
                      value={reviewNotes[task._id] || ''}
                      onChange={event =>
                        setReviewNotes(current => ({
                          ...current,
                          [task._id]: event.target.value
                        }))
                      }
                    />
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={busyTaskId === task._id}
                      onClick={() => submitReview(task, 'APPROVED')}
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      className="button button-quiet"
                      type="button"
                      disabled={busyTaskId === task._id}
                      onClick={() => submitReview(task, 'CHANGES_REQUESTED')}
                    >
                      Request changes
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title="No reviews waiting"
          description="Tasks submitted to you for review will appear here."
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
                ['pdf', 'txt'].includes(getFileExtension(previewFile.name)) ? (
                  <iframe
                    src={previewUrl}
                    title="Review attachment preview"
                    className="document-preview-frame"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Review attachment preview"
                    className="document-preview-image"
                  />
                )
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ReviewsPage;
