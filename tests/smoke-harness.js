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
  const ORDER = ['kernel', 'outline', 'stitch-rect', 'stitch-circle', 'stitch-path', 'stitch-edges', 'load', 'nostitch', 'a11y'];
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
