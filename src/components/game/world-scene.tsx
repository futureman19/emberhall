import { Html, MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, VIEW } from "@/game/atlas";
import { cameraFixedHeight, cameraLockedAxis } from "@/game/camera-follow";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import {
  projectileProgress,
  spellProjectileProfile,
  travelEffectProfile,
} from "@/game/combat-animation";
import { HEALING_DURATION, healingPulse } from "@/game/healing-animation";
import { TAMING_DURATION, tamingPulse } from "@/game/taming-animation";
import { CRAFTING_DURATION, craftingPose, craftingVisualProfile } from "@/game/crafting-animation";
import { getCraftFx } from "@/game/craft";
import { CORPSE_DURATION, corpseFxAge, corpsePose, getCorpseFx } from "@/game/corpse-animation";
import { CONSTRUCTION_DURATION, constructionPose, getConstructionFx } from "@/game/construction-animation";
import { COMPANION_DURATION, companionPose, getCompanionFx } from "@/game/companion-animation";
import { NPC_INTERACTION_DURATION, getNpcInteractionFx, npcInteractionPose } from "@/game/npc-interaction-animation";
import { MOONGATE_DURATION, getMoongateFx, moongatePhase } from "@/game/moongate-animation";
import { EXTRACTION_DURATION, extractionVisualProfile, getExtractionFx } from "@/game/extraction-animation";
import { GATHERING_DURATION, gatheringPose, gatheringVisualProfile, getGatheringFx } from "@/game/gathering-animation";
import { groundY as heightAt } from "@/game/height";
import { getGraphicsSettings, useGraphicsSettings } from "@/game/graphics-settings";
import { getWorld } from "@/game/live";
import { getCastFx, getDeathFx, getFizzleFx } from "@/game/magery";
import { getChips, getCombatFx, getHealingFx, getTamingFx } from "@/game/player";
import { useGame } from "@/game/store";
import { hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import { Buildings } from "./building-meshes";
import { Crops } from "./crop-meshes";
import { Fauna } from "./fauna-meshes";
import { Gates } from "./gate-meshes";
import { Lighting } from "./lighting";
import { Sky } from "./sky";
import { WeatherFx } from "./weather-fx";
import { People } from "./people-meshes";
import { Piles } from "./pile-meshes";
import { Campfires } from "./campfire-meshes";
import { Horizon, Terrain } from "./terrain";

declare global {
  interface Window {
    __emberCamera?: {
      getCamera: () => { x: number; y: number; z: number };
      getTarget: () => { x: number; y: number; z: number } | null;
      getAnchor: () => { x: number; y: number; z: number } | null;
    };
    __emberGraphicsRuntime?: {
      getState: () => {
        shadows: boolean;
        farTreeCount: number | null;
        farTreeStock: number | null;
        farTreeCandidates: number | null;
        farTreeLimit: number | null;
      };
    };
  }
}

function GraphicsProbe() {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has("qa");
    if (!enabled) return;
    const probe = {
      getState: () => {
        const far = scene.getObjectByName("far-horizon-trees") as THREE.InstancedMesh | undefined;
        return {
          shadows: gl.shadowMap.enabled,
          farTreeCount: far?.count ?? null,
          farTreeStock:
            typeof far?.userData.stockCount === "number" ? far.userData.stockCount : null,
          farTreeCandidates:
            typeof far?.userData.candidateCount === "number" ? far.userData.candidateCount : null,
          farTreeLimit: typeof far?.userData.limit === "number" ? far.userData.limit : null,
        };
      },
    };
    window.__emberGraphicsRuntime = probe;
    return () => {
      if (window.__emberGraphicsRuntime === probe) delete window.__emberGraphicsRuntime;
    };
  }, [gl, scene]);
  return null;
}

function SimClock() {
  useFrame((_, dt) => {
    useGame.getState().tick(Math.min(dt, 0.1));
  }, -2);
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
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const followAnchor = useRef(new THREE.Vector3());
  const followReady = useRef(false);
  const { camera } = useThree();
  const phase = useGame((s) => s.phase);
  const placing = useGame((s) => Boolean(s.buildKind));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has("qa");
    if (!enabled) return;
    const probe = {
      getCamera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
      getTarget: () => {
        const target = controls.current?.target;
        return target ? { x: target.x, y: target.y, z: target.z } : null;
      },
      getAnchor: () =>
        followReady.current
          ? { x: followAnchor.current.x, y: followAnchor.current.y, z: followAnchor.current.z }
          : null,
    };
    window.__emberCamera = probe;
    return () => {
      if (window.__emberCamera === probe) delete window.__emberCamera;
    };
  }, [camera]);
  useFrame(() => {
    const p = getWorld().people.find((x) => x.isPlayer);
    const c = controls.current;
    if (!p || !c || phase !== "playing") return;
    const y = groundY(p.x, p.z);
    const anchor = followAnchor.current;
    if (!followReady.current) {
      anchor.copy(c.target);
      followReady.current = true;
    }
    const desiredY = y + 0.3;
    const jump = Math.hypot(p.x - anchor.x, p.z - anchor.z);
    const x = cameraLockedAxis(anchor.x, p.x);
    const z = cameraLockedAxis(anchor.z, p.z);
    const height = cameraFixedHeight(anchor.y, desiredY, jump > 10);
    const dx = x.delta;
    const dy = height.delta;
    const dz = z.delta;
    anchor.set(x.next, height.next, z.next);
    // Lock X/Z to the player's exact rendered displacement so starts, stops,
    // and turns cannot lag. Keep Y fixed during walking so uneven terrain can
    // move the character without bouncing the view; only a large teleport
    // recenters height. Equal translation preserves MapControls offsets.
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
    c.target.x += dx;
    c.target.y += dy;
    c.target.z += dz;
  }, -1);
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
      maxDistance={150}
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
  const mark =
    intent.kind === "chop" ||
    intent.kind === "mine" ||
    intent.kind === "plant" ||
    intent.kind === "harvest" ||
    intent.kind === "till";
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[intent.tx, y + 0.1, intent.ty]}>
      <ringGeometry args={[0.22, 0.32, 18]} />
      <meshBasicMaterial
        color={mark ? "#e0b56a" : ember ? "#a85a42" : "#ece6d8"}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function CastFxMesh() {
  const group = useRef<THREE.Group>(null);
  const puff = useRef<THREE.Mesh>(null);
  const bolt = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  const impact = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getCastFx();
    const g = group.current;
    const puffMesh = puff.current;
    const boltMesh = bolt.current;
    const trailMesh = trail.current;
    const impactMesh = impact.current;
    if (!g || !puffMesh || !boltMesh || !trailMesh || !impactMesh) return;
    if (!fx) {
      g.visible = false;
      return;
    }
    const age = (getWorld().hour - fx.at) * SECONDS_PER_HOUR;
    const duration = fx.spell === "magicarrow" || fx.spell === "fireball" ? 0.78 : 0.68;
    if (age < 0 || age > duration) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = age / duration;
    const y0 = groundY(fx.x, fx.z) + 0.9;
    const y1 = groundY(fx.tx, fx.tz) + 0.75;
    const puffMat = puffMesh.material as THREE.MeshBasicMaterial;
    const boltMat = boltMesh.material as THREE.MeshBasicMaterial;
    const trailMat = trailMesh.material as THREE.MeshBasicMaterial;
    const impactMat = impactMesh.material as THREE.MeshBasicMaterial;
    if (fx.spell === "magicarrow" || fx.spell === "fireball") {
      const k = Math.min(1, t * 1.55);
      const profile = spellProjectileProfile(fx.spell);
      const fat = fx.spell === "fireball";
      boltMesh.visible = t < 0.72;
      boltMesh.position.set(
        fx.x + (fx.tx - fx.x) * k,
        y0 + (y1 - y0) * k,
        fx.z + (fx.tz - fx.z) * k,
      );
      boltMesh.scale.setScalar(profile.coreScale);
      boltMat.color.set(profile.core);
      boltMat.opacity = 0.95 * (1 - t);
      trailMesh.visible = t < 0.72;
      trailMesh.position.set(
        (fx.x + boltMesh.position.x) * 0.5,
        (y0 + boltMesh.position.y) * 0.5,
        (fx.z + boltMesh.position.z) * 0.5,
      );
      trailMesh.lookAt(boltMesh.position);
      const trailLength = Math.max(
        0.08,
        Math.hypot(
          boltMesh.position.x - fx.x,
          boltMesh.position.y - y0,
          boltMesh.position.z - fx.z,
        ),
      );
      trailMesh.scale.set(profile.trailScale, profile.trailScale, trailLength * 4.1);
      trailMat.color.set(profile.trail);
      trailMat.opacity = (fat ? 0.68 : 0.72) * (1 - t);
      puffMesh.position.set(fx.tx, y1, fx.tz);
      puffMesh.scale.setScalar(profile.impactScale * (0.35 + t * 1.25));
      puffMat.color.set(profile.impact);
      puffMat.opacity = (fat ? 0.68 : 0.5) * (1 - t);
      impactMesh.visible = t > 0.32;
      impactMesh.position.set(fx.tx, groundY(fx.tx, fx.tz) + 0.08, fx.tz);
      impactMesh.scale.setScalar(profile.impactScale * (0.45 + t * 1.2));
      impactMat.color.set(profile.impact);
      impactMat.opacity = 0.78 * (1 - t);
    } else if (fx.spell === "teleport" || fx.spell === "recall") {
      trailMesh.visible = false;
      impactMesh.visible = false;
      boltMesh.visible = t < 0.45;
      const k = Math.min(1, t * 2.2);
      boltMesh.position.set(
        fx.x + (fx.tx - fx.x) * k,
        y0 + (y1 - y0) * k,
        fx.z + (fx.tz - fx.z) * k,
      );
      puffMesh.position.set(fx.tx, y1, fx.tz);
      puffMesh.scale.setScalar(0.7 + t * 2.2);
      puffMat.color.set(fx.spell === "recall" ? "#a85a42" : "#ece6d8");
      puffMat.opacity = 0.7 * (1 - t);
    } else {
      trailMesh.visible = false;
      impactMesh.visible = false;
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
        <meshBasicMaterial
          color="#ece6d8"
          transparent
          opacity={0.6}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={bolt}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshBasicMaterial
          color="#a85a42"
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={trail} visible={false}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial
          color="#4a8ee8"
          transparent
          opacity={0.4}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={impact} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.34, 18]} />
        <meshBasicMaterial
          color="#8ec8ff"
          transparent
          opacity={0.7}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function MoongateTravelFxMesh() {
  const source = useRef<THREE.Group>(null);
  const destination = useRef<THREE.Group>(null);
  const transit = useRef<THREE.Group>(null);
  const petA = useRef<THREE.Mesh>(null);
  const petB = useRef<THREE.Mesh>(null);
  const petC = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const world = getWorld();
    const fx = getMoongateFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < MOONGATE_DURATION);
    if (label.current) label.current.style.display = live ? "grid" : "none";
    for (const group of [source.current, destination.current, transit.current]) if (group) group.visible = live;
    if (!fx || !live) return;
    if (label.current) label.current.textContent = `MOONGATE · ${fx.destinationName.toUpperCase()}`;
    const phase = moongatePhase(age);
    const sourceY = groundY(fx.x, fx.z);
    const destinationY = groundY(fx.tx, fx.tz);
    if (source.current) {
      source.current.position.set(fx.x, sourceY + 0.12, fx.z);
      source.current.scale.setScalar(0.7 + phase.departure * 0.9);
      source.current.rotation.y = age * 4;
    }
    if (destination.current) {
      destination.current.position.set(fx.tx, destinationY + 0.12, fx.tz);
      destination.current.scale.setScalar(0.82 + phase.arrival * 0.45);
      destination.current.rotation.y = -age * 3.2;
    }
    if (transit.current) {
      transit.current.position.set(fx.tx, destinationY + 1.1 + phase.transit * 0.65, fx.tz);
      transit.current.rotation.y = age * 7;
      transit.current.scale.setScalar(0.68 + phase.transit * 0.34);
    }
    const petRefs = [petA.current, petB.current, petC.current];
    petRefs.forEach((mesh, index) => {
      if (!mesh) return;
      const arrival = fx.companions[index];
      mesh.visible = Boolean(arrival);
      if (!arrival) return;
      mesh.position.set(arrival.x, groundY(arrival.x, arrival.z) + 0.12, arrival.z);
      mesh.scale.setScalar(1.1 + phase.arrival * 0.45);
      mesh.rotation.z = age * (index % 2 ? -3 : 3);
    });
  });

  return (
    <group>
      <group ref={source} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.78, 1.12, 28]} /><meshBasicMaterial color="#b88cff" transparent opacity={0.78} depthWrite={false} /></mesh>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.5, 0.88, 2.2, 16, 1, true]} /><meshBasicMaterial color="#8f6bd8" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      </group>
      <group ref={destination} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.2, 1.42, 28]} /><meshBasicMaterial color="#8fd5ff" transparent opacity={0.5} depthWrite={false} depthTest={false} /></mesh>
        <mesh position={[0, 1.25, 0]}><cylinderGeometry args={[0.92, 0.58, 2.5, 16, 1, true]} /><meshBasicMaterial color="#8fd5ff" transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      </group>
      <group ref={transit} visible={false}>
        {Array.from({ length: 4 }, (_, index) => { const angle = index * Math.PI / 2; return <mesh key={index} position={[Math.cos(angle) * 1.62, (index % 2) * 0.58, Math.sin(angle) * 1.62]} rotation={[0, angle, Math.PI / 4]}><boxGeometry args={[0.1, 0.1, 0.72]} /><meshBasicMaterial color={index % 2 ? "#fff0bd" : "#8fd5ff"} transparent opacity={0.72} depthTest={false} /></mesh>; })}
        <Html position={[0, 2.15, 0]} center zIndexRange={[29, 0]} style={{ pointerEvents: "none" }}><div ref={label} style={{ display: "none", placeItems: "center", minWidth: 132, padding: "7px 10px", border: "1px solid #b88cff", borderRadius: 8, background: "rgba(20,18,15,.92)", color: "#fff8e7", fontFamily: "serif", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", whiteSpace: "nowrap" }} /></Html>
      </group>
      <mesh ref={petA} visible={false} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.78, 18]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.9} depthWrite={false} depthTest={false} /></mesh>
      <mesh ref={petB} visible={false} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.78, 18]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.9} depthWrite={false} depthTest={false} /></mesh>
      <mesh ref={petC} visible={false} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.78, 18]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0.9} depthWrite={false} depthTest={false} /></mesh>
    </group>
  );
}

function TravelFxMesh() {
  const sourceRing = useRef<THREE.Mesh>(null);
  const destinationRing = useRef<THREE.Mesh>(null);
  const sourceColumn = useRef<THREE.Mesh>(null);
  const destinationColumn = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getCastFx();
    const meshes = [
      sourceRing.current,
      destinationRing.current,
      sourceColumn.current,
      destinationColumn.current,
    ];
    if (meshes.some((mesh) => !mesh)) return;
    const travel = fx && (fx.spell === "teleport" || fx.spell === "recall") ? fx : null;
    const age = travel ? (getWorld().hour - travel.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(travel && age >= 0 && age < 0.82);
    for (const mesh of meshes) if (mesh) mesh.visible = visible;
    if (!travel || !visible) return;
    const t = projectileProgress(age, 0.82);
    const profile = travelEffectProfile(travel.spell);
    const sourcePulse = 1 - t;
    const destinationPulse = Math.sin(Math.min(1, t * 1.35) * Math.PI);
    const sourceY = groundY(travel.x, travel.z);
    const destinationY = groundY(travel.tx, travel.tz);
    sourceRing.current!.position.set(travel.x, sourceY + 0.08, travel.z);
    sourceRing.current!.scale.setScalar(0.7 + t * 1.8);
    destinationRing.current!.position.set(travel.tx, destinationY + 0.08, travel.tz);
    destinationRing.current!.scale.setScalar(1.9 - Math.min(1, t * 1.45));
    sourceColumn.current!.position.set(travel.x, sourceY + 0.8, travel.z);
    sourceColumn.current!.scale.set(0.7 + t * 0.5, 1 - t * 0.65, 0.7 + t * 0.5);
    destinationColumn.current!.position.set(travel.tx, destinationY + 0.8, travel.tz);
    destinationColumn.current!.scale.set(
      0.65 + destinationPulse * 0.55,
      0.35 + destinationPulse,
      0.65 + destinationPulse * 0.55,
    );
    const style = (mesh: THREE.Mesh, color: string, opacity: number) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(color);
      material.opacity = Math.max(0, opacity);
    };
    style(sourceRing.current!, profile.source, sourcePulse * 0.9);
    style(destinationRing.current!, profile.destination, (1 - t) * 0.95);
    style(sourceColumn.current!, profile.accent, sourcePulse * 0.42);
    style(destinationColumn.current!, profile.destination, destinationPulse * 0.52);
  });
  return (
    <group>
      <mesh ref={sourceRing} visible={false} renderOrder={7} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.52, 24]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={destinationRing} visible={false} renderOrder={7} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.68, 28]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={sourceColumn} visible={false} renderOrder={6}>
        <cylinderGeometry args={[0.28, 0.55, 1.6, 12, 1, true]} />
        <meshBasicMaterial
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={destinationColumn} visible={false} renderOrder={6}>
        <cylinderGeometry args={[0.5, 0.25, 1.6, 12, 1, true]} />
        <meshBasicMaterial
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function FizzleFxMesh() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const fx = getFizzleFx();
    const g = group.current;
    if (!g) return;
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < 0.58);
    g.visible = visible;
    if (!fx || !visible) return;
    const t = projectileProgress(age, 0.58);
    g.position.set(fx.x, groundY(fx.x, fx.z) + 0.78 - t * 0.34, fx.z);
    g.rotation.y = t * Math.PI * 2.4;
    g.scale.setScalar(0.9 + t * 2.1);
    g.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshBasicMaterial;
      material.opacity = 0.92 * (1 - t);
    });
  });
  return (
    <group ref={group} visible={false}>
      {[
        [-0.28, 0.18, 0.04],
        [0.26, 0.06, 0.16],
        [-0.06, -0.12, -0.26],
        [0.12, 0.3, -0.12],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} renderOrder={8}>
          <dodecahedronGeometry args={[index % 2 ? 0.14 : 0.2, 0]} />
          <meshBasicMaterial
            color={index % 2 ? "#aeb8c8" : "#ffffff"}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
        <ringGeometry args={[0.3, 0.55, 18]} />
        <meshBasicMaterial
          color="#aeb8c8"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={8}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial
          color="#d8d4cc"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function HealingFxMesh() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getHealingFx();
    const g = group.current;
    const ringMesh = ring.current;
    if (!g || !ringMesh) return;
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < HEALING_DURATION);
    g.visible = visible;
    if (!fx || !visible) return;
    const t = projectileProgress(age, HEALING_DURATION);
    const pulse = healingPulse(age);
    const y = groundY(fx.x, fx.z);
    g.position.set(fx.x, y, fx.z);
    ringMesh.scale.setScalar(0.75 + t * 2.1);
    const ringMaterial = ringMesh.material as THREE.MeshBasicMaterial;
    ringMaterial.opacity = pulse * 0.82;
    for (let index = 1; index < Math.min(6, g.children.length); index += 1) {
      const mote = g.children[index] as THREE.Mesh;
      const angle = (index / 5) * Math.PI * 2 + age * 2.8;
      const radius = 0.32 + index * 0.055;
      mote.position.set(
        Math.cos(angle) * radius,
        0.34 + t * (1 + index * 0.12),
        Math.sin(angle) * radius,
      );
      mote.scale.setScalar(0.9 + pulse * 1.15);
      const material = mote.material as THREE.MeshBasicMaterial;
      material.opacity = pulse * (index % 2 ? 0.95 : 0.72);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} renderOrder={7} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.46, 24]} />
        <meshBasicMaterial
          color="#ffd36a"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {[0, 1, 2, 3, 4].map((index) => (
        <mesh key={index} renderOrder={8}>
          <sphereGeometry args={[index % 2 ? 0.21 : 0.15, 8, 6]} />
          <meshBasicMaterial
            color={index % 2 ? "#fff8e7" : "#ffd36a"}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <pointLight color="#ffd36a" intensity={1.1} distance={2.4} />
    </group>
  );
}

function TamingFxMesh() {
  const attemptRing = useRef<THREE.Mesh>(null);
  const tether = useRef<THREE.Mesh>(null);
  const resultRing = useRef<THREE.Mesh>(null);
  const resultBurst = useRef<THREE.Mesh>(null);
  const motes = useRef<THREE.Group>(null);
  useFrame(() => {
    const world = getWorld();
    const player = world.people.find((person) => person.isPlayer);
    const target =
      world.player.intent.kind === "tame"
        ? world.fauna.find((creature) => creature.id === world.player.intent.targetId)
        : null;
    const appeal = target && player ? tamingPulse(world.player.workT) : 0;
    const attempting = Boolean(
      target && player && world.player.workT >= 0 && world.player.workT < TAMING_DURATION,
    );
    if (attemptRing.current) attemptRing.current.visible = attempting;
    if (tether.current) tether.current.visible = attempting;
    if (attempting && target && player && attemptRing.current && tether.current) {
      const targetY = groundY(target.x, target.z) + 0.08;
      const sourceY = groundY(player.x, player.z) + 0.72;
      attemptRing.current.position.set(target.x, targetY, target.z);
      attemptRing.current.scale.setScalar(0.8 + appeal * 0.8);
      (attemptRing.current.material as THREE.MeshBasicMaterial).opacity = 0.38 + appeal * 0.5;
      tether.current.position.set(
        (player.x + target.x) * 0.5,
        (sourceY + targetY + 0.5) * 0.5,
        (player.z + target.z) * 0.5,
      );
      tether.current.lookAt(target.x, targetY + 0.5, target.z);
      const length = Math.max(0.2, Math.hypot(target.x - player.x, target.z - player.z));
      tether.current.scale.set(0.7 + appeal * 0.35, 0.7 + appeal * 0.35, length * 4.1);
      (tether.current.material as THREE.MeshBasicMaterial).opacity = appeal * 0.48;
    }
    const fx = getTamingFx();
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const resultLive = Boolean(fx && age >= 0 && age < 0.78);
    if (resultRing.current) resultRing.current.visible = resultLive;
    if (resultBurst.current) resultBurst.current.visible = resultLive;
    if (motes.current) motes.current.visible = resultLive;
    if (!fx || !resultLive || !resultRing.current || !resultBurst.current || !motes.current) return;
    const t = projectileProgress(age, 0.78);
    const pulse = Math.sin(t * Math.PI);
    const color = fx.success ? "#fff1a8" : "#a85a42";
    const pale = fx.success ? "#ffffff" : "#8a8d90";
    const y = groundY(fx.x, fx.z);
    resultRing.current.position.set(fx.x, y + 0.08, fx.z);
    resultRing.current.scale.setScalar(0.9 + t * (fx.success ? 3.2 : 2.2));
    const ringMaterial = resultRing.current.material as THREE.MeshBasicMaterial;
    ringMaterial.color.set(color);
    ringMaterial.opacity = pulse * (fx.success ? 1 : 0.9);
    resultBurst.current.position.set(fx.x, y + 0.72, fx.z);
    resultBurst.current.scale.setScalar(0.8 + pulse * (fx.success ? 2.4 : 1.15));
    const burstMaterial = resultBurst.current.material as THREE.MeshBasicMaterial;
    burstMaterial.color.set(pale);
    burstMaterial.opacity = pulse * 0.82;
    motes.current.position.set(fx.x, y, fx.z);
    motes.current.rotation.y = age * (fx.success ? 3.8 : -5.2);
    for (let index = 0; index < motes.current.children.length; index += 1) {
      const mote = motes.current.children[index] as THREE.Mesh;
      const angle = (index / motes.current.children.length) * Math.PI * 2;
      const radius = 0.35 + index * 0.05;
      mote.position.set(
        Math.cos(angle) * radius,
        0.35 + t * (0.8 + index * 0.1),
        Math.sin(angle) * radius,
      );
      const material = mote.material as THREE.MeshBasicMaterial;
      material.color.set(index % 2 ? pale : color);
      material.opacity = pulse * 0.9;
    }
  });
  return (
    <group>
      <mesh ref={attemptRing} visible={false} renderOrder={7} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.48, 24]} />
        <meshBasicMaterial
          color="#e0b56a"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={tether} visible={false} renderOrder={6}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshBasicMaterial
          color="#ffd36a"
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={resultRing} visible={false} renderOrder={8} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.82, 32]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={resultBurst} visible={false} renderOrder={9}>
        <dodecahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <group ref={motes} visible={false}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <mesh key={index} renderOrder={9}>
            <sphereGeometry args={[index % 2 ? 0.18 : 0.14, 8, 6]} />
            <meshBasicMaterial
              transparent
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function CraftFxMesh() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const hotMetal = useRef<THREE.Mesh>(null);
  const workpiece = useRef<THREE.Mesh>(null);
  const pot = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);
  useFrame(() => {
    const fx = getCraftFx();
    const g = group.current;
    if (!g || !ring.current || !hotMetal.current || !workpiece.current || !pot.current || !particles.current) return;
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < CRAFTING_DURATION);
    g.visible = visible;
    if (!fx || !visible) return;
    const t = projectileProgress(age, CRAFTING_DURATION);
    const pose = craftingPose(fx.kind, age);
    const profile = craftingVisualProfile(fx.kind);
    const y = groundY(fx.x, fx.z);
    g.position.set(fx.x, y, fx.z);
    ring.current.scale.setScalar(0.7 + t * 2);
    const ringMaterial = ring.current.material as THREE.MeshBasicMaterial;
    ringMaterial.color.set(fx.success ? profile.primary : "#a85a42");
    ringMaterial.opacity = pose.work * 0.78;
    hotMetal.current.visible = fx.kind === "smithing";
    hotMetal.current.position.set(0, 0.32 + pose.strike * 0.05, 0.35);
    const metalMaterial = hotMetal.current.material as THREE.MeshStandardMaterial;
    metalMaterial.emissiveIntensity = 1.2 + pose.strike * 2.4;
    workpiece.current.visible = fx.kind === "carpentry";
    workpiece.current.position.set(0, 0.2, 0.38);
    workpiece.current.rotation.y = Math.sin(age * 12) * 0.08;
    pot.current.visible = fx.kind === "cooking";
    pot.current.position.set(0, 0.2, 0.34);
    pot.current.rotation.y = age * 2.5;
    particles.current.position.set(0, 0, 0.32);
    for (let index = 0; index < particles.current.children.length; index += 1) {
      const particle = particles.current.children[index] as THREE.Mesh;
      const angle = (index / particles.current.children.length) * Math.PI * 2;
      if (fx.kind === "smithing") {
        const radius = 0.18 + t * (0.7 + index * 0.04);
        particle.position.set(Math.cos(angle) * radius, 0.34 + Math.sin(t * Math.PI) * (0.6 + index * 0.04), Math.sin(angle) * radius);
      } else if (fx.kind === "carpentry") {
        const radius = 0.16 + t * (0.45 + index * 0.03);
        particle.position.set(Math.cos(angle) * radius, 0.22 + t * 0.35, Math.sin(angle) * radius);
      } else {
        const radius = 0.12 + index * 0.025;
        particle.position.set(Math.cos(angle + age * 2) * radius, 0.5 + t * (0.9 + index * 0.08), Math.sin(angle + age * 2) * radius);
      }
      if (fx.kind === "smithing") {
        particle.rotation.y = angle;
        particle.scale.set(0.4, 0.4, 2 + pose.strike * 0.9);
      } else if (fx.kind === "carpentry") particle.scale.set(2.2 + pose.work, 0.45, 0.9);
      else particle.scale.setScalar(1.5 + pose.work * 1.5);
      const material = particle.material as THREE.MeshBasicMaterial;
      material.color.set(fx.kind === "smithing" ? (index % 2 ? "#fff1a8" : "#ff7a2f") : fx.kind === "carpentry" ? (index % 2 ? "#fff0cf" : "#b57a3d") : "#f4f0e8");
      material.opacity = pose.work * (1 - t * 0.55);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} renderOrder={7} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.3, 0.5, 24]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
      <mesh ref={hotMetal} visible={false}><boxGeometry args={[1.15, 0.24, 0.4]} /><meshStandardMaterial color="#ff8a38" emissive="#ff5a1f" emissiveIntensity={1.6} metalness={0.55} roughness={0.3} /><group position={[0, 0.62, 0]} rotation={[0, 0, -0.45]}><mesh><boxGeometry args={[0.1, 1.15, 0.1]} /><meshStandardMaterial color="#5a3e28" /></mesh><mesh position={[0, 0.58, 0]}><boxGeometry args={[0.65, 0.28, 0.28]} /><meshStandardMaterial color="#e8e1d4" metalness={0.7} roughness={0.25} /></mesh></group></mesh>
      <mesh ref={workpiece} visible={false}><boxGeometry args={[2.1, 0.24, 0.58]} /><meshStandardMaterial color="#8b5f35" roughness={0.9} /><group position={[0, 0.58, 0]} rotation={[0.15, 0, 0.45]}><mesh><boxGeometry args={[1.15, 0.36, 0.06]} /><meshStandardMaterial color="#ece6d8" metalness={0.55} roughness={0.3} /></mesh><mesh position={[0, 0.3, 0]}><boxGeometry args={[0.28, 0.55, 0.13]} /><meshStandardMaterial color="#5a3e28" roughness={0.9} /></mesh></group></mesh>
      <group ref={pot} visible={false}><mesh><cylinderGeometry args={[0.72, 0.58, 0.68, 14]} /><meshStandardMaterial color="#5a554d" metalness={0.35} roughness={0.55} /></mesh><mesh position={[0, 0.34, 0]}><torusGeometry args={[0.62, 0.065, 7, 20]} /><meshStandardMaterial color="#a09b91" metalness={0.45} roughness={0.4} /></mesh><group position={[0.18, 0.88, 0]} rotation={[0, 0, 0.45]}><mesh><cylinderGeometry args={[0.055, 0.055, 1.45, 7]} /><meshStandardMaterial color="#a87842" roughness={0.85} /></mesh><mesh position={[0, -0.76, 0]}><sphereGeometry args={[0.21, 9, 7]} /><meshStandardMaterial color="#a87842" roughness={0.85} /></mesh></group></group>
      <group ref={particles}>{Array.from({ length: 10 }, (_, index) => <mesh key={index} renderOrder={8}><sphereGeometry args={[index % 2 ? 0.1 : 0.075, 7, 5]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} /></mesh>)}</group>
    </group>
  );
}

function NpcInteractionFxMesh() {
  const root = useRef<THREE.Group>(null);
  const talk = useRef<THREE.Group>(null);
  const heal = useRef<THREE.Group>(null);
  const trade = useRef<THREE.Group>(null);
  const bank = useRef<THREE.Group>(null);
  const recruit = useRef<THREE.Group>(null);
  const tradeGlyph = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const group = root.current;
    const world = getWorld();
    const fx = getNpcInteractionFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < NPC_INTERACTION_DURATION);
    if (tradeGlyph.current) tradeGlyph.current.style.display = live && fx?.kind === "trade" ? "grid" : "none";
    if (!group) return;
    group.visible = live;
    if (!fx || !live) return;
    const target = fx.targetId ? world.people.find((person) => person.id === fx.targetId) : null;
    const player = world.people.find((person) => person.isPlayer);
    const x = target?.x ?? fx.x;
    const z = target?.z ?? fx.z;
    const pose = npcInteractionPose(fx.kind, age);
    const phase = Math.max(0, Math.min(1, age / NPC_INTERACTION_DURATION));
    const pulse = Math.sin(phase * Math.PI);
    group.position.set(x, heightAt(world, x, z) + 0.12, z);
    for (const [ref, kind] of [[talk, "talk"], [heal, "heal"], [trade, "trade"], [bank, "bank"], [recruit, "recruit"]] as const) if (ref.current) ref.current.visible = fx.kind === kind;
    if (talk.current) { talk.current.position.y = 1.65 + pulse * 0.65; talk.current.scale.setScalar(1.2 + pulse * 0.5); }
    if (heal.current) { heal.current.position.y = pulse * 0.45; heal.current.rotation.y = age * 3.6; heal.current.scale.setScalar(1.1 + pulse * 0.65); }
    if (trade.current) { trade.current.position.y = 0.48 + pose.lift; trade.current.rotation.y = player ? Math.atan2(player.x - x, player.z - z) : 0; trade.current.scale.setScalar(1 + pulse * 0.3); }
    if (bank.current) { bank.current.position.y = 0.18 + pulse * 0.38; bank.current.scale.setScalar(0.9 + pulse * 0.3); }
    if (recruit.current) { recruit.current.position.y = 1.35 + pulse * 0.65; recruit.current.rotation.y = -age * 3; recruit.current.scale.setScalar(1.3 + pulse * 0.5); }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={talk}>{[-0.65, 0, 0.65].map((x, index) => <mesh key={x} position={[x, index * 0.36, 0]}><sphereGeometry args={[0.32 + index * 0.08, 8, 6]} /><meshBasicMaterial color="#fff0c8" depthTest={false} /></mesh>)}</group>
      <group ref={heal}>
        {[0, 0.48, 0.96].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.05 + y * 0.44, 1.2 + y * 0.44, 24]} /><meshBasicMaterial color="#a9e2cf" transparent opacity={0.48} depthWrite={false} /></mesh>)}
        {Array.from({ length: 10 }, (_, index) => { const angle = index * Math.PI * 2 / 10; return <mesh key={index} position={[Math.cos(angle) * 1.45, 0.72 + (index % 3) * 0.42, Math.sin(angle) * 1.45]}><octahedronGeometry args={[0.3, 0]} /><meshBasicMaterial color="#e8fff5" depthTest={false} /></mesh>; })}
      </group>
      <group ref={trade}>
        <group position={[2.2, 0, 0]}>
          <mesh scale={[1, 0.82, 0.78]}><sphereGeometry args={[0.66, 10, 8]} /><meshStandardMaterial color="#8a633e" roughness={0.9} /></mesh>
          <mesh position={[0, 0.56, 0]}><coneGeometry args={[0.32, 0.46, 10]} /><meshStandardMaterial color="#b58c58" roughness={0.86} /></mesh>
          <mesh position={[0, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.06, 7, 16]} /><meshBasicMaterial color="#e0b86d" /></mesh>
          {[-0.48, 0, 0.48].map((x) => <mesh key={x} position={[x, 0.82 + Math.abs(x) * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.08, 12]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>)}
        </group>
        <mesh position={[0, 1.12, 1]}><boxGeometry args={[0.16, 0.16, 1.5]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>
        <mesh position={[0, 1.12, 1.78]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.3, 0.48, 8]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>
        <mesh position={[0, 1.12, 0.22]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.3, 0.48, 8]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>
      </group>
      <Html position={[0, 2.15, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div ref={tradeGlyph} style={{ display: "none", placeItems: "center", width: 54, height: 38, border: "1px solid #ffd36a", borderRadius: 10, background: "rgba(20,18,15,.9)", color: "#ffd36a", fontSize: 30, fontWeight: 800, lineHeight: 1 }}>↔</div>
      </Html>
      <group ref={bank}>
        <mesh><boxGeometry args={[1.3, 0.72, 0.92]} /><meshStandardMaterial color="#5b4030" roughness={0.92} /></mesh>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.38, 0.16, 1]} /><meshStandardMaterial color="#8a633e" roughness={0.86} /></mesh>
        {[-0.48, 0, 0.48].map((x) => <mesh key={x} position={[x, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.17, 0.17, 0.07, 12]} /><meshBasicMaterial color="#ffd36a" /></mesh>)}
      </group>
      <group ref={recruit}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.12, 0.16, 8, 24]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>
        {Array.from({ length: 8 }, (_, index) => { const angle = index * Math.PI / 4; return <mesh key={index} position={[Math.cos(angle) * 1.52, (index % 2) * 0.62, Math.sin(angle) * 1.52]}><octahedronGeometry args={[0.46, 0]} /><meshBasicMaterial color="#fff0ae" depthTest={false} /></mesh>; })}
      </group>
    </group>
  );
}

function CompanionFxMesh() {
  const root = useRef<THREE.Group>(null);
  const feed = useRef<THREE.Group>(null);
  const foodMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const stay = useRef<THREE.Group>(null);
  const follow = useRef<THREE.Group>(null);
  const release = useRef<THREE.Group>(null);
  const name = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = root.current;
    const world = getWorld();
    const fx = getCompanionFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < COMPANION_DURATION);
    if (!group) return;
    group.visible = live;
    if (!fx || !live) return;
    const target = world.fauna.find((creature) => creature.id === fx.targetId);
    const player = world.people.find((person) => person.isPlayer);
    const x = target?.x ?? fx.x;
    const z = target?.z ?? fx.z;
    const pose = companionPose(fx.kind, age);
    const phase = Math.max(0, Math.min(1, age / COMPANION_DURATION));
    const pulse = Math.sin(phase * Math.PI);
    group.position.set(x, heightAt(world, x, z) + 0.12, z);
    for (const [ref, kind] of [[feed, "feed"], [stay, "stay"], [follow, "follow"], [release, "release"], [name, "name"]] as const) {
      if (ref.current) ref.current.visible = fx.kind === kind;
    }
    const towardPlayer = player ? Math.atan2(player.x - x, player.z - z) : 0;
    if (feed.current) { feed.current.position.y = 0.12; feed.current.rotation.y = towardPlayer; feed.current.scale.setScalar(1.35 + pulse * 0.45); }
    if (foodMaterial.current && fx.kind === "feed") foodMaterial.current.color.set(["meat", "cooked_meat", "stew"].includes(fx.item) ? "#c76b58" : "#86ad58");
    if (stay.current) stay.current.scale.setScalar(0.82 + pulse * 0.42);
    if (follow.current) { follow.current.position.y = 0.58 + pose.hop; follow.current.position.z = pulse * 0.62; follow.current.rotation.y = towardPlayer; follow.current.scale.setScalar(1.45 + pulse * 0.42); }
    if (release.current) { release.current.scale.setScalar(0.72 + pulse * 1.25); release.current.rotation.y = age * 3.4; }
    if (name.current) { name.current.position.y = 1.5 + pulse * 0.55; name.current.rotation.y = -age * 3.8; name.current.scale.setScalar(1.35 + pulse * 0.32); }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={feed}>
        <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.62, 0.82, 0.3, 12]} /><meshStandardMaterial color="#384754" metalness={0.18} roughness={0.72} /></mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.66, 0.08, 7, 18]} /><meshBasicMaterial color="#9fb5c2" /></mesh>
        <mesh position={[0, 0.28, 0]}><sphereGeometry args={[0.42, 9, 7]} /><meshStandardMaterial ref={foodMaterial} color="#86ad58" emissive="#3e5a28" emissiveIntensity={0.42} roughness={0.8} /></mesh>

        {[-0.72, 0, 0.72].map((x) => <mesh key={x} position={[x, 0.82 + Math.abs(x) * 0.18, 0]}><sphereGeometry args={[0.18, 8, 6]} /><meshBasicMaterial color="#ffd36a" /></mesh>)}
      </group>
      <group ref={stay}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.72, 1.02, 24]} /><meshBasicMaterial color="#7fb6a1" transparent opacity={0.82} depthWrite={false} /></mesh>
        <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.82, 0.12, 0.82]} /><meshBasicMaterial color="#b8ddd1" transparent opacity={0.65} /></mesh>
      </group>
      <group ref={follow}>
        {[0, 0.82, 1.64].map((z) => <group key={z} position={[0, 0, z]}>{[-1, 1].map((side) => <mesh key={side} position={[side * 0.3, 0, 0]} rotation={[0, side * 0.72, 0]}><boxGeometry args={[0.2, 0.16, 0.96]} /><meshBasicMaterial color={z === 0.82 ? "#ffd36a" : "#ff9f32"} transparent opacity={0.96} /></mesh>)}</group>)}
      </group>
      <group ref={release}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.64, 0.9, 24]} /><meshBasicMaterial color="#d68162" transparent opacity={0.78} depthWrite={false} /></mesh>
        {Array.from({ length: 8 }, (_, index) => { const angle = index * Math.PI / 4; return <mesh key={index} position={[Math.cos(angle) * 0.92, 0.36 + (index % 2) * 0.28, Math.sin(angle) * 0.92]} rotation={[angle, angle, angle]}><boxGeometry args={[0.16, 0.08, 0.42]} /><meshBasicMaterial color="#c47951" /></mesh>; })}
      </group>
      <group ref={name}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.9, 0.14, 8, 22]} /><meshBasicMaterial color="#ffd36a" depthTest={false} /></mesh>
        {Array.from({ length: 7 }, (_, index) => { const angle = index * Math.PI * 2 / 7; return <mesh key={index} position={[Math.cos(angle) * 1.32, 0.22 + (index % 2) * 0.56, Math.sin(angle) * 1.32]} rotation={[0, angle, Math.PI / 4]}><octahedronGeometry args={[0.5, 0]} /><meshBasicMaterial color={index % 2 ? "#fff3bd" : "#ffd36a"} depthTest={false} /></mesh>; })}
      </group>
    </group>
  );
}

function ConstructionFxMesh() {
  const root = useRef<THREE.Group>(null);
  const scaffold = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Group>(null);
  const hammer = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const group = root.current;
    const world = getWorld();
    const fx = getConstructionFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const live = Boolean(fx && age >= 0 && age < CONSTRUCTION_DURATION);
    if (!group) return;
    group.visible = live;
    if (!fx || !live) return;
    const pose = constructionPose(age);
    const phase = Math.max(0, Math.min(1, age / CONSTRUCTION_DURATION));
    const pulse = Math.sin(phase * Math.PI);
    group.position.set(fx.x, heightAt(world, fx.x, fx.z) + 0.08, fx.z);
    if (scaffold.current) {
      scaffold.current.scale.y = Math.max(0.08, pose.lift);
      scaffold.current.position.y = -1.9 * (1 - pose.lift);
    }
    if (dust.current) {
      dust.current.position.y = 0.15 + pulse * 0.72;
      dust.current.scale.setScalar(0.75 + pulse * 0.55);
      dust.current.rotation.y = age * 2.8;
    }
    if (hammer.current) hammer.current.rotation.z = -0.48 + pose.hammer * 0.42;
    if (ring.current) ring.current.scale.setScalar(1 + pulse * 0.34);
    if (ringMaterial.current) {
      ringMaterial.current.color.set(fx.source === "deed" ? "#a9d7cf" : "#ffd36a");
      ringMaterial.current.opacity = 0.32 + pulse * 0.46;
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.6, 4.05, 32]} />
        <meshBasicMaterial ref={ringMaterial} color="#ffd36a" transparent opacity={0.62} depthWrite={false} depthTest={false} />
      </mesh>
      <group ref={scaffold}>
        {[[-3.3, -3.3], [-3.3, 3.3], [3.3, -3.3], [3.3, 3.3]].map(([x, z]) => (
          <mesh key={`${x},${z}`} position={[x, 2, z]}>
            <boxGeometry args={[0.2, 4, 0.2]} />
            <meshStandardMaterial color="#c58a4a" emissive="#5a3218" emissiveIntensity={0.3} roughness={0.86} />
          </mesh>
        ))}
        {[0.9, 2.1, 3.3].flatMap((y) => [
          <mesh key={`x-${y}-a`} position={[0, y, -3.3]}><boxGeometry args={[6.8, 0.18, 0.18]} /><meshStandardMaterial color="#e0ad68" roughness={0.84} /></mesh>,
          <mesh key={`x-${y}-b`} position={[0, y, 3.3]}><boxGeometry args={[6.8, 0.18, 0.18]} /><meshStandardMaterial color="#e0ad68" roughness={0.84} /></mesh>,
          <mesh key={`z-${y}-a`} position={[-3.3, y, 0]}><boxGeometry args={[0.18, 0.18, 6.8]} /><meshStandardMaterial color="#e0ad68" roughness={0.84} /></mesh>,
          <mesh key={`z-${y}-b`} position={[3.3, y, 0]}><boxGeometry args={[0.18, 0.18, 6.8]} /><meshStandardMaterial color="#e0ad68" roughness={0.84} /></mesh>,
        ])}
      </group>
      <group ref={hammer} position={[2.75, 1.55, 0]} rotation={[0.08, 0, -0.48]}>
        <mesh>
          <boxGeometry args={[0.18, 2.15, 0.18]} />
          <meshBasicMaterial color="#a96732" depthTest={false} />
        </mesh>
        <mesh position={[0, 1.08, 0]}>
          <boxGeometry args={[1.15, 0.42, 0.42]} />
          <meshBasicMaterial color="#667078" depthTest={false} />
        </mesh>
      </group>
      <group ref={dust}>
        {Array.from({ length: 14 }, (_, index) => {
          const angle = (index / 14) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * (2.8 + (index % 2) * 0.7), 0.18 + (index % 4) * 0.22, Math.sin(angle) * (2.8 + (index % 2) * 0.7)]}>
              <sphereGeometry args={[0.42 + (index % 3) * 0.1, 8, 6]} />
              <meshBasicMaterial color={index % 2 ? "#e3c18c" : "#bd8e58"} transparent opacity={0.5} depthWrite={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function ExtractionFxMesh() {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const lumber = useRef<THREE.Group>(null);
  const mining = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = root.current;
    const world = getWorld();
    const fx = getExtractionFx(world);
    if (!group || !fx) {
      if (group) group.visible = false;
      return;
    }
    const age = (world.hour - fx.at) * SECONDS_PER_HOUR;
    const live = age >= 0 && age < EXTRACTION_DURATION;
    group.visible = live;
    if (!live) return;
    const phase = Math.max(0, Math.min(1, age / EXTRACTION_DURATION));
    const pulse = Math.sin(phase * Math.PI);
    const profile = extractionVisualProfile(fx.kind);
    group.position.set(fx.x, heightAt(world, fx.x, fx.z) + 0.1, fx.z);
    if (ring.current) ring.current.scale.setScalar(0.85 + pulse * 0.9);
    if (ringMaterial.current) {
      ringMaterial.current.color.set(fx.success ? profile.primary : "#a85a42");
      ringMaterial.current.opacity = 0.28 + pulse * 0.58;
    }
    if (lumber.current) {
      lumber.current.visible = fx.kind === "lumberjacking";
      lumber.current.position.y = 0.62 + pulse * 0.55;
      lumber.current.rotation.y = age * 3.2;
      lumber.current.scale.setScalar(0.82 + pulse * 0.42);
    }
    if (mining.current) {
      mining.current.visible = fx.kind === "mining";
      mining.current.position.y = 0.28 + pulse * 0.38;
      mining.current.rotation.y = 0;
      mining.current.scale.setScalar(1 + pulse * 0.3);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.08, 24]} />
        <meshBasicMaterial ref={ringMaterial} color="#e2b66f" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <group ref={lumber}>
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0.12, x * 0.55, x * 0.7]}>
            <boxGeometry args={[0.48, 0.3, 1.18]} />
            <meshStandardMaterial color="#8a5e34" emissive="#4e2d18" emissiveIntensity={0.24} roughness={0.9} />
          </mesh>
        ))}
        {Array.from({ length: 7 }, (_, index) => {
          const angle = (index / 7) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.86, 0.18 + (index % 2) * 0.24, Math.sin(angle) * 0.86]} rotation={[angle, angle * 0.7, angle * 1.2]}>
              <boxGeometry args={[0.14, 0.12, 0.48]} />
              <meshStandardMaterial color="#f0c47c" emissive="#6a3e20" emissiveIntensity={0.35} roughness={0.82} />
            </mesh>
          );
        })}
      </group>
      <group ref={mining}>
        <group position={[1.25, 1.18, 0]} rotation={[0.1, 0, -0.62]}>
          <mesh>
            <boxGeometry args={[0.16, 1.55, 0.16]} />
            <meshBasicMaterial color="#c87934" depthTest={false} />
          </mesh>
          <mesh position={[0, 0.77, 0]}>
            <boxGeometry args={[1.16, 0.2, 0.2]} />
            <meshBasicMaterial color="#263b4c" depthTest={false} />
          </mesh>
        </group>
        {[-0.72, 0, 0.72].map((x, index) => (
          <mesh key={x} position={[x, index === 1 ? 0.25 : 0, (index - 1) * 0.18]} rotation={[index * 0.6, index, index * 0.4]}>
            <dodecahedronGeometry args={[index === 1 ? 0.56 : 0.4, 0]} />
            <meshStandardMaterial color="#aaa69d" emissive="#58534c" emissiveIntensity={0.38} roughness={0.68} metalness={0.2} />
          </mesh>
        ))}
        {Array.from({ length: 5 }, (_, index) => {
          const angle = Math.PI * 0.72 + (index / 4) * Math.PI * 1.15;
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.82, 0.78 + Math.sin(angle) * 0.58, 0.22]} rotation={[0, 0, angle - Math.PI / 2]}>
              <boxGeometry args={[0.1, 0.72, 0.1]} />
              <meshBasicMaterial color={index % 2 ? "#fff4c9" : "#ff8a24"} transparent opacity={0.98} depthTest={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function CorpseFxMesh() {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const skin = useRef<THREE.Group>(null);
  const loot = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = root.current;
    const fx = getCorpseFx();
    if (!group || !fx) {
      if (group) group.visible = false;
      return;
    }
    const world = getWorld();
    const age = corpseFxAge(world, fx);
    const live = age >= 0 && age < CORPSE_DURATION;
    group.visible = live;
    if (!live) return;
    const pose = corpsePose(fx.kind, age);
    const phase = Math.max(0, Math.min(1, age / CORPSE_DURATION));
    const pulse = Math.sin(phase * Math.PI);
    group.position.set(fx.x, heightAt(world, fx.x, fx.z) + 0.12, fx.z);
    if (ring.current) ring.current.scale.setScalar(0.9 + pulse * 0.8);
    if (ringMaterial.current) {
      ringMaterial.current.color.set(fx.kind === "skinning" ? "#d09a72" : "#ffd36a");
      ringMaterial.current.opacity = 0.3 + pulse * 0.48;
    }
    if (skin.current) {
      skin.current.visible = fx.kind === "skinning";
      skin.current.rotation.y = pose.cut * 0.18;
      skin.current.position.y = 0.34 + pulse * 0.22;
    }
    if (loot.current) {
      loot.current.visible = fx.kind === "looting";
      loot.current.position.y = 0.12 + pulse * 0.72;
      loot.current.rotation.y = age * 4.5;
      loot.current.scale.setScalar(0.88 + pulse * 0.32);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.2, 24]} />
        <meshBasicMaterial ref={ringMaterial} color="#d09a72" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <group ref={skin}>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[-0.2, 0, x * 0.8]}>
            <boxGeometry args={[0.72, 0.08, 1.15]} />
            <meshStandardMaterial color="#d8aa78" emissive="#6a3a24" emissiveIntensity={0.24} roughness={0.9} />
          </mesh>
        ))}
        {[-0.48, 0, 0.48].map((x) => (
          <mesh key={x} position={[x, 0.08, 0]} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[0.11, 0.07, 1.18]} />
            <meshBasicMaterial color="#f08a62" transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <group ref={loot}>
        <mesh position={[0, 0, 0]} scale={[1, 0.8, 0.75]}>
          <sphereGeometry args={[0.68, 12, 9]} />
          <meshStandardMaterial color="#8a633e" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[0.3, 0.42, 10]} />
          <meshStandardMaterial color="#b08a58" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.055, 6, 14]} />
          <meshStandardMaterial color="#d6b46d" roughness={0.8} />
        </mesh>
        {[-0.56, -0.28, 0, 0.28, 0.56].map((x, index) => (
          <mesh key={x} position={[x, 0.42 + (index % 3) * 0.16, (index % 2 ? -1 : 1) * 0.18]} rotation={[Math.PI / 2, 0, index * 0.4]}>
            <cylinderGeometry args={[0.17, 0.17, 0.07, 12]} />
            <meshStandardMaterial color="#ffd36a" emissive="#c98a24" emissiveIntensity={0.65} metalness={0.58} roughness={0.28} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GatheringFxMesh() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const bed = useRef<THREE.Mesh>(null);
  const crop = useRef<THREE.Group>(null);
  const sapling = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);
  useFrame(() => {
    const fx = getGatheringFx();
    const g = group.current;
    if (!g || !ring.current || !bed.current || !crop.current || !sapling.current || !particles.current) return;
    const age = fx ? (getWorld().hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && age >= 0 && age < GATHERING_DURATION);
    g.visible = visible;
    if (!fx || !visible) return;
    const t = projectileProgress(age, GATHERING_DURATION);
    const pose = gatheringPose(fx.kind, age);
    const profile = gatheringVisualProfile(fx.kind);
    g.position.set(fx.x, groundY(fx.x, fx.z), fx.z);
    ring.current.scale.setScalar(0.8 + t * 2.3);
    const ringMaterial = ring.current.material as THREE.MeshBasicMaterial;
    ringMaterial.color.set(fx.success ? profile.primary : "#a85a42");
    ringMaterial.opacity = pose.work * 0.72;
    bed.current.visible = fx.kind === "tilling";
    bed.current.scale.set(1 + pose.strike * 0.35, 1, 1 + pose.strike * 0.35);
    crop.current.visible = fx.kind === "harvesting";
    crop.current.position.y = 0.18 + pose.pull * 0.85;
    crop.current.rotation.y = age * 3;
    sapling.current.visible = fx.kind === "forestry";
    sapling.current.scale.setScalar(0.6 + pose.settle * 0.85);
    sapling.current.position.y = 0.12 + pose.settle * 0.18;
    for (let index = 0; index < particles.current.children.length; index += 1) {
      const particle = particles.current.children[index] as THREE.Mesh;
      const angle = (index / particles.current.children.length) * Math.PI * 2;
      const radius = fx.kind === "sowing" ? 0.25 + t * (0.8 + index * 0.025) : 0.18 + t * (0.65 + index * 0.03);
      const lift = fx.kind === "tilling" ? Math.sin(t * Math.PI) * (0.55 + index * 0.03) : fx.kind === "sowing" ? 0.75 + Math.sin(t * Math.PI) * 0.5 - t * 0.65 : 0.25 + Math.sin(t * Math.PI) * 0.7;
      particle.position.set(Math.cos(angle) * radius, lift, Math.sin(angle) * radius);
      particle.scale.setScalar(fx.kind === "sowing" ? 1.2 : fx.kind === "harvesting" ? 1.7 : 1.45);
      const material = particle.material as THREE.MeshBasicMaterial;
      material.color.set(fx.kind === "tilling" ? (index % 2 ? "#a96f3d" : "#5a3e28") : fx.kind === "sowing" ? "#f2d77e" : fx.kind === "harvesting" ? (index % 2 ? "#d9b65f" : "#6f914e") : "#80a958");
      material.opacity = pose.work * (1 - t * 0.45);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} renderOrder={7} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.32, 0.52, 24]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
      <mesh ref={bed} visible={false} position={[0, 0.14, 0]}><boxGeometry args={[1.5, 0.2, 1.5]} /><meshStandardMaterial color="#5a3e28" roughness={0.98} /></mesh>
      <group ref={crop} visible={false}>{[-0.3, 0, 0.3].map((x) => <group key={x} position={[x, 0, Math.abs(x) * 0.25]}><mesh position={[0, 0.38, 0]}><boxGeometry args={[0.08, 0.75, 0.08]} /><meshStandardMaterial color="#d9b65f" roughness={0.9} /></mesh><mesh position={[0, 0.8, 0]}><sphereGeometry args={[0.22, 8, 6]} /><meshStandardMaterial color="#6f914e" roughness={0.85} /></mesh></group>)}</group>
      <group ref={sapling} visible={false}><mesh position={[0, 0.5, 0]}><boxGeometry args={[0.12, 1, 0.12]} /><meshStandardMaterial color="#6a4a32" roughness={0.9} /></mesh><mesh position={[0, 1.15, 0]}><coneGeometry args={[0.58, 1.1, 7]} /><meshStandardMaterial color="#80a958" roughness={0.86} /></mesh></group>
      <group ref={particles}>{Array.from({ length: 12 }, (_, index) => <mesh key={index} renderOrder={8}><sphereGeometry args={[0.11, 7, 5]} /><meshBasicMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} /></mesh>)}</group>
    </group>
  );
}

function CombatFxMesh() {
  const arrow = useRef<THREE.Group>(null);
  const impact = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = getCombatFx();
    const arrowGroup = arrow.current;
    const impactMesh = impact.current;
    const ringMesh = ring.current;
    if (!arrowGroup || !impactMesh || !ringMesh) return;
    if (!fx) {
      arrowGroup.visible = false;
      impactMesh.visible = false;
      ringMesh.visible = false;
      return;
    }
    const age = (getWorld().hour - fx.at) * SECONDS_PER_HOUR;
    const flight = projectileProgress(age, 0.36);
    const impactT = projectileProgress(age - (fx.kind === "arrow" ? 0.24 : 0), 0.34);
    arrowGroup.visible = fx.kind === "arrow" && age >= 0 && age < 0.4;
    if (arrowGroup.visible) {
      const sourceY = groundY(fx.x, fx.z) + 0.92;
      const targetY = groundY(fx.tx, fx.tz) + 0.68;
      arrowGroup.position.set(
        fx.x + (fx.tx - fx.x) * flight,
        sourceY + (targetY - sourceY) * flight,
        fx.z + (fx.tz - fx.z) * flight,
      );
      arrowGroup.lookAt(fx.tx, targetY, fx.tz);
      arrowGroup.scale.setScalar(1.45);
    }
    const showImpact = age >= 0 && impactT > 0 && impactT < 1;
    impactMesh.visible = showImpact;
    ringMesh.visible = showImpact;
    if (showImpact) {
      const color = fx.clean ? (fx.kind === "arrow" ? "#d8efff" : "#e0b56a") : "#9a9286";
      impactMesh.position.set(fx.tx, groundY(fx.tx, fx.tz) + 0.7, fx.tz);
      impactMesh.scale.setScalar(
        (fx.kind === "arrow" ? 0.65 : 0.8) + Math.sin(impactT * Math.PI) * 1.1,
      );
      const impactMat = impactMesh.material as THREE.MeshBasicMaterial;
      impactMat.color.set(color);
      impactMat.opacity = 0.72 * (1 - impactT);
      ringMesh.position.set(fx.tx, groundY(fx.tx, fx.tz) + 0.06, fx.tz);
      ringMesh.scale.setScalar(0.65 + impactT * 1.5);
      const ringMat = ringMesh.material as THREE.MeshBasicMaterial;
      ringMat.color.set(color);
      ringMat.opacity = 0.68 * (1 - impactT);
    }
  });
  return (
    <group>
      <group ref={arrow} visible={false}>
        <mesh renderOrder={7} position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.016, 0.82, 6]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.54, 5]} />
          <meshBasicMaterial color="#ffffff" depthTest={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={8} position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.22, 6]} />
          <meshStandardMaterial
            color="#d8efff"
            emissive="#8ec8ff"
            emissiveIntensity={0.5}
            metalness={0.3}
            roughness={0.35}
          />
        </mesh>
        <pointLight color="#8ec8ff" intensity={0.8} distance={1.8} />
      </group>
      <mesh ref={impact} visible={false}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial
          color="#e0b56a"
          transparent
          opacity={0.7}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.3, 16]} />
        <meshBasicMaterial
          color="#e0b56a"
          transparent
          opacity={0.65}
          depthWrite={false}
          toneMapped={false}
        />
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
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 32]}
      frustumCulled={false}
      raycast={() => {}}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

export function WorldScene() {
  const graphics = useGraphicsSettings();
  return (
    <Canvas
      className="h-full w-full touch-none"
      shadows={graphics.shadows}
      data-graphics-shadows={graphics.shadows ? "on" : "off"}
      data-horizon-tree-reduction={graphics.horizonTreeReduction}
      dpr={[1, 1.5]}
      camera={{ position: [COURT.tx + 16, 23, COURT.ty + 20], fov: 48, near: 0.2, far: 480 }}
      gl={{ antialias: true, alpha: false }}
      onContextMenu={(e) => e.preventDefault()}
      onCreated={({ gl }) => {
        gl.setClearColor("#1a1c18", 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.36;
        gl.shadowMap.enabled = getGraphicsSettings().shadows;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      <Lighting shadows={graphics.shadows} />
      <GraphicsProbe />
      <Sky />
      <WeatherFx />
      <Horizon treeReduction={graphics.horizonTreeReduction} />
      <Terrain />
      <Buildings />
      <Crops />
      <People />
      <Fauna />
      <Piles />
      <Campfires />
      <Gates />
      <WalkMarker />
      <MarkStones />
      <CastFxMesh />
      <TravelFxMesh />
      <MoongateTravelFxMesh />
      <FizzleFxMesh />
      <HealingFxMesh />
      <TamingFxMesh />
      <CraftFxMesh />
      <GatheringFxMesh />
      <NpcInteractionFxMesh />
      <CompanionFxMesh />
      <ConstructionFxMesh />
      <ExtractionFxMesh />
      <CorpseFxMesh />
      <CombatFxMesh />
      <DeathFxMesh />
      <ChipBits />
      <PlacePointer />
      <Rig />
      <SimClock />
    </Canvas>
  );
}

export default WorldScene;
