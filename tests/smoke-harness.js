// ===================================================================
// Leather Studio 3D - smoke-test harness
// Injected into a copy of index.html and run in headless Edge.
// Exercises the REAL app logic: the ported geometry/stitch kernel
// (outlinePolygon, stitchFor) and the .lpd -> 3D loader (loadPattern).
// Writes results as JSON into <pre id="__smoke_out"> for the runner.
//
// Tests are grouped into independently-runnable FEATURES. The runner
// passes either a tier name ('quick' | 'full') or a comma/space list of
// feature names. The app's kernel functions are top-level decls in the
// (classic) app script, so they're reachable here by name.
// ===================================================================
window.__SMOKE__ = function (spec) {
  const results = [];
  let aborted = null;

  function assert(name, cond, detail) {
    results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
  }
  function assertNear(name, got, want, tol) {
    tol = tol == null ? 1e-6 : tol;
    assert(name, Math.abs(got - want) <= tol, `got ${got}, want ${want} +/-${tol}`);
  }

  // Path-point makers (mirror the main app's pen-point shape).
  const corner = (x, y) => ({ x, y, cp1x: x, cp1y: y, cp2x: x, cp2y: y, corner: true });
  // A smooth closed "blob" path built from BEZIER_K (a real curved pen path).
  function blobPath(cx, cy, r) {
    const k = BEZIER_K;
    return [
      { x: cx,   y: cy - r, cp1x: cx - r*k, cp1y: cy - r,   cp2x: cx + r*k, cp2y: cy - r   },
      { x: cx+r, y: cy,     cp1x: cx + r,   cp1y: cy - r*k, cp2x: cx + r,   cp2y: cy + r*k },
      { x: cx,   y: cy + r, cp1x: cx + r*k, cp1y: cy + r,   cp2x: cx - r*k, cp2y: cy + r   },
      { x: cx-r, y: cy,     cp1x: cx - r,   cp1y: cy + r*k, cp2x: cx - r,   cp2y: cy - r*k },
    ];
  }
  const square = () => [corner(0, 0), corner(40, 0), corner(40, 40), corner(0, 40)];

  // ---------------------------------------------------------------
  // FEATURE REGISTRY
  // ---------------------------------------------------------------
  const FEATURES = {

    // --- pure bezier/sampling kernel ---
    kernel() {
      const p0 = corner(0, 0), p1 = corner(10, 0);
      assertNear('cubicPt t=0.5 straight', cubicPt(p0, { x: 0, y: 0 }, { x: 10, y: 0 }, p1, 0.5).x, 5, 1e-9);
      assert('sampleSeg returns SEG_STEPS+1 pts', sampleSeg(p0, p1).length === SEG_STEPS + 1, `len=${sampleSeg(p0,p1).length}`);
      assert('rectRounded true when radii set', rectRounded({ type: 'rect', radii: [3, 0, 0, 0] }) === true);
      assert('rectRounded falsy when no radii', !rectRounded({ type: 'rect' }));
    },

    // --- outlinePolygon: shape -> sampled mm polygon ---
    outline() {
      const sharp = outlinePolygon({ type: 'rect', x: 0, y: 0, w: 50, h: 30 });
      assert('sharp rect -> 4 pts', sharp && sharp.length === 4, `len=${sharp && sharp.length}`);

      const round = outlinePolygon({ type: 'rect', x: 0, y: 0, w: 50, h: 30, radii: [5, 5, 5, 5] });
      assert('rounded rect -> sampled curve (>4 pts)', round && round.length > 4, `len=${round && round.length}`);

      const circ = outlinePolygon({ type: 'circle', cx: 0, cy: 0, r: 20 });
      assert('circle -> 72 pts', circ && circ.length === 72, `len=${circ && circ.length}`);

      // *** PEN REGRESSION ***  path shapes use `points` (not `pts`) + beziers.
      const pen = outlinePolygon({ type: 'path', closed: true, points: blobPath(0, 0, 25) });
      assert('PEN path -> non-empty polygon (regression)', pen && pen.length >= 3, `len=${pen && pen.length}`);
      assert('PEN path samples the curve (not just anchors)', pen && pen.length > 10, `len=${pen && pen.length}`);

      // a path stored under the OLD wrong field name must NOT crash; just yields nothing
      assert('legacy pts-field path -> null (skipped, no throw)', outlinePolygon({ type: 'path', pts: [{ x: 0, y: 0 }] }) === null);

      assert('text shape -> null (skipped in 3D)', outlinePolygon({ type: 'text', x: 0, y: 0, w: 10, h: 10 }) === null);
    },

    // --- stitchFor: rectangles ---
    'stitch-rect'() {
      LP.defMargin = 3; LP.defSpacing = 3.38;
      const res = stitchFor({ type: 'rect', x: 0, y: 0, w: 100, h: 80, hasStitch: true });
      assert('stitched rect -> holes', res && res.pts.length > 0, `pts=${res && res.pts.length}`);
      // four inset corners must each be a forced hole
      const forced = res.pts.filter(p => p.forced).length;
      assert('rect has 4 forced corners', forced === 4, `forced=${forced}`);
      assert('unstitched rect -> null', stitchFor({ type: 'rect', x: 0, y: 0, w: 100, h: 80, hasStitch: false }) === null);
    },

    // --- stitchFor: circles ---
    'stitch-circle'() {
      LP.defMargin = 3; LP.defSpacing = 3.38;
      const r = 30, sp = 3.38;
      const res = stitchFor({ type: 'circle', cx: 0, cy: 0, r, hasStitch: true });
      const expect = Math.round(2 * Math.PI * (r - 3) / sp);
      assert('circle hole count ~ circumference/spacing', Math.abs(res.pts.length - expect) <= 1, `got ${res.pts.length}, ~${expect}`);
    },

    // --- stitchFor: bezier path (the pen blob) ---
    'stitch-path'() {
      LP.defMargin = 3; LP.defSpacing = 3.38;
      const res = stitchFor({ type: 'path', closed: true, points: blobPath(0, 0, 40), hasStitch: true });
      assert('stitched pen path -> holes', res && res.pts.length > 4, `pts=${res && res.pts.length}`);
      // a sharp square path: 4 harsh corners -> 4 forced/highlighted holes
      const sq = stitchFor({ type: 'path', closed: true, points: square(), hasStitch: true });
      const hl = sq.pts.filter(p => p.hl).length;
      assert('square path -> 4 highlighted corners', hl === 4, `hl=${hl}`);
    },

    // --- per-edge stitching ---
    'stitch-edges'() {
      LP.defMargin = 3; LP.defSpacing = 3.38;
      const all = stitchFor({ type: 'rect', x: 0, y: 0, w: 100, h: 80, hasStitch: true });
      const one = stitchFor({ type: 'rect', x: 0, y: 0, w: 100, h: 80, hasStitch: true, stitchEdges: [0] });
      assert('one stitched edge < all edges', one.pts.length < all.pts.length, `one=${one.pts.length} all=${all.pts.length}`);
      assert('one edge still produces holes', one.pts.length > 0, `one=${one.pts.length}`);
    },

    // --- loadPattern integration: .lpd -> 3D meshes (uses three.js) ---
    load() {
      loadPattern({ settings: { defMargin: 3, defSpacing: 3.38 }, shapes: [
        { type: 'rect', x: 0, y: 0, w: 90, h: 120, radii: [8,8,8,8], hasStitch: true },
        { type: 'circle', cx: 200, cy: 60, r: 30, hasStitch: true },
        { type: 'path', closed: true, points: blobPath(200, 160, 30), hasStitch: true },
      ] }, 'smoke');
      assert('load -> 3 panel meshes (rect+circle+PEN path)', S.panelMeshes.length === 3, `panels=${S.panelMeshes.length}`);
      assert('load -> stitch meshes present (holes+thread)', S.stitchMeshes.length >= 1, `stitch=${S.stitchMeshes.length}`);
      assert('load remembers doc for rebuild', S.lastData && S.lastName === 'smoke');
      // piece distinction: one silhouette outline per panel, and adjacent pieces get distinct tints
      assert('distinction: one outline per panel', S.outlineMeshes.length === 3, `outlines=${S.outlineMeshes.length}`);
      assert('distinction: pieces get distinct tints', !S.panelMeshes[0].material.color.equals(S.panelMeshes[1].material.color));
      const tHex = S.panelMeshes[1].material.color.getHex();
      applyMaterials();   // a base-colour/roughness re-apply must KEEP the per-piece tint
      assert('distinction: tint survives applyMaterials', S.panelMeshes[1].material.color.getHex() === tHex);

      // hidden shapes are skipped
      loadPattern({ shapes: [
        { type: 'rect', x: 0, y: 0, w: 50, h: 50 },
        { type: 'rect', x: 0, y: 0, w: 50, h: 50, hidden: true },
      ] }, 'hide');
      assert('hidden shape skipped -> 1 panel', S.panelMeshes.length === 1, `panels=${S.panelMeshes.length}`);

      clearScene();
      assert('clearScene empties panels', S.panelMeshes.length === 0 && S.stitchMeshes.length === 0);
    },

    // --- #U3 camera framing + orbit pivot ---
    camera() {
      loadPattern({ shapes: [
        { type: 'rect', id: 1, x: 0,   y: 0, w: 60, h: 40, label: 'Front', hasStitch: false },
        { type: 'rect', id: 2, x: 300, y: 0, w: 60, h: 40, label: 'Back',  hasStitch: false },
      ] }, 'cam');

      const sel = document.getElementById('pivotSel');
      assert('pivot select lists model + 2 pieces', sel && sel.options.length === 3, `opts=${sel ? sel.options.length : 0}`);
      assert('pivot options carry piece names',
        [...sel.options].some(o => o.textContent === 'Front') && [...sel.options].some(o => o.textContent === 'Back'));

      // frame the whole model: orbit target lands on the model centre, camera pulled back
      S.pivot = 'model';
      frameTarget();
      const mc = modelBox().getCenter(new THREE.Vector3());
      assert('frame model: target at model centre', controls.target.distanceTo(mc) < 1, `d=${controls.target.distanceTo(mc).toFixed(2)}`);
      assert('frame model: camera pulled off the target', camera.position.distanceTo(controls.target) > 5);

      // choose a single piece as pivot -> orbit target snaps to that piece's centre
      S.pivot = pieceKeyFromStr('2');
      assert('piece key resolves from string', S.pivot != null);
      aimPivot();
      const pc = pieceBox(S.pivot).getCenter(new THREE.Vector3());
      assert('pivot piece: target at piece centre', controls.target.distanceTo(pc) < 1, `d=${controls.target.distanceTo(pc).toFixed(2)}`);
      assert('pivot piece: target differs from model centre', controls.target.distanceTo(mc) > 1);

      clearScene();
      assert('clearScene resets pivot to model', S.pivot === 'model');
      assert('clearScene empties pivot dropdown to model-only', sel.options.length === 1);
    },

    // --- #U4/#U5 stitch-hole style geometry + saddle-stitch thread ---
    stitch3d() {
      const g = new THREE.Group();
      const holes = [{ x: 0, y: 0, a: 0, yTop: 2 }, { x: 5, y: 0, a: 0, yTop: 2 }, { x: 10, y: 0, a: 0, yTop: 2 }];
      const lastHoleGeo = st => { LP.stitchStyle = st; addHoleMesh(holes, g); return S.stitchMeshes[S.stitchMeshes.length - 1].geometry; };

      // U4: hole geometry tracks the global stitch style
      assert('round style -> cylinder holes', lastHoleGeo('round').type === 'CylinderGeometry');
      assert('french style -> box (slit) holes', lastHoleGeo('french').type === 'BoxGeometry');
      const dia = lastHoleGeo('diamond');
      assert('diamond style -> 4-gon prism', dia.type === 'CylinderGeometry' && dia.parameters.radialSegments === 4);
      assert('hole mesh is instanced per hole', S.stitchMeshes[S.stitchMeshes.length - 1].count === holes.length);

      // U4: a non-round hole is turned to its local stitch angle (+ style offset) about world-Y
      LP.stitchStyle = 'french';
      addHoleMesh([{ x: 0, y: 0, a: Math.PI / 2, yTop: 2 }], g);
      const hm = S.stitchMeshes[S.stitchMeshes.length - 1];
      const mtx = new THREE.Matrix4(); hm.getMatrixAt(0, mtx);
      const eul = new THREE.Euler().setFromRotationMatrix(mtx, 'YXZ');
      assertNear('french hole turned to a-30 deg about Y', eul.y, Math.PI / 2 - Math.PI / 6, 0.02);

      // U5: each gap gets a stitch on both faces -> 2 thread instances per segment
      const segs = [{ a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, yTop: 2 }, { a: { x: 5, y: 0 }, b: { x: 10, y: 0 }, yTop: 2 }];
      LP.stitchStyle = 'french';
      addThreadMesh(segs, g);
      const tm = S.threadMeshes[S.threadMeshes.length - 1];
      assert('thread = 2 instances per gap (top + bottom)', tm.count === segs.length * 2, `count=${tm.count}`);
      // U5 fix: stitches are tilted by a CONSTANT iron angle and centred on the seam, so a run reads
      // as a clean parallel slant that follows the line (not opposite-side endpoints crossing it).
      assert('U5: french slant = 30deg', Math.abs(stitchSlant('french') - Math.PI / 6) < 1e-6);
      assert('U5: diamond slant = 45deg', Math.abs(stitchSlant('diamond') - Math.PI / 4) < 1e-6);
      const dirOf = i => { const M = new THREE.Matrix4(); tm.getMatrixAt(i, M); const e = M.elements; return new THREE.Vector3(e[4], e[5], e[6]).normalize(); };
      const d0 = dirOf(0), d1 = dirOf(1), d2 = dirOf(2);   // gap0 top, gap0 bottom, gap1 top
      assert('U5: consecutive top stitches are parallel (follow the line)', Math.abs(d0.dot(d2)) > 0.999, `dot=${d0.dot(d2)}`);
      assert('U5: stitch is slanted off the seam, not axis-aligned', Math.abs(d0.z) > 0.05 && Math.abs(d0.z) < 0.95, `z=${d0.z}`);
      // Both faces share the slant (NOT mirrored) — fixes the crossing-stitch look (user 2026-06-09).
      assert('U5: top + bottom face share the same slant (not mirrored)', d0.dot(d1) > 0.999, `dot=${d0.dot(d1)}`);
      // Thread CROSSES the slit (user 2026-06-10): slit lies at a-30deg, thread at a+30deg, so
      // they meet at ~60deg (|dot| ~ cos60 = 0.5) — never parallel (was th=-iron, |dot|=1).
      addHoleMesh([{ x: 0, y: 0, a: 0, yTop: 2 }], g);
      const hm2 = S.stitchMeshes[S.stitchMeshes.length - 1];
      const hx = new THREE.Matrix4(); hm2.getMatrixAt(0, hx);
      const slitDir = new THREE.Vector3(hx.elements[0], hx.elements[1], hx.elements[2]).normalize();
      assert('thread crosses the slit (not parallel)', Math.abs(d0.dot(slitDir)) < 0.7,
        `dot=${d0.dot(slitDir).toFixed(3)}`);

      clearScene();
    },

    // --- a shape with no stitching adds no stitch geometry ---
    nostitch() {
      loadPattern({ shapes: [{ type: 'rect', x: 0, y: 0, w: 50, h: 50, hasStitch: false }] }, 'plain');
      assert('no hasStitch -> no stitch meshes', S.stitchMeshes.length === 0, `stitch=${S.stitchMeshes.length}`);
      assert('no hasStitch -> still 1 panel', S.panelMeshes.length === 1, `panels=${S.panelMeshes.length}`);
      clearScene();
    },

    // --- assembly (v15): consume seams/folds, build the graph, flag problems ---
    assembly() {
      // edge sampling matches the editor's per-edge contract
      const e0 = sampleEdge({ type: 'rect', x: 0, y: 0, w: 100, h: 80 }, 0);
      assert('sampleEdge: rect edge 0 -> 2 pts', e0 && e0.length === 2, `len=${e0 && e0.length}`);
      assertNear('sampleEdge: rect top edge length = 100', polyLength(e0), 100, 1e-6);
      assert('resampleByArcLength: K -> K+1 pts', resampleByArcLength(e0, 8).length === 9);
      // per-piece thickness override / fallback
      assert('pieceThickness: explicit value wins', pieceThickness({ thickness: 5 }) === 5);
      assert('pieceThickness: missing -> global', pieceThickness({}) === S.thickness);

      // a doc with: a good 2-member seam, a length-mismatch seam, a dangling-ref seam, + a fold
      loadPattern({ settings: { defMargin: 3, defSpacing: 3.38 },
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80, thickness: 4 },
          { id: 2, type: 'rect', x: 200, y: 0, w: 100, h: 80 },
        ],
        assembly: { version: 1,
          seams: [
            { id: 1, name: 'spine',    type: 'stitch', members: [{ shape: 1, edge: 0 }, { shape: 2, edge: 0 }] }, // both 100mm
            { id: 2, name: 'mismatch', type: 'stitch', members: [{ shape: 1, edge: 0 }, { shape: 1, edge: 1 }] }, // 100 vs 80
            { id: 3, name: 'dangling', type: 'stitch', members: [{ shape: 1, edge: 0 }, { shape: 99, edge: 0 }] }, // shape 99 gone
          ],
          folds: [{ id: 1, shape: 1, a: { x: 10, y: 10 }, b: { x: 90, y: 10 }, angle: 90, name: 'crease' }],
        },
      }, 'asm');

      assert('assembly built', !!S.assembly);
      assert('assembly: 3 seams resolved', S.assembly.seams.length === 3, `n=${S.assembly.seams.length}`);
      const good = S.assembly.seams.find(s => s.id === 1);
      assert('assembly: good seam has 2 resolved members', good.resolved.length === 2);
      assert('assembly: member resolves to a polyline', Array.isArray(good.resolved[0].poly) && good.resolved[0].poly.length >= 2);
      assertNear('assembly: member edge length ~100', good.resolved[0].len, 100, 1e-6);
      // graph: nodes = joined pieces, arcs = usable seams
      assert('assembly: graph links pieces 1 & 2', S.assembly.graph.nodes.includes(1) && S.assembly.graph.nodes.includes(2));
      assert('assembly: graph has >=1 arc', S.assembly.graph.arcs.length >= 1, `arcs=${S.assembly.graph.arcs.length}`);
      assert('assembly: 1 fold parsed', S.assembly.folds.length === 1);
      // Tier-1 problems
      assert('problem: length-mismatch flagged', S.problems.some(p => p.kind === 'length'));
      assert('problem: dangling reference flagged', S.problems.some(p => p.kind === 'dangling'));
      assert('problem: incomplete seam flagged', S.problems.some(p => p.kind === 'incomplete'));
      // overlays: connectors (good + mismatch) + fold crease
      assert('overlays: seam/fold meshes built', S.seamMeshes.length >= 3, `meshes=${S.seamMeshes.length}`);
      assert('panel uses per-piece thickness (still 2 panels)', S.panelMeshes.length === 2);
      // panel shows the Assembly section + a problems list
      renderAssemblyPanel();
      assert('panel: Assembly section shown', document.getElementById('sec-assembly').style.display !== 'none');
      assert('panel: problem rows rendered', document.querySelectorAll('#asm-problems .asm-prob').length === S.problems.length);

      // absent assembly -> flat viewer unchanged (no-op)
      loadPattern({ shapes: [{ type: 'rect', x: 0, y: 0, w: 50, h: 50 }] }, 'flat');
      assert('no assembly -> S.assembly null', S.assembly === null);
      assert('no assembly -> no seam meshes', S.seamMeshes.length === 0);
      assert('no assembly -> no problems', S.problems.length === 0);
      assert('no assembly -> Assembly section hidden', document.getElementById('sec-assembly').style.display === 'none');

      clearScene();
      assert('clearScene resets assembly state', S.assembly === null && S.seamMeshes.length === 0);
    },

    // --- #U6 partial / unequal-length seams ---
    partialseams() {
      // clipPolyByT: a 100mm edge clipped to the middle 40% -> ~40mm
      const full = sampleEdge({ type: 'rect', x: 0, y: 0, w: 100, h: 80 }, 0);
      assertNear('clipPolyByT: middle 30-70% -> ~40mm', polyLength(clipPolyByT(full, 0.3, 0.7)), 40, 1e-3);
      assert('clipPolyByT: whole edge returns input', clipPolyByT(full, 0, 1) === full);

      // PARTIAL join: a 100mm edge clipped to 45% mated with a 45mm edge -> equal spans, no warning
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80, name: 'back' },
          { id: 2, type: 'rect', x: 200, y: 0, w: 45,  h: 80, name: 'pocket' },
        ],
        assembly: { version: 2, seams: [
          { id: 1, name: 'partial-spine', type: 'stitch', fit: 'partial', anchor: 'start',
            members: [{ shape: 1, edge: 0, t0: 0, t1: 0.45 }, { shape: 2, edge: 0 }] },
        ] },
      }, 'partial');
      const s = S.assembly.seams.find(x => x.id === 1);
      assert('partial seam carries fit=partial', s.fit === 'partial');
      assertNear('partial member clipped to ~45mm', s.resolved[0].len, 45, 0.5);
      assert('partial join: NO length-mismatch problem', !S.problems.some(p => p.kind === 'length'));

      // mm partial join (schema v4): a 100mm edge + 50mm mating edge -> run auto = 50mm; the long
      // member's offset (mm from its reference end) slides that run. No t0/t1 in the file.
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80, name: 'long' },
          { id: 2, type: 'rect', x: 200, y: 0, w: 50,  h: 80, name: 'mate' },
        ],
        assembly: { version: 4, seams: [
          { id: 1, name: 'mm-spine', type: 'stitch', fit: 'partial', anchor: 'start',
            members: [{ shape: 1, edge: 0, offset: 25 }, { shape: 2, edge: 0 }] },
        ] },
      }, 'mm');
      const mm = S.assembly.seams.find(x => x.id === 1);
      const long = mm.resolved.find(r => r.shape === 1);
      assertNear('mm: run auto-derives to the 50mm mating edge', long.len, 50, 0.5);
      assertNear('mm: offset 25 slides the run start to x=25', long.poly[0].x, 25, 0.5);
      assertNear('mm: run ends at x=75', long.poly[long.poly.length - 1].x, 75, 0.5);
      assert('mm: no length-mismatch problem', !S.problems.some(p => p.kind === 'length'));

      // control: the SAME unequal edges as a FULL join DO raise the mismatch
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80 },
          { id: 2, type: 'rect', x: 200, y: 0, w: 45,  h: 80 },
        ],
        assembly: { version: 2, seams: [
          { id: 1, name: 'full', type: 'stitch', members: [{ shape: 1, edge: 0 }, { shape: 2, edge: 0 }] },
        ] },
      }, 'fullctrl');
      assert('full join (unequal): length-mismatch flagged', S.problems.some(p => p.kind === 'length'));

      // align2D anchors: 'end' coincides the far endpoints, 'start' the near ones
      const ref = [{ x: 0, y: 0 }, { x: 100, y: 0 }], mov = [{ x: 0, y: 0 }, { x: 45, y: 0 }];
      const movEnd = applyXf2D(align2D(ref, mov, IDENT_XF, 'end'), mov[1]);
      assertNear('align2D end-anchor: mov end -> ref end (x=100)', movEnd.x, 100, 1e-3);
      const movStart = applyXf2D(align2D(ref, mov, IDENT_XF, 'start'), mov[0]);
      assertNear('align2D start-anchor: mov start -> ref start (x=0)', movStart.x, 0, 1e-3);

      clearScene();
    },

    // --- U7: shared stitch — every member gets the SAME aligned hole layout (holes coincide) ---
    sharedstitch() {
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80, name: 'back' },
          { id: 2, type: 'rect', x: 300, y: 0, w: 100, h: 80, name: 'front' },
        ],
        assembly: { version: 3, seams: [
          { id: 1, name: 'spine', type: 'stitch', stitch: { shared: true, spacing: 5 },
            members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] },   // both 80mm edges
        ] },
      }, 'shared');
      const seam = S.assembly.seams.find(s => s.id === 1);
      assert('U7-3D: buildAssembly carries shared stitch', seam.stitch && seam.stitch.shared === true && seam.stitch.spacing === 5, JSON.stringify(seam.stitch));
      // member edges are seam-driven (not independently stitched); a free edge still is
      assert('U7-3D: member edge skipped by edgeStitched', edgeStitched({ id: 1, type: 'rect', hasStitch: true }, 1) === false);
      assert('U7-3D: non-member edge still stitched', edgeStitched({ id: 1, type: 'rect', hasStitch: true }, 0) === true);
      // collect seam holes per member shape — counts must match so they coincide through the stack
      const h1 = [], t1 = []; collectStitches({ id: 1, hidden: false, hasStitch: false }, h1, t1);
      const h2 = [], t2 = []; collectStitches({ id: 2, hidden: false, hasStitch: false }, h2, t2);
      assert('U7-3D: both members get aligned holes', h1.length > 0 && h2.length > 0, `${h1.length} / ${h2.length}`);
      assert('U7-3D: members share hole count (coincide)', h1.length === h2.length, `${h1.length} vs ${h2.length}`);
      const u7mg = (LP.defMargin || 3);
      assert('U7-3D: count = round(insetLen/spacing)+1', h1.length === Math.round((80 - 2 * u7mg) / 5) + 1, `n=${h1.length}`);
      assert('U7-3D: threads link consecutive holes per run', t1.length === h1.length - 1, `t=${t1.length}`);
      assert('U7-3D: holes carry an orientation angle', h1.every(p => typeof p.a === 'number'));
      // Margin inset: member edge 1 of rect id1 is the right edge at x=100; holes must sit the
      // 3mm stitch margin IN from it (~x=97), not on the edge line (user 2026-06-09).
      assert('U7-3D: shared holes inset from the edge by the margin', h1.every(p => p.x < 99) && h1.some(p => p.x > 95), `xs=${h1.map(p => p.x.toFixed(1)).join(',')}`);
      // End-hole fix (user 2026-06-10): the run's end holes are ALSO inset by the margin along
      // the edge (mirrors the editor) — corner = ONE inset hole, not a doubled pair. Edge 1 runs
      // y 0→80, so holes live in [mg, 80-mg] and touch both inset ends.
      const ys = h1.map(p => p.y);
      assert('U7-3D: end holes inset along the run',
        ys.every(y => y > u7mg - 0.01 && y < 80 - u7mg + 0.01) &&
        ys.some(y => y < u7mg + 0.01) && ys.some(y => y > 80 - u7mg - 0.01),
        `ys=${ys.map(y => y.toFixed(1)).join(',')}`);
      // Corner dedupe: independently stitch the other edges of piece 1 — the corner twins the
      // seam already owns must be dropped (one hole per corner, like the editor).
      const hd = [], td = []; collectStitches({ id: 1, type: 'rect', x: 0, y: 0, w: 100, h: 80, hidden: false, hasStitch: true }, hd, td);
      const sp1 = (LP.defSpacing || 3.38);
      const sideN = e => Math.max(1, Math.round((e - 2 * u7mg) / sp1));   // holes per independent edge
      // Independent holes placed: edge 0 = N(100) + a far push toward the seam edge, edge 2 =
      // N(100) (its next edge 3 is stitched, no push), edge 3 = N(80). The two corners on the
      // seam edge (edge 0's push at c1, edge 2's start at c2) coincide with the seam's inset end
      // holes and are deduped: N(100)*2 + N(80) + 1 push - 2 deduped.
      const expected = h1.length + sideN(100) * 2 + sideN(80) - 1;
      assert('U7-3D: one hole per corner (dedup vs side edges)', hd.length === expected, `holes=${hd.length} expected=${expected}`);
      clearScene();
    },

    // --- S1: pairwise edge-snap + thickness/layer stacking ---
    stacking() {
      // two rects drawn far apart, joined along equal-length edges (rect1 right <-> rect2 left)
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0,   y: 0, w: 100, h: 80, thickness: 3 },
          { id: 2, type: 'rect', x: 400, y: 0, w: 100, h: 80, thickness: 2 },
        ],
        assembly: { version: 1,
          seams: [{ id: 1, name: 'spine', type: 'stitch', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] }],
          folds: [],
        },
      }, 'stack');

      const isIdent = m => m.elements.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9);
      assert('two piece groups built', S.pieceGroups.size === 2);
      // flat: every piece group's matrix is identity (raw 2D layout)
      setAssemblyMode('flat');
      const g2 = S.pieceGroups.get(2).group;
      assert('flat: moving piece at identity', isIdent(g2.matrix));

      // stacked: piece 2 (higher layer index) snaps onto piece 1, lifted by piece1 thickness
      setAssemblyMode('stacked');
      const xf2 = S.pieceXf.get(2);
      assert('stacked: moving piece got a non-identity pose',
        !!xf2 && (Math.abs(xf2.tx) > 1e-6 || Math.abs(xf2.ty) > 1e-6 || Math.abs(xf2.theta) > 1e-6));
      assertNear('stacked: lifted by reference thickness (3mm)', xf2.dy, 3, 1e-6);
      assertNear('stacked: group matrix Y = stack height', S.pieceGroups.get(2).group.matrix.elements[13], 3, 1e-6);
      assert('stacked: reference piece (lower layer) unmoved', S.pieceXf.get(1).dy === 0);
      // mated edge endpoints coincide after the transform
      const refEdge = sampleEdge(S.lastData.shapes[0], 1);   // rect1 edge 1: (100,0)->(100,80)
      const movEdge = sampleEdge(S.lastData.shapes[1], 3);   // rect2 edge 3
      const m0 = applyXf2D(xf2, movEdge[0]), m1 = applyXf2D(xf2, movEdge[movEdge.length - 1]);
      const d0 = Math.hypot(m0.x - refEdge[0].x, m0.y - refEdge[0].y);
      const d1 = Math.hypot(m1.x - refEdge[refEdge.length - 1].x, m1.y - refEdge[refEdge.length - 1].y);
      assert('stacked: mated edge endpoints coincide', d0 < 1e-6 && d1 < 1e-6, `d0=${d0.toFixed(4)} d1=${d1.toFixed(4)}`);

      // toggle back to flat → identity restored
      setAssemblyMode('flat');
      assert('flat again: identity restored', isIdent(S.pieceGroups.get(2).group.matrix));

      // REGRESSION (wrong-side / splay): a pen path whose mated edge is wound ANTIPARALLEL to the
      // parent's, with its body NOT mirror-symmetric to the parent (so a 180-deg flip splays it out
      // instead of nesting). Parent rect right edge (x=100, +Y) <-> child path right edge (x=100, -Y).
      // Both bodies sit to the LEFT of x=100, so the child must NEST over the parent (theta~0), not flip.
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0, y: 0, w: 100, h: 80, thickness: 2 },
          { id: 2, type: 'path', closed: true, thickness: 2, points: [
            { x: 0, y: 200 }, { x: 0, y: 280 }, { x: 100, y: 280 }, { x: 100, y: 200 } ]
            .map(p => ({ ...p, cp1x: p.x, cp1y: p.y, cp2x: p.x, cp2y: p.y, corner: true })) },
        ],
        assembly: { version: 1,
          seams: [{ id: 1, name: 'nest', type: 'stitch', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 2 }] }],
          folds: [] },
      }, 'splay');
      setAssemblyMode('stacked');
      const sx = S.pieceXf.get(2);
      assert('splay-guard: antiparallel pen edge nests without a 180-deg flip',
        Math.abs(sx.theta) < 1e-6, `theta=${sx.theta.toFixed(4)}`);
      // child centroid (50,240) must land on the parent's side of the seam line (nested), not flipped out
      const cc = applyXf2D(sx, { x: 50, y: 240 });
      assert('splay-guard: child body nests over the parent (not splayed out)',
        cc.x > 0 && cc.x < 100 && cc.y > -1 && cc.y < 81, `c=(${cc.x.toFixed(1)},${cc.y.toFixed(1)})`);

      // --- layer-order stack + soft non-adjacent seams (user 2026-06-10) ---
      // back (layer 0) / pocket (layer 1) / front (layer 2). Hard seams: back↔pocket (A),
      // pocket↔front (C) — adjacent layers. Seam B joins back↔front DIRECTLY (pocket between
      // them in the layer sequence) → SOFT: alignment hint only, never a hard rule.
      loadPattern({
        shapes: [
          { id: 1, type: 'rect', x: 0, y: 0,   w: 100, h: 80, thickness: 2,   name: 'back'   },
          { id: 2, type: 'rect', x: 0, y: 200, w: 100, h: 40, thickness: 1.5, name: 'pocket' },
          { id: 3, type: 'rect', x: 0, y: 300, w: 100, h: 80, thickness: 2,   name: 'front'  },
        ],
        assembly: { version: 4, seams: [
          { id: 1, name: 'A back-pocket',  type: 'stitch', members: [{ shape: 1, edge: 2 }, { shape: 2, edge: 0 }] },
          { id: 2, name: 'B back-front',   type: 'stitch', members: [{ shape: 1, edge: 0 }, { shape: 3, edge: 0 }] },
          { id: 3, name: 'C pocket-front', type: 'stitch', members: [{ shape: 2, edge: 2 }, { shape: 3, edge: 2 }] },
        ], folds: [] },
      }, 'layerstack');
      assert('soft: non-adjacent-layer seam classified soft', S.softSeams.has(2), [...S.softSeams].join(','));
      assert('soft: adjacent-layer seams stay hard', !S.softSeams.has(1) && !S.softSeams.has(3), [...S.softSeams].join(','));
      // Z-stack follows the GLOBAL layer order: pocket on back (2mm), front on back+pocket (3.5mm)
      assertNear('layerstack: back at the base', S.pieceXf.get(1).dy, 0, 1e-6);
      assertNear('layerstack: pocket lifted by back', S.pieceXf.get(2).dy, 2, 1e-6);
      assertNear('layerstack: front lifted by back+pocket', S.pieceXf.get(3).dy, 3.5, 1e-6);
      // Front was positioned by the hard chain (A then C), so the soft seam B's edges do NOT
      // meet — and being soft, that must NOT raise a Tier-2 gap problem.
      assert('soft: hard chain placed front via the pocket', S.pieceTree.get(3) && S.pieceTree.get(3).parent === 2,
        JSON.stringify(S.pieceTree.get(3)));
      assert('soft: no gap problem from the alignment-only seam', !S.problems.some(p => p.kind === 'gap'),
        JSON.stringify(S.problems));

      clearScene();
      assert('clearScene clears piece groups', S.pieceGroups.size === 0);
    },

    // --- S3: hinge/fold dihedral via forward kinematics over the seam tree ---
    fold() {
      const rect = (id, x) => ({ id, type: 'rect', x, y: 0, w: 100, h: 80, thickness: 2 });
      loadPattern({ shapes: [rect(1, 0), rect(2, 400)],
        assembly: { version: 1, seams: [{ id: 1, name: 'hinge', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] }], folds: [] } }, 'fold');
      S.foldAngle = 90;
      const matClose = (a, b) => { for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > 1e-6) return false; return true; };

      assert('fold: hinge tree records the child + parent', S.pieceTree.has(2) && S.pieceTree.get(2).parent === 1);
      const pose2 = poseMatrix(2);
      const W0 = computeAssembledMatrices(0).get(2);
      const W1 = computeAssembledMatrices(1).get(2);
      assert('fold: t=0 reproduces the stacked pose', matClose(W0, pose2));
      assert('fold: t=1 actually folds the child', !matClose(W1, pose2));

      // the mated (hinge) edge is invariant across the fold; the far edge swings out of plane
      const onHinge = new THREE.Vector3(400, 0, -40);   // child mated-edge midpoint, at the base (on the axis)
      const h0 = onHinge.clone().applyMatrix4(W0), h1 = onHinge.clone().applyMatrix4(W1);
      assert('fold: hinge edge stays put through the fold', h0.distanceTo(h1) < 1e-3, `d=${h0.distanceTo(h1).toFixed(4)}`);
      const far = new THREE.Vector3(500, 0, -40);        // child far-edge midpoint (100mm from the hinge)
      const f0 = far.clone().applyMatrix4(W0), f1 = far.clone().applyMatrix4(W1);
      assert('fold: far edge swings well out of plane', f1.distanceTo(f0) > 50 && Math.abs(f1.y - f0.y) > 50, `dist=${f1.distanceTo(f0).toFixed(1)} dy=${(f1.y-f0.y).toFixed(1)}`);

      // mode plumbing + assemble slider drive the live group matrices
      setAssemblyMode('assembled'); setAssembleT(1);
      assert('assembled mode active', S.assemblyMode === 'assembled');
      assert('assembled: child group matrix is folded', !matClose(S.pieceGroups.get(2).group.matrix, pose2));
      setAssembleT(0);
      assert('assemble t=0: child returns to the stacked pose', matClose(S.pieceGroups.get(2).group.matrix, pose2));
      assert('assembled: root piece stays put', matClose(S.pieceGroups.get(1).group.matrix, poseMatrix(1)));

      setAssemblyMode('flat');
      clearScene();
    },

    // --- S2: whole seam-graph positioning from a root (chain / N-way / cycle) ---
    graph() {
      const rect = (id, x, th) => ({ id, type: 'rect', x, y: 0, w: 100, h: 80, thickness: th });
      const gapCount = () => S.problems.filter(p => p.kind === 'gap').length;
      const moved = id => { const xf = S.pieceXf.get(id); return Math.abs(xf.tx) > 1e-6 || Math.abs(xf.ty) > 1e-6 || Math.abs(xf.theta) > 1e-6; };

      // chain A-B-C: root should be the most-connected middle piece B (degree 2)
      loadPattern({ shapes: [rect(1,0,2), rect(2,400,2), rect(3,800,2)],
        assembly: { version: 1, seams: [
          { id: 1, name: 's1', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] },
          { id: 2, name: 's2', members: [{ shape: 2, edge: 1 }, { shape: 3, edge: 3 }] },
        ], folds: [] } }, 'chain');
      assert('chain: root (most-connected B) keeps in-plane identity',
        S.pieceXf.get(2).theta === 0 && S.pieceXf.get(2).tx === 0 && S.pieceXf.get(2).ty === 0);
      assertNear('chain: stack follows layer order (B above A)', S.pieceXf.get(2).dy, 2, 1e-6);
      assert('chain: both leaves positioned', moved(1) && moved(3));
      assert('chain: tree closes with no gap', gapCount() === 0, `gaps=${gapCount()}`);

      // N-way spine: 3 pieces share one seam → stack at distinct, cumulative heights
      loadPattern({ shapes: [rect(1,0,2), rect(2,400,3), rect(3,800,4)],
        assembly: { version: 1, seams: [
          { id: 1, name: 'spine', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 1 }, { shape: 3, edge: 1 }] },
        ], folds: [] } }, 'nway');
      assert('N-way: root (lowest layer) at base', S.pieceXf.get(1).dy === 0);
      assertNear('N-way: 2nd piece lifted by piece1 thickness', S.pieceXf.get(2).dy, 2, 1e-6);
      assertNear('N-way: 3rd piece lifted by piece1+piece2', S.pieceXf.get(3).dy, 5, 1e-6);
      assert('N-way: spine coincides (no gap)', gapCount() === 0, `gaps=${gapCount()}`);

      // cycle A-B-C-A: the closing seam joins NON-adjacent layers (A and C, with B between) →
      // it is a SOFT alignment, not a hard rule (user 2026-06-10) — no gap problem; the
      // spanning tree still places all three pieces.
      loadPattern({ shapes: [rect(1,0,2), rect(2,400,2), rect(3,800,2)],
        assembly: { version: 1, seams: [
          { id: 1, name: 's1', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] },
          { id: 2, name: 's2', members: [{ shape: 2, edge: 1 }, { shape: 3, edge: 3 }] },
          { id: 3, name: 's3', members: [{ shape: 3, edge: 1 }, { shape: 1, edge: 3 }] },
        ], folds: [] } }, 'cycle');
      assert('cycle: closing non-adjacent seam is soft → no gap problem',
        S.softSeams.has(3) && gapCount() === 0, `soft=${[...S.softSeams]} gaps=${gapCount()}`);
      assert('cycle: all three pieces still placed', !moved(1) && moved(2) && moved(3));

      // 2-piece over-constrained cycle: adjacent layers, so BOTH seams stay hard — once the
      // first places B, the second can't coincide → the residual gap IS still flagged (Tier-2).
      loadPattern({ shapes: [rect(1,0,2), rect(2,400,2)],
        assembly: { version: 1, seams: [
          { id: 1, name: 'h1', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] },
          { id: 2, name: 'h2', members: [{ shape: 1, edge: 0 }, { shape: 2, edge: 0 }] },
        ], folds: [] } }, 'cycle2');
      assert('cycle: hard 2-piece cycle still gap-flagged', gapCount() >= 1, `gaps=${gapCount()}`);

      clearScene();
    },

    // --- v5 edge reference guides: a directional, alignment-only annotation. members[0]=target;
    //     a source piece butts its edge against the target edge (opposite side), no stitch/fold/gap. ---
    guide() {
      const perpDist = (P, A, B) => { const dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1; return Math.abs((P.x-A.x)*dy - (P.y-A.y)*dx)/L; };
      const kind = k => S.problems.filter(p => p.kind === k).length;
      // base (100mm top edge) + smaller tab (40mm bottom edge) joined ONLY by a guide.
      loadPattern({ shapes: [
        { id: 1, type:'rect', x:0,   y:0,   w:100, h:80 },   // base — target = top edge (0)
        { id: 2, type:'rect', x:0,   y:200, w:40,  h:30 },   // tab  — source = bottom edge (2)
      ], assembly: { version: 5, seams: [
        { id: 1, name: 'tab align', type: 'guide',
          members: [ { shape: 1, edge: 0 }, { shape: 2, edge: 2 } ] },
      ], folds: [] } }, 'guide');

      const seam = S.assembly.seams[0];
      assert('guide: parsed with type guide', seam.type === 'guide');
      assert('guide: unequal edges raise NO length problem', kind('length') === 0, `len=${kind('length')}`);
      assert('guide: carries no shared-stitch layout', seam.stitch == null);
      assert('guide: owns no stitching (sharedSeamForEdge3D null)', sharedSeamForEdge3D(2, 2) === null);
      assert('guide: in the graph (toggle shows)', S.assembly.graph.arcs.length >= 1, `arcs=${S.assembly.graph.arcs.length}`);

      const tgt = seam.resolved[0], src = seam.resolved[1];
      const txf = S.pieceXf.get(tgt.shape), sxf = S.pieceXf.get(src.shape);
      assert('guide: source piece is positioned', Math.abs(sxf.tx) > 1e-6 || Math.abs(sxf.ty) > 1e-6 || Math.abs(sxf.theta) > 1e-6, JSON.stringify(sxf));
      assert('guide: target stays at identity (reference)', txf.theta === 0 && txf.tx === 0 && txf.ty === 0);
      // source edge lands collinear with the target edge (aligned)
      const tA = applyXf2D(txf, tgt.poly[0]), tB = applyXf2D(txf, tgt.poly[tgt.poly.length-1]);
      const srcPts = resampleByArcLength(src.poly, 8).map(p => applyXf2D(sxf, p));
      const maxPerp = Math.max(...srcPts.map(p => perpDist(p, tA, tB)));
      assert('guide: source edge aligns onto the target edge line', maxPerp < 0.5, `maxPerp=${maxPerp.toFixed(3)}mm`);
      // butt joint: source body sits on the OPPOSITE side of the edge from the target body
      const tc = applyXf2D(txf, pieceCentroid(tgt.sh)), sc = applyXf2D(sxf, pieceCentroid(src.sh));
      assert('guide: source butts opposite the target (extends outward)',
        sideOfLine(tA, tB, tc) === -sideOfLine(tA, tB, sc), `tgtSide=${sideOfLine(tA,tB,tc)} srcSide=${sideOfLine(tA,tB,sc)}`);
      // alignment-only: never folds (not in the hinge tree), never gap-flagged
      assert('guide: source not in the hinge tree (alignment-only)', !S.pieceTree.has(src.shape));
      assert('guide: coplanar with target (no stack lift)', sxf.dy === (txf.dy||0), `dy=${sxf.dy}`);
      assert('guide: raises NO gap problem', kind('gap') === 0, `gap=${kind('gap')}`);

      clearScene();
    },

    // --- #24 theme toggle (pill, LPD-style) + #22 keyboard-accessible menubar ---
    a11y() {
      const tog = document.getElementById('theme-toggle');
      assert('theme-toggle exists and is role=button', !!tog && tog.getAttribute('role') === 'button');
      assert('theme-toggle has aria-pressed', !!tog && tog.hasAttribute('aria-pressed'));
      assert('theme-toggle is keyboard-focusable', !!tog && tog.tabIndex === 0);
      assert('theme-toggle renders the sliding switch', !!tog && !!tog.querySelector('.theme-switch .theme-knob'));
      // toggling theme flips aria-pressed + the label text
      const before = tog.getAttribute('aria-pressed');
      const lblBefore = document.getElementById('theme-label').textContent;
      toggleTheme();
      assert('toggleTheme flips aria-pressed', tog.getAttribute('aria-pressed') !== before);
      assert('toggleTheme swaps the label', document.getElementById('theme-label').textContent !== lblBefore);
      toggleTheme(); // restore

      const bar = document.getElementById('menubar');
      assert('menubar has role=menubar', bar && bar.getAttribute('role') === 'menubar');
      const items = [...document.querySelectorAll('.m-item[data-menu]')];
      assert('menubar has top-level items', items.length >= 3, `items=${items.length}`);
      assert('top-level items are focusable role=menuitem',
        items.every(mi => mi.getAttribute('role') === 'menuitem' && mi.tabIndex === 0));
      assert('top-level items expose aria-haspopup + aria-expanded',
        items.every(mi => mi.getAttribute('aria-haspopup') === 'true' && mi.hasAttribute('aria-expanded')));
      assert('every dropdown action is role=menuitem',
        [...document.querySelectorAll('.m-act')].every(a => a.getAttribute('role') === 'menuitem'));
      assert('resize handle is role=separator',
        document.getElementById('props-resize').getAttribute('role') === 'separator');
    },
  };

  // Tier -> ordered feature list. quick = pure logic; full = everything.
  const ORDER = ['kernel', 'outline', 'stitch-rect', 'stitch-circle', 'stitch-path', 'stitch-edges', 'load', 'camera', 'stitch3d', 'nostitch', 'assembly', 'partialseams', 'sharedstitch', 'stacking', 'graph', 'guide', 'fold', 'a11y'];
  const TIERS = { quick: ['kernel', 'outline'], full: ORDER };

  function resolve(spec) {
    const s = String(spec || 'quick').trim();
    if (TIERS[s]) return TIERS[s].slice();
    return s.split(/[\s,]+/).filter(Boolean);
  }

  let ran = [];
  try {
    const names = resolve(spec);
    for (const name of names) {
      if (!FEATURES[name]) {
        assert(`unknown feature "${name}"`, false, 'available: ' + ORDER.join(', '));
        continue;
      }
      ran.push(name);
      FEATURES[name]();
    }
    return finish();
  } catch (e) {
    aborted = (e && e.stack) ? e.stack : String(e);
    assert('harness ran without throwing', false, aborted);
    return finish();
  }

  function finish() {
    const passed = results.filter(r => r.pass).length;
    const out = { tier: ran.join('+') || String(spec), features: ran, total: results.length, passed, failed: results.length - passed, results, aborted };
    const pre = document.createElement('pre');
    pre.id = '__smoke_out';
    // Markers assembled from fragments so they don't appear contiguously in
    // this source (else the runner's regex matches the harness's own text).
    const START = '__SMOKE' + '_JSON__';
    const END = '__' + 'END__';
    pre.textContent = START + JSON.stringify(out) + END;
    document.body.appendChild(pre);
    return out;
  }
};
