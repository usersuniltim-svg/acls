# Security Specification - ACLS 2025

## 1. Data Invariants
- A user can only access their own profile.
- A user profile must contain all required professional fields.
- Email must match the authenticated user's email.
- `onboardedAt` must be set to the server time during creation and remain immutable.
- `email` is immutable after creation.

## 2. The Dirty Dozen Payloads (Targeting `/users/{userId}`)

1. **Identity Spoofing**: Attempt to create a profile for `user_B` while authenticated as `user_A`.
2. **Email Hijacking**: Attempt to set `email` to `victim@gmail.com` while authenticated as `attacker@gmail.com`.
3. **Admin Escalation**: Attempt to inject `isAdmin: true` into the user profile.
4. **Shadow Field Injection**: Attempt to create a profile with an extra `shadowField: "hidden"`.
5. **Partial Data Write**: Attempt to create a profile missing the `councilRegistration` field.
6. **Type Poisoning**: Attempt to set `phone` as a `number` instead of `string`.
7. **Resource Poisoning**: Attempt to set `fullName` to a 2MB string.
8. **Malicious ID**: Attempt to create a profile with a document ID containing special characters (e.g., `../../../etc/passwd`).
9. **Email Re-assignment**: Attempt to update `email` after creation.
10. **Timestamp Manipulation**: Attempt to set `onboardedAt` to a past date.
11. **Terminal State Break**: Attempt to modify `onboardedAt` during an update.
12. **Unauthenticated Read**: Attempt to read any profile without being signed in.

## 3. Test Runner (Conceptual)
All the above payloads MUST return `PERMISSION_DENIED`.
