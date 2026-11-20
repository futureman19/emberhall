import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

test('release lint covers this checkout, not nested independent worktrees', async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored('.worktrees/example/src/game/world.ts'), true);
  assert.equal(await eslint.isPathIgnored('src/game/world.ts'), false);
  assert.equal(await eslint.isPathIgnored('scripts/emberdeep-smoke.mjs'), false);
});
