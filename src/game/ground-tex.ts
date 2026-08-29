import * as THREE from "three";

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function hash2(ix: number, iy: number, seed: number, period: number) {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, period: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const ux = fade(x - x0);
  const uy = fade(y - y0);
  const a = hash2(x0, y0, seed, period);
  const b = hash2(x0 + 1, y0, seed, period);
  const c = hash2(x0, y0 + 1, seed, period);
  const d = hash2(x0 + 1, y0 + 1, seed, period);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, cells: number, seed: number) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x * f, y * f, cells * f, seed + i * 19);
    s += a;
    a *= 0.5;
    f *= 2;
  }
  return v / s;
}

function makeTex(size: number, paint: (u: number, v: number) => [number, number, number]) {
  const data = new Uint8Array(size * size * 4);
  const cells = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint((x / size) * cells, (y / size) * cells);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function makeGrassTex() {
  return makeTex(512, (u, v) => {
    const w = fbm(u + 2.2, v + 1.4, 8, 3);
    const clump = fbm(u + w * 1.8, v - w * 1.6, 8, 1);
    const patch = fbm(u * 0.5 + 4, v * 0.5, 4, 11);
    const fine = fbm(u * 3.1, v * 3.1, 24, 23);
    let r = 0.2 + clump * 0.22 + fine * 0.05;
    let g = 0.28 + clump * 0.26 - patch * 0.04 + fine * 0.04;
    let b = 0.1 + clump * 0.1;
    if (patch > 0.58) {
      const d = (patch - 0.58) / 0.42;
      r = r * (1 - d) + (0.38 + fine * 0.08) * d;
      g = g * (1 - d) + (0.3 + clump * 0.06) * d;
      b = b * (1 - d) + (0.16 + fine * 0.04) * d;
    }
    return [Math.min(255, r * 255), Math.min(255, g * 255), Math.min(255, b * 255)];
  });
}

export function makeDirtTex() {
  return makeTex(512, (u, v) => {
    const n = fbm(u, v, 8, 31);
    const grit = fbm(u * 4.2, v * 4.2, 32, 41);
    const r = 0.32 + n * 0.22 + grit * 0.08;
    const g = 0.24 + n * 0.14 + grit * 0.04;
    const b = 0.14 + n * 0.08;
    return [Math.min(255, r * 255), Math.min(255, g * 255), Math.min(255, b * 255)];
  });
}

export const GROUND_SHADER = `
varying vec3 vWp;
varying vec3 vCover;
uniform sampler2D uDirt;
uniform vec2 uOrigin;
uniform float uNear;
uniform float uFar;
uniform vec3 uFog;
uniform float uLod;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
`;
