# 05: Add Antigravity quota-family support

**Status:** resolved

**Parent specification:** [CLI Proxy API Quotas Popup](../spec.md)

**What to build:** Extend the working live-quota dashboard with Antigravity Provider Accounts, including project discovery, provider endpoint fallback, and compact model-family aggregation without weakening partial-success or security behavior.

**Blocked by:** 03: Show live Codex quota windows.

- [x] Antigravity Provider Accounts are recognized and queried through `/v0/management/api-call` using their current Refresh-local `auth_index`.
- [x] Disabled and unavailable Antigravity accounts remain visible but are skipped by the live-query scheduler.
- [x] The existing project identifier is used when available; otherwise the Cloud Code Assist project-discovery request resolves it through CLIProxyAPI token substitution.
- [x] Available models are requested from the supported primary endpoint and then the documented fallback endpoints only as needed.
- [x] Supported Claude/GPT models are aggregated into one family and supported Gemini models into another; unrelated models do not create extra dashboard rows.
- [x] Each family reports the lowest remaining capacity and earliest reset time among its matching models, with remaining fractions normalized and clamped to 0–100.
- [x] Antigravity families use the shared account card, progress health thresholds, local reset time, countdown, and account ordering behavior established by the Codex slice.
- [x] Project-discovery, endpoint-fallback, malformed-model, and provider failures remain account-scoped and do not remove successful Antigravity, Codex, or Claude results from the Partial Quota Snapshot.
- [x] Sanitized Antigravity errors obey the existing whitelist and never render raw upstream responses, project credential metadata, Management Keys, or provider tokens.
- [x] Popup-root automated coverage proves project reuse/discovery, endpoint fallback, model-family filtering, lowest-remaining and earliest-reset aggregation, unavailable-account skipping, rendering, and isolation from other Provider Groups.
- [x] Demo: open the popup against an instance containing Antigravity plus another supported provider and observe both model families, fallback behavior where applicable, correct aggregation, and provider-isolated failure handling.
