import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { COURT, inGreybarrow } from "@/game/atlas";
import { biomeAt } from "@/game/biome";
import { DEV_DAYLIGHT } from "@/game/debug";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { playSfx } from "@/game/vale-sfx";
import { rainRate } from "@/game/weather";
import { skyFlash, sunColorFor, sunDirFor, sunHeight } from "./sky-math";

const SKY_DAY = "#8b9e95";
const SKY_TUNDRA = "#8a9690";
const SKY_TAIGA = "#4a5a4c";
const SKY_FEN = "#5e6c58";
const SKY_JUNGLE = "#4e6350";
const SKY_DESERT = "#c4a878";
const SKY_DUSK = "#8a6848";
const SKY_NIGHT = "#141210";
const SKY_PIT = "#0c0a08";
const HAZE = "#3d4c2c";
const HAZE_TUNDRA = "#8a8680";
const HAZE_DESERT = "#7a6c50";
const HAZE_FEN = "#2e3a2c";
const HAZE_TAIGA = "#354232";
const HAZE_JUNGLE = "#2a3a28";
const OVERCAST = new THREE.Color("#6f7672");
const OVERCAST_DUSK = new THREE.Color("#4a4038");

export function Lighting() {
  const dir = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.Group>(null);
  const fog = useRef<THREE.FogExp2>(null);
  const bg = useRef<THREE.Color>(null);
  const thunderIn = useRef(0);
  const scratch = useRef(new THREE.Color());
  const { scene, gl } = useThree();

  useLayoutEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.36;
    gl.setClearColor("#1a1c18", 1);
    const light = dir.current;
    if (!light) return;
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const w = getWorld();
    const p = w.people.find((x) => x.isPlayer);
    const px = p?.x ?? COURT.tx;
    const pz = p?.z ?? COURT.ty;
    const py = p ? groundY(w, p.x, p.z) : 0;
    const pit = Boolean(p && inGreybarrow(Math.round(p.x), Math.round(p.z)));
    const sight = (w.player.nightSightUntil ?? 0) > w.hour;
    const night = !DEV_DAYLIGHT && useGame.getState().snap.isNight && !sight;
    const dusk = !DEV_DAYLIGHT && useGame.getState().snap.isDusk && !sight;
    const climate = biomeAt(Math.round(px), Math.round(pz));
    const cloud = pit ? 0 : (w.weather?.cloud ?? 0);
    const rain = pit ? 0 : rainRate(w);
    // The sun rides the real clock so days visibly arc. DEV_DAYLIGHT only
    // floors the brightness at half-day (dev visibility), never darkness.
    const sunDir = sunDirFor(w.hour);
    const sunH = DEV_DAYLIGHT ? Math.max(sunHeight(w.hour), 0.5) : sunHeight(w.hour);

    // Lightning: the storm picks its own moments; the sky dome and clouds
    // read skyFlash so the whole heavens answer the same strike.
    const storm = !pit && w.weather?.kind === "storm";
    if (storm && Math.random() < dt * 0.32) {
      skyFlash.v = 1;
      thunderIn.current = 0.35 + Math.random() * 1.1;
    }
    if (thunderIn.current > 0) {
      thunderIn.current -= dt;
      if (thunderIn.current <= 0) playSfx("thunder", 0.4 + Math.random() * 0.3);
    }
    skyFlash.v = Math.max(0, skyFlash.v - dt * 4.2);
    const flash = skyFlash.v * skyFlash.v;

    const ambI =
      pit ? 0.1 : night ? 0.16 : dusk ? 0.46 : climate === "taiga" ? 0.42 : climate === "jungle" ? 0.52 : 0.58;
    const dirI =
      pit ? 0.12 : night ? 0.22 : dusk ? 1.21 : climate === "taiga" ? 1.35 : climate === "jungle" ? 1.7 : 1.94;
    const cloudDim = 1 - cloud * 0.55;
    if (amb.current) amb.current.intensity = ambI * (1 - cloud * 0.22) + flash * 0.9;
    if (hemi.current)
      hemi.current.intensity = pit ? 0.04 : night ? 0.08 : dusk ? 0.23 : climate === "taiga" ? 0.16 : 0.29;

    const lx = px + sunDir.x * 48;
    const ly = py + sunDir.y * 48;
    const lz = pz + sunDir.z * 48;
    if (dir.current) {
      dir.current.intensity = dirI * (night || pit ? 1 : cloudDim) * (night || dusk || pit ? 1 : 0.45 + 0.55 * sunH) + flash * 1.7;
      if (night) dir.current.color.set("#9aa8c4");
      else if (dusk) dir.current.color.set("#e0a060");
      else sunColorFor(w.hour, dir.current.color);
      dir.current.position.set(lx, ly, lz);
      dir.current.target.position.set(px, py, pz);
      dir.current.target.updateMatrixWorld();
      dir.current.shadow.bias = -0.0008;
      dir.current.shadow.normalBias = 0.045;
      const cam = dir.current.shadow.camera;
      cam.left = -36;
      cam.right = 36;
      cam.top = 36;
      cam.bottom = -36;
      cam.near = 8;
      cam.far = 90;
      cam.updateProjectionMatrix();
    }

    if (sun.current) {
      sun.current.visible = !pit && !night && cloud < 0.8;
      sun.current.position.set(px + sunDir.x * 92, py + sunDir.y * 92, pz + sunDir.z * 92);
    }

    const sky = pit
      ? SKY_PIT
      : night
        ? SKY_NIGHT
        : dusk
          ? SKY_DUSK
          : climate === "tundra"
            ? SKY_TUNDRA
            : climate === "taiga"
              ? SKY_TAIGA
              : climate === "fen"
                ? SKY_FEN
                : climate === "jungle"
                  ? SKY_JUNGLE
                  : climate === "desert"
                    ? SKY_DESERT
                    : SKY_DAY;
    if (bg.current) {
      bg.current.set(sky);
      if (!pit && !night) bg.current.lerp(dusk ? OVERCAST_DUSK : OVERCAST, cloud * 0.5);
      if (flash > 0.01) bg.current.lerp(scratch.current.set("#dfe4ea"), flash * 0.55);
    }
    const haze =
      pit ? SKY_PIT
      : climate === "tundra" ? HAZE_TUNDRA
      : climate === "desert" ? HAZE_DESERT
      : climate === "fen" ? HAZE_FEN
      : climate === "taiga" ? HAZE_TAIGA
      : climate === "jungle" ? HAZE_JUNGLE
      : HAZE;
    if (fog.current) {
      fog.current.color.set(haze);
      if (!pit && !night) fog.current.color.lerp(OVERCAST, cloud * 0.45);
      fog.current.density = pit ? 0.14 : 0.007 + cloud * 0.005 + rain * 0.008;
    }
    scene.background = bg.current;
  });

  return (
    <>
      <color ref={bg} attach="background" args={[SKY_DAY]} />
      <fogExp2 ref={fog} attach="fog" args={[HAZE, 0.007]} />
      <ambientLight ref={amb} intensity={0.58} color="#ece6d8" />
      <directionalLight
        ref={dir}
        castShadow
        position={[COURT.tx + 22, 40, COURT.ty + 14]}
        intensity={1.94}
        color="#fff1c8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight ref={hemi} args={["#c5d0c4", "#3a3228", 0.29]} />
      <group ref={sun} frustumCulled={false}>
        <mesh frustumCulled={false} renderOrder={-1}>
          <sphereGeometry args={[2.4, 20, 14]} />
          <meshBasicMaterial color="#f2d48a" toneMapped={false} fog={false} depthWrite={false} />
        </mesh>
        <mesh frustumCulled={false} renderOrder={-2}>
          <sphereGeometry args={[4.6, 20, 14]} />
          <meshBasicMaterial color="#e0b56a" toneMapped={false} fog={false} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
