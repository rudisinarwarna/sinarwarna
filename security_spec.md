# Security Specification — Sinar Warna Firebase Firestore

## 1. Data Invariants
1. **Strict Ownership & Admin RBAC Isolation**:
   - Every `/users/{userId}` document can only be created by `request.auth.uid == userId` (`email_verified == true`) with `role == 'user'` (except primary admin `rudi.sinarwarna@gmail.com` who may initialize as `role == 'admin'`), `blocked == false`, and `deleted == false`.
   - Regular users CANNOT list `/users` (`allow list: if isAdmin()`), read other users' profiles, or escalate their own `role`, `verifiedBadge`, `blocked`, or `deleted` fields.
   - Only verified Admins (`email == 'rudi.sinarwarna@gmail.com' && email_verified == true` or registered in `/admins/{uid}`) may list `/users`, promote/demote users (`role`), grant/revoke blue verified badges (`verifiedBadge`), block/unblock users (`blocked`), or delete accounts. Primary admin `rudi.sinarwarna@gmail.com` is immutable against demotion, badge removal, blocking, or deletion.
2. **Admin Registry (`/admins/{userId}`)**:
   - Only verified Admins can read, list, create, or delete `/admins/{userId}` entries (primary admin entry cannot be deleted). Regular users can only check their own `/admins/{uid}` document (`get`).
3. **Admin-Only Private AI Memories (`/adminMemories/{memoryId}` & `/adminMeta/seed`)**:
   - Strictly restricted to verified Admins (`isAdmin()`). Unauthenticated users and non-admin users are completely denied (`PERMISSION_DENIED`) from reading, listing, creating, updating, or deleting `/adminMemories` or `/adminMeta`.
4. **Conversation & Message Isolation + Blocked User Guard**:
   - Blocked or deleted users (`users/{uid}.blocked == true || users/{uid}.deleted == true`) are denied creating or updating conversations/messages.
   - Regular users can only read/write their own `/conversations/{conversationId}` and `/conversations/{conversationId}/messages/{messageId}` documents.
   - Verified Admins may list/delete target user conversations and messages strictly for account deletion cleanup.
5. **Strict Key, Bounds, & Timestamp Enforcement**:
   - All writes validate `keys().hasAll(...)`, `keys().hasOnly(...)`, `affectedKeys().hasOnly(...)` on update, regex IDs (`^[a-zA-Z0-9_\-]+$`), bounded string lengths, and server timestamps (`request.time`).
   - Zero `get()` or `exists()` calls inside `allow list` rules.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/conversations/conv_1` or `/adminMemories/mem_1`.
2. **Unverified email user** (`email_verified == false`) attempting to create `/users/u1` or `/conversations/conv_1`.
3. **Self-promotion attack**: Regular user creating `/users/{uid}` with `role: "admin"` or updating their `role` to `"admin"`.
4. **Admin registry hijack**: Non-admin user creating `/admins/{uid}`.
5. **Non-admin reading private lore**: Non-admin user reading or listing `/adminMemories`.
6. **Non-admin scraping PII**: Non-admin user listing `/users`.
7. **Primary admin sabotage**: Another admin attempting to block, demote, or delete `rudi.sinarwarna@gmail.com`.
8. **Blocked user write**: User with `blocked: true` trying to create a new conversation or message.
9. **Identity spoofing**: User A creating `/conversations/conv_1` with `userId: "user_B"`.
10. **Shadow field injection**: Creating `/adminMemories/mem_1` with unapproved extra field `evil: true`.
11. **Oversized payload DoW**: Creating `/adminMemories/mem_1` with `content` > 2000 chars or `title` > 120 chars.
12. **Client-forged timestamp**: Creating/updating `/adminMemories/mem_1` or `/users/{uid}` without `request.time`.
