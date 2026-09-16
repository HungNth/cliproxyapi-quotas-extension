# Quota Health Color Thresholds

Status: ready-for-agent

## Problem Statement

Users need a clearer, four-tier visual indication of their remaining quota capacity across all providers. The previous three-tier scheme (>50% green, 21–50% amber, <=20% red) was too coarse, making it difficult to distinguish between healthy capacity (e.g. 80%), moderate capacity (e.g. 60%), low capacity (e.g. 40%), and critical capacity (<30%).

## Solution

Update the quota progress bar and percentage text color thresholds across all Provider Groups in the popup to use a refined four-tier health scale:
- Healthy (>= 70%): Emerald green (`bg-emerald-500`, `text-emerald-600 dark:text-emerald-400`)
- Moderate (50% – 69%): Yellow (`bg-yellow-500`, `text-yellow-600 dark:text-yellow-400`)
- Low (30% – 49%): Orange (`bg-orange-500`, `text-orange-600 dark:text-orange-400`)
- Critical (< 30%): Rose red (`bg-rose-500`, `text-rose-600 dark:text-rose-400`)
- Unavailable / Null: Gray (`bg-zinc-400`, `text-zinc-500`)

## User Stories

1. As a user viewing my quota dashboard, I want Quota Windows with >= 70% capacity shown in emerald green, so that I immediately see which models have plentiful capacity.
2. As a user viewing my quota dashboard, I want Quota Windows with 50% to 69% capacity shown in yellow, so that I can see when capacity has dropped below the top tier without being critical yet.
3. As a user viewing my quota dashboard, I want Quota Windows with 30% to 49% capacity shown in orange, so that I get an early warning when capacity is running low.
4. As a user viewing my quota dashboard, I want Quota Windows with less than 30% capacity shown in rose red, so that urgent capacity constraints are unmistakably prominent.
5. As a user with unavailable or loading quota data, I want null percentages rendered in neutral gray, so that missing data is not mistaken for a health status.
6. As a user switching between light and dark mode, I want text colors optimized for contrast in both modes, so that numbers remain legible in any theme.
7. As a user managing multiple providers, I want these color thresholds applied consistently across Codex, Antigravity, and Claude accounts, so that the meaning of colors is uniform throughout the extension.

## Implementation Decisions

- **Color Mapping in Popup**:
  - Update `getProgressColor(percent: number | null): string`:
    - `percent === null` -> `'bg-zinc-400'`
    - `percent >= 70` -> `'bg-emerald-500'`
    - `percent >= 50` -> `'bg-yellow-500'`
    - `percent >= 30` -> `'bg-orange-500'`
    - default (< 30) -> `'bg-rose-500'`
  - Update `getTextColor(percent: number | null): string`:
    - `percent === null` -> `'text-zinc-500'`
    - `percent >= 70` -> `'text-emerald-600 dark:text-emerald-400'`
    - `percent >= 50` -> `'text-yellow-600 dark:text-yellow-400'`
    - `percent >= 30` -> `'text-orange-600 dark:text-orange-400'`
    - default (< 30) -> `'text-rose-600 dark:text-rose-400'`
- **Scope**:
  - Applied directly in `entrypoints/popup/App.vue`, automatically covering all Provider Groups and Quota Windows.

## Testing Decisions

- **Seam**: Existing popup integration test seam in `entrypoints/popup/__tests__/popup.test.ts`.
- **Test cases**:
  - Verify that a Quota Window with >= 70% receives emerald classes.
  - Verify that a Quota Window between 50% and 69% receives yellow classes.
  - Verify that a Quota Window between 30% and 49% receives orange classes.
  - Verify that a Quota Window below 30% receives rose classes.
  - Verify that a Quota Window with null remaining percent receives zinc classes.

## Out of Scope

- Custom per-provider color configurations or user-customizable threshold sliders.
- Color changes to headers, badges, or connection settings.

## Further Notes

- Maintains accessibility and contrast in both light and dark modes with Tailwind v4.
