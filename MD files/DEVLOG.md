# Leather Studio 3D — Development Log

One entry per session, newest first. Bump `APP_VERSION` in `index.html` and the version line in
`CONTEXT.md` + `SHORTCUTS.md` with each entry.

---

## v0.0.14 — app icon "L3D" + status-bar hierarchy (2026-06-11)

### A. App icon now reads "L3D" (was the LPD icon)
The desktop icon had been reusing the Pattern Designer's "LPD" mark. Recreated the same
leather-brown / lighter-inner-panel / dashed-french-stitch-border / cream-wordmark style as
`desktop/icon-source.html`, rasterized to `desktop/icon-source.png` (1024px, headless Edge
`--screenshot`), and regenerated the full set via `cargo tauri icon ../icon-source.png`
(icon.ico/.icns/.png, 32-512 PNGs, Square*Logo, iOS, Android). Only visible after this rebuild.

### B. Status-bar hierarchy (parity with LPD UI/UX audit #7)
The live message (`#sb-msg`) now reads as the stateful item (`--text-2`, 600 weight); the passive
right-side info (`.sb-r`) recedes to `--text-faint`. CSS only; no logic change.

---

## v0.0.13 — layer-order stack + soft seams + thread crosses the slit + end-hole parity (2026-06-10)

### A. Shared-seam end holes — parity with LPD v0.8.9 (one hole per corner)
Mirror of the editor's fix for the doubled extreme-end holes. `seamStitchSegments3D` now trims each
member's inset polyline by the stitch **margin at both ends** (`clipPolyByT`), with the hole count
derived from the trimmed reference run — so the seam's end holes sit on the inset corner like
independent stitching, and the same mm trim on every member keeps the holes coincident through the
stack. `collectStitches` drops any independent hole within 0.75mm of a seam hole (the perpendicular
edge's corner twin). `buildAssembly` also carries **`stitch.margin`** through to the resolved seam —
it was silently dropped, so a custom seam margin fell back to the default in 3D.

### B. Stack follows the LAYER order; non-adjacent seams are soft (user 2026-06-10)
*"Render stack should follow the layer and render above each other, edge seams for layers that are
not adjacent will just be an alignment not a hard rule."*
- **Global layer stack.** `computePieceTransforms` no longer steps dy per-seam from the parent;
  after placing a component it lifts every piece by the **summed thickness of all lower-layer
  pieces in that component** — the render stack now always matches the editor's layer panel,
  even when the seam graph reaches a piece "out of order".
- **Soft seams.** Two pieces are *stack-adjacent* when no other seam-touched piece sits between
  them in the layer sequence. A seam with **no stack-adjacent member pair** is SOFT (`S.softSeams`):
  a two-phase BFS places pieces via hard seams first (a soft seam only places a piece nothing else
  reaches), and soft seams are **never gap-flagged** — they're alignment hints, not joins. A
  3-cycle's closing seam (back↔front with the pocket between) is exactly this case; a 2-piece
  over-constrained cycle stays hard and still raises the Tier-2 gap problem.

### C. Thread crosses the slit (user 2026-06-10, visually verified)
*"The stitching should not be parallel to the stitch hole."* `addThreadMesh` laid the surface
thread at `th = −iron` — deliberately parallel to the french slit (slit = edgeAngle − 30°), so the
thread hid inside the slit line. Flipped to **`th = +iron`**: thread and slit now cross at ~2·iron
(60° french), the classic opposing saddle-stitch slant; both faces still share the slant (the
v0.0.10 un-mirror kept). Verified with before/after + close-up screenshots via `tests/_shot.ps1`
(new `closecorner` camera), sent to the user.

Smoke: +10 (layerstack/soft/cycle2/thread-cross; chain + cycle fixtures updated to the new
semantics — root keeps in-plane identity at its layer height, 3-cycle closing seam soft). Full
**148/148**, build smoke 36/36.

---

## v0.0.12 — update prompt on welcome screen + pivot dropdown shows real piece names (2026-06-10)

### A. Update prompt now shows on the welcome screen
Bug (user-reported): on launch the auto-updater's "Version X is available" prompt did **not** appear on
the Home/welcome screen — it only surfaced after a file was loaded. Cause was pure z-ordering: the
silent launch check (`checkForUpdates(false)`, fired ~1.5s after `showHome()`) opened the themed
`#modal-bg` at `z-index:100`, but the `#home` overlay sits at `z-index:5000`, so the prompt rendered
*behind* the welcome screen and only became visible once `hideHome()` ran (which a file load triggers).
Fix: raise `#modal-bg` to `z-index:11000`, matching the Pattern Designer's convention (`#confirm-bg`
is 11000, above its 5000 home) so confirm/alert/update dialogs always sit above the welcome screen.
One-line CSS change; no logic touched.

### B. Cleanup (audit pass, pre-release addendum)
Removed the unused `isDesktop()` helper (leftover from LPD scaffolding — `desktopLaunch()`
checks `window.__TAURI__` directly). Fixed the CONTEXT.md header: it said "assembly-schema v3"
but the code consumes **v4** (mm partial joins), matching LPD v0.8.8. Quick smoke 11/11 +
build smoke 36/36.

### C. Camera-pivot dropdown shows the LPD piece name
Bug (user-reported): the orbit-pivot `<select>` listed pieces as "Piece 1/2/…" instead of the names
given in the editor. Cause: `pieceLabel()` read `shape.name`, but LPD stores the user-given layer name
in `shape.**label**` (see the editor's `layerName()`), so it always fell through to the generic label.
Fix: `pieceLabel()` now mirrors `layerName()` — `label` → text box's first line → type word
(Rectangle/Circle/Path) → "Piece N". The `camera` smoke fixture was itself wrong (it set `name:` on the
shapes, encoding the same bug); corrected to `label:` so the assert is now meaningful. Full **136/136**.

---

## v0.0.11 — splay fix + mm partial seams + piece distinction (2026-06-09)

Three things this session (paired with LPD v0.8.8): the wrong-side stack fix, consuming the editor's
new **mm** partial-seam model, and making stacked pieces tell apart.

### A. mm partial-seam consumption (assembly-schema v4)

The editor replaced arbitrary `t0`/`t1` fraction sub-spans with **mm**: a partial seam's run length
**auto-derives = the shortest ("mating") member edge**, and each member positions that run via
`offset` mm from a reference end (`from`). New `memberSpan3D` / `seamRunLenMM3D` / `edgeLenMM3D` in
`buildAssembly` resolve a member to its `{t0,t1}` clip from the mm fields, with a **legacy fallback**
(a member carrying `t0`/`t1` and no `offset` uses the old fractions, so pre-v4 files still load).
Note the new semantics: in a partial seam a member with **no** offset now joins its first *run* mm
(the mating length), not its whole edge — the intended "true-length" behaviour. `partialseams` smoke
gains 4 mm asserts (auto run = 50mm mating edge; offset 25 slides the run to [25,75]).

### B. Piece distinction (user: hard to tell pieces apart)

Each panel gets a **deterministic per-piece tint** (subtle HSL lightness zig-zag + hue drift off the
base leather, keyed by piece index; stored on the mesh so a base-colour re-material re-applies it,
not resets to flat) **+ a dark silhouette outline** (`EdgesGeometry(geo, 28°)` → `LineSegments` in the
piece group, tracked in `S.outlineMeshes`, disposed on clear). `load` smoke gains 3 distinction
asserts. App smoke **129 → 136**.

### C. Captured the 2D→3D rules as a skill

New `.claude/skills/2d-to-3d-rendering/SKILL.md` — frame convention (extrude, don't reflect), the
nesting/winding invariant + same-side centroid test, mm partial spans, the pen-path `cp*`-handle NaN
gotcha, and the tint/outline trick. Stack-independent geometry, both apps.

---

### (original entry) fix wrong-side / splayed stack (geometry-inferred nesting)

The `SampleCardHolder` assembled with pieces **splayed out** and seam connectors crossing (the
T‑pocket flung to the wrong side) instead of nesting — see `Weird3DRender.png` vs `IntendedStack.png`
in the LPD repo root. **Root cause (diagnosed by hand-tracing all three seams):** `align2D` snaps a
child's seam edge onto its parent's by rotating the child's edge **direction** to match — so when two
mated edges are wound **antiparallel** (a pen path mated to a rect, e.g. T‑pocket edge 6 runs `−Y`
against the back panel's right edge `+Y`), it inserts a spurious **180° rotation** that flips the
child's *body* to the wrong side of the seam line. Seam 1 (both rect "bottom" edges, same direction)
worked by luck → `θ=0`; seams 2/3 (pen-path edges) → `θ=π` → splay. The old `stacking` smoke only
checked endpoint *coincidence*, which is true even when the body is flipped — so it never caught it.

**This is NOT the "flipped render / showing the back face" theory from v0.0.10's carry-forward.** That
was two separate bugs conflated: the splay is purely a 2D winding/`align2D` issue (this fix); the
`world Z = −shape Y` reflection (det −1, which mirrors the stitch slant) is a *separate* axis, deferred
to the next step (no‑Y‑flip "straight extrusion" refactor — see Backlog).

- **Fix lives in the 3D consumer** (per user: the 3D trusts the 2D data and is smart enough to render
  it — no editor change, no re-saving `.lpd`). New `placeMemberOnParent(pm, mov, refXf, anchor)`:
  there are exactly **two** rigid edge-matches (chord start→start vs start→end) and they put the moving
  body on **opposite** sides of the seam line. We compute both and pick the one whose **piece centroid**
  lands on the **same side** as the parent's centroid (it *nests*). `align2D` itself is unchanged;
  `computePieceTransforms` calls the chooser instead. Geometry-only side test (`pieceCentroid` cached
  per shape id, cleared on load; `sideOfLine` cross-product) — robust to any authored winding.
- The existing two-identical-rects `stacking` case keeps `θ=π` **correctly** (mirror-symmetric rects —
  the 180° *is* the right stack), proving the side test discriminates flip-needed from flip-splays.
- **Smoke 127 → 129**: new `splay-guard` asserts an antiparallel **pen-path** mate nests without a
  180° flip (`θ≈0`) and the child body lands inside the parent footprint. (Test fixture's path points
  carry `cp*` handles = anchor, or `cubicPt` reads `undefined` → NaN — a real .lpd authoring detail.)

**Carry-forward (next step):** the no‑Y‑flip frame refactor (straight extrusion of the flat template +
camera re-aim) — fixes the stitch-slant mirror (v0.0.10 Task 2). Then capture the whole thing as a
reusable **2D→3D rendering** skill (frame convention + nesting/winding invariant + pen-path gotcha).

---

## v0.0.10 — stitch fixes: un-mirror faces + margin inset + distinct stitches (2026-06-09)

User feedback after U7: the saddle stitch still looked wrong. Three fixes (paired with LPD v0.8.7):

- **Threads no longer mirrored per face.** `addThreadMesh` used `th = -iron*face` (top `/`, bottom
  `\`); seeing both faces near an edge read as crossing stitches. Now `th = -iron` on **both** faces —
  same slant — so they don't cross.
- **Shared-stitch holes inset by the margin.** `seamStitchSegments3D` was sampling the edge polyline
  directly (holes ON the line). New `insetEdgePoly`/`shapeCentroid` offset each member's edge **inward
  by the stitch margin** before resampling, so the seam stitch sits in from the edge.
- **Distinct stitches.** `segLen` shortened to `0.62 × gap` so each thread reads as a separate slanted
  dash with a gap at every hole (was tiling into a continuous band).

`stitch3d`/`sharedstitch` smoke gain asserts: "both faces share the slant (not mirrored)" + "shared
holes inset from the edge by the margin". App smoke **125 → 127**. **Carry-forward (next session):**
the 3D render may be showing the **back face** (flipped) and the slant may need flipping — see
`CONTEXT.md` Backlog #8. Geometry-only.

---

## v0.0.9 — U7: shared stitch across stacked pieces (2026-06-09)

Cross-app with the Pattern Designer's v0.8.6 (assembly-schema **v3**). A stitch seam may carry
`stitch:{shared:true, spacing?}` — one hole layout shared by every member so a single running stitch
sews the whole stack (no more independently-stitched edges whose holes don't line up).

- **`buildAssembly` carries `seam.stitch`** onto the resolved seam, and **now runs BEFORE the per-piece
  build/stitch loop** in `loadPattern` (it used to run after — which left shared-stitch holes empty
  because `collectStitches` saw no assembly yet). This was the one ordering bug; found via headless render.
- **`seamStitchSegments3D(sh)`** — `N = round(polyLength(ref.poly)/spacing)` from the first resolved
  member; each member's (clipped/reversed) polyline is `resampleByArcLength(poly, N)` → the same N+1
  points every member gets (the exact pairing the seam connectors already use), so holes coincide once
  `align2D` pins the edges together. Holes carry a tangent angle + the piece top-face y; consecutive
  holes in a run become threads.
- **`edgeStitched` skips seam-owned edges** (`sharedSeamForEdge3D`); `collectStitches` no longer bails
  on `!hasStitch`, so a piece with only seam-driven holes still stitches.

Verified visually (`tests/_shot.ps1`, `tests/_u7_demo.lpd`): one continuous saddle stitch along the
seam through the stacked pieces ("42 stitch holes · 1 seam"). New `sharedstitch` smoke feature (8);
app smoke **117 → 125**; build smoke 36/36. Contract: `MD files/SEAM-CONSUMPTION.md` §10.

---

## v0.0.8 — stitch slant now follows the seam line (card-holder feedback) (2026-06-09)

User flagged that the saddle-stitch threads didn't follow the drawn (red) seam line — they read as a
steep X-crisscross over it. Cause: `addThreadMesh` offset each stitch's two endpoints to **opposite**
perpendicular sides of the seam by a **fixed 0.32 mm** (`STITCH_SLANT`). So every stitch crossed the
centreline diagonally, and because the perpendicular offset was a fixed distance (not an angle), the
slant went **near-perpendicular at tight spacing**. Both faces showing then made it an X.

Fix — each stitch is now **centred on the seam** and tilted by a **constant iron angle** (`stitchSlant`:
french 30° / diamond 45° / round 20°, matching the editor's slit), reaching toward both holes via
`segLen = (gap − 2·inset)/cos(angle)`. A run now reads as a clean parallel slant **along** the line;
the top face leans one way (edgeAngle − iron, matching the 2D french slit) and the bottom mirrors it.
`STITCH_SLANT` removed; `STITCH_INSET`/`THREAD_RISE` unchanged.

Verified by headless render (`tests/_shot.ps1`) before/after — the crisscross became a consistent
saddle-stitch slant around the whole perimeter. `stitch3d` smoke gains: `stitchSlant` angle checks,
consecutive top-face stitches are **parallel** (follow the line), and each stitch is slanted off the
seam (not axis-aligned). App smoke **113 → 117**; build smoke 36/36.

---

## v0.0.7 — card-holder feedback U6: partial / unequal-length seams (2026-06-08)

Cross-app with the Pattern Designer's v0.8.4 (assembly-schema **v2**). The viewer can now consume
**partial joins** — a member that uses only a sub-span of its edge, and seams whose mated edges are
intentionally unequal (a T-pocket on part of a side; a short front pocket on a tall back). Built
**indigo-wren-V7**. App smoke **113 → … (partialseams feature)**; build smoke 36/36.

- **Member sub-span.** A member may carry `t0`/`t1` ∈ [0,1] (fractions of arc length). `clipPolyByT`
  clips the sampled edge polyline to that slice before any length/align/hinge use. Absent = whole edge.
- **`fit:"partial"` relaxes the rules.** `buildAssembly` skips the Tier-1 **length-mismatch** flag for
  partial seams (the inequality is intended); `computeSeamGaps` skips them for Tier-2 too (a resampled
  point-for-point compare of unequal spans would overstate the gap).
- **Anchored alignment.** `align2D(ref, mov, refXf, anchor)` now takes the seam's `anchor`
  (`"start"`|`"end"`): direction is matched via the chords as before, but the chosen endpoint is the
  one that coincides — so a short span sits flush at that end instead of being stretched across.
- **Smoke:** new `partialseams` feature — `clipPolyByT`, the suppressed length flag (vs a full-join
  control that still flags), and `align2D` start/end anchoring. Contract: `SEAM-CONSUMPTION.md` §9.

---

## v0.0.6 — card-holder feedback U1–U5: UI sync, 1 mm default, camera, stitch realism (2026-06-08)

First slice of the card-holder testing feedback batch (U1–U7): the three **3D quick wins** (U1–U3)
plus **stitch realism** (U4 hole shape + U5 saddle-stitch thread). The cross-app partial-seam /
cross-stack work (U6/U7) remains queued. App smoke **88 → 105**; build smoke unchanged.

- **U1 — top-right UI sync.** Replaced the square sun/moon `#theme-btn` with the Pattern Designer's
  **sliding-pill `#theme-toggle`** (36×18 track + 14 px red knob, "Dark/Light Mode" label) and moved
  the **product name + version** (`#app-title`) to the **top-right** next to it (LPD layout:
  `margin-left:auto`, faint text). The old left brand block + `SUN_SVG`/`MOON_SVG` consts are gone;
  `applyTheme` now drives the pill label + `aria-pressed`. Pill colours use the shared design tokens.
- **U2 — default leather thickness 1 mm.** `S.thickness` default `2.0 → 1.0`; the `#matThick`
  slider/number HTML defaults follow. Saved prefs still win (existing users keep their value).
- **U3 — camera focus + pivot.** New **Camera** property section with a **Pivot** dropdown
  (Whole model / each piece by name) + a **Frame view** button, and an **`F`** shortcut.
  - `frameBox(box)` fits the camera to a `Box3` — aims `controls.target` at its centre and pulls the
    camera back along the current view direction until the box fills the FOV (1.25× margin).
  - `pivotBox()` returns the box for the current pivot (`S.pivot` = `'model'` or a `pieceGroups` key);
    `frameTarget()` (F / button) fits it, `aimPivot()` re-aims the orbit target without moving the
    camera. `pieceKeyFromStr` resolves the `<select>` string back to the real (possibly numeric) key.
  - **Orbit now pivots about the model/piece centre**, not the ground origin — the core complaint.
    Fresh loads auto-`frameTarget()`; switching **Flat/Stacked/Assembled** now `recentrePattern()` +
    `aimPivot()` so orbit stays sane after a re-pose. `R` still snaps to the fixed home view.
  - `camera` smoke feature (11 asserts); a11y feature updated for the new pill toggle.
- **U4 — stitch-hole shape.** 3D holes now follow the editor's **global `settings.stitchStyle`**
  (`round` / `diamond` / `french`, default french), read into `LP.stitchStyle` on load. `holeGeometry`
  picks the cross-section — round cylinder, 4-gon prism (diamond, half-diag 0.6 mm), or a **1.2×0.35 mm
  box slit** (french) — and each instance is turned about world-Y to its local stitch angle `a` plus the
  style offset (french `a−30°`, diamond `a+45°`), mirroring the editor's SVG `rotate`. Shape XY→world XZ
  (Y→−Z) makes a shape-plane orientation θ a world-Y rotation of exactly θ.
- **U5 — proper saddle-stitch render.** Replaced the single floating tube-per-gap with a **two-needle
  saddle stitch**: every gap gets a stitch on **both faces**, endpoints **inset** from the hole centres
  (`STITCH_INSET`) so the dark holes read as distinct dots, and shifted perpendicular to the seam in
  **opposite directions per face** (`STITCH_SLANT`) — the mirrored lean that makes hand stitching look
  right. Thread sits just off each surface (`THREAD_RISE`). Thinner thread (`THREAD_R` 0.42→0.38).
  - `stitch3d` smoke feature (6 asserts: per-style geometry, instanced count, french hole Y-orientation,
    2 thread instances/gap).

---

## v0.0.5 — 3D auto-stacking: seam consume → stack → fold (S0–S3) (2026-06-08)

Built **slate-vireo-V5**. The 3D app's first big feature release since v0.0.4: it now reads the
Pattern Designer's **v15 `assembly`** model and previews the **assembled product**, not just flat
panels — pieces snap together at their seams, stack by layer/thickness, and fold up into 3D, with
read-only problem detection. Released through CI (installed apps auto-update). App smoke **36 → 88**;
build smoke **36/36**. The four build steps (S0–S3) are detailed below.

### S3: hinge/fold dihedral — assembled preview (Phase 2b)

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

### S2: whole seam-graph positioning from a root

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

### S1: pairwise edge-snap + thickness/layer stacking

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

### S0: consume the v15 assembly model (Phase 2a foundation)

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
