import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, inGreybarrow } from "@/game/atlas";
import { biomeAt } from "@/game/biome";
import { DEV_DAYLIGHT } from "@/game/debug";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { hash2 } from "@/game/rng";
import { useGame } from "@/game/store";

const N_CARD = 12;
const N_BIRD = 16;
const dummy = new THREE.Object3D();

function chevron() {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array([
    0, 0, 0.12, -0.42, 0, -0.08, -0.34, 0, -0.2, 0, 0, 0.12, 0.42, 0, -0.08, 0.34, 0, -0.2,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

function fade3(t: number) {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade3(x - x0);
  const fy = fade3(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm2(x: number, y: number, seed: number) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x * f, y * f, seed + i * 19);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

function makeCloudCard() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const img = ctx.createImageData(s, s);
  const data = img.data;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const v = y / s;
      const d = Math.hypot((u - 0.5) * 1.15, (v - 0.52) * 1.45);
      const n = fbm2(u * 4.2, v * 3.1, 11);
      const n2 = fbm2(u * 8.4 + 3, v * 6.2, 23);
      let a = (n * 0.68 + n2 * 0.32) * (1 - d * d);
      a = Math.max(0, Math.min(1, (a - 0.16) * 1.9));
      const i = (y * s + x) * 4;
      const w = 0.88 + n * 0.12;
      data[i] = Math.floor(242 * w);
      data[i + 1] = Math.floor(236 * w);
      data[i + 2] = Math.floor(226 * w);
      data[i + 3] = Math.floor(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#c5d0c4") },
      uMid: { value: new THREE.Color("#8b9e95") },
      uHorizon: { value: new THREE.Color("#6a7a5c") },
      uCloud: { value: new THREE.Color("#f0ebe3") },
      uCover: { value: 1 },
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const w = getWorld();
    const p = w.people.find((x) => x.isPlayer);
    const px = p?.x ?? COURT.tx;
    const pz = p?.z ?? COURT.ty;
    const py = p ? groundY(w, p.x, p.z) : 0;
    if (mesh.current) mesh.current.position.set(px, py, pz);
    const pit = Boolean(p && inGreybarrow(Math.round(p.x), Math.round(p.z)));
    const sight = (w.player.nightSightUntil ?? 0) > w.hour;
    const night = !DEV_DAYLIGHT && useGame.getState().snap.isNight && !sight;
    const dusk = !DEV_DAYLIGHT && useGame.getState().snap.isDusk && !sight;
    const climate = biomeAt(Math.round(px), Math.round(pz));
    const u = uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uCover.value = pit ? 0 : night ? 0.12 : dusk ? 0.55 : 1;
    if (pit) {
      u.uZenith.value.set("#0c0a08");
      u.uMid.value.set("#0c0a08");
      u.uHorizon.value.set("#0c0a08");
    } else if (night) {
      u.uZenith.value.set("#1a1e28");
      u.uMid.value.set("#141210");
      u.uHorizon.value.set("#1a1814");
    } else if (dusk) {
      u.uZenith.value.set("#c4a078");
      u.uMid.value.set("#8a6848");
      u.uHorizon.value.set("#6a4a32");
    } else if (climate === "desert") {
      u.uZenith.value.set("#e4d4b0");
      u.uMid.value.set("#c4a878");
      u.uHorizon.value.set("#a89068");
    } else if (climate === "tundra") {
      u.uZenith.value.set("#d0d4d0");
      u.uMid.value.set("#8a9690");
      u.uHorizon.value.set("#7a8278");
    } else if (climate === "taiga") {
      u.uZenith.value.set("#9aaa98");
      u.uMid.value.set("#4a5a4c");
      u.uHorizon.value.set("#3a4a3c");
    } else if (climate === "jungle") {
      u.uZenith.value.set("#9ab098");
      u.uMid.value.set("#4e6350");
      u.uHorizon.value.set("#3a4a38");
    } else if (climate === "fen") {
      u.uZenith.value.set("#a8b4a0");
      u.uMid.value.set("#5e6c58");
      u.uHorizon.value.set("#4a5848");
    } else {
      u.uZenith.value.set("#c5d0c4");
      u.uMid.value.set("#8b9e95");
      u.uHorizon.value.set("#6a7a5c");
    }
  });

  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-20} raycast={() => {}}>
      <sphereGeometry args={[400, 32, 20]} />
      <shaderMaterial
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        vertexShader={`
varying vec3 vN;
void main() {
  vN = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`}
        fragmentShader={`
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform float uCover;
uniform float uTime;
varying vec3 vN;

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

void main() {
  float h = clamp(vN.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.42, 0.62, h));
  c = mix(c, uZenith, smoothstep(0.62, 0.92, h));
  float az = atan(vN.z, vN.x);
  vec2 uv = vec2(az * 0.42, h * 2.2) + vec2(uTime * 0.007, 0.0);
  float banks = fbm(uv * 1.05);
  float wisp = fbm(uv * 2.6 + 9.0);
  float band = smoothstep(0.5, 0.6, h) * (1.0 - smoothstep(0.8, 0.97, h));
  float cloud = smoothstep(0.4, 0.64, banks) * 0.72 + smoothstep(0.52, 0.74, wisp) * 0.38;
  cloud *= band * uCover;
  vec3 puff = mix(uCloud * 0.78, uCloud, smoothstep(0.42, 0.78, banks));
  c = mix(c, puff, clamp(cloud, 0.0, 0.82));
  gl_FragColor = vec4(c, 1.0);
}
`}
      />
    </mesh>
  );
}

function CloudCards() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => makeCloudCard(), []);
  const stock = useMemo(
    () =>
      Array.from({ length: N_CARD }, (_, i) => {
        const a = (i / N_CARD) * Math.PI * 2 + hash2(i, 2, 11) * 0.4;
        return {
          a,
          r: 210 + hash2(i, 5, 13) * 70,
          y: 52 + hash2(i, 8, 17) * 28,
          sx: 38 + hash2(i, 3, 19) * 32,
          sy: 16 + hash2(i, 4, 23) * 12,
          v: 0.012 + hash2(i, 7, 29) * 0.02,
        };
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const m = mesh.current;
    if (!m) return;
    const w = getWorld();
    const p = w.people.find((x) => x.isPlayer);
    const px = p?.x ?? COURT.tx;
    const pz = p?.z ?? COURT.ty;
    const py = p ? groundY(w, p.x, p.z) : 0;
    const pit = Boolean(p && inGreybarrow(Math.round(p.x), Math.round(p.z)));
    const sight = (w.player.nightSightUntil ?? 0) > w.hour;
    const night = !DEV_DAYLIGHT && useGame.getState().snap.isNight && !sight;
    m.visible = !pit;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = night ? 0.16 : 0.88;
    const t = clock.getElapsedTime();
    for (let i = 0; i < N_CARD; i++) {
      const c = stock[i]!;
      const a = c.a + t * c.v;
      const x = px + Math.cos(a) * c.r;
      const z = pz + Math.sin(a) * c.r;
      const y = py + c.y;
      const near = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z);
      dummy.position.set(x, y, z);
      dummy.lookAt(camera.position);
      const hide = near < 140 ? 0.01 : 1;
      dummy.scale.set(c.sx * hide, c.sy * hide, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N_CARD]} frustumCulled={false} raycast={() => {}} renderOrder={-12}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        fog={false}
        toneMapped={false}
        opacity={0.88}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function Birds() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => chevron(), []);
  const stock = useMemo(
    () =>
      Array.from({ length: N_BIRD }, (_, i) => ({
        r: 42 + hash2(i, 1, 3) * 70,
        h: 14 + hash2(i, 2, 5) * 16,
        s: 0.85 + hash2(i, 3, 7) * 0.9,
        w: 0.18 + hash2(i, 4, 11) * 0.28,
        ph: hash2(i, 5, 13) * Math.PI * 2,
        ox: (hash2(i, 6, 17) - 0.5) * 40,
        oz: (hash2(i, 7, 19) - 0.5) * 40,
      })),
    [],
  );

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const w = getWorld();
    const p = w.people.find((x) => x.isPlayer);
    const px = p?.x ?? COURT.tx;
    const pz = p?.z ?? COURT.ty;
    const py = p ? groundY(w, p.x, p.z) : 0;
    const pit = Boolean(p && inGreybarrow(Math.round(p.x), Math.round(p.z)));
    const sight = (w.player.nightSightUntil ?? 0) > w.hour;
    const night = !DEV_DAYLIGHT && useGame.getState().snap.isNight && !sight;
    m.visible = !pit && !night;
    const t = clock.getElapsedTime();
    for (let i = 0; i < N_BIRD; i++) {
      const b = stock[i]!;
      const a = t * b.w + b.ph;
      const x = px + b.ox + Math.cos(a) * b.r;
      const z = pz + b.oz + Math.sin(a) * b.r;
      const y = py + b.h + Math.sin(a * 3.2) * 0.55;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, -a + Math.PI * 0.5, Math.sin(t * 8 + b.ph) * 0.28);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, N_BIRD]} frustumCulled={false} raycast={() => {}}>
      <meshBasicMaterial color="#2a2824" fog={false} toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

export function Sky() {
  return (
    <group>
      <SkyDome />
      <CloudCards />
      <Birds />
    </group>
  );
}
