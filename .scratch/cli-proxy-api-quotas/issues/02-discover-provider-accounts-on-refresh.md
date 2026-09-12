# 02: Discover Provider Accounts on Refresh

**Status:** resolved

**Parent specification:** [CLI Proxy API Quotas Popup](../spec.md)

**What to build:** A usable dashboard shell that automatically discovers current Provider Accounts whenever the popup opens, supports explicit Refresh, presents account availability and CLIProxyAPI version state, and handles loading or connection failure without background polling.

**Blocked by:** 01: Configure one CLIProxyAPI Instance.

- [x] Opening a configured popup starts one Refresh and requests `/v0/management/auth-files`; `auth_index` values are treated as Refresh-local data and are not persisted.
- [x] The popup exposes a manual Refresh control that is disabled while a Refresh is active; overlapping open/click triggers are deduplicated into one in-flight operation.
- [x] Management requests time out after 30 seconds, do not retry automatically, and use cancellation so popup teardown can stop outstanding work when supported.
- [x] Provider Accounts are classified into Codex, Antigravity, and Claude Provider Groups and display the best available identity plus `disabled`, `unavailable`, non-ready, or discovery-error state.
- [x] Unsupported providers and Claude API-key credentials do not break discovery; supported empty groups are omitted and a valid instance with no supported accounts shows a clear empty state.
- [x] Provider Groups render in Codex, Antigravity, then Claude order within an English, system-theme-aware, compact scrollable popup approximately 400 pixels wide and at most approximately 600 pixels high.
- [x] The running CLIProxyAPI version is read from the Management API response headers when available.
- [x] Each Refresh independently calls `/v0/management/latest-version`; when a newer release exists, the UI renders only the text `current → latest available`, with no badge, release URL, or external link.
- [x] A failed or unsupported latest-version check does not fail account discovery, remove the current version, or replace the dashboard with a global error.
- [x] Account-discovery authentication, network, timeout, and malformed-response failures produce a sanitized global connection error and a route back to Settings without exposing raw responses or secrets.
- [x] No Provider Account live quota endpoint is called in this ticket, no Quota Snapshot is persisted, and no content script, service worker, alarm, or network interval is introduced.
- [x] Popup-root automated coverage proves automatic discovery, manual Refresh deduplication, empty state, account status rendering, timeout/fatal state, exact update text, absence of badge/link, and non-fatal latest-version failure.
- [x] Demo: open the popup against a configured CLIProxyAPI Instance and observe automatic account discovery, current/update version text, disabled/unavailable statuses, manual Refresh behavior, and the empty state on an instance with no accounts.
