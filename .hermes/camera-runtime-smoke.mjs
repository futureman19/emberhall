import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const smokeUrl = process.env.CAMERA_SMOKE_URL || "http://127.0.0.1:8080/?qa=camera-smoothing";
  await page.goto(smokeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "New hall", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Step into the vale" }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "playing" && Boolean(window.__emberCamera));
  const handoff = await page.evaluate(() => {
    const world = window.__ember.getWorld();
    const state = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    let run = null;
    for (let y = 2; y < world.tiles.length - 2 && !run; y += 1) {
      for (let x = 2; x < world.tiles[y].length - 3; x += 1) {
        const tiles = [world.tiles[y][x], world.tiles[y][x + 1], world.tiles[y][x + 2]];
        if (tiles.every((tile) => !["water", "wall", "rock"].includes(tile.kind))
          && Math.abs(tiles[0].h - tiles[1].h) <= 1
          && Math.abs(tiles[1].h - tiles[2].h) <= 1) {
          run = { x, y };
          break;
        }
      }
    }
    if (!player || !run) throw new Error("waypoint fixture missing");
    player.x = run.x + 0.9;
    player.z = run.y;
    player.path = [{ tx: run.x + 1, ty: run.y }, { tx: run.x + 2, ty: run.y }];
    world.player.intent = { kind: "walk", tx: run.x + 2, ty: run.y, targetId: null, spell: null };
    world.speed = 1;
    const before = player.x;
    state.tick(0.1);
    return { delta: player.x - before, path: player.path.map((node) => ({ ...node })) };
  });
  if (Math.abs(handoff.delta - 0.26) > 1e-8 || handoff.path.length !== 1) {
    throw new Error(`waypoint handoff paused: ${JSON.stringify(handoff)}`);
  }
  const fractionalSegment = await page.evaluate(() => {
    const world = window.__ember.getWorld();
    const state = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("player missing");
    for (let z = 9; z <= 13; z += 1) {
      for (let x = 9; x <= 14; x += 1) {
        world.tiles[z][x].kind = "grass";
        world.tiles[z][x].h = 0;
      }
    }
    world.tiles[10][12].kind = "wall";
    player.x = 10.5408;
    player.z = 10.3606;
    player.path = [{ tx: 13, ty: 12 }];
    world.player.intent = { kind: "walk", tx: 13, ty: 12, targetId: null, spell: null };
    const before = { x: player.x, z: player.z };
    state.tick(0.1);
    return {
      delta: Math.hypot(player.x - before.x, player.z - before.z),
      path: player.path.map((node) => ({ ...node })),
    };
  });
  if (Math.abs(fractionalSegment.delta - 0.26) > 1e-8 || fractionalSegment.path.length !== 1) {
    throw new Error(`fractional segment paused: ${JSON.stringify(fractionalSegment)}`);
  }
  const cornerSegment = await page.evaluate(() => {
    const world = window.__ember.getWorld();
    const state = window.__ember.useGame.getState();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("player missing");
    for (let z = 9; z <= 22; z += 1) {
      for (let x = 9; x <= 13; x += 1) {
        world.tiles[z][x].kind = "grass";
        world.tiles[z][x].h = 0;
      }
    }
    world.tiles[12][11].kind = "wall";
    player.x = 10.4544;
    player.z = 12.499;
    player.path = [{ tx: 12, ty: 21 }];
    world.player.intent = { kind: "walk", tx: 12, ty: 21, targetId: null, spell: null };
    const before = { x: player.x, z: player.z };
    state.tick(0.1);
    return {
      delta: Math.hypot(player.x - before.x, player.z - before.z),
      path: player.path.map((node) => ({ ...node })),
    };
  });
  if (Math.abs(cornerSegment.delta - 0.26) > 1e-8 || cornerSegment.path.length !== 1) {
    throw new Error(`corner segment stuck: ${JSON.stringify(cornerSegment)}`);
  }
  const result = await page.evaluate(async () => {
    const world = window.__ember.getWorld();
    const player = world.people.find((person) => person.isPlayer);
    if (!player) throw new Error("player missing");
    let run = null;
    for (let y = 2; y < world.tiles.length - 2 && !run; y += 1) {
      for (let x = 2; x < world.tiles[y].length - 3; x += 1) {
        const tiles = [world.tiles[y][x], world.tiles[y][x + 1], world.tiles[y][x + 2]];
        if (tiles.every((tile) => !["water", "wall", "rock"].includes(tile.kind))
          && Math.abs(tiles[0].h - tiles[1].h) <= 1
          && Math.abs(tiles[1].h - tiles[2].h) <= 1) {
          run = { x, y };
          break;
        }
      }
    }
    if (!run) throw new Error("walk fixture missing");
    player.x = run.x + 0.1;
    player.z = run.y;
    player.path = [{ tx: run.x + 1, ty: run.y }, { tx: run.x + 2, ty: run.y }];
    world.player.intent = { kind: "walk", tx: run.x + 2, ty: run.y, targetId: null, spell: null };
    world.speed = 1;
    const target = { x: run.x + 2, z: run.y };
    const samples = [];
    const started = performance.now();
    await new Promise((resolve) => {
      const sample = () => {
        samples.push({
          at: performance.now() - started,
          camera: window.__emberCamera.getCamera(),
          focus: window.__emberCamera.getTarget(),
          anchor: window.__emberCamera.getAnchor(),
          player: { x: player.x, z: player.z },
        });
        if (performance.now() - started < 1_200) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    const steps = [];
    for (let index = 1; index < samples.length; index += 1) {
      const before = samples[index - 1].focus;
      const after = samples[index].focus;
      if (before && after) steps.push(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z));
    }
    const moving = steps.filter((step) => step > 1e-5);
    const first = samples[0];
    const last = samples.at(-1);
    const firstOffset = first.focus && first.anchor
      ? { x: first.focus.x - first.anchor.x, y: first.focus.y - first.anchor.y, z: first.focus.z - first.anchor.z }
      : null;
    const lastOffset = last.focus && last.anchor
      ? { x: last.focus.x - last.anchor.x, y: last.focus.y - last.anchor.y, z: last.focus.z - last.anchor.z }
      : null;
    const horizontalLockError = samples.reduce((max, sample) => {
      if (!sample.anchor) return Number.POSITIVE_INFINITY;
      return Math.max(max, Math.hypot(sample.anchor.x - sample.player.x, sample.anchor.z - sample.player.z));
    }, 0);
    const cameraHeights = samples.map((sample) => sample.camera.y);
    const cameraHeightDrift = Math.max(...cameraHeights) - Math.min(...cameraHeights);
    return {
      target,
      sampleCount: samples.length,
      movingFrames: moving.length,
      maxStep: Math.max(...moving),
      averageStep: moving.reduce((sum, step) => sum + step, 0) / moving.length,
      playerDistance: Math.hypot(
        last.player.x - first.player.x,
        last.player.z - first.player.z,
      ),
      panOffsetDrift: firstOffset && lastOffset
        ? Math.hypot(lastOffset.x - firstOffset.x, lastOffset.y - firstOffset.y, lastOffset.z - firstOffset.z)
        : null,
      horizontalLockError,
      cameraHeightDrift,
    };
  });
  console.log(JSON.stringify({ handoff, fractionalSegment, cornerSegment, runtime: result, browserErrors: errors }, null, 2));
  // This CI host renders the full Three.js vale in software and can drop to a
  // few frames per second. Assert continuity on the frames it does produce;
  // refresh-rate invariance is covered by camera-follow.test.ts.
  if (result.sampleCount < 2) throw new Error(`too few frames: ${result.sampleCount}`);
  if (result.movingFrames < 1) throw new Error(`camera target did not move: ${result.movingFrames}`);
  if (result.maxStep > 0.3) throw new Error(`camera jump too large: ${result.maxStep}`);
  if (result.panOffsetDrift === null || result.panOffsetDrift > 1e-6) {
    throw new Error(`camera follow fought controls target: ${result.panOffsetDrift}`);
  }
  if (result.horizontalLockError > 1e-9) {
    throw new Error(`camera did not lock to player X/Z: ${result.horizontalLockError}`);
  }
  if (result.cameraHeightDrift > 1e-9) {
    throw new Error(`terrain moved camera height: ${result.cameraHeightDrift}`);
  }
  if (errors.length) throw new Error(`browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await browser.close();
}
