# 01: Configure one CLIProxyAPI Instance

**Status:** resolved

**Parent specification:** [CLI Proxy API Quotas Popup](../spec.md)

**What to build:** A complete first-run and Settings flow in the popup that lets the user connect one CLIProxyAPI Instance, validates the connection safely, persists it locally, and can remove it completely.

**Blocked by:** None (can start immediately).

- [x] Opening the popup without saved settings shows an English connection form with base URL and masked Management Key inputs, an explicit reveal control, and Save/Test.
- [x] Base URL validation accepts an HTTP(S) origin with a custom port, normalizes a trailing `/`, permits HTTP only for `localhost` and `127.0.0.1`, and requires HTTPS for remote hosts.
- [x] Validation rejects path prefixes, query strings, fragments, URL userinfo, unsupported schemes, and malformed URLs with a clear field-level message.
- [x] The extension declares requestable localhost and HTTPS host patterns as optional permissions but receives effective access only to the exact origin approved by the user.
- [x] Save requests exact-origin permission directly from the Save user gesture before awaiting validation, then authenticates against `/v0/management/auth-files` using the candidate Management Key.
- [x] A structurally valid HTTP 200 response is accepted even when it contains zero Provider Accounts; authentication failures, invalid response shapes, and network failures reject the candidate settings with sanitized feedback.
- [x] Replacing a connection is transactional: failure revokes a newly granted unused origin and preserves the previous settings/permission; success persists the replacement before removing the old origin permission.
- [x] Saved base URL and Management Key use browser local storage and survive closing and reopening the popup; neither value is logged, synced, rendered in diagnostics, or embedded in a URL.
- [x] Settings remain accessible after setup, and Clear configuration deletes the stored connection and removes its granted origin permission.
- [x] The approved popup-root automated test seam is established with Vitest, WXT's official Vitest plugin, Vue Test Utils, a minimal DOM environment, fake browser storage, permission boundary stubs where needed, and mocked HTTP.
- [x] Automated coverage proves first-run rendering, exact permission ordering, zero-account validation, failed replacement rollback, successful persistence, and Clear configuration permission removal through user-observable popup behavior.
- [x] Demo: load the unpacked extension, save a valid local or HTTPS CLIProxyAPI connection, reopen the popup to observe persisted configuration, attempt an invalid replacement without losing it, then clear it and confirm the extension returns to first-run state.
