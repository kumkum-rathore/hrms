const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokenUtils');
const { sendError } = require('../utils/apiResponse');
module.exports = async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return sendError(res, { statusCode: 401, message: 'Please log in to access this resource.', code: 'AUTHENTICATION_REQUIRED' });
    let payload;
    try { payload = verifyAccessToken(header.slice(7).trim()); }
    catch { return sendError(res, { statusCode: 401, message: 'Access token is invalid or expired.', code: 'INVALID_ACCESS_TOKEN' }); }
    if (!payload.sub) return sendError(res, { statusCode: 401, message: 'Invalid access token.', code: 'INVALID_ACCESS_TOKEN' });
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE') return sendError(res, { statusCode: 401, message: 'Your account is not active.', code: 'ACCOUNT_NOT_ACTIVE' });
    if (user.tokenVersion !== payload.tokenVersion) return sendError(res, { statusCode: 401, message: 'Your session is no longer valid.', code: 'SESSION_INVALIDATED' });
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    req.user = { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, permissions, branchId: user.branchId ? user.branchId.toString() : null, departmentId: user.departmentId ? user.departmentId.toString() : null, status: user.status };
    next();
  } catch (err) { next(err); }
};
