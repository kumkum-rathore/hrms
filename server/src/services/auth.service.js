
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshSession = require('../models/RefreshSession');
const {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  createSessionFamilyId,
} = require('../utils/tokenUtils');

function authError(message, statusCode, code) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  return e;
}

function refreshExpiry() {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('REFRESH_TOKEN_EXPIRES_DAYS must be 1–90.');
  }

  return new Date(Date.now() + days * 86400000);
}

async function safeUser(u) {
  const permissions = u.permissions || [];
  let customRole = null;

  if (u.customRoleId && u.branchId) {
    const CustomRole = require('../models/CustomRole');
    customRole = await CustomRole.findOne({
      _id: u.customRoleId,
      branchId: u.branchId,
    })
      .select('name')
      .lean();
  }

  return {
    id: u._id.toString(),
    employeeCode: u.employeeCode || null,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    branchId: u.branchId ? u.branchId.toString() : null,
    departmentId: u.departmentId ? u.departmentId.toString() : null,
    status: u.status,
    joiningDate: u.joiningDate,
    leavingDate: u.leavingDate,
    experienceYears: u.experienceYears,
    experienceSummary: u.experienceSummary,
    hasPreviousExperience: u.hasPreviousExperience,
    previousCompanyName: u.previousCompanyName,
    previousCompanyLeavingDate: u.previousCompanyLeavingDate,
    previousCompanyLeavingReason: u.previousCompanyLeavingReason,
    salaryAmount: u.salaryAmount,
    customRoleId: u.customRoleId,
    customRoleName: customRole?.name || null,
    permissions,
  };
}

async function createSession(user, token, familyId, meta = {}) {
  return RefreshSession.create({
    userId: user._id,
    tokenHash: hashRefreshToken(token),
    familyId,
    expiresAt: refreshExpiry(),
    userAgent: meta.userAgent || null,
    ipAddress: meta.ipAddress || null,
  });
}

async function login({ email, password, meta = {} }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || user.status !== 'ACTIVE') {
    throw authError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    throw authError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const refreshToken = createRefreshToken();

  await createSession(user, refreshToken, createSessionFamilyId(), meta);

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: await safeUser(user),
    accessToken: createAccessToken(user),
    refreshToken,
    refreshExpiresAt: refreshExpiry().toISOString(),
  };
}

async function refresh(token, meta = {}) {
  if (!token || typeof token !== 'string') {
    throw authError('Refresh token is required.', 401, 'REFRESH_TOKEN_REQUIRED');
  }

  const hash = hashRefreshToken(token);

  const session = await RefreshSession.findOne({
    tokenHash: hash,
  }).select('+tokenHash');

  if (!session) {
    throw authError('Refresh token is invalid or expired.', 401, 'INVALID_REFRESH_TOKEN');
  }

  if (session.revokedAt) {
    await RefreshSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    throw authError(
      'Session token reuse detected. Please log in again.',
      401,
      'REFRESH_TOKEN_REUSED'
    );
  }

  if (session.expiresAt <= new Date()) {
    session.revokedAt = new Date();
    await session.save();

    throw authError(
      'Refresh token expired. Please log in again.',
      401,
      'REFRESH_TOKEN_EXPIRED'
    );
  }

  const user = await User.findById(session.userId);

  if (!user || user.status !== 'ACTIVE') {
    session.revokedAt = new Date();
    await session.save();

    throw authError('Account is not active.', 401, 'ACCOUNT_NOT_ACTIVE');
  }

  const nextToken = createRefreshToken();
  const nextHash = hashRefreshToken(nextToken);

  const claimed = await RefreshSession.findOneAndUpdate(
    {
      _id: session._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        revokedAt: new Date(),
        replacedByTokenHash: nextHash,
      },
    },
    { new: true }
  );

  if (!claimed) {
    throw authError(
      'Refresh token has already been used.',
      401,
      'REFRESH_TOKEN_REUSED'
    );
  }

  try {
    await RefreshSession.create({
      userId: user._id,
      tokenHash: nextHash,
      familyId: session.familyId,
      expiresAt: refreshExpiry(),
      userAgent: meta.userAgent || session.userAgent,
      ipAddress: meta.ipAddress || session.ipAddress,
    });
  } catch (err) {
    await RefreshSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    throw err;
  }

  return {
    user: await safeUser(user),
    accessToken: createAccessToken(user),
    refreshToken: nextToken,
    refreshExpiresAt: refreshExpiry().toISOString(),
  };
}

async function logout(token) {
  if (!token || typeof token !== 'string') return;

  await RefreshSession.updateOne(
    {
      tokenHash: hashRefreshToken(token),
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    }
  );
}

module.exports = { login, refresh, logout, safeUser };
