# 02: Handle exhausted limits, multi-window sorting, and error isolation for Antigravity

**What to build:** Handle Antigravity edge cases including exhausted quota (0% or omitted fraction with reset time per ADR 0003), multi-window sorting by the lowest remaining capacity across all four windows, Partial Quota Snapshot preservation on account-scoped upstream failure, error sanitization, and skipped queries for disabled/unavailable accounts.

**Blocked by:** 01: Query Antigravity User Quota Summary and render four Quota Windows

**Status:** resolved

- [x] A quota bucket with `remainingFraction: 0` or omitted `remainingFraction` with `resetTime` is normalized to 0% and displays its countdown (ADR 0003).
- [x] Accounts with multiple windows are correctly sorted by the lowest remaining percentage across all four windows.
- [x] Antigravity upstream failure (4xx/5xx/network) produces a sanitized account error and does not drop successful accounts from the Partial Quota Snapshot.
- [x] Error messages are sanitized and do not leak Management Keys or sensitive tokens.
- [x] Disabled and unavailable Antigravity accounts are skipped during Refresh and display their status badges.
- [x] Automated tests cover all exhausted, sorting, and error isolation scenarios.
