# 03: Show live Codex quota windows

**Status:** resolved

**Parent specification:** [CLI Proxy API Quotas Popup](../spec.md)

**What to build:** The first complete live-quota tracer bullet: eligible Codex Provider Accounts are queried through CLIProxyAPI, normalized into Quota Windows, and rendered with health, reset, sorting, partial-failure, and security behavior that later providers can reuse.

**Blocked by:** 02: Discover Provider Accounts on Refresh.

- [x] After discovery, eligible Codex/OpenAI Codex accounts are queried through `/v0/management/api-call` using the current `auth_index` and CLIProxyAPI's literal `$TOKEN$` substitution.
- [x] Disabled and unavailable Codex accounts remain visible with their status but do not generate live upstream quota calls.
- [x] Live account work uses a shared scheduler capped at eight Provider Accounts concurrently, with the Refresh's 30-second request timeout and cancellation signal.
- [x] The Codex request supplies the required usage headers and includes the ChatGPT account identifier when it can be derived from the account identity token.
- [x] The parser accepts the documented response aliases and either a JSON-string or already-parsed `/api-call` body without evaluating or rendering untrusted markup.
- [x] Primary/five-hour and secondary/weekly usage are normalized to percentage remaining, clamped to 0–100, and include the best available reset timestamp or reset-after value.
- [x] Manual reset credits are requested and displayed when available; failure to load credits does not remove otherwise valid Codex Quota Windows.
- [x] Codex account cards show identity, status, Quota Windows, percentage remaining, progress bars, local reset time, and a human-readable countdown.
- [x] Health colors are greater than 50% green, 21–50% amber, 20% or below red, and unavailable data gray.
- [x] A popup-local ten-second timer updates countdown labels without issuing network requests and is cleaned up when the popup closes.
- [x] Successful accounts sort before failed accounts, then by minimum remaining quota ascending, then by account identity.
- [x] One Codex failure produces a Partial Quota Snapshot: successful accounts remain visible and the failed account receives a sanitized account-level error.
- [x] Error Details render only whitelisted HTTP status, stable error code, and sanitized message; raw upstream bodies, auth metadata, Management Keys, tokens, and authorization headers are never rendered.
- [x] Popup-root automated coverage proves live Codex loading, disabled/unavailable skipping, concurrency eligibility, both quota windows, manual credits, response aliases, percentage normalization, countdown/health rendering, sorting, Partial Quota Snapshot behavior, and secret non-disclosure.
- [x] Demo: open the popup against an instance with multiple Codex accounts and observe live five-hour/weekly quota, credits, ordering, countdown updates, skipped unavailable accounts, and account-isolated failure behavior.
