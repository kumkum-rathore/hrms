const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function accessSecret() {
  const value = process.env.ACCESS_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error('ACCESS_TOKEN_SECRET must be at least 32 characters.');
  return value;
}
function refreshPepper() {
  const value = process.env.REFRESH_TOKEN_PEPPER;
  if (!value || value.length < 32) throw new Error('REFRESH_TOKEN_PEPPER must be at least 32 characters.');
  return value;
}
function createAccessToken(user) {
  return jwt.sign({ tokenVersion: user.tokenVersion }, accessSecret(), {
    subject: user._id.toString(), expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    issuer: 'orbit-hr-api', audience: 'orbit-hr-clients'
  });
}
function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret(), { issuer: 'orbit-hr-api', audience: 'orbit-hr-clients' });
}
function createRefreshToken() { return crypto.randomBytes(48).toString('base64url'); }
function hashRefreshToken(token) { return crypto.createHmac('sha256', refreshPepper()).update(token).digest('hex'); }
function createSessionFamilyId() { return crypto.randomUUID(); }
module.exports = { createAccessToken, verifyAccessToken, createRefreshToken, hashRefreshToken, createSessionFamilyId };
