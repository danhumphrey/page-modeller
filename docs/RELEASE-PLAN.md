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
13. ✅ **Listing copy** drafted and settled in `STORE-LISTING.md`: name, summary, description,
    categories, and the justification CWS demands for `<all_urls>`. Two decisions recorded there that
    are edits to the STORE FORMS rather than to the copy — UK spelling throughout, so Chrome's
    *modeling* changes; and the "considered a beta release" line comes off both listings.

## Phase 4 — Docs

14. ✅ Rewrite `README.md` — it described Phase 1 of the rewrite. The manual checklist buried in it is
    now `MANUAL-VERIFICATION.md`, updated to current behaviour; the stale "Phase 1 — Playwright Page
    Object Model" description in `package.json` and the **manifest** is now the store summary.
    **Outstanding:** a screenshot for the top of the README, once the store captures are chosen.
15. ✅ Pruned. `PRD.md` became `CONSTRAINTS.md` — its `FR-*` items described functionality that was
    never built, so they are gone rather than left to read as a specification, and the NFRs and
    out-of-scope list that were always true are kept, numbering included, because shipped code cites
    NFR-6. `SESSION-CONTEXT.md` is deleted: everything current in it lives in CLAUDE.md or SPEC.md,
    and one row of it had gone stale (it said Firefox was DevTools-only).

## Phase 5 — Submit

16. **Secrets: three, all of which you already have.** In
    `Settings → Secrets and variables → Actions`: `FIREFOX_JWT_ISSUER` and `FIREFOX_JWT_SECRET` (the
    AMO key and secret) and `FIREFOX_EXTENSION_ID`, which must be the **slug** — `page-modeller` — and not the gecko GUID. AMO's
    API takes a slug, a numeric id or a GUID, but a GUID has braces, they are not URL-safe, and the
    submit tool passes the value straight into the path: the GUID 404s on "Getting addon details"
    after the authentication has already succeeded, which reads like a credentials problem and is
    not one. The GUID still belongs in `wxt.config.ts`, where it identifies the add-on to Firefox.

    **Chrome is uploaded by hand**, from the `release-zips` artifact the workflow keeps — the same
    drag-and-drop 2.5.1 used, two minutes, a few times a year. Its API is not worth the setup: V1
    wants a Google Cloud project, an OAuth consent screen, a client and a refresh token that expires
    after seven days unless the consent screen is published — and **V1 is retired on 15 October
    2026**, so all of that buys about a month. V2 replaces it with a service account and no consent
    screen, which is genuinely simpler and worth doing *later*, on its own time. The workflow already
    submits to Chrome automatically the moment `CHROME_CLIENT_ID` exists, so nothing has to change
    when it does.
17. **Rehearse.** Run the **Release dry run** workflow from the Actions tab. It builds the same zips
    and runs the same submit command with `--dry-run`: authentication only, nothing uploaded. Do this
    before tagging — otherwise the first time the credentials are exercised is on a tag that has
    already been pushed.

    **`--dry-run` is not enough on its own**, which 3.0.0 found out. It stops *before* the submit call,
    so it proves the key authenticates and never that the key may publish *this* add-on. The first
    attempt failed at the last step with a 403 after building, uploading and validating: the key was
    valid and belonged to a second Mozilla account that owned no add-ons. `scripts/check-amo-access.mjs`
    now asks that question directly — it reads the key's own account id and checks it against the
    add-on's authors — and runs first in **both** workflows, so a doomed release stops in seconds
    rather than ten minutes in. A slug returning 200 proves only that the listing exists; it is public,
    and it resolves for anybody.
18. **Tag and push.** `v3.0.0`. The workflow runs the full suite with `PM_REQUIRE_FULL_SUITE=1`,
    checks the tag agrees with `package.json`, zips, and submits to both stores. Submitting is not
    publishing: both gate on review, and AMO reviews the sources zip as well.

## Risks worth naming now

- **`<all_urls>` invites scrutiny.** CWS asks why, in writing, and broad host permissions slow review.
- **AMO reviews source** because the upload is bundled. Phase 2.9 is not cosmetic.
- **Settings must survive the upgrade.** v3 reads the same `storage.sync` key (`options`) and the same
  names as v2.5.1 — asserted by code, never by a test against real v2.5.1 data. Worth one.
