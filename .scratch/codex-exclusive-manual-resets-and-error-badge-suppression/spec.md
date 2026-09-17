# Codex-Exclusive Manual Resets and Stale Error Badge Suppression

Status: ready-for-agent

## Problem Statement

Users observing Antigravity accounts see a confusing `[error]` status badge on their account card even when all Antigravity Quota Windows load successfully with live capacity and countdown timers. The `[error]` badge originates from a stale or transient `"status": "error"` field returned by CLIProxyAPI in `/v0/management/auth-files`. Because this badge renders in the exact header position where Codex manual reset credits appear, users reasonably assume the extension attempted to inspect manual reset credits for Antigravity and failed. Furthermore, the manual resets UI badge did not explicitly check for the `codex` provider type in the template.

## Solution

1. Explicitly guard the Manual Resets badge in the popup UI so it only renders for Codex Provider Accounts (`account.provider === 'codex' && account.manualResetCredits !== undefined`).
2. Suppress the `[error]` status badge on any Provider Account when live Quota Windows are successfully retrieved (`res.ok` with non-empty windows and no account error), preventing misleading error indicators when live quotas are healthy.
3. If live quota retrieval fails for an account, preserve the error representation via the sanitized account-level error view.

## User Stories

1. As an Antigravity user whose account quotas load successfully, I do not want to see a misleading `[error]` badge in the account header, so that I can be confident my account is functioning properly.
2. As a Claude user whose account quotas load successfully, I do not want to see a misleading `[error]` badge in the account header, so that I know my account is healthy.
3. As a Codex user whose account quotas load successfully, I do not want to see a misleading `[error]` badge even if CLIProxyAPI's auth-file previously recorded an error state.
4. As a Codex user, I want manual reset credits displayed in the account header when available, so that I can see how many rate limit resets I have remaining.
5. As an Antigravity or Claude user, I never want manual resets displayed or queried for my accounts, so that provider semantics remain cleanly separated.
6. As a user whose account genuinely fails upstream quota retrieval, I want the sanitized error message displayed clearly under the account card, preserving Partial Quota Snapshot behavior.
7. As a developer, I want automated integration tests to verify that manual reset credits are exclusive to Codex and that `[error]` badges are suppressed when live quotas load successfully.

## Implementation Decisions

- **Codex-Exclusive Manual Resets Badge**:
  - In `entrypoints/popup/App.vue`, update the badge condition to `v-if="account.provider === 'codex' && account.manualResetCredits !== undefined"`.
- **Stale Error Badge Suppression**:
  - In `services/quota.ts`, when an account's live quota query succeeds (`res.ok` and `windows.length > 0`), if `account.statusBadge === '[error]'`, clear `account.statusBadge = undefined`.
  - Other status badges such as `[unavailable]` are preserved because they indicate intentional CLIProxyAPI routing state rather than an active query failure.
- **Error Handling Preservation**:
  - If live quota retrieval fails (`!res.ok`), `account.error` is set and displayed beneath the account card, and the `[error]` badge remains visible if present.

## Testing Decisions

- **Testing Seam**:
  - Integration suite in `entrypoints/popup/__tests__/popup.test.ts` mounting `<App />` with mocked `fakeBrowser` and `global.fetch`.
- **Behavior Verification**:
  - Verify that an Antigravity account with `status: "error"` in `/auth-files` suppresses the `[error]` badge when its live quota summary succeeds.
  - Verify that an account with `status: "error"` that fails live quota query retains the `[error]` badge and displays the sanitized error message.
  - Verify that `manualResetCredits` does not render for Antigravity or Claude accounts even if data were present.
  - Verify that `manualResetCredits` renders as expected for Codex accounts.

## Out of Scope

- Modifying how CLIProxyAPI assigns internal account statuses on the server side.
- Adding manual reset capabilities to Antigravity or Claude (upstream providers do not support them).
