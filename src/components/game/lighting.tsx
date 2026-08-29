import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { COURT, inGreybarrow } from "@/game/atlas";
import { DEV_DAYLIGHT } from "@/game/debug";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

const SUN_DIR = new THREE.Vector3(-0.52, 0.78, -0.36).normalize();
const SKY_DAY = "#cdd2cc";
const SKY_DUSK = "#c4a078";
const SKY_NIGHT = "#141210";
const SKY_PIT = "#0c0a08";

export function Lighting() {
  const dir = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.Group>(null);
  const fog = useRef<THREE.Fog>(null);
  const bg = useRef<THREE.Color>(null);
  const { scene, gl } = useThree();

  useLayoutEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
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

    const ambI = pit ? 0.1 : night ? 0.18 : dusk ? 0.4 : 0.62;
    const dirI = pit ? 0.12 : night ? 0.28 : dusk ? 1.5 : 3.4;
    if (amb.current) amb.current.intensity = ambI;
    if (hemi.current) hemi.current.intensity = pit ? 0.04 : night ? 0.08 : dusk ? 0.22 : 0.32;

    const lx = px + SUN_DIR.x * 48;
    const ly = py + SUN_DIR.y * 48;
    const lz = pz + SUN_DIR.z * 48;
    if (dir.current) {
      dir.current.intensity = dirI;
      dir.current.color.set(night ? "#9aa8c4" : dusk ? "#e0a060" : "#fff8e4");
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
      sun.current.position.set(px + SUN_DIR.x * 78, py + SUN_DIR.y * 78, pz + SUN_DIR.z * 78);
    }

    const sky = pit ? SKY_PIT : night ? SKY_NIGHT : dusk ? SKY_DUSK : SKY_DAY;
    if (bg.current) bg.current.set(sky);
    if (fog.current) {
      fog.current.color.set(sky);
      fog.current.near = pit ? 8 : 68;
      fog.current.far = pit ? 22 : 175;
    }
    scene.background = bg.current;
  });

  return (
    <>
      <color ref={bg} attach="background" args={[SKY_DAY]} />
      <fog ref={fog} attach="fog" args={[SKY_DAY, 68, 175]} />
      <ambientLight ref={amb} intensity={0.62} color="#ece6d8" />
      <directionalLight
        ref={dir}
        castShadow
        position={[COURT.tx + 22, 40, COURT.ty + 14]}
        intensity={3.4}
        color="#fff8e4"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight ref={hemi} args={["#efe8d8", "#3a3228", 0.32]} />
      <group ref={sun} frustumCulled={false}>
        <mesh frustumCulled={false} renderOrder={-1}>
          <sphereGeometry args={[5.4, 24, 16]} />
          <meshBasicMaterial color="#fffce8" toneMapped={false} fog={false} depthWrite={false} />
        </mesh>
        <mesh frustumCulled={false} renderOrder={-2}>
          <sphereGeometry args={[11, 24, 16]} />
          <meshBasicMaterial color="#f0c070" toneMapped={false} fog={false} transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh frustumCulled={false} renderOrder={-3}>
          <sphereGeometry args={[22, 24, 16]} />
          <meshBasicMaterial color="#e8d8a8" toneMapped={false} fog={false} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
