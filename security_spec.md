# Security Specification — Sinar Warna Firebase Firestore

## 1. Data Invariants
1. **Strict Ownership**: Every `/users/{userId}` document can only be read, created, or updated by `request.auth.uid == userId` with `email_verified == true`. Listing `/users` is strictly denied.
2. **Conversation Isolation**: Every `/conversations/{conversationId}` document must carry `userId == request.auth.uid` on creation and cannot transfer `userId`, `id`, or `createdAt` on update.
3. **Master Gate Message Ownership**: Every `/conversations/{conversationId}/messages/{messageId}` document must belong to a valid existing parent conversation owned by `request.auth.uid`, match `conversationId == path.conversationId`, and carry `userId == request.auth.uid`.
4. **Strict Key & Type Enforcement**: All writes validate `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, bounded string lengths, regex IDs (`^[a-zA-Z0-9_\-]+$`), and server timestamps (`request.time`).
5. **Query Security**: `allow list` rules explicitly enforce `resource.data.userId == request.auth.uid` without delegating filtering solely to the client and without `get()`/`exists()` inside `list`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/conversations/conv_1` (`request.auth == null`).
2. **Unverified email user** (`email_verified == false`) attempting to create `/conversations/conv_1`.
3. **Identity spoofing**: User A creating `/conversations/conv_1` with `userId: "user_B"`.
4. **Shadow field injection**: User A creating `/conversations/conv_1` with extra ghost field `isAdmin: true`.
5. **Oversized ID poisoning**: Creating `/conversations/${"a".repeat(200)}` or invalid characters `conv/../../evil`.
6. **Oversized title/text DoW**: Creating `/conversations/conv_1` with `title` of 500 characters (> 120).
7. **Invalid mode enum**: Creating `/conversations/conv_1` with `mode: "superuser"`.
8. **Client-forged timestamp**: Creating `/conversations/conv_1` with `createdAt` set to a past timestamp instead of `request.time`.
9. **Immutable owner hijack on update**: Updating `/conversations/conv_1` to change `userId` or `createdAt`.
10. **Orphaned message write**: Creating `/conversations/nonexistent/messages/msg_1` where parent conversation does not exist.
11. **Cross-tenant list scraping**: Listing `/conversations` without `where('userId', '==', uid)`.
12. **Unbounded attachment array**: Creating a message with 10 elements in `attachmentNames` (> 3) or non-string elements.
