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

const N_CLOUD = 64;
const PUFFS = 5;
const N_PUFF = N_CLOUD * PUFFS;
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

function SkyDome() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#c5d0c4") },
      uMid: { value: new THREE.Color("#8b9e95") },
      uHorizon: { value: new THREE.Color("#6a7a5c") },
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
    const u = uniforms;
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
      <sphereGeometry args={[400, 28, 18]} />
      <shaderMaterial
        ref={mat}
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
varying vec3 vN;
void main() {
  float h = clamp(vN.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.42, 0.62, h));
  c = mix(c, uZenith, smoothstep(0.62, 0.92, h));
  gl_FragColor = vec4(c, 1.0);
}
`}
      />
    </mesh>
  );
}

function Clouds() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const stock = useMemo(() => {
    return Array.from({ length: N_CLOUD }, (_, i) => {
      const a = hash2(i, 2, 11) * Math.PI * 2;
      const far = hash2(i, 5, 13);
      const r = 220 + far * 85;
      const y = 188 + hash2(i, 8, 17) * 38 + far * 14;
      const s = 4.2 + hash2(i, 3, 19) * 5.2 + far * 2.4;
      const puffs = Array.from({ length: PUFFS }, (_, k) => ({
        dx: (hash2(i, k, 31) - 0.5) * 2.1,
        dy: (hash2(i, k, 37) - 0.4) * 0.85,
        dz: (hash2(i, k, 41) - 0.5) * 1.5,
        sc: 0.48 + hash2(i, k, 43) * 0.62,
      }));
      return {
        a,
        r,
        y,
        s,
        v: 0.04 + hash2(i, 7, 23) * 0.06,
        puffs,
      };
    });
  }, []);

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
    mat.opacity = night ? 0.18 : 0.42;
    const t = clock.getElapsedTime();
    let n = 0;
    for (let i = 0; i < N_CLOUD; i++) {
      const c = stock[i]!;
      const a = c.a + t * c.v * 0.028;
      const cx = px + Math.cos(a) * c.r;
      const cz = pz + Math.sin(a) * c.r;
      const cy = py + c.y;
      const near = Math.hypot(cx - camera.position.x, cy - camera.position.y, cz - camera.position.z);
      const hide = near < 150 ? 0.01 : 1;
      for (const puff of c.puffs) {
        dummy.position.set(cx + puff.dx * c.s, cy + puff.dy * c.s, cz + puff.dz * c.s);
        dummy.scale.set(c.s * puff.sc * 1.15 * hide, c.s * puff.sc * 0.86 * hide, c.s * puff.sc * 1.05 * hide);
        dummy.updateMatrix();
        m.setMatrixAt(n++, dummy.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N_PUFF]} frustumCulled={false} raycast={() => {}} renderOrder={-12}>
      <sphereGeometry args={[1, 9, 7]} />
      <meshBasicMaterial
        color="#f4f1ea"
        transparent
        opacity={0.42}
        depthWrite={false}
        fog={false}
        toneMapped={false}
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
      <Clouds />
      <Birds />
    </group>
  );
}
