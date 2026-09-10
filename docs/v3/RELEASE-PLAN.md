# Release plan

What stands between v3 and an in-place update of both store listings. Ordered; each phase is
independently mergeable.

## Blockers only you can clear

| | Why it is yours |
|---|---|
| **The AMO add-on id** | v2.5.1 declares no `gecko.id`, so AMO assigned one. It is on the listing, not in this repo. `wxt.config.ts` has `todo-amo-id@page-modeller.invalid` — submit with that and AMO creates a **second add-on** rather than updating the existing one. Find it in the Developer Hub, or in the manifest of the published XPI. |
| **The CWS item id** | The long string in the store URL. Needed as the `CHROME_EXTENSION_ID` secret. |
| **The version number** | v3 is `0.1.0`. Both stores reject an upload that is not **higher than 2.5.1**. `2.6.0` says "same tool, rebuilt"; `3.0.0` says "new major". |
| **Store secrets** | `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`, and the two ids above. |
| **Listing copy and branding** | I can draft; the words and the artwork are a product decision. |

## Phase 1 — Restructure the repo

v3 moves to the root and v2.5.1 retires. Do this first: everything else touches paths.

1. Tag the shipping code `v2.5.1-final` so it stays reachable, then delete `src/`, `webpack.config.js`,
   the root `scripts/`, the Jest config and the v2.5.1 half of `package.json`.
2. Move `v3/*` up. Merge `.gitignore`. Decide `docs/v3/` → `docs/`.
3. Collapse CI to one job — the `v3` one. The `test` job exists only for `src/`.
4. Rewrite CLAUDE.md's orientation: there is one codebase again. Keep the gotchas.
5. Decide what happens to `media/` — v2.5.1's store artwork, and the source `.sketch` files.

## Phase 2 — Release plumbing

6. Set the version, in one place, and check it at build time: **higher than 2.5.1 or the build fails**.
7. Replace the `gecko.id` placeholder. `scripts/check-manifests.mjs` should reject the placeholder
   outright, so it cannot be shipped by accident.
8. Move `release.yml` to the root and bring it up to date: it is on **Node 20**, which cannot run the
   jsdom tests; it uses `npm install`; it runs `test:unit` and a partial E2E rather than `npm test`, so
   it never runs the manifest checks or builds Firefox. Give the tag a prefix that cannot collide with
   a v2.5.1 tag.
9. Trim the AMO sources zip. It is **9.5 MB**, of which 17 MB uncompressed is
   `tests/compile/csharp/bin/` — three `selenium-manager` binaries. Reviewers read this.
10. A preflight check before submit: version, id, both zips present, manifest shape.

## Phase 3 — Store assets

11. **Screenshots.** `scripts/screenshot.mjs` already renders both panel surfaces. Extend it to emit
    store sizes (1280×800) against a fixture page with a populated model, so they are reproducible
    rather than hand-cropped. You approve them.
12. **Promo tiles.** CWS requires a 440×280 small tile; the 1400×560 marquee is optional. AMO needs
    none. `media/promo_*.png` are v2.5.1's — reuse or redraw is yours.
13. **Listing copy.** Name, 132-character summary, description, category, and the justification CWS
    demands for `<all_urls>`. I draft, you edit.

## Phase 4 — Docs

14. Rewrite `README.md` — it describes v2.5.1.
15. Prune: `PRD.md` is explicitly not authoritative (SPEC.md supersedes it) and
    `SESSION-CONTEXT.md` is history. Keep SPEC and this plan.

## Phase 5 — Submit

16. Secrets, tag, push. Both stores gate on review; AMO will also review the sources.

## Risks worth naming now

- **`<all_urls>` invites scrutiny.** CWS asks why, in writing, and broad host permissions slow review.
- **AMO reviews source** because the upload is bundled. Phase 2.9 is not cosmetic.
- **Settings must survive the upgrade.** v3 reads the same `storage.sync` key (`options`) and the same
  names as v2.5.1 — asserted by code, never by a test against real v2.5.1 data. Worth one.
