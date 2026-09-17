# 01: Scope manual resets to Codex and suppress stale error badge

**What to build:** Ensure manual reset allowances are strictly scoped to Codex accounts in the UI, and suppress misleading `[error]` status badges when an account's live Quota Windows are successfully loaded from upstream.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] In `entrypoints/popup/App.vue`, the manual resets badge is guarded with `account.provider === 'codex' && account.manualResetCredits !== undefined`.
- [x] In `services/quota.ts`, if an account's live quota query succeeds (`res.ok` with non-empty windows), any stale `[error]` status badge is cleared (`acc.statusBadge = undefined`).
- [x] Status badges other than `[error]` (such as `[unavailable]`) continue to be preserved when Quota Windows are loaded.
- [x] When live quota retrieval fails for an account, its `[error]` badge (if present) is retained and the sanitized account-level error view is rendered.
- [x] Integration tests in `entrypoints/popup/__tests__/popup.test.ts` verify that `[error]` is suppressed on successful quota load, retained on failed quota load, and that manual reset credits are exclusive to Codex.
