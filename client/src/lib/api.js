const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export async function api(path, options = {}) {
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(options.body && !isFormData
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  const result = await response.json().catch(() => ({
    success: false,
    message: 'Server returned an unreadable response.'
  }));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'Request failed.');
    error.status = response.status;
    error.code = result.error?.code;
    error.details = result.error?.details || [];
    throw error;
  }
  return result;
}

export async function login(email, password) {
  const result = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setAccessToken(result.data.accessToken);
  return result.data;
}

export async function restoreSession() {
  try {
    const result = await api('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({})
    });
    setAccessToken(result.data.accessToken);
    return result.data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } finally {
    setAccessToken(null);
  }
}

export async function downloadFile(path, filename = 'download') {
  const response = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include'
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'File download failed.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetch a private file as a Blob (for previews).
 * Respects the same auth token + cookies as api() / downloadFile().
 */
export async function fetchFileBlob(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include'
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'File preview failed.');
  }
  return response.blob();
}