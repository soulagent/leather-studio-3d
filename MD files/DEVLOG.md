# Leather Studio 3D — Development Log

One entry per session, newest first. Bump `APP_VERSION` in `index.html` and the version line in
`CONTEXT.md` + `SHORTCUTS.md` with each entry.

---

## v0.0.2 — Pen paths + stitching + desktop wrapper + smoke tests (2026-06-07)

Second pass on the framework, addressing user feedback ("pen shapes don't show, no
stitch holes/thread") plus a desktop exe and a standalone test harness.

- **Pen/path render fix.** The loader looked for `sh.pts`; real `.lpd` path shapes use
  **`points`** with cubic control points (`{x,y,cp1x,cp1y,cp2x,cp2y,corner}` + `closed`).
  Rewrote outline building as `outlinePolygon(sh)` -> sampled mm polygon -> `shapeFromPolygon`
  -> `ExtrudeGeometry`, so pen pieces now render with **true bezier curvature** (sampled, not
  anchor-only). Rect now honours the per-corner **`radii`** array (matches the main app), circle
  unchanged.
- **Stitching in 3D.** Ported the Pattern Designer's **stitch-edge-logic kernel VERBATIM**
  (`cubicPt`/`sampleSeg`/`samplePath`/`roundedRectPathPts`/`rectRounded`/`shapeEdgeCount`/
  `edgeStitched`/`stitchRect`/`stitchCircle`/`stitchPath`/`stitchFor`) — only the margin/spacing
  defaults are rebound to `LP.*`. `collectStitches` turns each shape's holes into instanced
  geometry: **holes** = dark cylinders sunk into the top face, **thread** = thread-coloured
  cylinders spanning consecutive holes (gap-limited so partial-edge runs don't bridge). New
  View ▸ Stitching toggle + Scene panel checkbox; thread colour is live. Defaults read from the
  doc's `settings.defMargin/defSpacing`, per-shape `stitchMargin/stitchSpacing/stitchEdges`
  respected.
- **Desktop wrapper (`desktop/`).** Tauri v2 shell mirroring the Pattern Designer: `build.rs`
  copies `index.html` **and `vendor/`** into `dist/`; `main.rs` = single-instance + `take_launch_file`
  + `open-lpd` event so "Open with -> Leather Studio 3D" loads a `.lpd` straight into the viewer.
  Frontend has a `window.__TAURI__` launch hook (no-op in browser). **No** `.lpd` association
  (the editor owns it) and **no** updater yet (needs its own key/repo/pipeline). Build with
  `cargo tauri build`; not yet built here.
- **Standalone smoke tests (`tests/`).** `run-smoke.ps1` (quick/full) injects `smoke-harness.js`
  into a copy of `index.html`, runs headless Edge (software GL), and greps a JSON result — like
  LPD but **writes the temp page to the project root** so `./vendor/` resolves, and passes
  SwiftShader flags (the kernel is defined after `WebGLRenderer`). **Full 26/26, quick 11/11.**
  `run-build-smoke.ps1` = 19/19 static build-wiring checks (version sync, Rust<->JS contract).
  Slash commands `/smoketest-quick` `/smoketest-full`; double-click `run-smoke.cmd`. Runs use no
  Claude credits/context.
- Also: render loop now kicks off **last** (after all definitions) inside a try, so a GL hiccup
  can't leave the kernel undefined. Version bumped to **v0.0.2** across index/tauri.conf/Cargo/ledger.

---

## v0.0.1 — Project framework / Phase-1 skeleton (2026-06-07)

**First commit.** Stood up Leather Studio 3D as a **separate product / separate git repo** beside
the Leather Pattern Designer, per the long-planned 3D companion (see the `companion-3d-app` note).

What landed:
- **`index.html`** — single-file app shell.
  - **three.js vendored locally as CLASSIC scripts** (`vendor/three.min.js` UMD → global `THREE`,
    + `vendor/OrbitControls.classic.js`, pinned **r0.147.0**) so the app runs **fully offline, no
    CDN, no build** — just double-click `index.html`.

  **Fix during this session:** the first cut used ES modules + an import map (three r0.160.0).
  That **silently failed when opening `index.html` over `file://`** — Chromium blocks `import`
  for CORS, so the whole module never ran and File ▸ Open did nothing (the static menu HTML still
  showed, masking it). Switched to classic `<script>` + global `THREE` (re-vendored r0.147.0, the
  last release shipping both a UMD build and a classic OrbitControls). Verified headless that the
  app script now executes and the WebGL canvas is created. **Rule: no ES modules in this app.**
  - **Scene**: PerspectiveCamera + damped `OrbitControls`, ambient + key (soft-shadow) + fill
    lights, a `ShadowMaterial` ground plane, a `GridHelper`, and a `patternGroup` container.
  - **`.lpd` → 3D pipeline**: `loadPattern` → `shapeFor` → `ExtrudeGeometry`, laying each piece
    flat in the XZ plane at 1 unit = 1 mm. Handles **rect** (incl. corner radius), **circle**,
    and **path** (anchor polygon). Text + unknown types skipped. Bezier curvature not yet honoured.
  - **Material**: one shared PBR `MeshStandardMaterial` leather; live colour / roughness /
    thickness / wireframe edits re-apply across panels.
  - **UI** built to the shared **`ui-language`** tokens: dark-first + `body.light` override, one
    red accent; menubar (File / View), Figma-style props panel (Material / Stitching / Lighting /
    Scene), status bar with success **flash**.
  - **Input**: File ▸ Open, drag-and-drop `.lpd` onto the canvas, Ctrl/Cmd+O, **R** reset camera,
    plus a built-in **sample panel** so the scene is never empty.
- **Docs**: `CONTEXT.md` (architecture + the assembly-data "crux"), this `DEVLOG.md`,
  `SHORTCUTS.md`, plus root `CLAUDE.md` + `README.md`. Copied the shared **`ui-language`** skill
  into `.claude/skills/`.
- **Status line**: `.working-on.txt` = "Leather Studio 3D"; version auto-appends from
  `APP_VERSION` via the shared global status line.

**Scope note:** this is the framework only — Phases 2–4 (fold into assembled product, build
instructions, template validation) are gated on a **seam/assembly data model** that `.lpd` does
not have yet. See CONTEXT.md "The crux".

**Next:** real bezier paths in `shapeFor`; ship a sample `.lpd` in `samples/`; design the
seam/assembly metadata model (the gate for everything past viewing).
