# 02: Query live quotas for unavailable accounts

**What to build:** Live quota retrieval for Provider Accounts marked `unavailable: true` by CLIProxyAPI across all supported Provider Groups (Antigravity, Codex, Claude), rendering their Quota Windows (including 0% progress bar and combined reset timing) directly beneath the account header while preserving the `[unavailable]` status badge, with disabled accounts remaining excluded.

**Blocked by:** 01: Format combined reset time and compact labels

**Status:** resolved

- [x] The live quota query scheduler in `services/quota.ts` queries accounts with `unavailable: true` while continuing to skip accounts with `disabled: true`.
- [x] Unavailable accounts across Antigravity, Codex, and Claude execute their respective quota fetching routines via `/v0/management/api-call`.
- [x] In the popup UI, an unavailable account with successfully retrieved Quota Windows renders both its `[unavailable]` status badge next to the display name AND its Quota Windows below (including 0% progress bars and reset countdowns).
- [x] Quota sorting places accounts with 0% remaining capacity at the top of their respective Provider Group based on existing minimum-remaining sort semantics.
- [x] If an unavailable account's upstream query returns an error, the account displays its `[unavailable]` badge alongside the sanitized error message, preserving the Partial Quota Snapshot.
- [x] Integration tests in `entrypoints/popup/__tests__/popup.test.ts` verify that unavailable accounts are queried, disabled accounts remain skipped, badges and Quota Windows render together, and error isolation holds.
