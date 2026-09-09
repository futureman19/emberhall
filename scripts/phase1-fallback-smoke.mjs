// Local DEV only. Run after other GPU samples: node scripts/phase1-fallback-smoke.mjs URL LABEL
// --source-only validates the exact source contracts without importing Playwright or launching a browser.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [urlArg, label, ...flags] = process.argv.slice(2);
assert(urlArg && label, 'Usage: node scripts/phase1-fallback-smoke.mjs URL LABEL [--source-only]');
assert(flags.every(f => f === '--source-only'), 'Unknown flag');
const target = new URL(urlArg);
assert(['http:', 'https:'].includes(target.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local Vite DEV only; never import /src into a deployed/live URL');
assert(!target.username && !target.password, 'Credentials are not supported');
assert.match(label, /^[A-Za-z0-9_-]+$/);
const out = path.join(repo, 'art/verification/phase1', label);
assert(!fs.existsSync(path.join(out, 'results.json')), 'Use a fresh label; retain prior evidence');
fs.mkdirSync(out, { recursive: true });
const kinds = ['hall', 'dormitory', 'kitchen', 'yard', 'market', 'forge', 'tavern', 'notice', 'board', 'farm', 'bank'];
const furnitureCounts = { hall: 7, dormitory: 7, kitchen: 9, yard: 2, market: 16, forge: 3, tavern: 9, bank: 8 };
const result = {
  url: target.href, label, status: 'running', started: new Date().toISOString(),
  scope: 'Local disposable fixture only. Explicit player-position setup, NOT walking, placement-commit, pointer-click, visual-quality, mobile, or performance proof.',
  limits: { totalMs: 120000, actionMs: 7000, navigationMs: 30000, readyMs: 35000, settleMs: 180, screenshots: 2, siteCandidatesPerKind: 1681, browsers: 1, pages: 1 },
  checks: [], fallback: [], ghosts: [], assets: [], errors: [], screenshots: [],
  acceptanceComplete: false,
};
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
const check = (name, ok, evidence = {}) => { result.checks.push({ name, ok: !!ok, ...evidence }); flush(); assert(ok, name); };
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
let browser, page, watchdog;
flush();
try {
  const fixtureRaw = read('public/art/phase1-review-save.json');
  const fixture = JSON.parse(fixtureRaw);
  const original = JSON.parse(read('public/art/commons-review-save.json'));
  const source = read('src/components/game/building-meshes.tsx');
  const interiorSource = read('src/components/game/interior-kit.ts');
  const siteSource = read('src/game/building-size.ts');
  result.source = { building: hash(source), interior: hash(interiorSource), site: hash(siteSource), fixture: hash(fixtureRaw) };
  check('fixture-original-building-records-byte-equivalent-JSON', original.buildings.every(b => JSON.stringify(fixture.buildings.find(f => f.id === b.id)) === JSON.stringify(b)), { originals: original.buildings.length });
  check('fixture-original-nonbuilding-records-byte-equivalent-JSON', Object.keys(original).filter(k => k !== 'buildings').every(k => JSON.stringify(original[k]) === JSON.stringify(fixture[k])));
  const compile = text => { const exports = {}; new Function('exports', ts.transpile(text, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(exports); return exports; };
  const start = source.indexOf('function put('), end = source.indexOf('function occupant(');
  check('source-generator-boundaries', start >= 0 && end > start);
  const { SPECS } = compile(source.slice(start, end) + '\nexport { SPECS };');
  const { replaceInteriorVoxel } = compile(interiorSource.slice(interiorSource.indexOf('export function replaceInteriorVoxel(')));
  const buildings = kinds.map(kind => fixture.buildings.filter(b => b.kind === kind).sort((a, b) => Math.hypot(a.tx - 256, a.ty - 292) - Math.hypot(b.tx - 256, b.ty - 292))[0]);
  check('eleven-unique-fixture-kinds', buildings.every(Boolean) && new Set(buildings.map(b => b.kind)).size === 11);
  const specs = Object.fromEntries(kinds.map(k => [k, { ...SPECS[k], selected: SPECS[k].voxels.filter(v => replaceInteriorVoxel(k, v)) }]));
  for (const [kind, count] of Object.entries(furnitureCounts)) check(`source-${kind}-exact-selected-original-cells`, specs[kind].selected.length === count && specs[kind].selected.every(v => v.y > 0 && !v.cut), { count, cells: specs[kind].selected });
  const ghostSource = source.slice(source.indexOf('function GhostAt('));
  check('source-original-GhostAt-not-authored', ghostSource.includes('<PreviewLayer items={items}') && !/<primitive|useArtistKit/.test(ghostSource));
  const { siteError } = compile(siteSource);
  result.sourcePlacementConstraints = kinds.map(kind => ({ kind, rejection: siteError(fixture, kind, buildings[0].tx, buildings[0].ty), valid: 'unreachable in unchanged all-11 fixture: singleton existing-kind rejection; hall/bank always rejected' }));
  check('source-all-eleven-valid-states-unreachable-without-world-mutation', result.sourcePlacementConstraints.every(c => /already stands/.test(c.rejection)));
  if (flags.includes('--source-only')) {
    result.status = 'source-only-passed';
    result.runtimeExecuted = false;
  } else {
    watchdog = setTimeout(() => {
      result.status = 'timeout'; result.failure = '120-second total deadline exceeded'; flush();
      // Hard bound even if Chromium or a pending evaluation is unresponsive.
      void browser?.close(); setTimeout(() => process.exit(1), 500).unref();
    }, result.limits.totalMs);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, timeout: 15000, args: ['--use-angle=d3d11', '--enable-gpu'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.routeWebSocket(/.*/, () => {});
    // Intentionally does NOT abort hall/bank/forge/etc approved exterior GLBs.
    const blockedPath = /^\/art\/lanternwood\/(?:interior-[^/]+|notice|board)\.glb$/;
    await context.route('**/*', async route => {
      const request = route.request(); const u = new URL(request.url());
      if (u.origin === target.origin && blockedPath.test(u.pathname)) {
        result.assets.push({ event: 'aborted', path: u.pathname, url: u.href }); flush();
        await route.abort('failed');
      } else await route.continue();
    });
    page = await context.newPage(); page.setDefaultTimeout(result.limits.actionMs);
    page.on('requestfailed', req => { result.assets.push({ event: 'failed', path: new URL(req.url()).pathname, error: req.failure()?.errorText }); flush(); });
    page.on('response', res => { if (/\.glb(?:\?|$)/.test(res.url())) { result.assets.push({ event: 'response', path: new URL(res.url()).pathname, status: res.status() }); flush(); } });
    page.on('pageerror', e => { result.errors.push({ type: 'pageerror', message: e.message }); flush(); });
    page.on('console', msg => { if (msg.type() === 'error') {
      const location = msg.location();
      let expectedBlockedAsset = false;
      try { const u = new URL(location.url); expectedBlockedAsset = u.origin === target.origin && blockedPath.test(u.pathname) && /Failed to load resource.*ERR_FAILED/.test(msg.text()); } catch { /* no source URL: retain as unexpected */ }
      result.errors.push({ type: 'console', message: msg.text(), location, expectedBlockedAsset }); flush();
    } });
    await page.addInitScript(raw => localStorage.setItem('emberhall-save-v4', raw), fixtureRaw);
    const launchURL = new URL('/?qa=1', target);
    await page.goto(launchURL.href, { waitUntil: 'domcontentloaded', timeout: result.limits.navigationMs });
    check('navigation-still-local-exact-origin', new URL(page.url()).origin === target.origin);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing', null, { timeout: result.limits.readyMs });
    await page.evaluate(() => window.__ember.useGame.getState().speed(0));
    const access = await page.evaluate(async ({ source, interiorSource, siteSource, specs }) => {
      if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw Error('Local only');
      const actual = await import('/src/components/game/building-meshes.tsx?raw');
      const actualInterior = await import('/src/components/game/interior-kit.ts?raw');
      const actualSite = await import('/src/game/building-size.ts?raw');
      if (actual.default !== source || actualInterior.default !== interiorSource || actualSite.default !== siteSource) throw Error('Served source differs from local evidence');
      const response = await fetch('/src/components/game/world-scene.tsx');
      if (!response.ok) throw Error('Local world-scene module unavailable');
      const text = await response.text();
      const match = text.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
      if (!match) throw Error('Exact renderer Fiber import not found');
      const fiber = await import(match[1]);
      const state = fiber._roots?.get(document.querySelector('canvas'))?.store?.getState();
      if (!state) throw Error('Exact target Fiber root unavailable');
      const { groundY } = await import('/src/game/height.ts');
      const { siteError, buildingBox } = await import('/src/game/building-size.ts');
      const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer);
      const savedPosition = { x: p.x, z: p.z };
      const snapshot = () => JSON.stringify(w, function(key, value) { return this === p && key in savedPosition ? savedPosition[key] : value; });
      const ui = window.__ember.useGame.getState();
      window.__fallbackQA = { state, groundY, siteError, buildingBox, specs, savedPosition, snapshot, before: snapshot(), buildings: JSON.stringify(w.buildings), savedUI: { buildKind: ui.buildKind, buildAt: ui.buildAt, snap: ui.snap } };
      return { method: 'exact-local-fiber-_roots:' + match[1], camera: state.camera.type };
    }, { source, interiorSource, siteSource, specs });
    check('exact-local-scene-and-byte-identical-served-sources', !!access.method, access);
    result.runtimeExecuted = true;
    const loadedRecords = await page.evaluate(expected => {
      const actual = window.__ember.getWorld().buildings;
      return { sameCount: actual.length === expected.length, identical: expected.every(b => JSON.stringify(actual.find(a => a.id === b.id)) === JSON.stringify(b)) };
    }, fixture.buildings);
    check('loaded-fixture-building-records-byte-equivalent-JSON', loadedRecords.sameCount && loadedRecords.identical, loadedRecords);
    const settle = () => page.waitForTimeout(result.limits.settleMs);
    const position = async (x, z) => {
      await page.evaluate(({ x, z }) => { const w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer), store = window.__ember.useGame; p.x = x; p.z = z; store.setState({ buildKind: null, buildAt: null, snap: { ...store.getState().snap, youX: x, youZ: z } }); }, { x, z });
      await settle();
    };
    const sceneFor = b => page.evaluate(b => {
      const q = window.__fallbackQA, spec = q.specs[b.kind], y0 = q.groundY(window.__ember.getWorld(), b.tx, b.ty);
      q.state.scene.updateMatrixWorld(true);
      const key = (x, y, z) => [x, y, z].map(n => n.toFixed(3)).join(',');
      const expected = v => key(b.tx + (v.x + .5) * .5, y0 + (v.y + .5) * .5, b.ty + (v.z + .5) * .5);
      const noncut = spec.voxels.filter(v => !v.cut), groups = [];
      q.state.scene.traverse(o => {
        const h = o.__r3f?.handlers;
        if (!o.isGroup || !h?.onPointerDown || !h.onPointerMove || !h.onPointerUp) return;
        const meshes = o.children.filter(c => c.isInstancedMesh); if (!meshes.length) return;
        const cells = new Map();
        for (const m of meshes) for (let i = 0; i < m.count; i++) {
          const mat = m.matrix.clone(); m.getMatrixAt(i, mat);
          const p = m.position.clone().setFromMatrixPosition(mat).applyMatrix4(m.matrixWorld);
          const k = key(p.x, p.y, p.z), materials = Array.isArray(m.material) ? m.material : [m.material];
          let visible = true; for (let a = m; a; a = a.parent) if (!a.visible) visible = false;
          const visibleColor = visible && materials.some(a => a.colorWrite && a.opacity > 0);
          const entries = cells.get(k) || []; entries.push({ mesh: m.uuid, instance: i, visibleColor, colorWrite: materials.map(a => a.colorWrite) }); cells.set(k, entries);
        }
        // All original non-cut cell centers, not a nearby generic group, identify the building.
        if (noncut.every(v => cells.has(expected(v)))) groups.push({ o, meshes, cells });
      });
      if (groups.length !== 1) return { found: false, matchingGroups: groups.length };
      const { o, meshes, cells } = groups[0];
      const names = []; o.traverse(n => { if (n.name) names.push(n.name); });
      if (!q.originalHandlers) q.originalHandlers = {};
      const previous = q.originalHandlers[b.id];
      const sameHandlers = !previous || previous.group === o && ['onPointerDown', 'onPointerMove', 'onPointerUp'].every(k => typeof o.__r3f.handlers[k] === 'function');
      q.originalHandlers[b.id] = { group: o };
      const all = spec.voxels.map(v => ({ voxel: v, present: cells.has(expected(v)), entries: cells.get(expected(v)) || [] }));
      return { found: true, uuid: o.uuid, sameOriginalGroupAndHandlerSlots: sameHandlers, meshIds: meshes.map(m => m.uuid), names,
        selected: spec.selected.map(v => ({ voxel: v, entries: cells.get(expected(v)) || [] })),
        noncutPresent: all.filter(a => !a.voxel.cut).every(a => a.present),
        // markRoof also marks perimeter floor cells cut; !inside removes the entire cut layer.
        floorPresent: all.filter(a => a.voxel.y === 0).every(a => a.present),
        noncutFloorPresent: all.filter(a => a.voxel.y === 0 && !a.voxel.cut).every(a => a.present),
        missingFloorCells: all.filter(a => a.voxel.y === 0 && !a.present).map(a => a.voxel),
        missingOnlyCutCells: all.filter(a => !a.present).every(a => a.voxel.cut),
        cutWallsPresent: all.filter(a => a.voxel.cut).every(a => a.present),
        allOriginalPresent: all.every(a => a.present), originalCount: all.length,
        visibleOriginalCenters: all.filter(a => a.entries.some(e => e.visibleColor)).length };
    }, b);
    const capture = async name => { await page.screenshot({ path: path.join(out, name), timeout: 7000 }); result.screenshots.push(name); flush(); };
    for (const b of buildings) {
      await position(b.tx, b.ty + 7);
      if (b.kind in furnitureCounts || b.kind === 'farm') await page.waitForFunction(name => {
        let found = false; window.__fallbackQA.state.scene.traverse(o => { if (o.name === name) found = true; }); return found;
      }, `blender-${b.kind}-exterior`, { timeout: 7000 });
      const outside = await sceneFor(b);
      check(`${b.kind}-outside-original-proxies-floors-walls`, outside.found && outside.allOriginalPresent && outside.floorPresent && outside.cutWallsPresent, { scene: outside });
      await position(b.tx, b.ty); const inside = await sceneFor(b);
      check(`${b.kind}-inside-same-original-building-group`, inside.found && inside.uuid === outside.uuid && inside.sameOriginalGroupAndHandlerSlots && inside.noncutPresent && inside.noncutFloorPresent && inside.missingOnlyCutCells, { scene: inside });
      const newPrimitive = [...outside.names, ...inside.names].filter(n => /^blender-(?:interior-|notice-|board-)/.test(n));
      check(`${b.kind}-no-failed-new-primitives`, newPrimitive.length === 0, { newPrimitive });
      if (b.kind in furnitureCounts) {
        check(`${b.kind}-selected-original-furniture-visible`, inside.selected.length === furnitureCounts[b.kind] && inside.selected.every(c => c.entries.some(e => e.visibleColor)), { selected: inside.selected });
        check(`${b.kind}-approved-exterior-still-present`, outside.names.includes(`blender-${b.kind}-exterior`), { names: outside.names });
      }
      if (b.kind === 'farm') check('farm-approved-exterior-still-present', outside.names.includes('blender-farm-exterior'), { names: outside.names });
      result.fallback.push({ kind: b.kind, building: b, outside, inside }); flush();
      if (b.kind === 'hall') await capture('representative-hall-fallback.png');
    }
    for (const name of [...Object.keys(furnitureCounts).map(k => `interior-${k}`), 'notice', 'board']) {
      const assetPath = `/art/lanternwood/${name}.glb`;
      check(`${name}-requested-aborted-and-failed`, result.assets.some(a => a.event === 'aborted' && a.path === assetPath) && result.assets.some(a => a.event === 'failed' && a.path === assetPath));
    }
    for (const b of buildings) {
      const sites = await page.evaluate(b => {
        const q = window.__fallbackQA, w = window.__ember.getWorld();
        const rejected = { tx: b.tx, ty: b.ty, error: q.siteError(w, b.kind, b.tx, b.ty) };
        if (/already stands/.test(rejected.error || '')) return { rejected, approved: null, candidates: 1, validStatus: 'unreachable-with-unchanged-world', reason: rejected.error };
        let approved = null, candidates = 0;
        for (let z = b.ty - 20; z <= b.ty + 20 && !approved; z++) for (let x = b.tx - 20; x <= b.tx + 20 && !approved; x++) { candidates++; if (!q.siteError(w, b.kind, x, z)) approved = { tx: x, ty: z }; }
        return { rejected, approved, candidates, validStatus: approved ? 'available' : 'not-found-within-bounded-search' };
      }, b);
      const entry = { kind: b.kind, sites, states: [] }; result.ghosts.push(entry); flush();
      for (const [mode, at] of [['invalid', sites.rejected], ['valid', sites.approved]]) {
        if (!at) { entry.states.push({ mode, status: 'unreachable', reason: sites.reason || sites.validStatus, rendered: false }); flush(); continue; }
        await position(at.tx, at.ty);
        await page.evaluate(({ kind, at }) => window.__ember.useGame.setState({ buildKind: kind, buildAt: { tx: at.tx, ty: at.ty } }), { kind: b.kind, at }); await settle();
        const ghost = await page.evaluate(({ kind, at }) => {
          const q = window.__fallbackQA, w = window.__ember.getWorld(), error = q.siteError(w, kind, at.tx, at.ty), expectedColor = error ? 'a85a42' : 'c9a36a';
          const spec = q.specs[kind], y0 = q.groundY(w, at.tx, at.ty), matches = [];
          q.state.scene.updateMatrixWorld(true);
          q.state.scene.traverse(o => {
            if (!o.isInstancedMesh || !o.material?.isMeshBasicMaterial || o.material.opacity !== .34 || o.frustumCulled !== false || o.count !== spec.voxels.length) return;
            let exact = true;
            for (let i = 0; i < o.count; i++) { const mat = o.matrix.clone(); o.getMatrixAt(i, mat); const p = o.position.clone().setFromMatrixPosition(mat).applyMatrix4(o.matrixWorld), v = spec.voxels[i]; if (Math.abs(p.x - at.tx - (v.x + .5) * .5) > .001 || Math.abs(p.y - y0 - (v.y + .5) * .5) > .001 || Math.abs(p.z - at.ty - (v.z + .5) * .5) > .001) { exact = false; break; } }
            if (!exact) return;
            let visible = true; for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
            const authored = []; o.parent.traverse(n => { if (/^blender-/.test(n.name)) authored.push(n.name); });
            q.state.camera.updateMatrixWorld(true);
            let viewportCenters = 0;
            for (let i = 0; i < o.count; i++) { const mat = o.matrix.clone(); o.getMatrixAt(i, mat); const p = o.position.clone().setFromMatrixPosition(mat).applyMatrix4(o.matrixWorld).project(q.state.camera); if (Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1) viewportCenters++; }
            const shell = o.parent.children;
            const originalGhostShell = shell.length === 5 && shell.filter(c => c.type === 'LineSegments').length === 1 && shell.filter(c => c.isMesh && !c.isInstancedMesh).length === 3 && !o.parent.__r3f?.handlers?.onPointerDown;
            matches.push({ uuid: o.uuid, count: o.count, exactOriginalTransforms: exact, visible: visible && o.material.colorWrite && o.material.opacity > 0, viewportCenters, originalGhostShell, color: o.material.color.getHexString(), expectedColor, authored, siblingTypes: shell.map(c => c.type) });
          });
          return { error, matches, worldUnchanged: q.before === q.snapshot(), buildingsUnchanged: q.buildings === JSON.stringify(w.buildings) };
        }, { kind: b.kind, at });
        check(`${b.kind}-${mode}-original-GhostAt-renderer`, ghost.matches.length === 1 && ghost.matches[0].visible && ghost.matches[0].viewportCenters > 0 && ghost.matches[0].originalGhostShell && ghost.matches[0].color === ghost.matches[0].expectedColor && ghost.matches[0].authored.length === 0 && (mode === 'invalid' ? !!ghost.error : ghost.error === null), ghost);
        check(`${b.kind}-${mode}-no-world-building-inventory-mutation`, ghost.worldUnchanged && ghost.buildingsUnchanged);
        entry.states.push({ mode, status: 'passed', at, ...ghost }); flush();
        if (b.kind === 'hall' && mode === 'invalid') await capture('representative-hall-original-invalid-ghost.png');
      }
    }
    const restoration = await page.evaluate(() => {
      const q = window.__fallbackQA, w = window.__ember.getWorld(), p = w.people.find(p => p.isPlayer);
      Object.assign(p, q.savedPosition); window.__ember.useGame.setState(q.savedUI);
      return { worldUnchanged: q.before === q.snapshot(), buildingsUnchanged: q.buildings === JSON.stringify(w.buildings) };
    });
    check('restored-position-and-build-state-no-world-mutation', restoration.worldUnchanged && restoration.buildingsUnchanged, restoration);
    check('all-eleven-fallback-and-ghost-records', result.fallback.length === 11 && result.ghosts.length === 11 && new Set(result.ghosts.map(g => g.kind)).size === 11);
    check('no-unexpected-page-console-shader-errors', !result.errors.some(e => e.type === 'pageerror' || (e.type === 'console' && !e.expectedBlockedAsset)), { errors: result.errors });
    check('fixture-file-unchanged', read('public/art/phase1-review-save.json') === fixtureRaw);
    result.acceptanceComplete = result.ghosts.every(g => g.states.some(s => s.mode === 'valid' && s.status === 'passed') && g.states.some(s => s.mode === 'invalid' && s.status === 'passed'));
    result.status = result.acceptanceComplete ? 'passed' : 'partial-valid-placement-unreachable';
    if (!result.acceptanceComplete) process.exitCode = 2;
  }
} catch (e) {
  result.status = 'failed'; result.failure = { message: e.message, stack: e.stack }; process.exitCode = 1;
} finally {
  // Disposal cannot persist fixture/preview edits into a user profile.
  if (browser) await browser.close().catch(e => { result.closeError = e.message; });
  clearTimeout(watchdog);
  result.finished = new Date().toISOString(); flush();
  console.log(JSON.stringify({ status: result.status, acceptanceComplete: result.acceptanceComplete, checks: result.checks.length, failure: result.failure, out }, null, 2));
}
