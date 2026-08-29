import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, inGreybarrow } from "@/game/atlas";
import { DEV_DAYLIGHT } from "@/game/debug";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { hash2 } from "@/game/rng";
import { useGame } from "@/game/store";
import { rainRate } from "@/game/weather";
import { setRainLevel } from "@/game/vale-sfx";

/**
 * Weather you can see: cloud shadows drifting over the dirt (the camera
 * never looks up, so the sky's weather is told on the ground), rain streaks
 * when the sky opens, and the rain's hush over the vale. All read
 * World.weather — the sim decides, this layer only answers. (The torch the
 * rain hisses out is rendered by people-meshes; the sim clears the hand.)
 */

const N_CLOUD = 22;
const N_DROP = 420;
const CLOUD_BOX = 260;
const WIND_X = -0.82;
const WIND_Z = 0.57;

const dummy = new THREE.Object3D();

interface SkyState {
  px: number;
  py: number;
  pz: number;
  cloud: number;
  rain: number;
  night: boolean;
  dusk: boolean;
  pit: boolean;
}

function readSky(): SkyState {
  const w = getWorld();
  const p = w.people.find((x) => x.isPlayer);
  const px = p?.x ?? COURT.tx;
  const pz = p?.z ?? COURT.ty;
  const py = p ? groundY(w, p.x, p.z) : 0;
  const pit = Boolean(p && inGreybarrow(Math.round(p.x), Math.round(p.z)));
  const sight = (w.player.nightSightUntil ?? 0) > w.hour;
  const night = !DEV_DAYLIGHT && useGame.getState().snap.isNight && !sight;
  const dusk = !DEV_DAYLIGHT && useGame.getState().snap.isDusk && !sight;
  return {
    px,
    py,
    pz,
    cloud: w.weather?.cloud ?? 0,
    rain: rainRate(w),
    night,
    dusk,
    pit,
  };
}

/** Soft-edged blob, generated once — no texture files. */
function shadowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function CloudShadows() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const alphaMap = useMemo(() => shadowTexture(), []);
  const stock = useMemo(
    () =>
      Array.from({ length: N_CLOUD }, (_, i) => ({
        ox: hash2(i, 1, 41) * CLOUD_BOX,
        oz: hash2(i, 2, 43) * CLOUD_BOX,
        sx: 9 + hash2(i, 4, 53) * 16,
        sz: 6 + hash2(i, 6, 61) * 11,
        rot: hash2(i, 7, 67) * Math.PI,
        sp: 0.75 + hash2(i, 9, 73) * 0.55,
      })),
    [],
  );
  const drift = useRef({ x: 0, z: 0 });

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const s = readSky();
    const w = getWorld();
    const wind = w.weather?.wind ?? 0.15;
    const speed = 2.2 + wind * 9;
    drift.current.x += WIND_X * speed * dt;
    drift.current.z += WIND_Z * speed * dt;
    const show = !s.pit && !s.night && s.cloud > 0.1;
    m.visible = show;
    if (!show) return;

    const active = Math.round(2 + s.cloud * (N_CLOUD - 2));
    const grow = 0.7 + s.cloud * 0.6;
    for (let i = 0; i < N_CLOUD; i++) {
      const c = stock[i]!;
      if (i >= active) {
        dummy.position.set(0, -300, 0);
        dummy.scale.setScalar(0.01);
      } else {
        const lx = ((((c.ox + drift.current.x * c.sp) % CLOUD_BOX) + CLOUD_BOX) % CLOUD_BOX) - CLOUD_BOX / 2;
        const lz = ((((c.oz + drift.current.z * c.sp) % CLOUD_BOX) + CLOUD_BOX) % CLOUD_BOX) - CLOUD_BOX / 2;
        const x = s.px + lx;
        const z = s.pz + lz;
        dummy.position.set(x, groundY(w, x, z) + 0.14, z);
        dummy.rotation.set(-Math.PI / 2, 0, c.rot);
        dummy.scale.set(c.sx * grow, c.sz * grow, 1);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.09 + s.cloud * 0.15;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N_CLOUD]} frustumCulled={false} raycast={() => {}} renderOrder={2}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial ref={mat} color="#0a0c08" transparent opacity={0.14} alphaMap={alphaMap} depthWrite={false} />
    </instancedMesh>
  );
}

function Rain() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const drops = useMemo(
    () =>
      Array.from({ length: N_DROP }, (_, i) => {
        const a = hash2(i, 1, 83) * Math.PI * 2;
        const r = Math.sqrt(hash2(i, 2, 89)) * 24;
        return {
          ox: Math.cos(a) * r,
          oz: Math.sin(a) * r,
          y: hash2(i, 3, 97) * 20,
          speed: 15 + hash2(i, 4, 101) * 6,
        };
      }),
    [],
  );

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const s = readSky();
    const w = getWorld();
    const raining = !s.pit && s.rain > 0.03;
    m.visible = raining;
    if (!raining) return;

    const active = Math.floor(N_DROP * Math.min(1, s.rain * 1.4));
    const lean = (w.weather?.wind ?? 0) * 0.3;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < N_DROP; i++) {
      const d = drops[i]!;
      if (i >= active) {
        dummy.position.set(0, -300, 0);
        dummy.scale.setScalar(0.01);
      } else {
        d.y -= d.speed * step;
        if (d.y < -1) d.y = 17 + Math.random() * 6;
        dummy.position.set(s.px + d.ox + d.y * lean * WIND_X * -1, s.py + d.y, s.pz + d.oz + d.y * lean * WIND_Z * -1);
        dummy.rotation.set(lean * WIND_Z, 0, lean * WIND_X);
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.24 + s.rain * 0.3;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N_DROP]} frustumCulled={false} raycast={() => {}}>
      <boxGeometry args={[0.03, 0.62, 0.03]} />
      <meshBasicMaterial ref={mat} color="#a8bcc8" transparent opacity={0.4} fog={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** Rain's hush: loop volume follows the actual rainfall. */
function WeatherAudio() {
  useFrame(() => {
    const s = readSky();
    setRainLevel(s.pit ? 0 : s.rain);
  });
  return null;
}

export function WeatherFx() {
  return (
    <group>
      <CloudShadows />
      <Rain />
      <WeatherAudio />
    </group>
  );
}
