const { sendError } = require('../utils/apiResponse');
module.exports = function notFound(req, res) {
  return sendError(res, { statusCode: 404, message: `Route not found: ${req.method} ${req.originalUrl}`, code: 'ROUTE_NOT_FOUND' });
};
