export function mulberry32(a: number) {
  return function rng() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function irange(rng: () => number, a: number, b: number) {
  return a + Math.floor(rng() * (b - a + 1));
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function hash2(x: number, y: number, seed: number) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.001) * 43758.5453;
  return n - Math.floor(n);
}
