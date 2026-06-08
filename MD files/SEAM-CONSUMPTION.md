# Seam / Assembly Consumption — Leather Studio 3D (design, #10)

_Status: **design / not yet implemented**, 2026-06-08. Companion to the data contract in the Pattern
Designer repo: **`Leather Stuff/MD files/SEAM-MODEL.md`** (`.lpd` schema v15). This doc covers the
**3D side**: how Leather Studio 3D reads the `assembly` model to (a) fold/preview the assembled
product and (b) flag problems — the "preview of what could go wrong" goal._

The 3D app **never writes** `.lpd`; `assembly` is read-only input. Today's viewer lays every piece
flat in the XZ plane (`patternGroup`, 1 unit = 1 mm). This design adds a seam-aware layer on top of
that, phased so each step ships value without waiting on the hard solver.

---

## 1. Reading the model

`loadPattern(data)` already stores `S.lastData` and builds `S.panelMeshes`. Extend it:

1. Read `data.assembly` (default `{version:1, seams:[], folds:[]}` when absent → app behaves exactly
   as the current flat viewer; **graceful with every pre-v15 file**).
2. **Resolve each seam member to a directed edge polyline.** Reuse the **already-ported kernel** —
   the same `samplePath`/edge sampling that places stitch holes — so a seam's geometry matches its
   stitches by construction. For member `{shape, edge}`: get the shape, sample edge `edge` into an
   ordered point list in the shape's local mm space, then map through the piece's current world
   transform. (Rect edge `e` and path edge `e` mean exactly what they mean in the editor — shared
   kernel.) Apply `reversed` if present (flip the polyline direction).
3. **Validate (read-only mirror of `validateSeams`).** Drop members whose shape/edge no longer
   resolve; collect — don't silently hide — the result into a **problems list** (§4). The editor is
   the writer/fixer; here we only report.
4. Build the **assembly graph**: nodes = pieces, arcs = seams (an N-way seam is a hyper-arc touching
   all its members' pieces); folds are intra-node creases.

---

## 2. Folding — phased, simplest-first

2D→3D is ill-posed in general (it's the inverse of pattern-flattening; leather is stiff → closer to
hinged rigid panels than cloth). So phase it:

### Phase 2a — seam-aware FLAT view (no folding) — ship first
Keep pieces flat, but make the relationships visible:
- Draw each seam as a **3D connector** between its paired edges (a coloured ribbon/line linking
  corresponding points of the member polylines), in the seam's colour.
- Show **fold lines** as dashed creases on their pieces.
- Render the **problem flags** from §4 directly (length-mismatch ribbons go red, orphans pulse).

This alone delivers most of the "will it assemble / what's wrong" value, is **low-risk** (no solver),
and validates that the model loads and the edge correspondence is right before any geometry moves.

### Phase 2b — rigid hinge tree (forward kinematics) — the workhorse
Most leather goods are **mostly-rigid panels hinged at seams/creases** — no cloth simulation needed.
For a graph that is a **tree** (no closed loops): pick a **root** piece (largest, or the one with most
seams), fix it, and for each child piece rotate it about the **shared hinge axis** (the seam's edge
line) by a **dihedral angle**. Recurse. This is plain forward kinematics over a tree of rigid bodies:

- **Hinge axis** = the seam's edge line. For N-way seams, pick one member as the reference axis;
  other members align to it (their pieces each hinge about that axis).
- **Angle** comes from `fold.angle` for creases and a per-seam dihedral for joins (authored later;
  default 0 = flat, so 2b with all-zero angles == 2a's layout). Animating the angle 0→target gives a
  satisfying **"assembling" animation** that doubles as the basis for the instructions (§5).
- **Thickness:** extrude each panel by its `sh.thickness` (per-piece; falls back to the global
  thickness slider). Optionally offset the hinge axis by half-thickness so folded panels meet on the
  outside face, not the mid-plane (nicer corners; optional polish).

Covers wallets, card holders, simple cases pockets/flaps — a large, useful subset.

### Phase 2c — constrained solve for loops / closures — gate on need
When the graph has **cycles** (a box where four walls must meet, or an N-way seam that must close a
loop), a hinge tree is over-/under-constrained and won't close cleanly. Options, in order of
preference: (i) restrict to a **parametric template catalogue** of known goods (box, tote, round
coin pouch) where the closed-form 3D is known and the seams just *label* it; (ii) a light
**relaxation solver** that nudges piece transforms to minimise total seam-edge mismatch
(least-squares over hinge angles). High risk / research-adjacent — **defer**; 2a+2b cover the
near-term, and 2c is exactly where the "preview the problem" framing earns its keep (show the gap
rather than pretend it closes).

---

## 3. Edge correspondence + alignment math

For a seam joining edges A and B (generalises to N): sample both to directed polylines (§1).
Determine correspondence by **endpoint matching** — pair A.start↔B.start / A.end↔B.end unless that
makes the seam cross itself, in which case flip (this is what an absent `reversed` infers; an explicit
`reversed` forces it). For hinging (2b), only the **shared axis** matters — the seam's reference edge
line; pieces rotate about it. For the **gap check** (§4), after positioning, measure the residual
distance between corresponding points of the mated edges.

---

## 4. Problem detection — the "preview what could go wrong" goal (goal #4)

Two tiers, both surfaced in a **Problems panel** (an issues inspector: list of warnings, click → focus
camera on the offender, hover → highlight in the scene). All derived from geometry; nothing is written
back.

**Tier 1 — flat/geometric (available in Phase 2a, no fold needed):**
- **Length mismatch** — mated seam edges differ in arc length beyond tolerance → "can't sew cleanly";
  show both lengths + delta; colour the connector red.
- **Orphan member** — a seam member whose endpoints meet no sibling's → likely mis-tagged in the
  editor.
- **Dangling reference** — member resolves to a missing shape/edge (post-edit drift).

**Tier 2 — assembled (needs Phase 2b):**
- **Residual seam gap/overlap** — after folding, corresponding mated points don't coincide → the flats
  don't actually close; visualise the gap distance (the real "will it assemble?" answer).
- **Panel collision / self-intersection** — folded panels pass through each other (lower priority;
  coarse AABB/SDF check).

Tier 1 ships with 2a and already makes the app useful as a checker. Tier 2 rides on 2b.

---

## 5. Rendering / UX

- **View toggle: Flat ↔ Assembled** (slider or button) — interpolates dihedral angles 0→target;
  doubles as the assembly animation. Reuses `rebuild()`-style refresh; seam/fold overlays are their
  own toggle (alongside the existing Stitching toggle).
- **Seam colours** mirror the editor's stable per-seam colour so the same spine reads identically in
  both apps.
- **Problems panel** in the existing props column (LPD-style `.p-sec`), a11y `role=button` rows.
- Honour the existing material/lighting/thickness controls; per-piece `thickness` overrides the global
  slider when present.

---

## 6. Instructions generator (tie-in, later phase — goal #3)

Falls out of this model: order the seams by `seam.order` (then graph traversal order from the root),
and each step = "join «these edges» (fold to «angle»)", illustrated by the per-step pose of the fold
animation (§2b/§5). Not built here — but 2b's ordered hinge tree IS the instruction sequence, so
designing the fold this way makes the manual nearly free later.

---

## 7. State, reuse, and kernel sync

- New state on `S`: `S.assembly` (the loaded model), `S.assemblyMode` (`flat | assembled`),
  `S.seamMeshes` (connectors/overlays, disposed in `clearScene` like `stitchMeshes`),
  `S.problems` (derived list). Build in/after `loadPattern`; refresh in `rebuild`.
- **Reuse** the ported stitch-edge kernel for edge sampling (do NOT write a second sampler — seam and
  stitch geometry must agree). Reuse `patternGroup`, the dispose pattern, the props-panel idiom, and
  `kbActivate`/focus-ring a11y.
- **Keep in lockstep with the editor:** the edge-index contract and the `assembly` shape are defined
  in `Leather Stuff/MD files/SEAM-MODEL.md`. If either app changes edge indexing or the schema, update
  that doc and both loaders. Mirror the contract note in this repo's `CONTEXT.md`.
- Smoke: extend the standalone harness with an `assembly` feature — loads a doc with a multi-member
  seam, asserts members resolve to polylines, the graph builds, a deliberately length-mismatched seam
  raises a Tier-1 problem, and an absent `assembly` is a no-op (flat viewer unchanged).

---

## 8. Phasing summary

| Phase | Delivers | Risk | Gate |
|-------|----------|------|------|
| **2a** | Seam-aware flat view + Tier-1 problem flags | Low | just this design |
| **2b** | Rigid hinge-tree fold (tree goods) + assemble animation + Tier-2 gap check | Medium | 2a + authored dihedral/fold angles |
| **2c** | Closed-loop / parametric-template assembly | High (research) | real need; start template-only |
| **3** | Build-instructions generator | Medium | 2b ordering |

Recommended: build **2a** first (immediately useful checker, proves the data path), then **2b** for the
common tree-structured goods. Treat **2c** as template-first and gate on demand.

---

---

## 9. Partial / unequal-length seams (U6, assembly-schema v2, 2026-06-08)

The v1 consumer assumed mated members were the **whole edge** and **equal length** (`align2D` mated
endpoints start↔start/end↔end; any length delta raised a Tier-1 *length* problem). v2 adds intentional
**partial** joins — a T-pocket joining only part of a side, a short front pocket sewn to a long back.

What the consumer now does (all in `buildAssembly` / `computePieceTransforms` / `computeSeamGaps`):

- **Member sub-span.** A member may carry `t0`,`t1` ∈ [0,1] (fractions of arc length). `clipPolyByT`
  clips the sampled edge polyline to that slice before length/align/hinge use it. Absent = whole edge.
- **`fit:"partial"` relaxes Tier-1.** When a seam is `fit:"partial"`, the **length-mismatch** check is
  skipped (the inequality is intended). Dangling/incomplete checks still apply.
- **Anchored alignment.** `align2D(ref, mov, refXf, anchor)` takes the seam's `anchor` (`"start"` |
  `"end"`). It always matches direction via the chords, but coincides the chosen endpoint — so a short
  span sits flush at that end of the longer one instead of being stretched across it. Full equal edges
  overlap exactly regardless of anchor (back-compatible).
- **Tier-2 gap skipped for partial.** `computeSeamGaps` skips `fit:"partial"` seams (like it already
  skips length-mismatched ones): a point-for-point resampled compare of unequal spans would overstate
  the gap. The hinge axis for assembled mode uses the clipped span endpoints, so folds about the joined
  portion only.

Smoke: the `partialseams` feature covers `clipPolyByT`, the suppressed length flag (vs a full-join
control that still flags), and `align2D` start/end anchoring.

No app-version gate — the consumer reads the optional fields and falls back to v1 behaviour when absent.

---

## 10. Shared stitch across stacked pieces (U7, assembly-schema v3, 2026-06-09)

A stitch seam may carry `stitch:{shared:true, spacing?}` — one hole layout shared by all members so a
single running stitch sews the whole stack. Consumption:

- `buildAssembly` carries `seam.stitch` onto the resolved seam object. **It now runs BEFORE the
  per-piece build/stitch loop** in `loadPattern` (it used to run after, which left shared-stitch holes
  empty because `collectStitches` saw no assembly yet).
- `seamStitchSegments3D(sh)` — for each shared-stitch seam this shape belongs to, `N =
  max(1, round(polyLength(ref.poly)/spacing))` from the first resolved member; each member's (already
  `clipPolyByT`-clipped, `reversed`-applied) polyline is `resampleByArcLength(poly, N)` → the **same
  N+1 points** every member gets. That's the exact pairing the seam **connectors** already use, so the
  holes coincide once `align2D` pins the member edges together in stacked/assembled mode. Each hole gets
  a tangent angle `a` + the piece's top-face `yTop`; consecutive holes in a run become threads.
- `edgeStitched(sh,e)` returns false for seam-owned edges (via `sharedSeamForEdge3D`), so the
  independent per-edge stitch is overridden, not doubled. `collectStitches` no longer bails on
  `!hasStitch` — a piece with only seam-driven holes still stitches.

Smoke: the `sharedstitch` feature asserts the carried flag, the edge override, equal hole counts across
members (coincide), `round(len/spacing)+1`, and per-run threads. Verified visually (`tests/_shot.ps1`):
one continuous saddle stitch along the seam through the stacked pieces ("42 stitch holes · 1 seam").

No app-version gate — absent `stitch` = independent per-edge stitching (v1/v2 behaviour).

---

_Consumes `Leather Stuff/MD files/SEAM-MODEL.md` schema v15 (assembly-schema v3), read-only. Keep both in sync._
