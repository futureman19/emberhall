import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { COURT, inGreybarrow } from "@/game/atlas";
import { biomeAt } from "@/game/biome";
import { DEV_DAYLIGHT } from "@/game/debug";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

const SUN_DIR = new THREE.Vector3(-0.52, 0.78, -0.36).normalize();
const SKY_DAY = "#8b9e95";
const SKY_TUNDRA = "#8a9690";
const SKY_TAIGA = "#4a5a4c";
const SKY_FEN = "#5e6c58";
const SKY_JUNGLE = "#4e6350";
const SKY_DESERT = "#c4a878";
const SKY_DUSK = "#8a6848";
const SKY_NIGHT = "#141210";
const SKY_PIT = "#0c0a08";
const HAZE = "#1c1c1a";

export function Lighting() {
  const dir = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.Group>(null);
  const fog = useRef<THREE.FogExp2>(null);
  const bg = useRef<THREE.Color>(null);
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

  useFrame(() => {
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

    const ambI =
      pit ? 0.1 : night ? 0.16 : dusk ? 0.46 : climate === "taiga" ? 0.42 : climate === "jungle" ? 0.52 : 0.58;
    const dirI =
      pit ? 0.12 : night ? 0.22 : dusk ? 1.21 : climate === "taiga" ? 1.35 : climate === "jungle" ? 1.7 : 1.94;
    if (amb.current) amb.current.intensity = ambI;
    if (hemi.current) hemi.current.intensity = pit ? 0.04 : night ? 0.08 : dusk ? 0.23 : climate === "taiga" ? 0.16 : 0.29;

    const lx = px + SUN_DIR.x * 48;
    const ly = py + SUN_DIR.y * 48;
    const lz = pz + SUN_DIR.z * 48;
    if (dir.current) {
      dir.current.intensity = dirI;
      dir.current.color.set(night ? "#9aa8c4" : dusk ? "#e0a060" : "#fff1c8");
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
      sun.current.visible = !pit && !night;
      sun.current.position.set(px + SUN_DIR.x * 92, py + SUN_DIR.y * 92, pz + SUN_DIR.z * 92);
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
    if (bg.current) bg.current.set(sky);
    if (fog.current) {
      fog.current.color.set(pit ? SKY_PIT : HAZE);
      fog.current.density = pit ? 0.14 : 0.0062;
    }
    scene.background = bg.current;
  });

  return (
    <>
      <color ref={bg} attach="background" args={[SKY_DAY]} />
      <fogExp2 ref={fog} attach="fog" args={[HAZE, 0.0062]} />
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
