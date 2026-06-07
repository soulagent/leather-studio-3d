# Leather Studio 3D — Session Context
_Last updated: 2026-06-07 · Current version: v0.0.1 · Reads .lpd (Pattern Designer save format v14)_

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
MD files/
  CONTEXT.md       ← this file
  DEVLOG.md        ← versioned changelog (append every session)
  SHORTCUTS.md     ← keyboard / mouse reference
.claude/
  skills/ui-language/SKILL.md  ← shared design language (copied from the Pattern Designer)
README.md
CLAUDE.md
```

---

## Architecture

Plain `<script>`s inside `index.html`: `vendor/three.min.js` (UMD → global `THREE`), then
`vendor/OrbitControls.classic.js` (→ `THREE.OrbitControls`), then the app script. **Classic
scripts on purpose** — ES-module `import` is blocked over `file://` in Chromium, so a module
build silently fails when the file is double-clicked. Use `THREE.*` globals; don't reintroduce
`import`/import maps (see DEVLOG v0.0.1 for the bug this fixed).

### The `S` state object
One global `S` holds app state: material (`leather`, `roughness`, `thickness`), `stitch` colour,
lighting (`keyLight`, `ambient`), scene toggles (`showGrid`, `wireframe`, `light` theme),
`panelMeshes[]` (the current pattern's meshes), and `docName`.

### Scene graph
`scene` → ambient + key (`DirectionalLight`, casts soft shadow) + fill light, a `ShadowMaterial`
ground plane, a `GridHelper`, and a `patternGroup` that all loaded panel meshes go into (so the
whole pattern can be recentred/cleared as a unit). `OrbitControls` with damping drives the camera;
`HOME_CAM` + `resetCamera()` frame the origin (bound to **R**).

### The `.lpd` → 3D pipeline (`loadPattern` → `shapeFor` → ExtrudeGeometry)
1. `loadPattern(data, name)` clears the scene, then for each non-hidden shape builds a
   `THREE.Shape` via `shapeFor`.
2. `shapeFor(sh)` maps a `.lpd` shape to a flat 2D outline in mm:
   - **rect** → `roundedRectShape` (corner radius from `rad`, or the max of `rTL/rTR/rBR/rBL`).
   - **circle** → `absarc` (uses `cx,cy,r`, falling back to `x,y,w,h` centre/half-min).
   - **path** → polygon through `pts` anchors. **Bezier curvature is NOT yet honoured** (anchors
     are joined with straight lines) — a known TODO (see DEVLOG / backlog).
   - **text** and unknown types → skipped (no 3D representation yet).
3. Each shape is extruded by `S.thickness` (`ExtrudeGeometry`, no bevel), rotated flat into the
   XZ plane, and given a shared `leatherMaterial()` (MeshStandardMaterial, double-sided).
4. `recentrePattern()` centres the group over the origin; `resetCamera()` frames it.

### Live edits (no reload)
- `applyMaterials()` — colour / roughness / wireframe re-applied to every panel mesh.
- `rebuildIfThickness()` — thickness change scales mesh Y to the new depth (skeleton shortcut;
  a true rebuild from the doc is a later refinement).
- `applyLighting()` — key/ambient intensities. `applyGrid()` — grid visibility (menu ↔ checkbox
  stay in sync). `applyTheme()` — `body.light` + scene background + grid recolour.
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

1. **Bezier paths**: honour control points (`absarc`/`bezierCurveTo`) instead of anchor polygons.
2. **Stitch holes**: render the saddle-stitch holes/thread in 3D once we reuse the Pattern
   Designer's `stitch-edge-logic` (currently the Stitch panel only sets a thread colour).
3. **Thickness**: rebuild geometry from the doc rather than scaling Y.
4. **Sample library**: ship a couple of real `.lpd` files in `samples/`.
5. **Themed dialogs**: add `confirmModal`/`alertModal` (currently only status-bar flashes) per
   the ui-language skill before any destructive/decision flows.
6. **Smoke tests**: no harness yet (the app is mostly three.js rendering). Add logic-level checks
   for `shapeFor`/`loadPattern` if the loader grows.

---

## Conventions

- **Append a DEVLOG entry every session**; bump `APP_VERSION` in `index.html` and the version line
  in this file + SHORTCUTS.md together.
- **All new UI follows the `ui-language` skill** — dark-first tokens + `body.light` override, one
  red accent, themed dialogs (never native), status flash for success.
- **three.js stays vendored as classic scripts** (no CDN, no ES modules — they break over
  `file://`). To upgrade, re-download the UMD build + classic OrbitControls into `vendor/` at a
  version that still ships both (≤ r0.147.0).
