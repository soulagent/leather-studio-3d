# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Leather Studio 3D** — a single-file HTML/CSS/JS app (`index.html`) that loads a finished
leather pattern (`.lpd`, produced by the sibling **Leather Pattern Designer**) and previews
the pieces in **3D**: leather material + stitch colour, full camera control, and lighting.
**No build step, no npm.** The entire app is `index.html`; three.js is **vendored locally**
in `vendor/` (no CDN), so it runs fully offline — just open `index.html` in a browser.

This is a **separate product** from the Leather Pattern Designer (its own repo). They share a
**visual + interaction design language** (the `ui-language` skill, copied into this repo) so
the two apps look and behave like one family.

**Stack decision (locked):** single-file HTML + vendored three.js for the web MVP. A C++/native
path may come later for a shared geometry kernel — out of scope for now.

## Read these first

The reference docs live in **`MD files/`**. Before making changes, read:
- **`MD files/CONTEXT.md`** — architecture, the `S` state object, the `.lpd`→3D pipeline, the
  function map, and the "crux / known gaps" section (chiefly: `.lpd` has no assembly/seam data,
  so today we render flat panels only). Primary orientation doc.
- **`MD files/DEVLOG.md`** — versioned changelog, one entry per session. **Append a new entry
  every session** and bump `APP_VERSION` in `index.html` + the version line in CONTEXT/SHORTCUTS.
- **`MD files/SHORTCUTS.md`** — keyboard/mouse reference; keep in sync when adding interactions.
- **`.claude/skills/ui-language/SKILL.md`** — the shared design tokens (dark/light, one red
  accent), property-row patterns, themed dialogs, french-stitch motif. Apply to all new UI.

## Commands

```powershell
tests\run-smoke.ps1 -Tier quick        # ~kernel + outline (fast)
tests\run-smoke.ps1 -Tier full         # + stitch generation + .lpd->3D load  (26/26)
tests\run-smoke.ps1 -Feature "stitch-path,load"
tests\run-build-smoke.ps1              # desktop-build wiring, static (no compile)  (19/19)
```

Also `/smoketest-quick` `/smoketest-full`, or double-click `run-smoke.cmd`. Run the app smoke
after any logic change (exit 0 = pass). All runs are headless/standalone — no Claude credits or
context. The app smoke forces software GL (SwiftShader) and writes its temp page to the **project
root** so `./vendor/` resolves. To view the app: open `index.html` in a browser. Build the exe:
`cd desktop\src-tauri; cargo tauri build`.

## Roadmap (phased — see CONTEXT.md for the full game plan)

- **Phase 1 (now): 3D viewer MVP.** Load `.lpd`, render each piece as a flat textured panel in
  3D, leather/stitch material, camera + lighting. Low risk, immediately useful. ← current
- **Phase 2: assembly authoring.** Seam graph + fold lines (needs a `.lpd` schema extension or a
  sibling assembly file; likely seam-tagging UI added to the Pattern Designer). Fold flat pieces
  into the 3D product.
- **Phase 3: build instructions** generated from the assembly graph (Lego-manual style).
- **Phase 4: template validation** (does the 3D surface unfold to the flat pieces?) + parametric
  bidirectional sync for templated goods.

**The crux:** Phases 2–4 are gated on **assembly/seam metadata that `.lpd` does not have yet**
(no edge-join info, fold lines, or material thickness). Design that data model early.

## Editing the app — what to keep in mind

- **mm == world units.** Pattern geometry is millimetres; in 3D, 1 unit = 1 mm. Don't conflate
  screen px and world mm.
- **three.js is vendored as CLASSIC (non-module) scripts, not from a CDN.** `index.html` loads
  `vendor/three.min.js` (UMD build → global `THREE`) then `vendor/OrbitControls.classic.js`
  (sets `THREE.OrbitControls`), then the app's plain `<script>`. **Do NOT use ES modules / import
  maps here** — Chromium blocks `import` over `file://`, which silently breaks the whole app when
  the file is double-clicked (this exact bug bit v0.0.1; see DEVLOG). Pinned at **r0.147.0**, the
  last three.js that still ships both the UMD global build and the classic `examples/js`
  OrbitControls. To bump, re-download both files at a version that still has them.
- **One shared PBR leather material**; live edits (colour/roughness/wireframe) re-apply across all
  panel meshes via `applyMaterials()`. Geometry-changing edits (thickness) are handled separately.
- **`S` is the single app-state object.** `S.panelMeshes` holds the current pattern's meshes;
  `clearScene()` disposes geometry+material before dropping them.
- **`.lpd` is read-only input.** This app never writes `.lpd`. It defaults missing fields the same
  way the Pattern Designer does (hidden→false, etc.) and **skips** shape types it can't render in
  3D yet (text). Bezier path curvature is approximated by anchor polygon for now (TODO in DEVLOG).
- **UI = the `ui-language` skill.** Dark-first tokens + `body.light` override, one red accent,
  themed dialogs (never native `confirm`/`alert`), status-bar flash for success.

## Status line

`.working-on.txt` (one line, "Leather Studio 3D") is read by the shared global Claude Code status
line (`~/.claude/statusline.ps1`), which appends the live `APP_VERSION` parsed from `index.html`.
So the status row reads "Working On: Leather Studio 3D vX.Y.Z" and tracks the version automatically
— **don't put the version in `.working-on.txt`**.

## Working style (shared with the Pattern Designer)

- Short, punchy iterations: change one thing, verify in the browser, update DEVLOG, move on.
- Don't over-engineer deferred items — respect the phased roadmap; don't start Phase 2+ work
  before the seam-data model exists.
- To view the app: open `index.html` directly in a browser (no server needed).
