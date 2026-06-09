---
name: 2d-to-3d-rendering
description: >-
  How to lift a flat 2D CAD template (SVG-style, mm, Y-down) into a 3D preview by
  extrusion + rigid assembly, without introducing handedness/winding bugs. Covers
  the frame convention (SVG Y-down → world, and why never to bake a reflection),
  the nesting/winding invariant for snapping one piece's seam edge onto another
  (the two rigid edge-matches + the same-side centroid test), partial/mm seam
  spans (auto length = mating edge), the pen-path control-handle gotcha that
  produces NaN, and the per-piece tint/outline trick for telling stacked pieces
  apart. Use this whenever you extrude a 2D shape into 3D, stack/assemble pieces
  along seams, debug a piece that renders "flipped", "mirrored", "on the wrong
  side", or "splayed", or port edge/seam geometry between the Leather Pattern
  Designer (2D editor) and Leather Studio 3D (the preview). These are
  stack-independent geometry rules — they hold whether the renderer is three.js
  today or something else later. NOT for UI styling (that's leather-ui-language)
  or the stitch-hole spacing algorithm (that's stitch-edge-logic).
---

# 2D → 3D rendering (extrusion + rigid assembly)

This skill captures the geometry rules for turning a finished **2D leather pattern**
(`.lpd`: cut shapes in mm, SVG **Y-down** convention) into a **3D preview** —
extruding each piece and snapping pieces together along their authored **seams**.
It was distilled from real bugs in Leather Studio 3D (the splayed card-holder
stack, the "is it showing the back face?" confusion). Read this before touching
`outlinePolygon` / `align2D` / `placeMemberOnParent` / `buildAssembly` or any new
2D→3D path.

## The cast (Leather Studio 3D)

- `outlinePolygon(sh)` — 2D shape → sampled mm polygon (rect / circle / **true-bezier** pen path).
- panel build — `ExtrudeGeometry` + `geo.rotateX(-π/2)` lays the shape flat in world XZ.
- `sampleEdge(sh, e)` / `edgeLenMM3D` — one addressable edge → polyline / its mm length.
- `buildAssembly` — resolves each seam member `{shape, edge[, offset, from, t0/t1]}` to a directed
  polyline; builds the seam graph.
- `align2D` / `placeMemberOnParent` / `computePieceTransforms` — the rigid 2D snap that stacks pieces.

---

## Rule 1 — Frame convention: extrude, don't reflect

SVG is **Y-down** (`+x` right, `+y` down). World is **Y-up**. The pieces lie on the XZ
ground plane, extruded up by thickness.

The mapping in use is `world = (shape.x, thickness, −shape.y)` (i.e. `geo.rotateX(-π/2)`).
**That `−y` is a reflection — `det = −1`.** Consequences to know:

- A reflection silently **mirrors** anything orientation-bearing on the grain face: the
  saddle-stitch **slant**, surface normals, and any **asymmetric** tooling / text / logo. On a
  left-right **symmetric** piece (a plain card holder) the mirror is invisible — which is exactly
  how this hides. Don't conclude "the render is correct" from a symmetric test piece.
- It is **not** the cause of pieces landing on the wrong side in a stack — that's Rule 2, and it
  happens in 2D *before* any world mapping. Keep the two diagnoses separate.

**Preferred convention going forward:** map `world.z = +shape.y` (a pure extrusion, `det = +1`) and
orient the **camera** to match the editor's reading, rather than baking a reflection into geometry.
The stacking math is unaffected (it's all in the 2D mm plane); you only change the final lift + the
default camera. If you keep the `−y` reflection, **document it** and remember the slant sign is
mirrored (verify slant visually; don't guess the sign).

> Litmus test for "is it flipped?": render a piece with an **asymmetric** mark (an "F", or a notch in
> one corner). If the mark reads mirrored on the grain face from the default camera, you have a
> reflection in the pipeline.

---

## Rule 2 — The nesting / winding invariant (the wrong-side / splay bug)

To stack/assemble, you snap a child piece's **seam edge** onto its parent's. A pure rigid motion
that maps one edge segment onto another has **exactly two solutions**:

- **(a) same-direction** — child start → parent start, end → end.
- **(b) reversed** — child start → parent end, end → start (differs from (a) by a 180° turn).

**These two place the child's *body* on *opposite* sides of the seam line.** One nests (bodies
overlap — correct); the other splays the child out to the wrong side.

The trap: matching edge **directions** (what a naïve `align2D` does — rotate child's chord to match
parent's chord) is *not* the same as choosing the nesting side. When two mated edges are wound
**antiparallel** — which happens whenever a **pen path** mates to a **rect**, because their polygon
windings differ — direction-matching forces a spurious **180°** and the piece splays. (Two
identically-wound rects mated on the same edge index match same-direction and nest by luck; that's
why "it worked on the simple case".)

**The fix — pick the side by geometry, not by authored winding:**

```
compute candidate A = align2D(parentEdge, childEdge, parentXf, anchor)
compute candidate B = align2D(parentEdge, childEdge.reversed(), parentXf, swap(anchor))
parentSide = sideOf(seamLine, centroid(parentPiece) under parentXf)
choose the candidate whose centroid(childPiece) lands on parentSide   // it nests
```

`sideOf(A→B, P) = sign((B−A) × (P−A))` (2D cross). Centroid = average of the piece's
**outline** vertices (enough for a side test); cache per shape id, clear on load. This is robust to
*any* authored winding — exactly the "the 3D trusts the 2D data and is smart enough" goal. See
`placeMemberOnParent`; locked by the `splay-guard` smoke (antiparallel pen edge must nest at `θ≈0`).

> Why not just "reverse antiparallel edges"? Because antiparallel is sometimes **correct** (mirror-
> symmetric mating rects). Only the **same-side centroid test** distinguishes flip-needed from
> flip-splays.

---

## Rule 3 — Partial / unequal seams in mm (auto length = mating edge)

Edges in a seam need not be equal length (a gusset's 12 mm edge sews to part of a 70 mm side). Model
it in **mm**, not arbitrary fractions:

- The seam's **run length auto-derives = the shortest ("mating") member edge.**
- Each member positions that run on its own edge by **`offset` mm from a reference end** (`from`:
  `start`/`end`, surfaced to the user as Top/Bottom/Left/Right from the edge's geometry).
- A member with no offset joins its first `run` mm (so a 3-way join clips the longer members to the
  mating length — the intended "true-length" preview, not the whole edge).

Resolve to `{t0, t1}` fractions of each edge at consumption (every downstream consumer — canvas band,
shared-stitch mapping, 3D clip — already speaks `t0/t1`). Keep a **legacy fallback**: a member with
`t0`/`t1` and no `offset` uses the old fractions, so old files still load. Keep the editor's
`memberSpan` and the 3D `memberSpan3D` **in sync** (assembly-schema v4).

---

## Rule 4 — The pen-path control-handle NaN gotcha

A `.lpd` path point carries cubic handles `cp1x/cp1y/cp2x/cp2y` **even for corner points** (set equal
to the anchor). If you hand-build a path fixture and omit them, `cubicPt` reads `undefined` →
**NaN** propagates through `sampleEdge`/`align2D` and a transform silently becomes `theta=NaN`. When
synthesising a path (tests, generated geometry), always set `cp* = anchor` for corners.

---

## Rule 5 — Tell stacked pieces apart

Stacked same-colour panels blur together. Two cheap, on-palette aids (don't leave the leather look):

- **Per-piece tint** — a subtle deterministic lightness zig-zag (`±` a few HSL steps, widening with
  index) + a hair of hue drift off the base colour, keyed by piece index. Store the index on the
  mesh so a base-colour re-material re-applies the tint (don't reset to flat `S.leather`).
- **Per-panel silhouette outline** — `EdgesGeometry(geo, ~28°)` (silhouette + face perimeter, not
  facets) as dark `LineSegments` added to the piece group so it poses with the piece. Track for
  disposal on clear.

---

## Checklist when adding a 2D→3D path

1. Decide the frame **once**; prefer a pure extrusion (`det +1`) + camera, not a baked reflection.
2. Any edge-snap must choose the nesting side by **centroid**, never by trusting authored winding.
3. Partial seams: mm offset + auto length; legacy `t0/t1` fallback; editor ↔ consumer resolvers in sync.
4. Synthetic path fixtures: set `cp*` handles or get NaN.
5. Add a regression that distinguishes flip-needed from flip-splays (not just endpoint coincidence —
   endpoints coincide even when the body is flipped).
