# W2-B — Merge Evidence

- **Section**: w2-b — Account Page & Password Change
- **Branch**: `codex/demo-expansion-w2-b`
- **Implementation SHA**: `01bd682`
- **Merge SHA (integration)**: `5412e34`
- **Checks on final integration**: typecheck ✅, lint ✅, format ✅ (merge files clean; pre-existing `.pi-subagents/artifacts` warnings only), seed ✅

## Summary

W2-B implements the account page and authenticated password change flow. The AccountPage displays user details (display name, email, role), provides a password change form with validation (8-128 chars), and integrates the change-password API. Backend adds `PATCH /password` (requireAuth guard), the `changePassword` domain function with current-password verification, same-password rejection, password hashing, and session management (invalidate all other sessions, preserve current). The auth plugin is extended to expose `sessionToken` on the request.

Four files changed (+237/-18): auth domain (changePassword function), auth plugin (sessionToken decoration), auth routes (PATCH /password endpoint), AccountPage (full UI).

## Implementation details

### Frontend — AccountPage.tsx
- Requires auth (guarded by ProtectedRoute)
- Displays user details: display name, email, role
- Password change form with current + new password fields
- Client-side validation: both fields required, 8-128 char constraint
- API integration via `changePasswordApi` from `@/api/auth`
- Error handling: ApiError messages displayed, generic fallback
- Success state: green banner shown, fields cleared
- Navigation links: wishlist, sign out (with logout + redirect)

### Backend — routes/auth.ts
- `PATCH /password`: requireAuth preHandler, TypeBox schema, ChangePasswordBody contract
- Validates password length server-side (8-128 chars)
- Delegates to `changePassword` domain
- Maps domain results to HTTP responses: INVALID_CURRENT→400, SAME_PASSWORD→400, SUCCESS→200

### Backend — domains/auth.ts
- `changePassword`: verifies current password against stored hash, rejects same password, hashes new password, updates DB in transaction, invalidates all other sessions while preserving current

### Backend — plugins/auth.ts
- Added `sessionToken` request decoration for session-preservation during password change
- `requireAuth` now sets `request.sessionToken` from cookie

## Acceptance criteria trace

| # | Requirement | Status |
|---|------------|--------|
| 1 | Account page shows user details (display name, email, role) | ✅ |
| 2 | Password change form with current and new password | ✅ |
| 3 | Client-side validation: both required, 8-128 chars | ✅ |
| 4 | Server-side validation: 8-128 chars | ✅ |
| 5 | Current password verified before allowing change | ✅ |
| 6 | Same-password rejection | ✅ |
| 7 | Successful change invalidates other sessions, preserves current | ✅ |
| 8 | Error states handled (current incorrect, same password, API errors) | ✅ |
| 9 | Success feedback shown to user | ✅ |
| 10 | Account page links to wishlist and sign out | ✅ |
| 11 | No password data stored client-side | ✅ |
| 12 | Typecheck, lint, format, seed all pass | ✅ |
