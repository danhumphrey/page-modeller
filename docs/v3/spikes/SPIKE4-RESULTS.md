# Spike #4 Results — A11y Verification Performance on Large DOMs

Per-pick latency of `engine.generate(el)` (candidate generation + in-page uniqueness verification, including the DOM-wide role/accessible-name scan). Timed with `performance.now()` inside the page.

| Target | Real element count | Samples | Median (ms) | p95 (ms) | Max (ms) | Mean (ms) |
|---|---|---|---|---|---|---|
| 1000 | 1180 | 31 | 1.9 | 8.2 | 14.8 | 2.8 |
| 5000 | 5842 | 31 | 7.2 | 79.1 | 89.1 | 13.6 |
| 10000 | 11680 | 31 | 14.4 | 304.1 | 321.7 | 40.4 |

## Verdict

**✅ Comfortably interactive — no optimization needed for the rewrite.** Median per-pick is ~14ms even on
an ~11.7k-element DOM, scaling linearly (~1.2µs/element) — the DOM-wide role/accname scan and the
pseudo-content `getComputedStyle` additions are not a problem at realistic page sizes.

**Note the tail:** p95/max grow faster than the median (~300ms worst case at 11.7k). A few picks — those
whose accessible-name computation recurses through large subtrees — are ~20× the median. Sub-second, so
fine, but if it ever matters there's clear headroom:

- **Memoize a role+name index once per page** and reuse it across picks (invalidate on DOM mutation via
  `MutationObserver`). This turns repeated picks from O(N) each into O(1) amortized — the biggest win,
  since a user picks many elements on the same page.
- Compute pseudo-content only for the picked element, not for every node in the uniqueness scan.

Neither is needed now; both are easy if a pathological page shows up.
