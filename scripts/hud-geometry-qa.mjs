#!/usr/bin/env node
// Run: node --experimental-strip-types scripts/hud-geometry-qa.mjs http://127.0.0.1:PORT
// QA-only bottom-HUD geometry census (card t_8765b104). Measures DOM rects,
// elementFromPoint hit ownership and AABB overlaps for the combat cluster,
// corner cluster and docked minimap at 1440x960 and 390x844, overworld and
// Emberdeep, map collapsed/open/persisted. NO UI edits, no deploy.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createWorld } from '../src/game/world.ts';
import { encodeSave, SAVE_KEY } from '../src/game/save.ts';
import { EMBERDEEP_ENTRY, EMBERDEEP_EXIT, EMBERDEEP_ROOMS } from '../src/game/emberdeep.ts';
import { COURT } from '../src/game/atlas.ts';
import { HOTBAR_KEY } from '../src/components/game/chrome/hotbar-dock.ts';
import { MINIMAP_DOCK_KEY } from '../src/components/game/chrome/minimap-dock.ts';

const url = process.argv[2] || process.env.HUD_QA_URL;
if (!url) throw new Error('Supply the explicitly allocated dev-server URL; no default shared port.');
const onlyDevice = process.env.HUD_QA_DEVICE || 'both';
const output = resolve(process.env.HUD_QA_OUTPUT_DIR || 'screenshots/hud-geometry-qa');
mkdirSync(output, { recursive: true });

// Hydration gate: React fiber marker on a live DOM node, never text visibility.
const FIBER_READY = () => {
  const all = document.querySelectorAll('body *');
  for (let i = 0; i < Math.min(all.length, 300); i++) {
    if (Object.keys(all[i]).some((k) => k.startsWith('__reactFiber$'))) return true;
  }
  return false;
};

const PINS = {
  six: ['sword', 'pick', 'torch', 'potion_heal', 'cabbage', 'log'],
  two: ['sword', 'pick'],
  none: [],
};

function makeFixture(at) {
  const w = createWorld(41);
  const p = w.people.find((x) => x.isPlayer);
  p.x = at.tx; p.z = at.ty; p.path = [];
  // Geometry fixture only: durable veteran so nothing dies mid-measurement.
  p.hp = p.maxHp = 5000;
  w.player.wear.main = 'sword';
  w.player.skills.swords = 100;
  w.player.skills.anatomy = 100;
  w.speed = 0;
  return encodeSave(w);
}
const FIXTURE_OW = makeFixture({ tx: COURT.tx, ty: COURT.ty + 1 });

const CENSUS = () => {
  const rect = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), right: +b.right.toFixed(1), bottom: +b.bottom.toFixed(1) };
  };
  const owner = (el) => {
    if (!el) return null;
    const t = el.closest('[data-testid]');
    return { testid: t ? t.getAttribute('data-testid') : null, tag: el.tagName, aria: el.getAttribute('aria-label') };
  };
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const hit = (r) => { const c = center(r); return owner(document.elementFromPoint(c.x, c.y)); };
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  const root = q('.classic-ui');
  const out = {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    cornerClear: root ? getComputedStyle(root).getPropertyValue('--corner-clear').trim() : null,
    region: window.__ember.useGame.getState().snap.region,
    mapOpen: !!q('[data-testid="docked-minimap"]'),
    combatCluster: rect(q('[data-testid="combat-cluster"]')),
    orbHealth: rect(q('[data-testid="orb-health"]')),
    orbMana: rect(q('[data-testid="orb-mana"]')),
    techniqueBar: rect(q('[data-testid="technique-bar"]')),
    hotbar: rect(q('[data-testid="hotbar"]')),
    cornerCluster: rect(q('[data-testid="corner-cluster"]')),
    dockedMinimap: rect(q('[data-testid="docked-minimap"]')),
    rightRail: rect(q('[data-testid="right-rail"]')),
    travelCard: rect(q('[data-testid="emberdeep-travel"]')),
  };
  out.orbHealthHit = out.orbHealth ? hit(out.orbHealth) : null;
  out.orbManaHit = out.orbMana ? hit(out.orbMana) : null;
  const buttons = (sel) => qa(sel).map((el) => { const r = rect(el); return { aria: el.getAttribute('aria-label'), rect: r, hit: hit(r) }; });
  out.techniqueChips = buttons('[data-testid="technique-bar"] button');
  out.hotbarSlots = qa('[data-testid="hotbar"] > *').map((el) => { const r = rect(el); return { aria: el.getAttribute('aria-label'), tag: el.tagName, rect: r, hit: hit(r) }; });
  out.cornerButtons = buttons('[data-testid="corner-cluster"] button');
  const mm = q('[data-testid="docked-minimap"]');
  if (mm) {
    const hide = mm.querySelector('button');
    out.minimapHideButton = { rect: rect(hide), hit: hit(rect(hide)) };
    out.minimapCanvas = rect(mm.querySelector('canvas'));
    out.minimapCenterHit = hit(out.dockedMinimap);
    const r = out.dockedMinimap;
    out.minimapViewportClip = { left: r.x < 0, top: r.y < 0, right: r.right > out.viewport.w + 0.5, bottom: r.bottom > out.viewport.h + 0.5 };
    out.minimapFlush = { right: Math.abs(r.right - out.viewport.w) < 1, bottom: Math.abs(r.bottom - out.viewport.h) < 1 };
  }
  const tb = q('[data-testid="emberdeep-travel"] button');
  if (tb) out.travelButton = { rect: rect(tb), hit: hit(rect(tb)) };
  return out;
};

function overlap(a, b) {
  if (!a || !b) return null;
  const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return null;
  return { w: +w.toFixed(1), h: +h.toFixed(1), area: +(w * h).toFixed(1) };
}

function analyze(c) {
  const cc = c.cornerCluster;
  const findings = [];
  const pairs = [
    ['combat-cluster', c.combatCluster], ['hotbar', c.hotbar], ['technique-bar', c.techniqueBar],
    ['orb-health', c.orbHealth], ['orb-mana', c.orbMana], ['docked-minimap', c.dockedMinimap],
    ['travel-card', c.travelCard],
  ];
  for (const [name, r] of pairs) {
    const o = overlap(r, cc);
    if (o) findings.push({ kind: 'aabb-overlap', a: name, b: 'corner-cluster', ...o });
  }
  c.hotbarSlots.forEach((s, i) => {
    const o = overlap(s.rect, cc);
    if (o) findings.push({ kind: 'aabb-overlap', a: `hotbar-slot-${i}`, b: 'corner-cluster', ...o });
    if (s.hit && s.hit.testid !== 'hotbar') findings.push({ kind: 'hit-stolen', target: `hotbar-slot-${i}`, aria: s.aria, owner: s.hit });
  });
  c.techniqueChips.forEach((s, i) => {
    const o = overlap(s.rect, cc);
    if (o) findings.push({ kind: 'aabb-overlap', a: `technique-chip-${i}`, b: 'corner-cluster', ...o });
    if (s.hit && s.hit.testid !== 'technique-bar') findings.push({ kind: 'hit-stolen', target: `technique-chip-${i}`, aria: s.aria, owner: s.hit });
  });
  for (const [name, r, h] of [['orb-health', c.orbHealth, c.orbHealthHit], ['orb-mana', c.orbMana, c.orbManaHit]]) {
    if (h && h.testid !== name) findings.push({ kind: 'hit-stolen', target: name, owner: h });
  }
  if (c.travelButton && c.travelButton.hit && c.travelButton.hit.testid !== 'emberdeep-travel') {
    findings.push({ kind: 'hit-stolen', target: 'travel-button', owner: c.travelButton.hit });
  }
  if (c.dockedMinimap) {
    const clip = c.minimapViewportClip;
    if (clip.left || clip.top || clip.right || clip.bottom) findings.push({ kind: 'minimap-viewport-clip', clip });
    if (c.minimapHideButton.hit && c.minimapHideButton.hit.testid !== 'docked-minimap') findings.push({ kind: 'hit-stolen', target: 'minimap-hide', owner: c.minimapHideButton.hit });
    if (c.minimapCenterHit && c.minimapCenterHit.testid !== 'docked-minimap') findings.push({ kind: 'hit-stolen', target: 'minimap-center', owner: c.minimapCenterHit });
  }
  return findings;
}

const report = { url, base: 'main f083a96 (worktree wt/t_8765b104)', scope: 'Bottom-HUD geometry + hit-target census. 5000-HP sword veteran fixture (geometry only, not balance). Overworld at COURT; Emberdeep via native Enter click then staged at Threshold Hall. No UI edits.', cases: [], errors: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    if (onlyDevice !== 'both' && onlyDevice !== device) continue;
    const context = await browser.newContext({ viewport, hasTouch: device === 'mobile' });
    await context.routeWebSocket(/.*/, () => {});
    // Throwaway warmup page: compile the module graph / warm shaders before real passes.
    const warm = await context.newPage();
    const warmTarget = new URL(url); warmTarget.searchParams.set('qa', '1');
    await warm.goto(warmTarget.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warm.waitForFunction(FIBER_READY, undefined, { timeout: 90000 });
    await warm.waitForFunction(() => !!window.__ember, undefined, { timeout: 60000 });
    await warm.close();
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(`${device}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${device}: ${m.text()}`); });
    const target = new URL(url); target.searchParams.set('qa', '1');

    const load = async (pins, dockFlag) => {
      await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(FIBER_READY, undefined, { timeout: 90000 });
      await page.evaluate(({ save, hotbar, dock, raw }) => {
        localStorage.setItem(save, raw);
        localStorage.setItem(hotbar.key, JSON.stringify(hotbar.ids));
        if (dock === null) localStorage.removeItem(dock.key); else localStorage.setItem(dock.key, dock.flag);
      }, { save: SAVE_KEY, hotbar: { key: HOTBAR_KEY, ids: PINS[pins] }, dock: { key: MINIMAP_DOCK_KEY, flag: dockFlag }, raw: FIXTURE_OW });
      await page.reload();
      await page.waitForFunction(FIBER_READY, undefined, { timeout: 90000 });
      // Continue via dispatched click (never actionability-gated under SwiftShader), with retries.
      let playing = false;
      for (let i = 0; i < 10 && !playing; i++) {
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === 'Continue');
          if (b) b.click();
        });
        playing = await page.waitForFunction(() => window.__ember?.useGame.getState().phase === 'playing', undefined, { timeout: 15000 }).then(() => true).catch(() => false);
      }
      if (!playing) throw new Error(`${device}: never reached playing after Continue`);
      await page.evaluate(() => { const s = window.__ember.useGame.getState(); s.speed(0); s.setPanel('none'); s.closeCtx(); });
      await page.waitForFunction(() => !!document.querySelector('[data-testid="combat-cluster"]'), undefined, { timeout: 30000 });
      await page.waitForTimeout(800);
    };
    const census = async (name) => {
      await page.waitForTimeout(400);
      const c = await page.evaluate(CENSUS);
      const findings = analyze(c);
      const shot = resolve(output, `${device}-${name}.png`);
      await page.screenshot({ path: shot });
      const entry = { device, name, census: c, findings, screenshot: shot };
      report.cases.push(entry);
      console.log(`[census] ${device}-${name}: mapOpen=${c.mapOpen} cornerClear=${c.cornerClear} findings=${findings.length}`);
      return entry;
    };
    const toggleMap = async () => {
      await page.evaluate(() => { const b = document.querySelectorAll('[data-testid="corner-cluster"] button'); b[b.length - 1].click(); });
      await page.waitForTimeout(400);
    };
    const stage = async (tx, ty) => {
      await page.evaluate(({ tx, ty }) => {
        const s = window.__ember.useGame.getState();
        const w = window.__ember.getWorld();
        const p = w.people.find((x) => x.isPlayer);
        p.x = tx; p.z = ty; p.path = []; p.intent = null;
        s.speed(1);
        for (let i = 0; i < 20; i++) s.tick(0.05);
        s.speed(0);
      }, { tx, ty });
      await page.waitForTimeout(1300);
    };
    const enterDungeon = async () => {
      await stage(EMBERDEEP_ENTRY.tx, EMBERDEEP_ENTRY.ty);
      await page.waitForFunction(() => !!document.querySelector('[data-testid="emberdeep-travel"] button'), undefined, { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-testid="emberdeep-travel"] button').click());
      await page.waitForFunction(() => window.__ember.useGame.getState().snap.region.includes('Emberdeep'), undefined, { timeout: 20000 });
      await stage(EMBERDEEP_ROOMS[0].tx, EMBERDEEP_ROOMS[0].ty);
    };

    const defaultDock = device === 'mobile' ? '1' : '0';
    const toggledDock = device === 'mobile' ? '0' : '1';

    // Phase A: six pins (worst-case hotbar width), default + toggled map, both regions.
    await load('six', defaultDock);
    await census('six-ow-default');
    await toggleMap(); await census('six-ow-toggled');
    await toggleMap();
    await enterDungeon();
    await census('six-dd-default');
    await toggleMap(); await census('six-dd-toggled');
    await toggleMap();

    // Phase B: two pins, overworld only (HUD chrome is region-independent; dungeon covered at six/none).
    await load('two', defaultDock);
    await census('two-ow-default');
    await toggleMap(); await census('two-ow-toggled');

    // Phase C: no pins (parent-screenshot state: technique chips, no hotbar), both regions.
    await load('none', defaultDock);
    await census('none-ow-default');
    await toggleMap(); await census('none-ow-toggled');
    await toggleMap();
    await enterDungeon();
    await census('none-dd-default');
    await toggleMap(); await census('none-dd-toggled');
    await toggleMap();

    // Phase D: persisted dock flag honored on fresh load + travel-card proximity case.
    await load('none', toggledDock);
    await census('persisted-load');
    await stage(EMBERDEEP_ENTRY.tx, EMBERDEEP_ENTRY.ty);
    await census('stair-proximity-mapopen');
    await toggleMap();
    await census('stair-proximity-mapcollapsed');

    await context.close();
  }
  report.passed = report.errors.length === 0;
} catch (e) {
  report.passed = false;
  report.errors.push(String(e && e.stack || e));
} finally {
  if (browser) await browser.close();
  writeFileSync(resolve(output, `verdict-${onlyDevice}.json`), JSON.stringify(report, null, 2));
  console.log(`verdict: ${resolve(output, `verdict-${onlyDevice}.json`)} cases=${report.cases.length} errors=${report.errors.length}`);
}
