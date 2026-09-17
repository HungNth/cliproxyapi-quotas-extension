# 01: Format combined reset time and compact labels

**What to build:** An enhanced reset timing presentation that displays both the local wall-clock reset timestamp and relative countdown together (`DD/MM HH:mm in Xh Ym` or `DD/MM HH:mm ready`) inline across all Quota Windows, along with compact `Claude/GPT (5-hour)` and `Claude/GPT (Weekly)` window labels for Antigravity, while preserving all existing popup styles.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A formatter combines local wall-clock reset time and relative countdown in the format `DD/MM HH:mm in <relative>` (e.g. `17/09 14:30 in 4h 51m`, `17/09 14:30 in 25m`, `17/09 14:30 in <1m`, `17/09 14:30 in 2d 5h`).
- [x] When the target reset time is reached or past (`sec <= 0`), the formatter outputs `DD/MM HH:mm ready`.
- [x] If `resetAt` is undefined, empty, or invalid, the reset display remains empty.
- [x] Antigravity quota window labels are normalized to `Claude/GPT (5-hour)` and `Claude/GPT (Weekly)` while Gemini labels remain `Gemini (5-hour)` and `Gemini (Weekly)`.
- [x] The popup renders the combined reset time inline without altering existing CSS styles, maintaining fit within the 400px popup width.
- [x] Integration tests in `entrypoints/popup/__tests__/popup.test.ts` verify the combined timestamp + countdown format, ready status, and updated Antigravity labels.
