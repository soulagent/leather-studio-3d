# Leather Studio 3D — Development Log

One entry per session, newest first. Bump `APP_VERSION` in `index.html` and the version line in
`CONTEXT.md` + `SHORTCUTS.md` with each entry.

---

## (unreleased) — S3: hinge/fold dihedral — assembled preview (Phase 2b) (2026-06-08)

Fourth step of the 3D auto-stacking stream. **Code + smoke only — still v0.0.4; ships at S4.**
The actual **assembled-product preview**: pieces fold up about their seams into 3D.

- **Matrix-based posing** — each piece group is now `matrixAutoUpdate=false` and driven by an explicit
  `THREE.Matrix4`. `poseMatrix(id)` builds the S1/S2 stacked pose as a matrix.
- **Forward kinematics over the seam tree** — `computeAssembledMatrices(t)` walks the spanning tree
  recorded by `computePieceTransforms` (`S.pieceTree`: child → {parent, hinge axis, hingeY}). Each
  child folds about its **parent's shared seam edge** (the hinge line, at the parent's top face) by
  `foldAngle·t`, carrying its whole subtree: `Wchild = Wparent · Hinge(axis, angle) · rel`, where
  `rel = pose(parent)⁻¹·pose(child)`. **t=0 reproduces the stacked layout exactly**, so the three
  modes share one path.
- **Flat / Stacked / Assembled** — the Layout control gains an **Assembled** option;
  `S.assemblyMode` now three-valued. In Assembled, an **Assemble slider** (`S.assembleT` 0–100%)
  animates flat→folded, and a **Fold angle** slider (`S.foldAngle`, default 90°) sets the target
  dihedral applied to every seam hinge. `setAssembleT`/`setFoldAngle` update live without recentring.
- **Overlays follow the fold** — `buildSeamOverlays` now maps edge points through each piece group's
  current matrix, so connectors + fold creases bend with their pieces in every mode.
- **Deferred** — per-crease (intra-piece `fold.angle`) bending needs panel-splitting at the crease →
  later; closed-loop/cycle closure stays Phase-2c (template-first). Creases still render.
- **Smoke** — new `fold` feature (9 asserts: hinge tree recorded; FK t=0 == stacked pose; t=1 folds;
  the hinge edge is invariant through the fold (<1e-3 mm) while the far edge swings >50 mm out of
  plane; assemble slider + mode plumbing drive the live group matrices; root stays put). App suite
  **79 → 88**; build smoke **36/36**.

---

## (unreleased) — S2: whole seam-graph positioning from a root (2026-06-08)

Third step of the 3D auto-stacking stream. **Code + smoke only — still v0.0.4, no release.**
Generalises S1's single-pair stacking to a whole multi-piece assembly.

- **BFS over the seam graph** — `computePieceTransforms` now roots each connected component at its
  **most-connected** piece (tie → lowest layer), then breadth-first positions every reachable piece:
  each newly visited piece snaps its mated edge onto its already-placed parent (`align2D`) and stacks
  in Y by **global layer order**, touching, stepped by thickness. First/shortest path wins.
- **N-way spines** — a seam with 3+ members positions all of them against the visiting piece's edge
  and stacks them by layer (cumulative thickness), so 3-on-a-spine goods (card-holder spine) stack at
  distinct heights instead of colliding.
- **Tree-first, cycles flagged not forced** — the traversal is a spanning tree; a seam that would
  re-position an already-placed piece (a cycle / closure) is skipped for positioning. `computeSeamGaps`
  then measures each seam's residual **in-plane** gap between mated edges and raises a **Tier-2 'gap'
  problem** ("edges don't meet in the assembly … a closed loop that won't lie flat") — the
  "preview the problem" payoff. Gap seams also colour their connector red. Length-mismatched seams
  (Tier-1) are skipped to avoid double-warning.
- **Smoke** — new `graph` feature (9 asserts: chain roots at the middle piece + closes gap-free;
  N-way spine stacks at cumulative heights; a 3-seam cycle flags a residual gap with all pieces still
  placed). App suite **70 → 79**; build smoke **36/36**.

---

## (unreleased) — S1: pairwise edge-snap + thickness/layer stacking (2026-06-08)

Second step of the 3D auto-stacking stream. **Code + smoke only — still v0.0.4, no release.**
The user's core ask: pieces should stack from their seam attachments + layer order **without
pre-overlapping the 2D patterns**.

- **Per-piece groups** — `loadPattern` now builds each piece into its own `THREE.Group` (panel +
  that piece's stitch holes/threads), so a piece can be rigidly posed without rebuilding geometry.
  `S.pieceGroups` (id → {group, shape, thickness}); stitch meshes are per-piece (`S.threadMeshes`).
- **In-plane alignment** — `align2D(refPoly, movPoly, refXf)` returns the rigid 2D transform
  (`{theta, tx, ty}`) that maps one seam member's edge endpoints onto the other's; `applyXf2D`
  applies a pose to a point. Pure mm-plane math, mapped to a group `rotation.y` + `position`.
- **`computePieceTransforms()`** — S1 pairwise rule: for each 2-piece seam, the **lower-layer**
  piece (earlier in `shapes[]`) stays put and the **higher-layer** piece snaps its mated edge onto
  it, lifted in Y by the lower piece's thickness so it **stacks on top** (lining under leather).
  `S.pieceXf` (id → pose). Multi-seam graphs get proper whole-graph handling in S2; here later seams
  override.
- **Flat ↔ Stacked toggle** — `setAssemblyMode('flat'|'stacked')` re-poses every piece group
  (`applyPieceTransforms`), rebuilds the seam/fold overlays at the new positions (connectors collapse
  onto the join when stacked), recentres, and persists. A segmented **Layout** control in the
  Assembly panel (shown only when there's ≥1 join). Flat = the original raw 2D layout, unchanged.
- **Transform-aware overlays** — `buildSeamOverlays` now maps each member edge through its piece's
  current pose, so connectors + fold creases follow the stack.
- **Smoke** — new `stacking` feature (9 asserts: two-piece snap, mated-edge coincidence, lift =
  reference thickness, reference unmoved, flat/stacked toggle round-trip, clearScene reset). App
  suite **61 → 70**; build smoke **36/36**.

---

## (unreleased) — S0: consume the v15 assembly model (Phase 2a foundation) (2026-06-08)

First step of the 3D auto-stacking stream (S0–S4). **Code + smoke only — version stays v0.0.4
until the stream ships at S4** (no release yet). Reads the Pattern Designer's `assembly` model
(`.lpd` schema v15) read-only; absent `assembly` (any pre-v15 file) → the flat viewer is unchanged.

- **Edge kernel** — `sampleEdge(sh, e)` samples one edge into a local-mm polyline using the *same*
  per-edge contract as the editor (rect = plain corners `e→e+1`; path edge `e` = cubic
  `points[e]→[e+1]`; circle/text = no edges), so seam geometry matches stitch geometry by
  construction. Plus `polyLength`, `resampleByArcLength`, `seamColor3D` (mirrors the editor's stable
  per-seam hue), `pieceThickness`.
- **`buildAssembly(data)`** — resolves each seam member `{shape,edge}` to a polyline (honours
  `reversed`), builds the seam **graph** (nodes = joined pieces, arcs = seams; N-way aware), and a
  read-only mirror of `validateSeams`: collects **Tier-1 problems** into `S.problems` —
  `length`-mismatch (>1.5 mm), `dangling` reference (deleted piece/edge), `incomplete` seam (<2
  resolved edges). Never hides bad refs; reports them.
- **`buildSeamOverlays()`** — Phase-2a **flat** view: a coloured **connector ribbon** between each
  seam's paired member edges (red when the seam has a Tier-1 problem) + dashed **violet fold creases**
  on their pieces. New state `S.assembly` / `S.seamMeshes` / `S.problems` / `S.showSeams`
  (`assemblyMode:'flat'`); meshes disposed in `clearScene`.
- **Per-piece thickness** — `sh.thickness` (mm) now drives each panel's extrude depth and its stitch
  hole/thread height (falls back to the global thickness slider).
- **UI** — a new **Assembly** props section (seam/fold/joined-piece summary + a Tier-1 **Problems**
  list, `role=button` rows, click → flash) + a **Seams & folds** toggle (View menu + Scene checkbox,
  persisted to prefs).
- **Smoke** — new `assembly` feature (25 asserts: edge sampling/length, per-piece thickness, seam
  resolution + graph, all three problem kinds, overlay meshes, panel rendering, absent-assembly
  no-op, clearScene reset). App suite **36 → 61**; build smoke **36/36**.

---

## v0.0.4 — theme toggle button + keyboard-accessible menubar (2026-06-08)

Finishes the two v0.0.3 carry-forwards (#24, #22).

- **Top-right theme toggle button** (#24): a `#theme-btn` pinned to the right of the menubar
  (`margin-left:auto`), showing a **sun** icon in dark mode (click → brighten) and a **moon** in
  light mode; inline SVG (`SUN_SVG`/`MOON_SVG`) swapped in `applyTheme`, `aria-pressed` + `title`
  kept in sync. Theme toggling refactored into one `toggleTheme()` (persist `ls3d-theme`) shared by
  the button and View ▸ Light mode.
- **Keyboard-accessible ARIA menubar** (#22): the menubar and its items were clickable `<div>`s with
  no roles/keyboard. Now `#menubar` is `role=menubar`; each top-level item is a focusable
  `role=menuitem` with `aria-haspopup` + synced `aria-expanded`; dropdowns are `role=menu` and each
  action is `role=menuitem`. Full keyboard nav: **Enter/Space/↓** opens a menu and focuses the first
  item, **↑/↓** move within it, **←/→** move between menus (open-to-open inside a dropdown), **Esc**
  closes. The top-level `keydown` is guarded (`e.target !== mi`) so keys bubbling up from dropdown
  items don't double-fire. Menu open/close centralised in `openMenu`/`closeAllMenus` (keeps
  `aria-expanded` honest). Resize handle is now `role=separator`. Added `.m-item`/`.m-act`
  `:focus-visible` rings. (Home buttons, recents, prop inputs, checkboxes, and the v0.0.3 section
  headers were already real controls.)
- New **`a11y`** smoke feature (10 asserts: theme button is a real `<button>` with aria-pressed +
  svg icon and toggles state; menubar/items/actions carry the right roles + focusability; resize
  handle is a separator). Full **36/36**, build smoke unchanged.
- **Open carry-forward:** none from the UI/UX track — next up is the Phase-2 **seam/assembly data
  model** (the gate for fold/instructions/validation; see CONTEXT.md "The crux").

---

## v0.0.3 — controls, properties panel, theme/prefs persistence, welcome screen (2026-06-07)

UI/UX pass syncing learnings from the Pattern Designer (LPD). **Released** (build russet-heron-V3)
via the CI workflow — installed v0.0.2 copies auto-update to this.

- **3ds Max camera scheme** (#16): middle-drag = pan, **Alt+middle-drag = orbit**, wheel =
  zoom-to-cursor (`zoomToCursor`). A capture-phase `pointerdown` flips `mouseButtons.MIDDLE` to
  ROTATE while Alt is held (OrbitControls has no modifier combos); middle-click autoscroll
  suppressed. Left-drag still orbits as a trackpad/2-button fallback.
- **Typable thickness** (#17): number input beside the slider, two-way synced + clamped 0.5–6mm.
- **Resizable properties panel** (#18): drag handle on the left edge, width clamped 170–460px and
  persisted (`ls3d-props-w`); renderer resizes live. Mirrors LPD's `.props-resize`.
- **Collapsible property sections** (#19): Material/Stitching/Lighting/Scene became LPD-style
  `.p-sec`/`.p-hd` sections — clickable headers (`role=button`, `aria-expanded`, Enter/Space via
  `kbActivate`, focus ring), collapse state persisted (`ls3d-sections`).
- **Theme persistence + system default** (#20): theme restored from `ls3d-theme`, else follows OS
  `prefers-color-scheme` on first run; chrome class applied pre-scene to limit flash; toggle persists.
- **Viewer prefs persistence** (#21): leather/stitch colour, roughness, thickness, key/ambient
  light, and grid/stitch/wireframe toggles persisted (`ls3d-prefs`) and restored into the controls
  + scene at startup (`savePrefs`/`prefsToUI`). App prefs only, not in any save file.
- **Welcome screen** (#23): LPD-style `#home` launch overlay framed by the **french-stitch border**
  (`frenchBorder`/`renderHomeStitch`, ported) — **Open .lpd** + **Load sample panel** actions, a
  **Recent files** list (FileSystemFileHandles in IndexedDB `ls3d-recents` where the FS Access API
  exists; degrades to none), plus "Skip to an empty scene". Reopen via **File ▸ Welcome Screen**;
  Esc/backdrop dismiss; any file load leaves it. Adapted for the viewer (no New File / no autosave
  restore). Open now routes through the FS-Access picker (so recents record), falling back to the
  file input. Shared `lsGet`/`lsSet` + `kbActivate` helpers now module-level.
- Smoke: full **26/26**, build **36/36** throughout.
- **Open carry-forward:** top-right dark-mode toggle button (#24, todo) and the a11y/keyboard-nav
  pass (#22, todo).

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

### Auto-update + updater signing (added in the v0.0.2 cycle)
Brought the desktop install/update experience to parity with the Pattern Designer:
- **Dedicated signing key** generated (`cargo tauri signer generate`) → `~/.tauri/leather-studio-3d.key`
  (+ `.pub` + `.password.txt`), **outside the repo, never committed**. Public key embedded in
  `tauri.conf.json plugins.updater.pubkey`; private key + password set as the repo secrets
  `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD`.
- **tauri.conf**: `createUpdaterArtifacts: true` + `plugins.updater` endpoint
  `…/leather-studio-3d/releases/latest/download/latest.json`. **Cargo**: `tauri-plugin-updater` +
  `tauri-plugin-process` + `serde_json`. **main.rs** registers both plugins; **capabilities** add
  `updater:default` + `process:default`.
- **index.html**: Help menu → `checkForUpdates()` (check → themed `confirmModal` → `downloadAndInstall`
  with % flash → `process.relaunch()`), plus minimal `confirmModal`/`alertModal` (promise-based,
  themed; ticks the dialogs backlog item) + `isDesktop()`. Update item hidden in browser; silent
  background check 1.5s after desktop launch.
- **`.github/workflows/release.yml`** (tauri-action): builds, **signs**, and publishes the NSIS
  installer + `.sig` + `latest.json` on a GitHub Release (`workflow_dispatch` or `v*` tag). Seeds
  **index.html AND vendor/** before the Tauri CLI validates `frontendDist`.
- Verified a **local signed build** produces the `.exe.sig`; build smoke +21 updater asserts
  (**36/36**). Published the first signed release via the workflow (tag `v0.0.2`).
- **Same caveat as the Pattern Designer:** this is updater *integrity*-signing (minisign), **not**
  a paid Authenticode certificate — so Windows SmartScreen still warns on first install. The
  in-app auto-update path is fully signed/verified.

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
