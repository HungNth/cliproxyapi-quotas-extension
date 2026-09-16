# 01: Implement 4-tier quota health color thresholds

**What to build:** Update quota progress bar and text color thresholds in the popup to follow a four-tier scale (>=70% green/emerald, 50-69% yellow, 30-49% orange, <30% red/rose, null gray/zinc) across all providers and themes.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Quota windows with remaining percentage >= 70% render emerald progress bar (`bg-emerald-500`) and text (`text-emerald-600 dark:text-emerald-400`).
- [x] Quota windows with remaining percentage between 50% and 69% render yellow progress bar (`bg-yellow-500`) and text (`text-yellow-600 dark:text-yellow-400`).
- [x] Quota windows with remaining percentage between 30% and 49% render orange progress bar (`bg-orange-500`) and text (`text-orange-600 dark:text-orange-400`).
- [x] Quota windows with remaining percentage < 30% render rose progress bar (`bg-rose-500`) and text (`text-rose-600 dark:text-rose-400`).
- [x] Quota windows with null remaining percentage render neutral zinc gray (`bg-zinc-400`, `text-zinc-500`).
- [x] Automated integration tests verify the rendered color classes for each tier.
