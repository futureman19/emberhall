// Read-only prerequisite audit. Never generates tokens or prints credentials.
// Usage: node scripts/phase4-onboarding-preflight.mjs [http://127.0.0.1:11434/v1]
// Exit 2 means prerequisites remain unverified; exit 0 is NOT acceptance.
import { execFileSync } from 'node:child_process';
const names = ['TYPESAFE_API_KEY', 'EMBERHALL_SECRET_KEY', 'EMBERHALL_DEFAULT_MODEL', 'OPENAI_API_KEY', 'EMBERHALL_MIND_PRIVATE_ORIGINS'];
const present = Object.fromEntries(names.map(name => [name, Boolean(process.env[name])]));
const result = {
  checkedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environmentPresent: present,
  protectionKeyValid: /^[a-fA-F0-9]{64}$/.test(process.env.EMBERHALL_SECRET_KEY ?? ''),
  localModels: { checked: false, reachable: false, count: 0 },
  paidTraffic: false,
  generationRequests: 0,
  spendAuthorization: 'Requires explicit owner approval; never inferred from environment',
  liveReflexVerified: false,
  onboardingSeconds: null,
  acceptance: 'NOT_RUN',
};
if (process.argv[2]) {
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error('Supply only a credential-free loopback HTTP API base');
  }
  result.localModels.checked = true;
  try {
    const response = await fetch(`${url.href.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    result.localModels.httpStatus = response.status;
    if (response.ok) {
      const body = await response.json();
      result.localModels.reachable = true;
      result.localModels.count = Array.isArray(body.data) ? body.data.length : 0;
    }
  } catch { result.localModels.error = 'Model listing unavailable'; }
}
console.log(JSON.stringify(result, null, 2));
// No provider-generation probe or live clock is performed by this script.
process.exitCode = 2;
