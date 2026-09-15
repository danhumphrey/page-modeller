# Spike #5 Results — Cross-Origin Frame Path Assembly

**Core result:** 6/6 elements across nested frames resolved **uniquely to the correct element** via an assembled `frameLocator` chain in a real Playwright run.

Coverage — main frame: 1, same-origin frames: 4, cross-origin frames: 1.

| Element | Frame path | Frame origin | Resolves to target |
|---|---|---|---|
| `top-button` | _(main)_ | main | ✅ |
| `child-email` | `#same-frame` | same-origin | ✅ |
| `child-submit` | `#same-frame` | same-origin | ✅ |
| `mid-button` | `#cross-frame` | cross-origin | ✅ |
| `child-email` | `#cross-frame` › `#deep-frame` | same-origin | ✅ |
| `child-submit` | `#cross-frame` › `#deep-frame` | same-origin | ✅ |
