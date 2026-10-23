# Architecture and implementation notes

## Stack
- Frontend: React 18, Vite, Lucide icons, responsive custom CSS.
- API: Node.js, Express 5, Mongoose, Zod, bcryptjs, JWT access tokens.
- Database: MongoDB.
- API contract: REST under `/api/v1`, shared response envelope, stable error codes.

## Main data models
- `User`: current employee identity, account status, branch/department references, role and joining date.
- `RefreshSession`: hashed opaque refresh token, token family, rotation/revocation and expiry.
- `Branch`: address, GeoJSON office point and geofence radius.
- `Attendance`: daily check-in/out timestamps and proximity measurements.
- `LeaveRequest`: leave dates, type, reason, status and decision metadata.

## Auth lifecycle
1. Passwords are hashed with bcryptjs.
2. Login issues a short-lived access JWT and a cryptographically random opaque refresh token.
3. Browser refresh tokens are HttpOnly cookies; mobile clients opt in using `X-Client-Type: mobile` and store tokens in platform secure storage.
4. Refresh tokens are stored only as HMAC hashes and rotate on refresh. Reuse of a revoked token revokes active sessions in the token family.
5. Protected requests reload the current user from MongoDB, so account status and tokenVersion are checked server-side.

## Authorization
Role middleware is a starting point. Branch listing, employee listing, attendance and leave endpoints scope data by branch/user. Before production, add a centralized permission matrix, department-level scoping for HODs, resource ownership tests and audit logging for every sensitive write.

## Planned modules
Departments and branch-scoped job-title roles; employee-level permissions; projects/tasks and task status history; employee experience history; secure employee document storage; leave balances and policy rules; payroll with approvals and audit trails; reporting/export; notifications; audit logs; API OpenAPI specification and automated tests.

## Production checklist
HTTPS; strong unique secrets; strict CORS; rate-limit tuning behind a trusted proxy; input validation; CSRF review if cross-site cookie auth is configured; password reset/invitations; MFA; backup/restore testing; logs/metrics/alerts; upload scanning and private object storage; retention/access policies; dependency scanning; unit/integration tests; geofence spoofing threat model; payroll/legal review.
