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

      // hidden shapes are skipped
      loadPattern({ shapes: [
        { type: 'rect', x: 0, y: 0, w: 50, h: 50 },
        { type: 'rect', x: 0, y: 0, w: 50, h: 50, hidden: true },
      ] }, 'hide');
      assert('hidden shape skipped -> 1 panel', S.panelMeshes.length === 1, `panels=${S.panelMeshes.length}`);

      clearScene();
      assert('clearScene empties panels', S.panelMeshes.length === 0 && S.stitchMeshes.length === 0);
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
      assert('chain: root is the most-connected piece (B identity)',
        S.pieceXf.get(2).dy === 0 && S.pieceXf.get(2).theta === 0 && S.pieceXf.get(2).tx === 0);
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

      // cycle A-B-C-A: spanning tree places A,B,C; the closing seam can't coincide → gap flagged
      loadPattern({ shapes: [rect(1,0,2), rect(2,400,2), rect(3,800,2)],
        assembly: { version: 1, seams: [
          { id: 1, name: 's1', members: [{ shape: 1, edge: 1 }, { shape: 2, edge: 3 }] },
          { id: 2, name: 's2', members: [{ shape: 2, edge: 1 }, { shape: 3, edge: 3 }] },
          { id: 3, name: 's3', members: [{ shape: 3, edge: 1 }, { shape: 1, edge: 3 }] },
        ], folds: [] } }, 'cycle');
      assert('cycle: residual-gap problem flagged', gapCount() >= 1, `gaps=${gapCount()}`);
      assert('cycle: all three pieces still placed', !moved(1) && moved(2) && moved(3));

      clearScene();
    },

    // --- #24 theme toggle button + #22 keyboard-accessible menubar ---
    a11y() {
      const btn = document.getElementById('theme-btn');
      assert('theme-btn exists and is a <button>', !!btn && btn.tagName === 'BUTTON');
      assert('theme-btn has aria-pressed', !!btn && btn.hasAttribute('aria-pressed'));
      assert('theme-btn renders an icon (svg)', !!btn && !!btn.querySelector('svg'));
      // toggling theme flips aria-pressed and swaps the icon
      const before = btn.getAttribute('aria-pressed');
      toggleTheme();
      assert('toggleTheme flips aria-pressed', btn.getAttribute('aria-pressed') !== before);
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
  const ORDER = ['kernel', 'outline', 'stitch-rect', 'stitch-circle', 'stitch-path', 'stitch-edges', 'load', 'nostitch', 'assembly', 'stacking', 'graph', 'fold', 'a11y'];
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
