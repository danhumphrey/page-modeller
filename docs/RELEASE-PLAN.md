# Release plan

What stands between v3 and an in-place update of both store listings. Ordered; each phase is
independently mergeable.

## Blockers only you can clear

| | Why it is yours |
|---|---|
| **The AMO add-on id** | ✅ `{1e34b9b3-8f45-415e-9586-c7d5de0d0aff}` — found on the public AMO search API, not supplied by hand. Now in `wxt.config.ts`, and `check-manifests.mjs` rejects a placeholder so it cannot regress. |
| **The CWS item id** | `ejgkdhekcepfgdghejpkmbfjgnioejak`, from the store URL. |
| **The version number** | ✅ `3.0.0`. Both stores reject an upload that is not higher than what is published — CWS has 2.5.1, **AMO is still on 2.1.0**. The manifest check enforces the floor at build time. |
| **Listing copy and branding** | I can draft; the words and the artwork are a product decision. |

**Credentials are not on this list, and must never be.** The store API keys go straight into GitHub
repo secrets (`Settings → Secrets and variables → Actions`); CI reads them at submit time. Nothing
local needs them, nothing in this repo reads them, and they should not be pasted into a terminal, a
file, or a conversation. An earlier draft listed their names here alongside things that genuinely
needed telling, which read as a request for the values. It was not.

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

14. ✅ Rewrite `README.md` — it described Phase 1 of the rewrite. The manual checklist buried in it is
    now `MANUAL-VERIFICATION.md`, updated to current behaviour; the stale "Phase 1 — Playwright Page
    Object Model" description in `package.json` and the **manifest** is now the store summary.
    **Outstanding:** a screenshot for the top of the README, once the store captures are chosen.
15. Prune: `PRD.md` is explicitly not authoritative (SPEC.md supersedes it) and
    `SESSION-CONTEXT.md` is history. Keep SPEC and this plan.

## Phase 5 — Submit

16. Secrets, tag, push. Both stores gate on review; AMO will also review the sources.

## Risks worth naming now

- **`<all_urls>` invites scrutiny.** CWS asks why, in writing, and broad host permissions slow review.
- **AMO reviews source** because the upload is bundled. Phase 2.9 is not cosmetic.
- **Settings must survive the upgrade.** v3 reads the same `storage.sync` key (`options`) and the same
  names as v2.5.1 — asserted by code, never by a test against real v2.5.1 data. Worth one.
