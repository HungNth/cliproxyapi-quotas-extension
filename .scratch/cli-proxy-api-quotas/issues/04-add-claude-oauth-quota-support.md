# 04: Add Claude OAuth quota support

**Status:** resolved

**Parent specification:** [CLI Proxy API Quotas Popup](../spec.md)

**What to build:** Extend the working live-quota dashboard with Claude OAuth Provider Accounts while preserving the established Refresh, scheduling, rendering, partial-success, and security contracts.

**Blocked by:** 03: Show live Codex quota windows.

- [x] Claude and Anthropic OAuth Provider Accounts are recognized and queried through `/v0/management/api-call` using their current Refresh-local `auth_index`.
- [x] Claude credentials identified as API-key accounts are not sent to the OAuth usage endpoint and do not break supported Claude OAuth accounts.
- [x] Disabled and unavailable Claude accounts remain visible but are skipped by the live-query scheduler.
- [x] The upstream request targets the Anthropic OAuth usage endpoint and supplies the required OAuth beta header through CLIProxyAPI token substitution.
- [x] Five-hour and seven-day utilization, including supported field aliases, are converted to percentage remaining, clamped to 0–100, and paired with reset timestamps.
- [x] Claude Quota Windows use the shared account card, progress health thresholds, local reset time, countdown, and account ordering behavior established by the Codex slice.
- [x] A Claude account or provider request failure remains account-scoped and does not remove successful Claude or Codex results from the Partial Quota Snapshot.
- [x] Sanitized Claude errors obey the existing whitelist and never render raw upstream responses, credential metadata, Management Keys, or provider tokens.
- [x] Popup-root automated coverage proves OAuth classification, API-key skipping, five-hour/seven-day normalization, alias handling, unavailable-account skipping, rendering, and isolation from Codex results.
- [x] Demo: open the popup against an instance containing Codex, Claude OAuth, and Claude API-key accounts; observe live Claude windows alongside Codex while the API-key account is safely excluded from OAuth quota querying.
