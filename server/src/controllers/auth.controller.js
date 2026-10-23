const { loginSchema } = require('../validators/auth.validators');
const service = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const mobile = req => (req.get('x-client-type') || '').toLowerCase() === 'mobile';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: process.env.COOKIE_SAME_SITE || 'lax', path: '/api/v1/auth' });
const setCookie = (res, token) => res.cookie('hrms_refresh', token, { ...cookieOptions(), maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7) * 86400000 });
const clearCookie = res => res.clearCookie('hrms_refresh', cookieOptions());
const tokenFrom = req => req.cookies?.hrms_refresh || req.body?.refreshToken || null;
const meta = req => ({ userAgent: req.get('user-agent') || null, ipAddress: req.ip || null });
function fail(res, err) {
  if (err.statusCode && err.statusCode < 500) return sendError(res, { statusCode: err.statusCode, message: err.message, code: err.code || 'AUTH_ERROR' });
  console.error('Auth request failed:', err); return sendError(res, { statusCode: 500, message: 'Unable to complete authentication request.', code: 'AUTHENTICATION_ERROR' });
}
async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, { statusCode: 400, message: 'Please check your login details.', code: 'VALIDATION_ERROR', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
    const result = await service.login({ ...parsed.data, meta: meta(req) });
    if (mobile(req)) {
      return sendSuccess(res, { message: 'Login successful.', data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, refreshExpiresAt: result.refreshExpiresAt, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' } });
    }
    setCookie(res, result.refreshToken);
    return sendSuccess(res, { message: 'Login successful.', data: { user: result.user, accessToken: result.accessToken, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' } });
  } catch (err) { return fail(res, err); }
}
async function refresh(req, res) {
  try {
    const result = await service.refresh(tokenFrom(req), meta(req));
    if (mobile(req)) return sendSuccess(res, { message: 'Token refreshed.', data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken, refreshExpiresAt: result.refreshExpiresAt, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' } });
    setCookie(res, result.refreshToken);
    return sendSuccess(res, { message: 'Token refreshed.', data: { user: result.user, accessToken: result.accessToken, tokenType: 'Bearer', expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' } });
  } catch (err) { clearCookie(res); return fail(res, err); }
}
async function logout(req, res) {
  try { await service.logout(tokenFrom(req)); clearCookie(res); return sendSuccess(res, { message: 'Logout successful.' }); }
  catch (err) { clearCookie(res); return fail(res, err); }
}
async function me(req, res) { return sendSuccess(res, { message: 'Current user loaded.', data: { user: req.user } }); }
module.exports = { login, refresh, logout, me };
