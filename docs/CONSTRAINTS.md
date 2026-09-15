# Constraints

What v3 must hold to, and what it deliberately does not do. Behaviour is owned by
[`SPEC.md`](SPEC.md) and architecture by [`REWRITE-PLAN.md`](REWRITE-PLAN.md); this is the short list
of things neither of those may quietly contradict.

The `NFR-*` numbering is kept because shipped code cites it — `wxt.config.ts` and `src/settings.ts`
both point at NFR-6, and a comment that names a requirement nobody can look up is worse than no
comment.

> Was `PRD.md`, which was generated from the locator spike before anyone wrote down what the tool
> does. Its `FR-*` items described functionality that was never built — `FR-G2`'s class generation
> most obviously — so they are gone rather than left to be read as a specification. What is here is
> the part that was always true.

## Non-functional

- **NFR-1** Chrome and Firefox, **MV3 on both**. v2.5.1 already ships MV3 to AMO, so MV2 would be a
  downgrade on an in-place update.
- **NFR-2** Fully offline and deterministic. No network, no LLM.
- **NFR-3** Per-pick latency stays interactive — under roughly 100 ms on a typical DOM.
- **NFR-4** Automated tests are a net, not the gate: unit for the generators, engine fidelity against
  real Playwright, and extension E2E. What decides *done* is a manual pass
  ([`MANUAL-VERIFICATION.md`](MANUAL-VERIFICATION.md)).
- **NFR-5** Build → zip → multi-store submit runs from CI, not from a laptop.
- **NFR-6** Ships as an **in-place update** to the existing listings. The CWS item id
  (`ejgkdhekcepfgdghejpkmbfjgnioejak`) and the AMO `gecko.id`
  (`{1e34b9b3-8f45-415e-9586-c7d5de0d0aff}`) are preserved — both live in `wxt.config.ts` and are
  guarded by `scripts/check-manifests.mjs`, which rejects a placeholder outright. User storage
  survives the upgrade: v3 reads the same `storage.sync` key and the same setting names.
- **NFR-7** **Browser floors are declared in the manifest and guarded by
  `scripts/check-manifests.mjs`.** Chrome **114** (`minimum_chrome_version`), set by the side panel
  API; Firefox **115** (`gecko.strict_min_version`), set by `storage.session`, where the per-tab
  models live. Both are the highest floor anything in v3 needs — MV3 itself is Chrome 88 / Firefox
  109, and `menus` with `contexts: ['action']` is Chrome 85 / Firefox 109. Shipped source uses no
  JavaScript newer than `??=` and `replaceChildren` (2020).

## Out of scope

Action recording and replay · LLM-assisted naming · **user-editable code templates** ·
object-repository and other non-code exports · Robot Framework · Protractor · Angular locators.

Templates ship fixed. Teams with their own conventions are served by the **locators only** shape
(SPEC §11), which is the escape hatch — our locators, none of our opinions. Editable templates are
deferred rather than dropped.

## v2.5.1 is not the default

The shipping code is 10–15 years old and carries decisions made for a browser landscape that no longer
exists. Where current best practice differs from what v2.5.1 does, **v3 takes current best practice**.
Parity is a floor for *features*, never a reason to carry a dated technique forward.

Two consequences worth knowing, because they are visible to a v2.5.1 user:

- `<img>` reclassifies from actionable to static, so images no longer get a `click` method. v2.5.1's
  `isClickable` included `IMG`; role-based classification does not. Accepted.
- `<div role="button">` and its like now classify correctly as actionable, which a `tagName` check
  missed entirely.
