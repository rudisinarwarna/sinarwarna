# Security Specification — Sinar Warna Firebase Firestore

## 1. Data Invariants
1. **Strict Ownership & 3-Tier Admin RBAC Isolation (`Admin Utama`, `Admin+`, `Admin`)**:
   - Every `/users/{userId}` document can only be created by `request.auth.uid == userId` (`email_verified == true`) with `role == 'user'` (except primary admin `rudi.sinarwarna@gmail.com` who may initialize as `role == 'admin_plus'`), `blocked == false`, and `deleted == false`.
   - Regular users CANNOT list `/users` (`allow list: if isAnyAdmin()`), read other users' profiles, or escalate their own `role`, `verifiedBadge`, `blocked`, or `deleted` fields.
   - **3-Tier Admin Hierarchy**:
     - **Admin Utama (`rudi.sinarwarna@gmail.com`)**: Immutable against demotion, badge removal, blocking, or deletion. Can manage all tiers (`user`, `admin`, `admin_plus`), appoint or demote `admin_plus`, grant/revoke `verifiedBadge`, block/unblock, delete accounts, and read/write `/adminMemories`.
     - **Admin+ (`admins/{uid}.level == 'admin_plus'`)**: Can read/write `/adminMemories` (view, add, delete private memories). Can manage `user` and plain `admin` accounts (`user` <-> `admin`, `verifiedBadge`, `blocked`, delete), but CANNOT modify fellow `admin_plus` or `Admin Utama`, and CANNOT promote anyone to `admin_plus`.
     - **Admin (`admins/{uid}` without `admin_plus`)**: CANNOT read, list, create, update, or delete `/adminMemories` or `/adminMeta`. Can manage `user` accounts ONLY (`user` -> `admin`, `verifiedBadge`, `blocked`, delete), and CANNOT modify any `admin`, `admin_plus`, or `Admin Utama`.
2. **Admin Registry (`/admins/{userId}`)**:
   - Only `isAnyAdmin()` may read/list `/admins` (or owner reading their own `/admins/{uid}`).
   - Plain `Admin` may only create `/admins/{userId}` with `level == 'admin'` for an existing `'user'`, and cannot update or delete `/admins/{userId}`.
   - `Admin+` may create (`level == 'admin'`) and delete `/admins/{userId}` only for plain `'admin'` targets (never `'admin_plus'` or primary admin).
   - Only `Admin Utama` may create/update/delete `/admins/{userId}` with `level == 'admin_plus'`.
3. **Admin+ Private AI Memories (`/adminMemories/{memoryId}` & `/adminMeta/seed`)**:
   - Strictly restricted to `isAdminPlus()` (`Admin+` and `Admin Utama`). Unauthenticated users, regular users, and plain `Admin` accounts are completely denied (`PERMISSION_DENIED`).
4. **Conversation & Message Isolation + Blocked User Guard**:
   - Blocked or deleted users (`users/{uid}.blocked == true || users/{uid}.deleted == true`) are denied creating or updating conversations/messages.
   - Regular users can only read/write their own `/conversations/{conversationId}` and `/conversations/{conversationId}/messages/{messageId}` documents.
   - Verified Admins may list/delete target user conversations and messages strictly for account deletion cleanup.
5. **Public Live, Freewill & Default Theme Config (`/appConfig/live`, `/appConfig/freewill`, `/appConfig/theme`)**:
   - `/appConfig/live` contains non-PII configuration (`greetingText`, `updatedBy` UID, timestamps), writable strictly by `isAdminPlus()`.
   - `/appConfig/freewill` contains non-PII `enabled` boolean and `memoriesSummary` (cleared to `""` whenever disabled), writable strictly by `isPrimaryAdmin()` (`rudi.sinarwarna@gmail.com`).
   - `/appConfig/theme` contains non-PII `defaultTheme` (`"dark"` or `"light"`), writable strictly by `isAnyAdmin()`.
   - All three documents are readable via single-document `get` (`allow list: if false`) so the server and clients reflect active settings without exposing PII.
6. **Public AI Memories (`/publicMemories/{memoryId}`)**:
   - Non-PII general store/service memories (`isPublic == true`, no `createdByEmail`), readable via `get` and guarded `list` (`resource.data.isPublic == true`) so AI serves them for everyone.
   - Writable (`create`, `update`, `delete`) by `Admin` tier and above (`isAdminOrFreewill()`).
7. **Strict Key, Bounds, & Timestamp Enforcement**:
   - All writes validate `keys().hasAll(...)`, `keys().hasOnly(...)`, `affectedKeys().hasOnly(...)` on update, regex IDs (`^[a-zA-Z0-9_\-]+$`), bounded string lengths, and server timestamps (`request.time`).
   - Zero `get()` or `exists()` calls inside `allow list` rules.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/conversations/conv_1`, `/adminMemories/mem_1`, `/publicMemories/pub_1` write, or `/appConfig/*` write.
2. **Unverified email user** (`email_verified == false`) attempting to create `/users/u1`, `/conversations/conv_1`, or `/publicMemories/pub_1`.
3. **Self-promotion attack**: Regular user or plain Admin creating/updating their own `role` to `"admin"` or `"admin_plus"`.
4. **Plain Admin memory & Live greeting snooping/tampering**: Plain `Admin` attempting to read, list, create, or delete `/adminMemories`, or write `/appConfig/live` or `/appConfig/freewill`.
5. **Non-primary Admin FREEWILL tampering**: `Admin+` or plain `Admin` attempting to enable/disable `/appConfig/freewill`.
6. **Admin+ privilege escalation**: `Admin+` attempting to promote a user to `admin_plus` or modify/delete another `Admin+`.
7. **Primary admin sabotage**: Any admin attempting to block, demote, or delete `rudi.sinarwarna@gmail.com`.
8. **Non-admin scraping PII**: Non-admin user listing `/users` or `/appConfig` when Freewill is disabled.
9. **Blocked user write**: User with `blocked: true` trying to create a new conversation, message, or public memory.
10. **Identity spoofing**: User A creating `/conversations/conv_1` with `userId: "user_B"`, `/publicMemories/pub_1` with `createdBy: "user_B"`, or updating `/appConfig/live` with someone else's `updatedBy`.
11. **Shadow field injection**: Creating `/adminMemories/mem_1`, `/publicMemories/pub_1`, or `/appConfig/live` with unapproved extra field `evil: true`.
12. **Client-forged timestamp**: Creating/updating `/adminMemories/mem_1`, `/publicMemories/pub_1`, `/appConfig/*`, or `/users/{uid}` without `request.time`.
