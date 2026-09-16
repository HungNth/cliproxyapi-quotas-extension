# 01: Query Antigravity User Quota Summary and render four Quota Windows

**What to build:** Antigravity Provider Accounts query `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` through `/v0/management/api-call` with static payload `{"project": "aicode-consumers"}` and custom user agent. Obsolete `:loadCodeAssist` and `:fetchAvailableModels` paths are completely removed. Upstream quota groups (`Gemini Models` and `Claude and GPT models`) are parsed into four Quota Windows (`Gemini (5-hour)`, `Gemini (Weekly)`, `Claude & GPT (5-hour)`, and `Claude & GPT (Weekly)`) and rendered with progress bars and countdowns.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Antigravity quota retrieval queries `https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary` with method `POST`.
- [x] The request passes `data: "{\"project\":\"aicode-consumers\"}"` and User-Agent `antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)`.
- [x] Obsolete project discovery via `:loadCodeAssist` and model scraping via `:fetchAvailableModels` are completely removed.
- [x] The four standard Quota Windows (`Gemini (5-hour)`, `Gemini (Weekly)`, `Claude & GPT (5-hour)`, `Claude & GPT (Weekly)`) are extracted and populated.
- [x] Fractions are converted to whole percentages (0-100) and reset times are preserved.
- [x] Popup integration tests verify the network payload and the rendering of the four Quota Windows.
