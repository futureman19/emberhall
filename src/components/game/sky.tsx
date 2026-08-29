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
import { rainRate } from "@/game/weather";
import { skyFlash, sunDirFor } from "./sky-math";

const N_BIRD = 16;
const dummy = new THREE.Object3D();
const OVERCAST_SKY = new THREE.Color("#767e78");
const FLASH_SKY = new THREE.Color("#e4e8ee");

function chevron() {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array([
    0, 0, 0.12, -0.42, 0, -0.08, -0.34, 0, -0.2, 0, 0, 0.12, 0.42, 0, -0.08, 0.34, 0, -0.2,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#b8c6c8") },
      uMid: { value: new THREE.Color("#8fa89c") },
      uHorizon: { value: new THREE.Color("#6a7a5c") },
      uSun: { value: new THREE.Color("#f2d48a") },
      uSunDir: { value: sunDirFor(12) },
      uGlow: { value: 1 },
    }),
    [],
  );

  useFrame(() => {
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
    const cloud = pit ? 0 : (w.weather?.cloud ?? 0);
    const u = uniforms;
    u.uSunDir.value.copy(sunDirFor(w.hour));
    u.uGlow.value = pit ? 0 : night ? 0.08 : dusk ? 0.7 : 1;
    u.uGlow.value *= 1 - cloud * 0.85;
    if (skyFlash.v > 0.01) u.uGlow.value += skyFlash.v * 1.6;
    if (pit) {
      u.uZenith.value.set("#0c0a08");
      u.uMid.value.set("#0c0a08");
      u.uHorizon.value.set("#0c0a08");
      u.uSun.value.set("#0c0a08");
    } else if (night) {
      u.uZenith.value.set("#1a2230");
      u.uMid.value.set("#141820");
      u.uHorizon.value.set("#1a1814");
      u.uSun.value.set("#9aa8c4");
    } else if (dusk) {
      u.uZenith.value.set("#c4a890");
      u.uMid.value.set("#8a6848");
      u.uHorizon.value.set("#6a4a32");
      u.uSun.value.set("#e0a060");
    } else if (climate === "desert") {
      u.uZenith.value.set("#d8c8a8");
      u.uMid.value.set("#c4a878");
      u.uHorizon.value.set("#a89068");
      u.uSun.value.set("#f0d090");
    } else if (climate === "tundra") {
      u.uZenith.value.set("#c8d0d4");
      u.uMid.value.set("#8a9690");
      u.uHorizon.value.set("#7a8278");
      u.uSun.value.set("#e8e4d8");
    } else if (climate === "taiga") {
      u.uZenith.value.set("#9aaca8");
      u.uMid.value.set("#4a5a4c");
      u.uHorizon.value.set("#3a4a3c");
      u.uSun.value.set("#e8d8a8");
    } else if (climate === "jungle") {
      u.uZenith.value.set("#9ab4a8");
      u.uMid.value.set("#4e6350");
      u.uHorizon.value.set("#3a4a38");
      u.uSun.value.set("#e8d090");
    } else if (climate === "fen") {
      u.uZenith.value.set("#a8b8b0");
      u.uMid.value.set("#5e6c58");
      u.uHorizon.value.set("#4a5848");
      u.uSun.value.set("#e8d8a0");
    } else {
      u.uZenith.value.set("#b8c6c8");
      u.uMid.value.set("#8fa89c");
      u.uHorizon.value.set("#6a7a5c");
      u.uSun.value.set("#f2d48a");
    }
    if (!pit && !night && cloud > 0.01) {
      const dim = cloud * 0.55;
      u.uZenith.value.lerp(OVERCAST_SKY, dim);
      u.uMid.value.lerp(OVERCAST_SKY, dim * 0.9);
      u.uHorizon.value.lerp(OVERCAST_SKY, dim * 0.8);
    }
    if (!pit && skyFlash.v > 0.01) {
      const f = skyFlash.v * 0.5;
      u.uZenith.value.lerp(FLASH_SKY, f);
      u.uMid.value.lerp(FLASH_SKY, f);
      u.uHorizon.value.lerp(FLASH_SKY, f);
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
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform float uGlow;
varying vec3 vN;

void main() {
  float h = clamp(vN.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.4, 0.62, h));
  c = mix(c, uZenith, smoothstep(0.58, 0.94, h));
  float mu = max(dot(normalize(vN), normalize(uSunDir)), 0.0);
  float core = pow(mu, 48.0);
  float halo = pow(mu, 6.0);
  float wash = pow(mu, 1.6);
  c += uSun * (core * 1.15 + halo * 0.28 + wash * 0.1) * uGlow;
  float hz = 1.0 - smoothstep(0.38, 0.72, h);
  c = mix(c, mix(uHorizon, uSun, wash * 0.45), hz * 0.32 * uGlow);
  gl_FragColor = vec4(c, 1.0);
}
`}
      />
    </mesh>
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
    m.visible = !pit && !night && rainRate(w) < 0.2;
    const t = clock.getElapsedTime();
    for (let i = 0; i < N_BIRD; i++) {
      const b = stock[i]!;
      const a = t * b.w + b.ph;
      dummy.position.set(
        px + b.ox + Math.cos(a) * b.r,
        py + b.h + Math.sin(a * 3.2) * 0.55,
        pz + b.oz + Math.sin(a) * b.r,
      );
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
      <Birds />
    </group>
  );
}
