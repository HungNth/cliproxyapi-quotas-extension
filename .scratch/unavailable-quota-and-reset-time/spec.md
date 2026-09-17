# Unavailable Quota Display and Reset Time

Status: ready-for-agent

## Problem Statement

CLIProxyAPI users cannot see remaining capacity or reset countdowns for accounts that have exhausted their quota. When upstream limits are reached, CLIProxyAPI marks the provider account as `unavailable: true`. The extension currently excludes unavailable accounts from live quota queries, hiding their Quota Windows and showing only the account email alongside an `[unavailable]` badge. Users cannot determine when their exhausted accounts will reset without checking terminal logs or third-party consoles. Furthermore, the reset countdown currently only shows relative time (e.g., `in 4h 51m`), requiring users to calculate or hover for tooltip text to determine the exact wall-clock reset moment.

## Solution

Enable live quota inspection for unavailable Provider Accounts across all supported Provider Groups (Antigravity, Codex, and Claude) while continuing to exclude disabled accounts. When an unavailable account's quota is fetched successfully, render its Quota Windows (including 0% remaining capacity and reset timing) directly beneath the account header while preserving the `[unavailable]` badge next to the display name. Combine local reset timestamp and countdown into a single inline string (`DD/MM HH:mm in Xh Ym` or `DD/MM HH:mm ready`) across all Quota Windows. Streamline Antigravity Quota Window labels from `Claude & GPT` to `Claude/GPT` for a more compact and readable inline layout.

## User Stories

1. As a CLIProxyAPI user with an exhausted Antigravity account, I want the extension to query its live quota summary even when marked unavailable, so that I can see the remaining capacity and reset time.
2. As a CLIProxyAPI user with an exhausted Codex account, I want the extension to query its live usage even when marked unavailable, so that I can see when its rate limits reset.
3. As a CLIProxyAPI user with an exhausted Claude account, I want the extension to query its live usage even when marked unavailable, so that I can see when its five-hour or seven-day windows reset.
4. As a user, I want disabled Provider Accounts (`disabled: true`) to remain excluded from upstream live quota requests, so that inactive accounts do not generate unnecessary network traffic.
5. As a user, I want the `[unavailable]` status badge preserved next to the account email, so that I know CLIProxyAPI has temporarily paused routing to this account.
6. As a user, I want exhausted Quota Windows with 0% remaining capacity to render the 0% progress bar and percentage text in rose color, so that depleted capacity is immediately recognizable.
7. As a user, I want an Antigravity bucket with omitted `remainingFraction` and valid `resetTime` to display 0% remaining capacity and reset time, so that exhausted limits are clearly reported.
8. As a user, I want each Quota Window reset indicator to show both the local wall-clock reset timestamp and relative countdown together in `DD/MM HH:mm in Xh Ym` format, so that I can immediately know the exact time and remaining duration without hovering.
9. As a user, I want a Quota Window whose reset time has passed to display `DD/MM HH:mm ready`, so that I know the exact time the window was scheduled to reset.
10. As a user, I want countdowns updated locally every ten seconds without triggering network requests, so that both the wall-clock timestamp and countdown stay synchronized while the popup remains open.
11. As a user, I want Antigravity window labels updated to `Claude/GPT (5-hour)` and `Claude/GPT (Weekly)`, so that third-party model window labels are concise and fit neatly on a single line.
12. As a user, I want existing UI layout, typography, and CSS classes preserved, so that the extension maintains its compact 400-pixel width without visual regressions.
13. As a user, I want an upstream API failure on an unavailable account to be isolated as a sanitized account-level error, so that other accounts in the Partial Quota Snapshot remain visible.
14. As a developer, I want all tests in the integration suite to verify unavailable account live queries, combined reset time formatting, compact labels, and error boundary isolation.

## Implementation Decisions

- **Account Eligibility for Live Quota Fetching**:
  - In the account scheduler, remove `!acc.unavailable` from the live quota task filter.
  - An account is eligible for live quota query if it has a non-empty `authIndex` and is not explicitly `disabled` (`!acc.disabled`).
  - Keep `getStatusBadge` returning `'[unavailable]'` when `raw.unavailable` is truthy, preserving the header badge.

- **Combined Local Reset Time and Countdown Formatting**:
  - Update `formatCountdown` or provide a combined formatter that produces `DD/MM HH:mm in <relative>` (e.g. `17/09 14:30 in 4h 51m`, `17/09 14:30 in 25m`, `17/09 14:30 in <1m`, `17/09 14:30 in 2d 5h`).
  - Date formatting uses two-digit local day and two-digit local month (`DD/MM`) followed by two-digit 24-hour time (`HH:mm`).
  - When the target reset time is in the past (`sec <= 0`), output `DD/MM HH:mm ready`.
  - If `resetAt` is absent or invalid, output empty string.

- **Antigravity Window Label Normalization**:
  - Change `Claude & GPT (5-hour)` to `Claude/GPT (5-hour)`.
  - Change `Claude & GPT (Weekly)` to `Claude/GPT (Weekly)`.
  - Gemini labels remain `Gemini (5-hour)` and `Gemini (Weekly)`.

- **Preservation of CSS and Partial Snapshot Semantics**:
  - No new CSS classes or layout refactoring in the popup. Existing text size (`text-[10px]`) and layout structure remain intact.
  - Upstream 4xx/5xx responses or parse failures on unavailable accounts continue to produce sanitized account errors in `acc.error`.

## Testing Decisions

- **Testing Seam**:
  - The existing popup root integration test seam (`entrypoints/popup/__tests__/popup.test.ts`) mounting `<App />` with mocked `fakeBrowser` and `global.fetch`.
- **External Behavior Verification**:
  - Verify that unavailable Provider Accounts (`unavailable: true`) for Antigravity, Codex, and Claude trigger upstream quota calls through `/v0/management/api-call`.
  - Verify that disabled accounts (`disabled: true`) are skipped from upstream quota calls.
  - Verify that unavailable accounts render both the `[unavailable]` badge and their Quota Windows (e.g. 0% progress bar and combined reset time string).
  - Verify that the combined reset time string matches the `DD/MM HH:mm in ...` and `DD/MM HH:mm ready` formats.
  - Verify that Antigravity renders `Claude/GPT (5-hour)` and `Claude/GPT (Weekly)`.
  - Verify that upstream errors on unavailable accounts produce sanitized errors without breaking the Partial Quota Snapshot.

## Out of Scope

- Querying live quota for `disabled: true` accounts.
- Modifying upstream CLIProxyAPI status tracking or mutation endpoints.
- User customization of date/time formats or locales.
- Additional background polling or notifications.

## Further Notes

- Recorded Architecture Decision Record `docs/adr/0005-query-unavailable-provider-accounts.md`.
