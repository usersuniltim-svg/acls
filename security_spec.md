# Security rules: what they guarantee

The rules are in `firestore.rules`. They are tested against the Firestore
emulator in `tests-rules/firestoreRules.test.ts` (CI job "firestore-rules";
locally: `npm run test:rules:emulator`, needs Java 21).

After changing `firestore.rules`, publish them in the Firebase console
(Firestore > Rules, database `ai-studio-acls2025companio-...`). The app
cannot publish rules itself.

## Who is admin

- A sign-in token with the custom claim `admin: true`. Set it once with
  `scripts/set-admin-claim.mjs` (instructions in the file).
- While the claim is being rolled out, the verified owner email is also
  accepted. Remove that line from `isAdmin()` in `firestore.rules`, and the
  matching check in `server/auth.ts`, once the claim is set.

## Doctor profiles and verification (KYC)

- A doctor reads and writes only their own profile.
- A doctor can never approve themselves, set `approvedAt` / `approvedBy`, or
  make themselves admin.
- After approval, a doctor cannot change the details the approval vouches for
  (name, council registration, profession, degree, date of birth) while
  keeping the approval. Changing them sends the profile back to "pending".
- Only the admin approves or rejects.

## Saved cases (`users/{uid}/cases/{caseId}`)

- A doctor reads and writes only cases under their own account.
- A case is signed when it has a fingerprint (`contentHash`) or a signature.
- The content of a signed case never changes. Only `updatedAt`,
  `storageVersion` and `amendments` may change.
- `amendments` is append-only: nothing already there can be removed, edited or
  reordered; at most 5 are added per write; each new one must be written by
  the signed-in doctor (`by` = their uid), be an `ADDENDUM` or `VOID`, and have
  1 to 2000 characters of text.
- A doctor cannot delete a signed case (it can be voided, with a reason).
  The admin can delete one, for example for a data-protection request.
- The fingerprint is SHA-256 over the signed content (`src/lib/caseIntegrity.ts`).
  The app and the printed report show whether the content still matches it.

## Other collections

- The old top-level `/cases` collection is read-only (own cases, or admin).
- Only the admin can read every doctor's cases (collection-group query).
- `test/connection` is readable by anyone (connection check); nothing else.
