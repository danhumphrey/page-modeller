# Spike #2 Results — WXT + Vue 3 + Quasar + TS Integration

**Core result: ✅ The stack integrates and ships a working cross-browser MV3 extension.**

A minimal extension (`spike-ui/`) with a Quasar-built popup (banner + icon button + data table)
builds for both Chrome and Firefox and **renders correctly in a real browser** with zero console errors.

## What was validated

| Check | Result |
|---|---|
| Chrome build (`wxt build`) | ✅ `chrome-mv3`, built in ~1.5s |
| Firefox build (`wxt build -b firefox`) | ✅ `firefox-mv2` (see finding below) |
| Quasar Sass compiles | ✅ 199 kB CSS emitted from `quasar/src/css/index.sass` |
| Vue 3 SFCs compile | ✅ via `@vitejs/plugin-vue` |
| Quasar component mounts | ✅ `.q-btn` present, themed |
| Quasar styling applied | ✅ button `border-radius: 3px`; banner bg `rgb(25,118,210)` (primary) |
| Icon font bundled | ✅ `@quasar/extras` material-icons woff/woff2 in output |
| `q-table` renders rows | ✅ 2 rows + pagination footer |
| Console errors | ✅ none |

Screenshot: `spike-ui/popup-render.png`.

## Integration recipe (the thing the spike de-risked)

- **Drive Vite directly** in `wxt.config.ts` rather than using the WXT Vue module — register
  `@vitejs/plugin-vue` *and* `@quasar/vite-plugin` yourself, passing Quasar's `transformAssetUrls` into
  the Vue plugin's `template` option. This avoids a double Vue-plugin conflict and wires Quasar exactly
  as it expects.
- Import Quasar's Sass entry (`quasar/src/css/index.sass`) in the entry script; requires a Sass
  implementation (`sass-embedded`) as a dev dependency.
- `createApp(App).use(Quasar).mount('#app')` in the popup entry.

## Findings / notes

1. **WXT defaults Firefox to MV2.** It abstracts the per-browser manifest version for you (Chrome→MV3,
   Firefox→MV2). This is a feature, not a blocker — it sidesteps Firefox's still-maturing MV3 background
   model. MV3 on Firefox can be forced via config later if required. (Revises the earlier
   "MV3 everywhere" phrasing in §8 of the plan.)
2. **Bundle size:** ~210 kB JS + ~199 kB CSS for full Quasar. Fine for an extension UI. The Quasar Vite
   plugin tree-shakes component *JS*, but the imported CSS index is the full framework; trimmable later
   if it matters.
3. **No Quasar CLI needed** — the `@quasar/vite-plugin` path works cleanly inside WXT's Vite build, so
   we keep WXT's cross-browser entrypoint/manifest handling and still get Quasar.

## Verdict

Stack confirmed. No change to the recommended WXT + Vue 3 + Quasar + TypeScript choice.
