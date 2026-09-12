# CLI Proxy API Quotas Popup

Status: ready-for-agent

## Problem Statement

CLIProxyAPI users cannot inspect the current quota state of their configured Codex, Antigravity, and Claude accounts from the browser. Existing quota information may be passive, stale, or absent, and the reference quota viewer is a terminal plugin rather than a browser extension. Users need a compact, read-only popup that loads a fresh Quota Snapshot on demand without background polling.

## Solution

Build a Chrome/Chromium Manifest V3 extension with WXT and Vue. The popup stores one CLIProxyAPI Instance connection locally, requests access only to its configured origin, discovers current Provider Accounts, queries eligible accounts through CLIProxyAPI's management proxy, normalizes provider-specific responses into Quota Windows, and renders a compact dashboard. Opening the popup and pressing Refresh each initiate one fresh load; no background worker, content script, network interval, or persisted Quota Snapshot is used.

## User Stories

1. As a CLIProxyAPI user, I want to open the extension popup and see a fresh Quota Snapshot, so that I can assess current capacity without opening a terminal.
2. As a first-time user, I want the popup to show connection settings, so that I can configure my CLIProxyAPI Instance before quotas are loaded.
3. As a user, I want to configure one CLIProxyAPI Instance, so that the extension remains simple and focused on my active installation.
4. As a user, I want my base URL and Management Key stored locally in the browser, so that I do not need to enter them on every popup open.
5. As a security-conscious user, I want the Management Key field masked with an explicit reveal control, so that it is not exposed accidentally.
6. As a user connecting to localhost, I want HTTP connections to `localhost` or `127.0.0.1` with a custom port to work, so that the default local CLIProxyAPI deployment is supported.
7. As a user connecting to a remote CLIProxyAPI Instance, I want HTTPS origins to work, so that I can use a domain-hosted deployment securely.
8. As a security-conscious user, I want remote HTTP origins rejected, so that my Management Key is not transmitted over an unencrypted network connection.
9. As a user, I want malformed base URLs, URL credentials, query strings, fragments, and path-prefixed URLs rejected with a clear message, so that endpoint construction is predictable.
10. As a user, I want an optional trailing slash normalized and a custom port preserved, so that harmless URL formatting does not prevent setup.
11. As a user, I want Chrome to request access only to the exact configured origin, so that the extension does not receive effective access to unrelated websites.
12. As a user, I want Save to validate the connection and Management Key immediately, so that invalid settings are caught before they replace a working connection.
13. As a user with a valid but empty CLIProxyAPI Instance, I want an empty `/auth-files` response to count as successful validation, so that I can save settings before adding Provider Accounts.
14. As a user editing an existing connection, I want failed validation to preserve the previous settings and permission, so that a typo does not break the working configuration.
15. As a user editing an existing connection, I want the old origin permission removed only after the new connection is validated and saved, so that access is neither lost early nor accumulated indefinitely.
16. As a user, I want Clear configuration to remove the stored base URL, Management Key, and active origin permission, so that I can fully disconnect the extension.
17. As a returning user, I want the popup to start Refresh automatically when it opens, so that the displayed data is current without another click.
18. As a user keeping the popup open, I want a Refresh button, so that I can request another Quota Snapshot without closing and reopening the popup.
19. As a user, I want duplicate Refresh triggers ignored while a load is active, so that repeated clicks do not generate overlapping upstream quota requests.
20. As a user, I want the Refresh control visibly disabled while loading, so that the in-flight state is clear.
21. As a user, I want long-running requests to time out, so that the popup does not wait forever for an unavailable provider.
22. As a user, I want to retry failures manually, so that the extension does not create hidden automatic traffic.
23. As a user, I want closing the popup to cancel outstanding work when possible, so that abandoned requests do not continue unnecessarily.
24. As a user, I want each Refresh to rediscover Provider Accounts and current `auth_index` values, so that removed or changed credentials are reflected correctly.
25. As a user, I want disabled and unavailable Provider Accounts shown with their status, so that they do not appear to have disappeared.
26. As a CLIProxyAPI operator, I want disabled and unavailable Provider Accounts excluded from live upstream quota calls, so that unusable accounts do not generate pointless requests.
27. As a Codex user, I want to see five-hour and weekly remaining capacity, reset timing, and manual reset credits when available, so that I understand both quota windows and recovery options.
28. As an Antigravity user, I want model quotas summarized into the supported Claude/GPT and Gemini families, so that a large model list remains readable.
29. As a Claude OAuth user, I want to see five-hour and seven-day remaining capacity and reset timing, so that I can plan usage across both windows.
30. As a Claude API-key user, I want unsupported OAuth quota inspection skipped safely, so that the extension does not issue an invalid usage request.
31. As a user with unsupported providers, I want them ignored without breaking supported Provider Groups, so that one unknown account type does not prevent the dashboard from loading.
32. As a user, I want all provider responses normalized as percentage remaining rather than mixed remaining/used values, so that progress bars have consistent meaning.
33. As a user, I want reset times displayed in my local time zone with a human-readable countdown, so that I can understand when capacity returns.
34. As a user leaving the popup open, I want countdown text updated locally every ten seconds without network requests, so that the displayed reset estimate remains useful.
35. As a user, I want Codex, Antigravity, and Claude rendered as distinct Provider Groups, so that accounts with different quota semantics are not mixed together.
36. As a user, I want Provider Groups ordered Codex, Antigravity, then Claude, so that the dashboard remains stable between Refreshes.
37. As a user, I want successful accounts listed before failed accounts, then lower remaining quota first, then name or email, so that urgent capacity issues are easy to find.
38. As a user, I want quota above 50% shown in green, 21–50% in amber, 20% or below in red, and unavailable data in gray, so that risk is recognizable at a glance.
39. As a user, I want one account failure to produce a Partial Quota Snapshot rather than replace all successful results with a global error, so that useful data remains visible.
40. As a user, I want a global connection error only when account discovery or Management API authentication fails, so that provider-specific problems are not misrepresented as a broken connection.
41. As a security-conscious user, I want error details limited to sanitized status, error code, and message fields, so that credentials, tokens, request headers, and raw auth metadata are never rendered.
42. As a user, I want to see the running CLIProxyAPI version when the server exposes it, so that I know which installation the snapshot came from.
43. As a user, I want each Refresh to check the latest CLIProxyAPI version independently, so that I can learn when an update is available.
44. As a user, I want update text in the form `current → latest available`, so that the information is concise.
45. As a user, I do not want a badge or external release link for an available update, so that the popup stays focused on quotas.
46. As a user, I want quota results to remain visible if the latest-version check fails or is unsupported, so that an auxiliary check cannot break the dashboard.
47. As a user, I want the popup to follow my operating-system light or dark preference, so that it fits the surrounding browser UI.
48. As a user, I want an English interface with provider-native terminology, so that labels and API errors remain consistent with CLIProxyAPI and upstream services.
49. As a user with many accounts, I want a compact scrollable popup approximately 400 pixels wide and no more than approximately 600 pixels high, so that the dashboard remains usable within browser popup limits.
50. As a security-conscious operator, I want the extension to remain read-only and never call quota-reset or other mutation endpoints, so that inspecting quota cannot change CLIProxyAPI state.

## Implementation Decisions

- The product is a Chrome/Chromium-first Manifest V3 extension built with the existing WXT, Vue, TypeScript, and Tailwind stack.
- The extension consists of a foreground popup only. It has no content script, background service worker, alarm, or background network behavior.
- The popup owns the complete user flow: first-run settings, connection editing, permission requests, Refresh orchestration, rendering, and configuration clearing.
- The interface uses the canonical terms defined in the project domain glossary: CLIProxyAPI Instance, Management Key, Provider Account, Provider Group, Quota Window, Quota Snapshot, Partial Quota Snapshot, Refresh, and CLIProxyAPI Update Notice.
- Only one connection is stored. Persisted settings contain the normalized base origin and Management Key; Provider Account identifiers and Quota Snapshots are not persisted.
- The base URL accepts only an HTTP(S) origin. A custom port is allowed, a trailing slash is normalized, and path prefixes, query strings, fragments, and userinfo are rejected.
- HTTP is accepted only for `localhost` and `127.0.0.1`. Remote hosts require HTTPS.
- Browser storage is local rather than synchronized. The Management Key is treated as a secret: it is masked in the interface and must never be logged or included in rendered diagnostics.
- Required extension permissions are limited to storage. Requestable host patterns are declared as optional host permissions: localhost HTTP patterns and the broad HTTPS pattern needed by Chrome to allow exact runtime-origin requests.
- Saving settings is transactional. From the synchronous Save user gesture, the popup requests the exact candidate origin before any validation await. It then validates through the candidate CLIProxyAPI Instance. A failed permission request or validation leaves the current connection unchanged and removes any newly granted unused origin. A successful replacement is persisted before the old origin permission is removed.
- Validation succeeds for a structurally valid HTTP 200 `/auth-files` response even when the account list is empty. Authentication failures, invalid response shapes, network failures, and non-success responses reject the candidate settings with a sanitized message.
- Clearing settings deletes local configuration and removes the currently granted origin permission.
- Opening a configured popup starts one Refresh. A manual Refresh button starts another only when no Refresh is already active.
- One in-flight Refresh is allowed. Duplicate triggers reuse or ignore the active operation, controls that could start conflicting work are disabled, and an abort signal is used so popup teardown can cancel work when supported.
- Management and upstream-proxy requests have a 30-second timeout. Automatic retries are not performed.
- Each Refresh starts by requesting `/v0/management/auth-files` with the Management Key. The returned Provider Accounts and current `auth_index` values are authoritative for that Refresh and are never reused from a previous snapshot.
- The latest-version request is independent of quota acquisition. Its failure produces an unavailable version state rather than a failed Quota Snapshot.
- Eligible Provider Accounts are queried through `/v0/management/api-call`, using the literal `$TOKEN$` placeholder so CLIProxyAPI injects the credential belonging to the current `auth_index`.
- At most eight Provider Account quota operations run concurrently. Disabled and unavailable accounts are represented in the snapshot but skipped by the live-query scheduler.
- Upstream 4xx/5xx responses wrapped inside a successful `/api-call` envelope are treated as Provider Account failures. The response body may be a JSON string or an already parsed object and must be handled defensively.
- Provider classification recognizes Codex/OpenAI Codex, Antigravity, and Claude/Anthropic OAuth credentials. Unknown providers and Claude API-key credentials are not live-queried.
- Provider Account display identity prefers email, then identity-token email claims, then account/name/label/auth index, with a neutral fallback when none is available.
- Codex live quota uses the ChatGPT usage endpoint through `/api-call`, including the Codex beta header and ChatGPT account identifier when available. It normalizes primary/five-hour and secondary/weekly windows and separately loads manual reset credits.
- Claude live quota uses the Anthropic OAuth usage endpoint through `/api-call`, includes the required OAuth beta header, and normalizes five-hour and seven-day utilization into percentage remaining.
- Antigravity live quota resolves a project identifier when it is absent, requests available models through the supported primary and fallback Cloud Code Assist endpoints, and summarizes the supported model families using the lowest remaining capacity and earliest reset within each family.
- Provider parsers accept the response aliases observed in the reference implementation, clamp percentages to 0–100, and convert provider utilization/used values into percentage remaining.
- A Provider Account failure is stored as a sanitized account-level error. Successful accounts remain available in a Partial Quota Snapshot.
- Rendered diagnostics use a whitelist of safe fields: HTTP status, stable error code, and sanitized message. Raw Management API responses, auth records, upstream bodies, tokens, Management Keys, and authorization headers are never rendered.
- Progress health thresholds are greater than 50% green, 21–50% amber, 20% or below red, and unavailable gray.
- Reset times are rendered in the user's local time zone. A popup-local ten-second timer recomputes countdown labels only and never triggers network access.
- The popup groups accounts in Codex, Antigravity, and Claude order. It sorts successful accounts before failed accounts, then by minimum remaining quota ascending, then by display identity.
- The latest version is compared with the current version reported by the CLIProxyAPI response headers. An available update is rendered only as `current → latest available`, without a badge or outbound link.
- The interface is English, follows `prefers-color-scheme`, and uses a compact scrollable layout approximately 400 pixels wide with a maximum height near 600 pixels.
- The extension is read-only. Management mutation endpoints, including quota reset, are never called.

## Testing Decisions

- The repository currently has no test files or configured test runner. This feature introduces one high-level automated seam: the popup root user flow.
- The automated test setup uses Vitest, WXT's official Vitest plugin, Vue Test Utils, and a minimal DOM environment. WXT's fake browser implementation supplies in-memory extension storage; permissions are stubbed only where the fake implementation does not cover the required behavior.
- HTTP behavior is controlled at the `fetch` boundary. Tests exercise the popup and assert user-observable state rather than calling provider parser helpers directly.
- The popup integration suite must cover first-run settings, exact-origin permission request ordering, successful validation with zero accounts, failed replacement rollback, automatic load, manual Refresh deduplication, disabled/unavailable account skipping, all supported Provider Groups, Partial Quota Snapshot rendering, independent version-check failure, sanitized error details, and configuration clearing with permission removal.
- Provider fixtures must represent the documented Codex, Claude OAuth, and Antigravity response shapes plus the defensive aliases intentionally supported by the reference behavior. Fixtures must contain conspicuous secret values so leakage assertions can prove they are absent from rendered output.
- Tests must assert observable contracts: rendered Provider Groups, percentages remaining, account status, error boundaries, update text, permission effects, and network call eligibility. They must not assert helper calls, internal component state, CSS class names, exact markup structure, or source text.
- No separate test suite is created for every parser, formatting helper, storage wrapper, or Vue component. Those paths are exercised through the popup root seam unless a provider parser later proves impossible to cover meaningfully at that level.
- There is no prior test convention in the repository. The setup follows WXT's official Vitest integration rather than creating a custom browser API mock framework.
- Manual acceptance is distinct from automated testing. Build the Chrome MV3 extension, load it unpacked in Chrome, connect to a real CLIProxyAPI Instance, open the popup, and verify first-run save, automatic loading, manual Refresh, provider rendering, countdown updates, and settings clearing. No Playwright or other automated browser runner is added in this scope.
- Type checking and the production Chrome build remain required verification steps after implementation.

## Out of Scope

- Firefox-specific delivery or validation.
- Multiple CLIProxyAPI Instances, profiles, or connection switching.
- Remote CLIProxyAPI over unencrypted HTTP.
- Reverse-proxy path prefixes in the configured base URL.
- Content scripts, service workers, alarms, periodic network Refresh, or any other background polling.
- Persisting or displaying a cached Quota Snapshot before live data returns.
- Automatic retries after network or provider failures.
- Management actions, quota reset, credential changes, or any mutation of CLIProxyAPI state.
- Live quota adapters for providers other than Codex, Antigravity, and Claude OAuth.
- Claude API-key quota inspection.
- A theme selector, localization selector, or non-English interface.
- Update badges, release links, or extension-driven CLIProxyAPI upgrades.
- Automated browser end-to-end tooling such as Playwright.
- Reverse engineering or stabilizing undocumented upstream provider APIs beyond the defensive aliases already demonstrated by the reference implementation.
- Changes to unrelated package author or homepage metadata; those values require separate source verification.

## Further Notes

- CLIProxyAPI exposes global CORS support, but Chrome extension-origin access still requires the appropriate granted host permission.
- Optional host permission patterns define which origins may be requested at runtime; they do not grant effective access to every matching host at installation time.
- The upstream Codex, Claude OAuth, and Antigravity quota endpoints are not stable public contracts. Provider failures must remain isolated and readable rather than collapsing the entire popup.
- The Management Key is stored in browser local storage, which is not an encrypted secret vault. The implementation must minimize exposure by never logging, syncing, rendering, or embedding it in URLs.
- The accepted architecture and vocabulary are recorded in the project's domain glossary and ADRs.
