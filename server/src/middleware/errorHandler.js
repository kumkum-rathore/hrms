const { sendError } = require('../utils/apiResponse');
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err && err.code === 11000) return sendError(res, { statusCode: 409, message: 'A record with this unique value already exists.', code: 'DUPLICATE_RECORD' });
  if (err && err.name === 'ValidationError') return sendError(res, { statusCode: 400, message: 'Please check the submitted data.', code: 'VALIDATION_ERROR', details: Object.values(err.errors).map(e => ({ field: e.path, message: e.message })) });
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  if (statusCode >= 500) console.error(err);
  return sendError(res, { statusCode, message: statusCode >= 500 ? 'An unexpected server error occurred.' : (err.message || 'Request failed.'), code: err.code && /^[A-Z0-9_]+$/.test(err.code) ? err.code : 'REQUEST_ERROR', details: err.details || [] });
};
