# Antigravity Quota Summary

Status: ready-for-agent

## Problem Statement

Antigravity users currently see inaccurate quota information for Gemini and third-party models in the browser extension popup. The existing implementation scrapes individual models from `:fetchAvailableModels` and tries to heuristically discover projects and compute minimum remaining fractions across models. Upstream Google Cloud Code Assist provides a dedicated user quota summary endpoint (`retrieveUserQuotaSummary`) that returns clean, structured five-hour and weekly quota buckets for both Gemini and third-party model groups. Users need the extension to query this dedicated endpoint and present accurate, separate five-hour and weekly Quota Windows for both Gemini and Claude & GPT model families.

## Solution

Update the Antigravity quota service to query the dedicated upstream endpoint `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` through the CLIProxyAPI Instance management proxy. Remove obsolete project-discovery calls (`:loadCodeAssist`) and model listing fallbacks. Normalize the returned quota groups (`Gemini Models` and `Claude and GPT models`) into four standard Quota Windows per Antigravity Provider Account: `Gemini (5-hour)`, `Gemini (Weekly)`, `Claude & GPT (5-hour)`, and `Claude & GPT (Weekly)`. Preserve existing health progress bar color thresholds, reset countdowns, Partial Quota Snapshot isolation, and account sorting semantics.

## User Stories

1. As an Antigravity user, I want to see distinct five-hour and weekly quota remaining for Gemini models, so that I can manage my short-term burst usage and longer-term capacity separately.
2. As an Antigravity user, I want to see distinct five-hour and weekly quota remaining for Claude and GPT models, so that I know when my third-party model allowances reset.
3. As an Antigravity user, I want `Gemini (5-hour)` displayed as the first Quota Window in each Antigravity account card, so that my most immediate rate limit is immediately visible.
4. As an Antigravity user, I want `Gemini (Weekly)` displayed after the five-hour window, so that my weekly tier capacity is clearly visible in context.
5. As an Antigravity user, I want `Claude & GPT (5-hour)` and `Claude & GPT (Weekly)` displayed after the Gemini windows, so that third-party model quotas are organized consistently.
6. As a user, I want the extension to query `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` with the static project payload `{"project": "aicode-consumers"}`, so that quota requests are reliable without depending on dynamic project discovery.
7. As a user, I want the Antigravity query to send the user-agent `antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)`, so that the upstream endpoint accepts the request without rejection.
8. As a user, I want remaining quota fractions from upstream normalized to whole percentages between 0 and 100, so that progress bars and percentages are consistent across all providers.
9. As an Antigravity user, I want a quota bucket with remaining fraction 0% to clearly show 0% remaining and a reset countdown, so that I know when an exhausted limit will refresh.
10. As an Antigravity user, I want a quota bucket that omits `remainingFraction` but provides `resetTime` treated as 0% remaining with countdown, so that exhausted limits are never misreported as missing data.
11. As an Antigravity user, I want human-readable countdowns (e.g. `in 2h 5m`, `in 6d 17h`) displayed alongside local reset times, so that I know exactly when each Quota Window resets.
12. As a user leaving the popup open, I want countdowns for all four Antigravity Quota Windows updated every ten seconds locally without network traffic, so that displayed timing remains accurate while the popup is open.
13. As a user, I want Antigravity accounts sorted alongside other Provider Accounts based on the lowest remaining percentage across all four windows, so that accounts with constrained quotas appear first.
14. As a user, I want an Antigravity upstream error or failure to produce an account-level sanitized error rather than breaking the entire Quota Snapshot, so that other accounts remain visible in a Partial Quota Snapshot.
15. As a security-conscious user, I want error details for failed Antigravity accounts sanitized according to existing rules, so that authorization tokens, project secrets, and raw payloads are never rendered in the UI.
16. As a developer, I want all obsolete code paths for `:loadCodeAssist` project discovery and `:fetchAvailableModels` model listing removed, so that the codebase remains lean, modular, and without dead fallbacks.
17. As a user with disabled or unavailable Antigravity Provider Accounts, I want those accounts displayed with their status badges without triggering upstream quota calls, so that no unnecessary requests are made.
18. As a user refreshing the popup, I want Antigravity quota retrieval executed concurrently with other eligible accounts up to the existing concurrency limit, so that the refresh completes promptly.

## Implementation Decisions

- **Dedicated Quota Endpoint**: Replace `:fetchAvailableModels` and `:loadCodeAssist` with a single upstream POST request to `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`.
- **Payload & Header Contract**:
  - URL: `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`
  - Method: `POST`
  - Headers:
    - `Authorization`: `Bearer $TOKEN$`
    - `Content-Type`: `application/json`
    - `User-Agent`: `antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)`
  - Body data: `{"project":"aicode-consumers"}`
- **Quota Windows Normalization**:
  - The Antigravity service normalizes groups into four explicit `QuotaWindow` objects:
    1. `Gemini (5-hour)` (from group with displayName matching `Gemini`, bucket `5h`)
    2. `Gemini (Weekly)` (from group with displayName matching `Gemini`, bucket `weekly`)
    3. `Claude & GPT (5-hour)` (from group with displayName matching `Claude` or `GPT`, bucket `5h`)
    4. `Claude & GPT (Weekly)` (from group with displayName matching `Claude` or `GPT`, bucket `weekly`)
  - Labeling uses flat combined labels so that existing UI rendering, progress bar components, and styles require zero modifications.
  - Fractions are converted via `Math.round(fraction * 100)` and clamped between 0 and 100.
  - Omitted `remainingFraction` with present `resetTime` is normalized to 0% (per ADR 0003). Missing both is normalized to `null`.
- **Removal of Obsolete Code Paths**:
  - Remove `resolveProjectId`, `extractExistingProjectId`, `ANTIGRAVITY_ENDPOINTS`, and `mergeFamilyQuota`.
  - Remove all references to `:fetchAvailableModels` and `:loadCodeAssist`.
- **Sorting Integration**:
  - Existing `getMinRemaining` function evaluates `account.windows`. Because four windows are populated, it automatically considers the lowest percentage across both Gemini and Claude & GPT limits when sorting.
- **Error Handling & Sanitization**:
  - Non-200 responses or malformed envelopes continue to use `sanitizeErrorMessage` and return safe account-level errors, preserving the Partial Quota Snapshot.

## Testing Decisions

- **Seam**: Use the single, existing, highest-level popup integration test seam (`entrypoints/popup/__tests__/popup.test.ts`) which mounts `<App />` with mocked `fakeBrowser` and `global.fetch`.
- **External Behavior Verification**:
  - Verify that an Antigravity Provider Account triggers `/v0/management/api-call` with the `retrieveUserQuotaSummary` endpoint, static project data, and expected headers.
  - Verify that the four Quota Windows are rendered with correct labels (`Gemini (5-hour)`, `Gemini (Weekly)`, `Claude & GPT (5-hour)`, `Claude & GPT (Weekly)`), percentage values, and countdowns.
  - Verify that exhausted quotas (`remainingFraction: 0` or omitted with `resetTime`) render 0% and countdowns.
  - Verify that accounts sort based on the minimum remaining capacity among the four windows.
  - Verify that upstream errors produce sanitized account errors while preserving successful accounts in a Partial Quota Snapshot.
  - Verify that disabled/unavailable Antigravity accounts are rendered with badges and not queried.
- **Prior Art**: Existing test suite in `entrypoints/popup/__tests__/popup.test.ts` (Tickets 01–05).

## Out of Scope

- Dynamic user configuration of the Antigravity project ID (static `"aicode-consumers"` is used).
- Adding custom nested headers or collapsible accordions for model groups in the UI (flat 4-window layout is preserved).
- Background polling, alarms, or notifications.
- Quota mutation or reset actions for Antigravity accounts.

## Further Notes

- Architecture Decision Record `docs/adr/0004-antigravity-quota-summary-endpoint.md` records this upstream endpoint migration.
