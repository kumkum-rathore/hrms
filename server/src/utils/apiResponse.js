function sendSuccess(res, { statusCode = 200, message = 'Request completed successfully.', data = null, meta = null } = {}) {
  return res.status(statusCode).json({ success: true, message, data, meta });
}
function sendError(res, { statusCode = 500, message = 'An unexpected error occurred.', code = 'INTERNAL_SERVER_ERROR', details = [] } = {}) {
  return res.status(statusCode).json({ success: false, message, error: { code, details } });
}
module.exports = { sendSuccess, sendError };
