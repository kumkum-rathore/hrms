const { sendError } = require('../utils/apiResponse');
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return sendError(res, { statusCode: 401, message: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  if (!roles.includes(req.user.role)) return sendError(res, { statusCode: 403, message: 'You do not have permission to perform this action.', code: 'INSUFFICIENT_PERMISSIONS' });
  next();
};
