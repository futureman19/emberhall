import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, VIEW } from "@/game/atlas";
import { groundY as heightAt } from "@/game/height";
import { getWorld } from "@/game/live";
import { getCastFx, getDeathFx } from "@/game/magery";
import { getChips } from "@/game/player";
import { useGame } from "@/game/store";
import { hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import { Buildings } from "./building-meshes";
import { Crops } from "./crop-meshes";
import { Fauna } from "./fauna-meshes";
import { Gates } from "./gate-meshes";
import { Lighting } from "./lighting";
import { People } from "./people-meshes";
import { Piles } from "./pile-meshes";
import { Terrain } from "./terrain";

function SimClock() {
  useFrame((_, dt) => {
    useGame.getState().tick(Math.min(dt, 0.1));
  });
  return null;
}

function groundY(x: number, z: number) {
  return heightAt(getWorld(), x, z);
}

function PlacePointer() {
  const { camera, gl } = useThree();
  const kind = useGame((s) => s.buildKind);
  const till = useGame((s) => s.tillArmed);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const plane = useMemo(() => new THREE.Plane(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useEffect(() => {
    if (!kind && !till) return;
    const el = gl.domElement;
    function xz(ev: PointerEvent) {
      const rect = el.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const g = useGame.getState();
      const at = g.buildAt ?? g.tillAt;
      const y = at ? heightAt(getWorld(), at.tx, at.ty) : 0;
      plane.set(up, -y);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return { tx: Math.round(hit.x), ty: Math.round(hit.z) };
    }
    function move(ev: PointerEvent) {
      const t = xz(ev);
      if (t) hoverAt(t.tx, t.ty);
    }
    function down(ev: PointerEvent) {
      if (ev.button !== 0) return;
      const t = xz(ev);
      if (t) leftAt(t.tx, t.ty);
    }
    function upEv(ev: PointerEvent) {
      if (ev.button !== 0) return;
      const t = xz(ev);
      if (t) liftAt(t.tx, t.ty);
    }
    el.addEventListener("pointermove", move);
    window.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", upEv);
    window.addEventListener("pointercancel", upEv);
    return () => {
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", upEv);
      window.removeEventListener("pointercancel", upEv);
    };
  }, [kind, till, camera, gl, ray, ndc, hit, plane, up]);
  return null;
}

function Rig() {
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const { camera } = useThree();
  const phase = useGame((s) => s.phase);
  const placing = useGame((s) => Boolean(s.buildKind));
  useFrame((_, dt) => {
    const p = getWorld().people.find((x) => x.isPlayer);
    const c = controls.current;
    if (!p || !c || phase !== "playing") return;
    const y = groundY(p.x, p.z);
    const jump = Math.hypot(p.x - c.target.x, p.z - c.target.z);
    if (jump > 10) {
      const dx = p.x - c.target.x;
      const dy = y + 0.3 - c.target.y;
      const dz = p.z - c.target.z;
      c.target.x += dx;
      c.target.y += dy;
      c.target.z += dz;
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
      return;
    }
    const k = Math.min(1, dt * 2.6);
    camera.position.x += (p.x - c.target.x) * k;
    camera.position.y += (y + 0.3 - c.target.y) * k;
    camera.position.z += (p.z - c.target.z) * k;
    c.target.x += (p.x - c.target.x) * k;
    c.target.y += (y + 0.3 - c.target.y) * k;
    c.target.z += (p.z - c.target.z) * k;
  });
  return (
    <MapControls
      ref={controls as never}
      enabled={phase === "playing"}
      enableDamping
      dampingFactor={0.12}
      enablePan={phase === "playing" && !placing}
      enableRotate={phase === "playing" && !placing}
      enableZoom={phase === "playing"}
      autoRotate={false}
      minDistance={8}
      maxDistance={88}
      zoomSpeed={1.35}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={Math.PI / 12}
      target={[COURT.tx, 0.4, COURT.ty]}
      makeDefault
    />
  );
}

function MarkStones() {
  const n = useGame((s) => s.snap.player?.marks?.length ?? 0);
  const marks = useGame((s) => s.snap.player?.marks ?? []);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const near = marks.filter((m) => Math.hypot(m.tx - x, m.ty - z) < VIEW);
  if (!n || !near.length) return null;
  return (
    <group>
      {near.map((m) => {
        const y = groundY(m.tx, m.ty);
        return (
          <group key={m.id} position={[m.tx, y, m.ty]}>
            <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.12, 0.32]} />
              <meshStandardMaterial color="#c9c3b6" roughness={0.92} />
            </mesh>
            <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0.2]}>
              <ringGeometry args={[0.16, 0.22, 12]} />
              <meshBasicMaterial color="#a85a42" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function WalkMarker() {
  const intent = useGame((s) => s.snap.player?.intent);
  if (!intent || intent.kind === "none") return null;
  const y = groundY(intent.tx, intent.ty);
  const ember = intent.kind === "cast";
  const mark = intent.kind === "chop" || intent.kind === "mine" || intent.kind === "plant" || intent.kind === "harvest" || intent.kind === "till";
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[intent.tx, y + 0.1, intent.ty]}>
      <ringGeometry args={[0.22, 0.32, 18]} />
      <meshBasicMaterial color={mark ? "#e0b56a" : ember ? "#a85a42" : "#ece6d8"} transparent opacity={0.85} />
    </mesh>
  );
}

function CastFxMesh() {
  const group = useRef<THREE.Group>(null);
  const puff = useRef<THREE.Mesh>(null);
  const bolt = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getCastFx();
    const g = group.current;
    const puffMesh = puff.current;
    const boltMesh = bolt.current;
    if (!g || !puffMesh || !boltMesh) return;
    if (!fx) {
      g.visible = false;
      return;
    }
    const age = getWorld().hour - fx.at;
    if (age < 0 || age > 0.28) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = age / 0.28;
    const y0 = groundY(fx.x, fx.z) + 0.9;
    const y1 = groundY(fx.tx, fx.tz) + 0.75;
    const puffMat = puffMesh.material as THREE.MeshBasicMaterial;
    const boltMat = boltMesh.material as THREE.MeshBasicMaterial;
    if (fx.spell === "magicarrow" || fx.spell === "fireball") {
      const k = Math.min(1, t * 1.55);
      const fat = fx.spell === "fireball";
      boltMesh.visible = t < 0.72;
      boltMesh.position.set(fx.x + (fx.tx - fx.x) * k, y0 + (y1 - y0) * k, fx.z + (fx.tz - fx.z) * k);
      boltMesh.scale.setScalar(fat ? 1.7 : 1);
      boltMat.opacity = 0.95 * (1 - t);
      puffMesh.position.set(fx.tx, y1, fx.tz);
      puffMesh.scale.setScalar((fat ? 0.7 : 0.35) + t * (fat ? 2.1 : 1.4));
      puffMat.color.set("#a85a42");
      puffMat.opacity = 0.55 * (1 - t);
    } else if (fx.spell === "teleport" || fx.spell === "recall") {
      boltMesh.visible = t < 0.45;
      const k = Math.min(1, t * 2.2);
      boltMesh.position.set(fx.x + (fx.tx - fx.x) * k, y0 + (y1 - y0) * k, fx.z + (fx.tz - fx.z) * k);
      puffMesh.position.set(fx.tx, y1, fx.tz);
      puffMesh.scale.setScalar(0.7 + t * 2.2);
      puffMat.color.set(fx.spell === "recall" ? "#a85a42" : "#ece6d8");
      puffMat.opacity = 0.7 * (1 - t);
    } else {
      boltMesh.visible = false;
      puffMesh.position.set(fx.tx, y1, fx.tz);
      puffMesh.scale.setScalar(0.55 + t * 1.8);
      puffMat.color.set(fx.spell === "heal" ? "#ece6d8" : "#c9c3b6");
      puffMat.opacity = 0.72 * (1 - t);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={puff}>
        <sphereGeometry args={[0.32, 10, 8]} />
        <meshBasicMaterial color="#ece6d8" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={bolt}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshBasicMaterial color="#a85a42" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DeathFxMesh() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getDeathFx();
    const m = mesh.current;
    if (!m) return;
    if (!fx) {
      m.visible = false;
      return;
    }
    const age = getWorld().hour - fx.at;
    if (age < 0 || age > 0.09) {
      m.visible = false;
      return;
    }
    const t = age / 0.09;
    m.visible = true;
    m.position.set(fx.x, groundY(fx.x, fx.z) + 0.7 + t * 0.6, fx.z);
    m.scale.setScalar(0.6 + t * 2.4);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.7 * (1 - t);
  });
  return (
    <mesh ref={mesh} visible={false}>
      <sphereGeometry args={[0.4, 10, 8]} />
      <meshBasicMaterial color="#ece6d8" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

function ChipBits() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D());
  const pal = useRef(new THREE.Color());
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (!m.instanceColor) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(32 * 3), 3);
    }
    const bits = getChips();
    const d = dummy.current;
    const col = pal.current;
    for (let i = 0; i < 32; i++) {
      const c = bits[i];
      if (!c) {
        d.position.set(0, -40, 0);
        d.scale.set(0.01, 0.01, 0.01);
      } else {
        const s = 0.08 * (1 - c.age / 0.6);
        d.position.set(c.x, c.y, c.z);
        d.scale.set(s, s, s);
        col.set(c.color);
        m.setColorAt(i, col);
      }
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 32]} frustumCulled={false} raycast={() => {}}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

export function WorldScene() {
  return (
    <Canvas
      className="h-full w-full touch-none"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [COURT.tx + 14, 20, COURT.ty + 18], fov: 46, near: 0.2, far: 180 }}
      gl={{ antialias: true, alpha: false }}
      onContextMenu={(e) => e.preventDefault()}
      onCreated={({ gl }) => {
        gl.setClearColor("#1a1c18", 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.18;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      <Lighting />
      <Terrain />
      <Buildings />
      <Crops />
      <People />
      <Fauna />
      <Piles />
      <Gates />
      <WalkMarker />
      <MarkStones />
      <CastFxMesh />
      <DeathFxMesh />
      <ChipBits />
      <PlacePointer />
      <Rig />
      <SimClock />
    </Canvas>
  );
}

export default WorldScene;
