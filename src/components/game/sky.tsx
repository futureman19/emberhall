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
import { skyFlash, skyTone, sunDirFor } from "./sky-math";

const N_BIRD = 16;
const dummy = new THREE.Object3D();
const OVERCAST_SKY = new THREE.Color("#7c837d");
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
      uZenith: { value: new THREE.Color("#7ea9d4") },
      uMid: { value: new THREE.Color("#a9c6dd") },
      uHorizon: { value: new THREE.Color("#e6ebe3") },
      uHaze: { value: new THREE.Color("#c2cbbd") },
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
      u.uHaze.value.set("#0c0a08");
      u.uSun.value.set("#0c0a08");
    } else if (night) {
      u.uZenith.value.set("#16202e");
      u.uMid.value.set("#10161f");
      u.uHorizon.value.set("#1c2020");
      u.uHaze.value.set("#14161a");
      u.uSun.value.set("#9aa8c4");
    } else if (dusk) {
      u.uZenith.value.set("#8a7a94");
      u.uMid.value.set("#c09068");
      u.uHorizon.value.set("#e0b078");
      u.uHaze.value.set("#a8846a");
      u.uSun.value.set("#e0a060");
    } else if (climate === "desert") {
      u.uZenith.value.set("#9fbdd4");
      u.uMid.value.set("#d8cbaa");
      u.uHorizon.value.set("#f0e2ba");
      u.uHaze.value.set("#ddcfa8");
      u.uSun.value.set("#f0d090");
    } else if (climate === "tundra") {
      u.uZenith.value.set("#aec6d6");
      u.uMid.value.set("#cdd9de");
      u.uHorizon.value.set("#eef0ea");
      u.uHaze.value.set("#d4d9d2");
      u.uSun.value.set("#e8e4d8");
    } else if (climate === "taiga") {
      u.uZenith.value.set("#86aec4");
      u.uMid.value.set("#b4c8cc");
      u.uHorizon.value.set("#dbe4d6");
      u.uHaze.value.set("#b6c2b0");
      u.uSun.value.set("#e8d8a8");
    } else if (climate === "jungle") {
      u.uZenith.value.set("#8ab8c0");
      u.uMid.value.set("#b6ccc2");
      u.uHorizon.value.set("#dde6d2");
      u.uHaze.value.set("#b9c6ac");
      u.uSun.value.set("#e8d090");
    } else if (climate === "fen") {
      u.uZenith.value.set("#9cb8c2");
      u.uMid.value.set("#bccbc4");
      u.uHorizon.value.set("#dfe4d4");
      u.uHaze.value.set("#b7c0ae");
      u.uSun.value.set("#e8d8a0");
    } else {
      u.uZenith.value.set("#7ea9d4");
      u.uMid.value.set("#a9c6dd");
      u.uHorizon.value.set("#e6ebe3");
      u.uHaze.value.set("#c2cbbd");
      u.uSun.value.set("#f2d48a");
    }
    if (!pit && !night && cloud > 0.01) {
      const dim = cloud * 0.55;
      u.uZenith.value.lerp(OVERCAST_SKY, dim);
      u.uMid.value.lerp(OVERCAST_SKY, dim * 0.9);
      u.uHorizon.value.lerp(OVERCAST_SKY, dim * 0.8);
      u.uHaze.value.lerp(OVERCAST_SKY, dim * 0.8);
    }
    if (!pit && skyFlash.v > 0.01) {
      const f = skyFlash.v * 0.5;
      u.uZenith.value.lerp(FLASH_SKY, f);
      u.uMid.value.lerp(FLASH_SKY, f);
      u.uHorizon.value.lerp(FLASH_SKY, f);
      u.uHaze.value.lerp(FLASH_SKY, f);
    }
    // Publish what the heavens settled on so background and fog match exactly.
    skyTone.horizon.copy(u.uHorizon.value);
    skyTone.haze.copy(u.uHaze.value);
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
uniform vec3 uHaze;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform float uGlow;
varying vec3 vN;

void main() {
  // Anchored on the true horizon (y = 0): a down-tilted camera mostly sees
  // the lower dome, so below the horizon melts into distance haze instead
  // of a flat green wall.
  float y = normalize(vN).y;
  vec3 c = mix(uHorizon, uMid, smoothstep(0.03, 0.30, y));
  c = mix(c, uZenith, smoothstep(0.26, 0.72, y));
  float mu = max(dot(normalize(vN), normalize(uSunDir)), 0.0);
  float core = pow(mu, 48.0);
  float halo = pow(mu, 6.0);
  float wash = pow(mu, 1.6);
  c += uSun * (core * 1.15 + halo * 0.28 + wash * 0.1) * uGlow;
  float hz = 1.0 - smoothstep(0.0, 0.34, abs(y));
  c = mix(c, mix(uHorizon, uSun, wash * 0.45), hz * 0.32 * uGlow);
  c = mix(c, uHaze, smoothstep(-0.05, -0.5, y));
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
