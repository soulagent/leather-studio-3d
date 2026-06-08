# Leather Studio 3D — Session Context
_Last updated: 2026-06-08 · Current version: v0.0.4 · Reads .lpd (Pattern Designer save format v14)_

---

## What this is

A single-file HTML/CSS/JS app (`index.html`) that loads a finished leather pattern (`.lpd`,
produced by the sibling **Leather Pattern Designer**) and previews the pieces in **3D**.
No build step, no npm; **three.js is vendored locally** in `vendor/` (no CDN) so it runs offline.

It is a **separate product** from the Pattern Designer (own repo). The two share a design
language (the `ui-language` skill) so they look/behave like one family.

This is the **Phase-1 framework skeleton**: render each `.lpd` shape as a FLAT textured panel
laid in the XZ plane (1 unit = 1 mm), with a PBR leather material, camera control, and lighting.

---

## File map

```
index.html         ← the entire app (UI + three.js scene + .lpd loader)
vendor/
  three.min.js              ← vendored three.js UMD build (pinned r0.147.0) → global THREE
  OrbitControls.classic.js  ← classic addon (examples/js) → sets THREE.OrbitControls
.working-on.txt    ← NOT app code. One line ("Leather Studio 3D") read by the shared global
                     Claude Code status line, which appends APP_VERSION parsed live from
                     index.html → "Working On: Leather Studio 3D v0.0.1". Don't put the
                     version in this file. Gitignored (personal scratch).
samples/           ← sample .lpd files to load (optional; gitignore covers _scratch*).
tests/
  run-smoke.ps1        ← headless-Edge app-logic smoke runner (-Tier quick|full). Writes the
                         instrumented page to the PROJECT ROOT so ./vendor/ resolves; forces
                         software GL (SwiftShader) since the kernel is defined after WebGLRenderer.
  smoke-harness.js     ← injected test body; asserts against the real kernel + loadPattern
  run-build-smoke.ps1  ← fast STATIC desktop-build checks (version sync, Rust<->JS contract)
run-smoke.cmd      ← double-click launcher for the app smoke (Q/F prompt)
desktop/           ← Tauri v2 native-exe wrapper. build.rs copies index.html + vendor/ into
                     dist/; main.rs = single-instance + take_launch_file + open-lpd + updater. See its README.
.github/workflows/
  release.yml      ← tauri-action: builds + SIGNS + publishes installer + .sig + latest.json
                     (Release per v* tag / manual run). Updater pubkey is in tauri.conf; private
                     key is in ~/.tauri (outside repo) + as repo secrets. See the auto-update note.
MD files/
  CONTEXT.md       ← this file
  DEVLOG.md        ← versioned changelog (append every session)
  SHORTCUTS.md     ← keyboard / mouse reference
.claude/
  commands/        ← /smoketest-quick + /smoketest-full slash commands
  skills/ui-language/SKILL.md  ← shared design language (copied from the Pattern Designer)
README.md
CLAUDE.md
```

## Commands

```powershell
tests\run-smoke.ps1 -Tier quick        # kernel + outline (fast)
tests\run-smoke.ps1 -Tier full         # + stitch gen + .lpd->3D load   (26/26)
tests\run-smoke.ps1 -Feature "stitch-path,load"
tests\run-build-smoke.ps1              # desktop-build wiring, static     (19/19)
```

Run the app smoke after any logic change. Exit 0 = all pass. Uses no Claude credits/context.

---

## Architecture

Plain `<script>`s inside `index.html`: `vendor/three.min.js` (UMD → global `THREE`), then
`vendor/OrbitControls.classic.js` (→ `THREE.OrbitControls`), then the app script. **Classic
scripts on purpose** — ES-module `import` is blocked over `file://` in Chromium, so a module
build silently fails when the file is double-clicked. Use `THREE.*` globals; don't reintroduce
`import`/import maps (see DEVLOG v0.0.1 for the bug this fixed). The render loop is kicked off
**last** (after every definition) inside a try, so a GL hiccup can't leave the kernel undefined.

### The `S` state object
One global `S` holds app state: material (`leather`, `roughness`, `thickness`), `stitch` colour,
lighting (`keyLight`, `ambient`), scene toggles (`showGrid`, `wireframe`, `showStitches`, `light`),
`panelMeshes[]` (panel meshes), `stitchMeshes[]` (hole + thread instanced meshes), `threadMesh`
(for live colour), `docName`, and `lastData/lastName` (for rebuilds). `LP.defMargin/defSpacing` =
stitch defaults read from the loaded doc's `settings`.

### Scene graph
`scene` → ambient + key (`DirectionalLight`, casts soft shadow) + fill light, a `ShadowMaterial`
ground plane, a `GridHelper`, and a `patternGroup` that all loaded panel + stitch meshes go into
(so the whole pattern can be recentred/cleared as a unit). `OrbitControls` with damping drives the
camera; `HOME_CAM` + `resetCamera()` frame the origin (bound to **R**).

### The geometry/stitch KERNEL (ported verbatim from the Pattern Designer)
A clearly-marked block holds the authoritative algorithms copied from the main app's `index.html`
(and its `stitch-edge-logic` skill): `cubicPt`/`sampleSeg`/`samplePath`, `roundedRectPathPts`/
`rectRounded`, `shapeEdgeCount`/`edgeStitched`, `stitchRect`/`stitchCircle`/`stitchPath`/`stitchFor`.
**Keep in sync with the main app** — only the margin/spacing defaults are rebound from `S.*` to
`LP.*`. Coordinates are mm, Y-down (SVG convention).

### The `.lpd` → 3D pipeline (`loadPattern` → `outlinePolygon` → ExtrudeGeometry + stitches)
1. `loadPattern(data, name, keepCam)` clears the scene, sets `LP` defaults from `data.settings`,
   then for each non-hidden shape builds a panel and collects its stitches.
2. `outlinePolygon(sh)` → a sampled **mm polygon**:
   - **rect** → sharp 4-corner, or `samplePath(roundedRectPathPts(sh))` when `radii` are set.
   - **circle** → 72-point ring (`cx,cy,r`, falling back to `x,y,w,h`).
   - **path** → **true bezier** sampled per cubic segment (uses `points` + cp handles), closed
     into a fillable panel. (This is the v0.0.2 pen-render fix — the old code read `sh.pts`.)
   - **text** / unknown → skipped.
3. `shapeFromPolygon` → `THREE.Shape`; extruded by `S.thickness`, rotated flat (shape XY → world
   XZ, **top face at world y = thickness**), shared `leatherMaterial()`.
4. `collectStitches(sh)` runs `stitchFor(sh)` → hole points; `addHoleMesh` (instanced cylinders
   sunk into the top) + `addThreadMesh` (instanced thread-coloured cylinders between consecutive
   holes within ~1.8×spacing). Stitch meshes honour `S.showStitches`.
5. `recentrePattern()` centres the group; `resetCamera()` frames it (unless `keepCam`).

### Live edits (no reload)
- `applyMaterials()` — colour / roughness / wireframe re-applied to every panel mesh.
- `applyStitchColor()` — thread colour. `applyStitch()` — stitch visibility (menu ↔ checkbox sync).
- `rebuild()` — full rebuild from `lastData` keeping the camera (used on **thickness** change,
  since hole/thread Y depends on thickness).
- `applyLighting()` — key/ambient intensities. `applyGrid()` — grid visibility.
  `applyTheme()` — `body.light` + scene background + grid recolour.
- `flash(msg)` — status-bar success flash (~2.6s) per the ui-language feedback rule.

### Input
File ▸ Open (`<input type=file>`), drag-and-drop a `.lpd` onto the canvas, **Ctrl/Cmd+O**, **R**
reset camera. Menubar dropdowns (File / View) follow the shared menu pattern.

---

## The crux / known gaps (READ before planning Phase 2+)

- **`.lpd` has no assembly/seam metadata.** It is a purely 2D document: cut shapes + stitch lines,
  with **nothing** saying which edge joins which, where fold lines are, or material thickness.
  So today we can only render **flat** panels. Folding pieces into the assembled product
  (Phase 2), generating build instructions (Phase 3), and template validation / parametric sync
  (Phase 4) are **all gated** on a seam/assembly data model — either a `.lpd` schema extension or
  a sibling assembly file, plus likely seam-tagging UI added to the Pattern Designer itself.
  **Design this data model early.** 2D→3D in general is ill-posed (it's the inverse of
  pattern-making); the most tractable path is a parametric catalogue of known goods. See the
  phased roadmap in CLAUDE.md and the `companion-3d-app` design note.

## Backlog / TODOs

- ✅ **Bezier paths** — DONE v0.0.2 (`outlinePolygon` samples cubic segments).
- ✅ **Stitch holes + thread** — DONE v0.0.2 (ported kernel + instanced hole/thread meshes).
- ✅ **Smoke tests** — DONE v0.0.2 (`tests/run-smoke.ps1` + `run-build-smoke.ps1`).
- ✅ **Desktop wrapper** — DONE v0.0.2 (`desktop/`, Tauri v2; not yet built).
1. **Sample library**: ship more real `.lpd` files in `samples/` (have `demo-card-pocket.lpd`).
2. **Themed dialogs**: add `confirmModal`/`alertModal` (currently only status-bar flashes) per
   the ui-language skill before any destructive/decision flows.
3. **Saddle-stitch realism**: alternate front/back thread passes + slanted slits (current thread is
   a simple cylinder between holes; holes are surface discs, not boolean-punched).
4. **Desktop follow-ups**: ✅ auto-update DONE (updater plugin + signing key + `release.yml`;
   `checkForUpdates()` in index.html; see DEVLOG). Remaining: native Open/Save dialogs (optional —
   the HTML file input works in WebView2); a paid Authenticode cert to silence SmartScreen.
5. **Thickness**: `rebuild()` re-runs the loader on change; fine, but a partial update would be
   cheaper if perf matters on big patterns.

---

## Conventions

- **Append a DEVLOG entry every session**; bump `APP_VERSION` in `index.html` and the version line
  in this file + SHORTCUTS.md together.
- **All new UI follows the `ui-language` skill** — dark-first tokens + `body.light` override, one
  red accent, themed dialogs (never native), status flash for success.
- **three.js stays vendored as classic scripts** (no CDN, no ES modules — they break over
  `file://`). To upgrade, re-download the UMD build + classic OrbitControls into `vendor/` at a
  version that still ships both (≤ r0.147.0).
