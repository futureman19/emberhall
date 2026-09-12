import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
import { SECONDS_PER_HOUR } from "@/game/catalog";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { getCombatFx, getTamingFx } from "@/game/player";
import { TAMING_DURATION, tamingPulse } from "@/game/taming-animation";
import { COMPANION_DURATION, companionLabel, companionPose, getCompanionFx } from "@/game/companion-animation";
import { useGame } from "@/game/store";
import type { Creature, FaunaKind } from "@/game/types";
import { FaunaArtBody } from "./fauna-art";

const COLOR: Record<FaunaKind, string> = {
  hare: "#c4a882",
  hart: "#8a6a42",
  wolf: "#6a6a68",
  wight: "#c9c3b6",
  brambleback_stag: "#4d7a4f",
  ironwood_boar: "#7c5a39",
  pine_lynx: "#4f4f5f",
  ember_fox: "#c45f2b",
  moss_badger: "#6f5d44",
  ridgeback_warg: "#6d5c4e",
  thornhide_doe: "#5f774c",
  mire_croaker: "#5d7045",
  reedback_stalker: "#2f3a4a",
  bog_toad: "#5d7a5c",
  saltback_tortoise: "#6d5a44",
  brine_hound: "#6f8aa2",
  dune_crawler: "#b07a3f",
  coal_salamander: "#4d4c46",
  orebeetle: "#6f5b3a",
  stonecrawl_spider: "#3f4c58",
  greybarrow_wightling: "#8a8b8f",
  barrow_hound: "#6a6559",
  ashen_banshee: "#ddd7dd",
  bonecrow: "#3f3f44",
  brine_troll: "#5b6456",
  stonefang_ogre: "#6f6654",
  orc_marauder: "#7d5f47",
  oak_bear: "#554331",
  frosthorn_ram: "#a9a69b",
  fen_leech: "#59413f",
  tideclaw_crab: "#8b4f3d",
  cavern_bat: "#403b4c",
  tomb_sentinel: "#777269",
  cinder_drake: "#6f3828",
  willow_wisp: "#86c8a5",
  blackbriar_hag: "#3d4434",
  rime_revenant: "#9aabb7",
  fen_ghoul: "#56604b",
  drowned_reaver: "#45626a",
  deepmaw_basilisk: "#465440",
  ossuary_knight: "#8a8579",
  ash_demon: "#572f29",
  grave_lich: "#665674",
  redtail_squirrel: "#a85c38",
  whiteback_elk: "#75614b",
  highland_aurochs: "#514538",
  reed_heron: "#8f9b92",
  river_otter: "#5b4636",
  brine_seal: "#75838a",
  cave_mole: "#3f342f",
  dusk_owl: "#6b655c",
  field_rat: "#8a6a54",
};

const SIZE: Record<FaunaKind, number> = {
  hare: 0.35,
  hart: 0.7,
  wolf: 0.55,
  wight: 0.8,
  brambleback_stag: 0.78,
  ironwood_boar: 0.74,
  pine_lynx: 0.53,
  ember_fox: 0.48,
  moss_badger: 0.33,
  ridgeback_warg: 0.8,
  thornhide_doe: 0.44,
  mire_croaker: 0.45,
  reedback_stalker: 0.78,
  bog_toad: 0.38,
  saltback_tortoise: 0.9,
  brine_hound: 0.64,
  dune_crawler: 0.58,
  coal_salamander: 0.62,
  orebeetle: 0.52,
  stonecrawl_spider: 0.58,
  greybarrow_wightling: 0.72,
  barrow_hound: 0.66,
  ashen_banshee: 0.85,
  bonecrow: 0.55,
  brine_troll: 1.15,
  stonefang_ogre: 1.05,
  orc_marauder: 0.98,
  oak_bear: 0.92,
  frosthorn_ram: 0.68,
  fen_leech: 0.58,
  tideclaw_crab: 0.62,
  cavern_bat: 0.5,
  tomb_sentinel: 0.92,
  cinder_drake: 0.92,
  willow_wisp: 0.48,
  blackbriar_hag: 1.12,
  rime_revenant: 1.12,
  fen_ghoul: 1.02,
  drowned_reaver: 1.18,
  deepmaw_basilisk: 1.12,
  ossuary_knight: 1.24,
  ash_demon: 1.38,
  grave_lich: 1.3,
  redtail_squirrel: 0.36,
  whiteback_elk: 0.84,
  highland_aurochs: 1.02,
  reed_heron: 0.68,
  river_otter: 0.52,
  brine_seal: 0.72,
  cave_mole: 0.4,
  dusk_owl: 0.58,
  field_rat: 0.38,
};

const DARK_MONSTER_KINDS: ReadonlySet<FaunaKind> = new Set([
  "blackbriar_hag",
  "rime_revenant",
  "fen_ghoul",
  "drowned_reaver",
  "deepmaw_basilisk",
  "ossuary_knight",
  "ash_demon",
  "grave_lich",
]);

function Body({ c }: { c: Creature }) {
  const s = SIZE[c.kind];
  const color = COLOR[c.kind];

  const isWolfBody =
    c.kind === "wolf" ||
    c.kind === "ridgeback_warg" ||
    c.kind === "brine_hound" ||
    c.kind === "barrow_hound" ||
    c.kind === "pine_lynx";
  const isBoar =
    c.kind === "ironwood_boar" || c.kind === "moss_badger" || c.kind === "mire_croaker";
  const isSpider = c.kind === "orebeetle" || c.kind === "stonecrawl_spider";
  const isCrawler =
    c.kind === "dune_crawler" || c.kind === "reedback_stalker" || c.kind === "bog_toad";
  const isTortoise = c.kind === "saltback_tortoise";
  const isBird = c.kind === "bonecrow";
  const isGhost =
    c.kind === "wight" || c.kind === "greybarrow_wightling" || c.kind === "ashen_banshee";

  if (c.kind === "hare") {
    return (
      <>
        <mesh position={[0, s * 0.42, 0]} castShadow>
          <boxGeometry args={[s * 0.9, s * 0.7, s * 1.15]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, s * 0.42]} castShadow>
          <boxGeometry args={[s * 0.55, s * 0.45, s * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[-s * 0.12, s * 1.08, s * 0.36]} castShadow>
          <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[s * 0.12, s * 1.08, s * 0.36]} castShadow>
          <boxGeometry args={[s * 0.12, s * 0.42, s * 0.08]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (c.kind === "hart") {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 0.65, s * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.95, s * 0.55]} castShadow>
          <boxGeometry args={[s * 0.28, s * 0.55, s * 0.28]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 1.2, s * 0.72]} castShadow>
          <boxGeometry args={[s * 0.38, s * 0.32, s * 0.42]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[-s * 0.12, s * 1.5, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
        </mesh>
        <mesh position={[s * 0.12, s * 1.5, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.08, s * 0.38, s * 0.08]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.85} />
        </mesh>
      </>
    );
  }

  if (c.kind === "oak_bear") {
    return (
      <>
        <mesh position={[0, s * 0.62, 0]} castShadow>
          <boxGeometry args={[s * 0.95, s * 0.82, s * 1.25]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
        <mesh position={[0, s * 0.82, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.72, s * 0.66, s * 0.6]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
        <mesh position={[0, s * 0.67, s * 0.98]} castShadow>
          <boxGeometry args={[s * 0.42, s * 0.3, s * 0.38]} />
          <meshStandardMaterial color="#332a23" roughness={1} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.27, s * 1.15, s * 0.58]} castShadow>
            <boxGeometry args={[s * 0.2, s * 0.2, s * 0.14]} />
            <meshStandardMaterial color={color} roughness={0.96} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "frosthorn_ram") {
    return (
      <>
        <mesh position={[0, s * 0.56, 0]} castShadow>
          <boxGeometry args={[s * 0.78, s * 0.68, s * 1.2]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0, s * 0.78, s * 0.58]} castShadow>
          <boxGeometry args={[s * 0.52, s * 0.5, s * 0.5]} />
          <meshStandardMaterial color="#77766f" roughness={0.92} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.34, s * 0.9, s * 0.56]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[s * 0.22, s * 0.065, 5, 8, Math.PI * 1.45]} />
            <meshStandardMaterial color="#d8d3c4" roughness={0.78} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "fen_leech") {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, s * (0.2 + i * 0.035), s * (i * 0.34 - 0.5)]} castShadow>
            <sphereGeometry args={[s * (0.34 - i * 0.025), 7, 5]} />
            <meshStandardMaterial color={i === 3 ? "#312b2a" : color} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, s * 0.24, s * 0.62]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[s * 0.2, s * 0.065, 6, 10]} />
          <meshStandardMaterial color="#a06a60" roughness={0.72} />
        </mesh>
      </>
    );
  }

  if (c.kind === "tideclaw_crab") {
    return (
      <>
        <mesh position={[0, s * 0.34, 0]} castShadow>
          <boxGeometry args={[s * 1.15, s * 0.42, s * 0.78]} />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * s * 0.82, s * 0.38, s * 0.22]}>
            <mesh rotation={[0, 0, side * 0.45]} castShadow>
              <boxGeometry args={[s * 0.58, s * 0.13, s * 0.16]} />
              <meshStandardMaterial color={color} roughness={0.86} />
            </mesh>
            <mesh position={[side * s * 0.3, s * 0.08, s * 0.12]} castShadow>
              <boxGeometry args={[s * 0.36, s * 0.3, s * 0.32]} />
              <meshStandardMaterial color="#a9664e" roughness={0.8} />
            </mesh>
          </group>
        ))}
      </>
    );
  }

  if (c.kind === "cavern_bat") {
    return (
      <>
        <mesh position={[0, s * 0.9, 0]} castShadow>
          <boxGeometry args={[s * 0.34, s * 0.48, s * 0.42]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.52, s * 0.9, 0]} rotation={[0, 0, side * 0.34]} castShadow>
            <boxGeometry args={[s * 0.9, s * 0.08, s * 0.58]} />
            <meshStandardMaterial color="#302c39" roughness={0.76} side={2} />
          </mesh>
        ))}
        <mesh position={[-s * 0.12, s * 1.22, s * 0.02]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[s * 0.09, s * 0.3, 4]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[s * 0.12, s * 1.22, s * 0.02]} rotation={[0, 0, -0.25]}>
          <coneGeometry args={[s * 0.09, s * 0.3, 4]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (c.kind === "tomb_sentinel") {
    return (
      <>
        <mesh position={[0, s * 0.88, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.95, s * 0.42]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.72} />
        </mesh>
        <mesh position={[0, s * 1.52, 0]} castShadow>
          <boxGeometry args={[s * 0.46, s * 0.42, s * 0.42]} />
          <meshStandardMaterial color="#4c4a47" metalness={0.55} roughness={0.65} />
        </mesh>
        <mesh position={[0, s * 1.58, s * 0.23]}>
          <boxGeometry args={[s * 0.28, s * 0.055, s * 0.035]} />
          <meshStandardMaterial color="#b26045" emissive="#64281f" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[-s * 0.52, s * 0.88, 0]} castShadow>
          <boxGeometry args={[s * 0.38, s * 0.72, s * 0.16]} />
          <meshStandardMaterial color="#5f5b54" metalness={0.4} roughness={0.78} />
        </mesh>
      </>
    );
  }

  if (c.kind === "cinder_drake") {
    return (
      <>
        <mesh position={[0, s * 0.58, 0]} castShadow>
          <boxGeometry args={[s * 0.72, s * 0.62, s * 1.28]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        <mesh position={[0, s * 0.78, s * 0.67]} castShadow>
          <boxGeometry args={[s * 0.52, s * 0.48, s * 0.62]} />
          <meshStandardMaterial color="#8d4930" roughness={0.75} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.62, s * 0.82, -s * 0.05]} rotation={[0.12, 0, side * 0.46]} castShadow>
            <boxGeometry args={[s * 0.9, s * 0.08, s * 0.72]} />
            <meshStandardMaterial color="#4b302a" roughness={0.82} side={2} />
          </mesh>
        ))}
        <mesh position={[0, s * 0.55, -s * 0.85]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[s * 0.2, s * 0.9, 5]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0, s * 0.78, s * 1.04]}>
          <boxGeometry args={[s * 0.2, s * 0.12, s * 0.18]} />
          <meshStandardMaterial color="#d2773e" emissive="#7a2f1f" emissiveIntensity={0.7} />
        </mesh>
      </>
    );
  }

  if (c.kind === "willow_wisp") {
    return (
      <>
        <pointLight position={[0, s * 1.15, 0]} color={color} intensity={0.7} distance={3.2} />
        <mesh position={[0, s * 1.12, 0]}>
          <sphereGeometry args={[s * 0.44, 9, 7]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.25} transparent opacity={0.72} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.43, s * 0.94, 0]}>
            <sphereGeometry args={[s * 0.12, 6, 5]} />
            <meshBasicMaterial color="#d7f3dc" transparent opacity={0.8} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "blackbriar_hag") {
    return (
      <>
        <mesh position={[0, s * 0.78, 0]} rotation={[0.18, 0, 0]} castShadow>
          <coneGeometry args={[s * 0.52, s * 1.5, 6]} />
          <meshStandardMaterial color={color} roughness={0.98} />
        </mesh>
        <mesh position={[0, s * 1.55, s * 0.12]} castShadow>
          <sphereGeometry args={[s * 0.3, 7, 5]} />
          <meshStandardMaterial color="#7b8063" roughness={1} />
        </mesh>
        <mesh position={[0, s * 1.82, s * 0.04]} rotation={[0, 0, -0.16]} castShadow>
          <coneGeometry args={[s * 0.48, s * 0.65, 6]} />
          <meshStandardMaterial color="#252a22" roughness={1} />
        </mesh>
        <mesh position={[s * 0.55, s * 0.85, s * 0.08]} rotation={[0.08, 0, -0.12]} castShadow>
          <cylinderGeometry args={[s * 0.045, s * 0.07, s * 1.75, 5]} />
          <meshStandardMaterial color="#33271f" roughness={1} />
        </mesh>
      </>
    );
  }

  if (c.kind === "rime_revenant") {
    return (
      <>
        <mesh position={[0, s * 0.82, 0]} castShadow>
          <coneGeometry args={[s * 0.48, s * 1.55, 7]} />
          <meshStandardMaterial color={color} emissive="#405664" emissiveIntensity={0.28} transparent opacity={0.78} roughness={0.55} />
        </mesh>
        <mesh position={[0, s * 1.62, 0]} castShadow>
          <boxGeometry args={[s * 0.42, s * 0.42, s * 0.36]} />
          <meshStandardMaterial color="#c5d3d8" emissive="#607887" emissiveIntensity={0.35} roughness={0.5} />
        </mesh>
        {[-1, 0, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.2, s * (1.98 - Math.abs(side) * 0.08), 0]}>
            <coneGeometry args={[s * 0.07, s * (0.38 - Math.abs(side) * 0.08), 4]} />
            <meshStandardMaterial color="#d8e4e6" emissive="#7895a3" emissiveIntensity={0.42} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "fen_ghoul") {
    return (
      <>
        <mesh position={[0, s * 0.78, 0]} rotation={[0.26, 0, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.9, s * 0.42]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0, s * 1.35, s * 0.2]} castShadow>
          <sphereGeometry args={[s * 0.29, 6, 5]} />
          <meshStandardMaterial color="#778064" roughness={0.96} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.48, s * 0.55, s * 0.18]} rotation={[0.3, 0, side * 0.2]} castShadow>
            <boxGeometry args={[s * 0.16, s * 1.05, s * 0.17]} />
            <meshStandardMaterial color="#667052" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, s * 1.37, s * 0.47]}>
          <boxGeometry args={[s * 0.23, s * 0.055, s * 0.04]} />
          <meshStandardMaterial color="#c1b36b" emissive="#75642b" emissiveIntensity={0.7} />
        </mesh>
      </>
    );
  }

  if (c.kind === "drowned_reaver") {
    return (
      <>
        <mesh position={[0, s * 0.84, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 1.0, s * 0.46]} />
          <meshStandardMaterial color={color} metalness={0.28} roughness={0.84} />
        </mesh>
        <mesh position={[0, s * 1.54, 0]} castShadow>
          <boxGeometry args={[s * 0.5, s * 0.44, s * 0.42]} />
          <meshStandardMaterial color="#607a7b" roughness={0.9} />
        </mesh>
        <mesh position={[-s * 0.52, s * 0.82, 0]} castShadow>
          <boxGeometry args={[s * 0.42, s * 0.74, s * 0.16]} />
          <meshStandardMaterial color="#374d52" metalness={0.38} roughness={0.75} />
        </mesh>
        <mesh position={[s * 0.58, s * 0.77, s * 0.02]} rotation={[0, 0, -0.18]} castShadow>
          <boxGeometry args={[s * 0.09, s * 1.15, s * 0.11]} />
          <meshStandardMaterial color="#85867f" metalness={0.7} roughness={0.45} />
        </mesh>
      </>
    );
  }

  if (c.kind === "deepmaw_basilisk") {
    return (
      <>
        <mesh position={[0, s * 0.42, 0]} castShadow>
          <boxGeometry args={[s * 0.74, s * 0.52, s * 1.45]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.52, s * 0.82]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.46, s * 0.62]} />
          <meshStandardMaterial color="#536348" roughness={0.88} />
        </mesh>
        <mesh position={[0, s * 0.38, -s * 1.0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[s * 0.24, s * 1.1, 5]} />
          <meshStandardMaterial color="#394334" roughness={0.92} />
        </mesh>
        {[-1, 0, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.18, s * 0.82, -side * side * s * 0.08]}>
            <coneGeometry args={[s * 0.09, s * (0.42 - Math.abs(side) * 0.08), 4]} />
            <meshStandardMaterial color="#758064" roughness={0.78} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.19, s * 0.61, s * 1.13]}>
            <sphereGeometry args={[s * 0.065, 6, 4]} />
            <meshStandardMaterial color="#d2a657" emissive="#8b5b24" emissiveIntensity={0.9} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "ossuary_knight") {
    return (
      <>
        <mesh position={[0, s * 0.88, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 1.02, s * 0.46]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.66} />
        </mesh>
        <mesh position={[0, s * 1.58, 0]} castShadow>
          <boxGeometry args={[s * 0.5, s * 0.48, s * 0.43]} />
          <meshStandardMaterial color="#514f4b" metalness={0.6} roughness={0.58} />
        </mesh>
        <mesh position={[0, s * 1.68, s * 0.24]}>
          <boxGeometry args={[s * 0.34, s * 0.07, s * 0.035]} />
          <meshStandardMaterial color="#bd4a38" emissive="#6f201b" emissiveIntensity={0.85} />
        </mesh>
        <mesh position={[-s * 0.57, s * 0.86, 0]} castShadow>
          <cylinderGeometry args={[s * 0.34, s * 0.34, s * 0.18, 8]} />
          <meshStandardMaterial color="#706c63" metalness={0.58} roughness={0.62} />
        </mesh>
        <mesh position={[s * 0.6, s * 0.8, 0]} rotation={[0, 0, -0.12]} castShadow>
          <boxGeometry args={[s * 0.1, s * 1.3, s * 0.12]} />
          <meshStandardMaterial color="#aaa79c" metalness={0.72} roughness={0.42} />
        </mesh>
      </>
    );
  }

  if (c.kind === "ash_demon") {
    return (
      <>
        <mesh position={[0, s * 0.92, 0]} castShadow>
          <boxGeometry args={[s * 0.88, s * 1.08, s * 0.58]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
        <mesh position={[0, s * 1.66, s * 0.04]} castShadow>
          <boxGeometry args={[s * 0.58, s * 0.5, s * 0.48]} />
          <meshStandardMaterial color="#71382d" roughness={0.82} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * s * 0.32, s * 2.03, 0]} rotation={[0, 0, side * -0.34]}>
              <coneGeometry args={[s * 0.12, s * 0.62, 5]} />
              <meshStandardMaterial color="#332725" roughness={0.8} />
            </mesh>
            <mesh position={[side * s * 0.68, s * 1.08, -s * 0.15]} rotation={[0.05, 0, side * 0.38]} castShadow>
              <boxGeometry args={[s * 0.72, s * 0.08, s * 0.82]} />
              <meshStandardMaterial color="#352827" roughness={0.9} side={2} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, s * 1.65, s * 0.3]}>
          <boxGeometry args={[s * 0.28, s * 0.07, s * 0.04]} />
          <meshStandardMaterial color="#ed7a43" emissive="#a23624" emissiveIntensity={1.1} />
        </mesh>
      </>
    );
  }

  if (c.kind === "grave_lich") {
    return (
      <>
        <pointLight position={[0, s * 1.55, 0]} color="#9d79ba" intensity={0.55} distance={3.5} />
        <mesh position={[0, s * 0.9, 0]} castShadow>
          <coneGeometry args={[s * 0.58, s * 1.72, 7]} />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
        <mesh position={[0, s * 1.72, 0]} castShadow>
          <sphereGeometry args={[s * 0.3, 7, 5]} />
          <meshStandardMaterial color="#b8b29f" roughness={0.86} />
        </mesh>
        {[-1, 0, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.19, s * (2.08 - Math.abs(side) * 0.08), 0]}>
            <coneGeometry args={[s * 0.065, s * (0.38 - Math.abs(side) * 0.06), 4]} />
            <meshStandardMaterial color="#c1a25c" metalness={0.56} roughness={0.52} />
          </mesh>
        ))}
        <mesh position={[s * 0.62, s * 0.98, 0]} castShadow>
          <cylinderGeometry args={[s * 0.045, s * 0.065, s * 1.95, 6]} />
          <meshStandardMaterial color="#312738" roughness={0.88} />
        </mesh>
        <mesh position={[s * 0.62, s * 1.98, 0]}>
          <sphereGeometry args={[s * 0.16, 8, 6]} />
          <meshStandardMaterial color="#b994d0" emissive="#73518c" emissiveIntensity={1.2} />
        </mesh>
      </>
    );
  }

  if (c.kind === "field_rat") {
    return (
      <>
        <mesh position={[0, s * 0.35, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.48, s * 1.0]} />
          <meshStandardMaterial color={color} roughness={0.98} />
        </mesh>
        <mesh position={[0, s * 0.46, s * 0.5]} castShadow>
          <boxGeometry args={[s * 0.48, s * 0.42, s * 0.48]} />
          <meshStandardMaterial color="#806a5e" roughness={0.96} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.18, s * 0.72, s * 0.43]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.12, s * 0.12, s * 0.05, 8]} />
            <meshStandardMaterial color="#a67d73" roughness={0.88} />
          </mesh>
        ))}
        <mesh position={[0, s * 0.28, -s * 0.82]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[s * 0.045, s * 0.065, s * 0.95, 6]} />
          <meshStandardMaterial color="#b58a7c" roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (c.kind === "redtail_squirrel") {
    return (
      <>
        <mesh position={[0, s * 0.48, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.68, s * 0.8]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
        <mesh position={[0, s * 0.82, s * 0.38]} castShadow>
          <boxGeometry args={[s * 0.5, s * 0.48, s * 0.48]} />
          <meshStandardMaterial color="#bd744b" roughness={0.94} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.17, s * 1.15, s * 0.34]} rotation={[0, 0, side * -0.16]}>
            <coneGeometry args={[s * 0.08, s * 0.3, 4]} />
            <meshStandardMaterial color={color} roughness={0.95} />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, s * (0.58 + i * 0.25), -s * (0.48 + i * 0.2)]} rotation={[i * 0.22, 0, 0]} castShadow>
            <sphereGeometry args={[s * (0.3 - i * 0.04), 6, 5]} />
            <meshStandardMaterial color="#c66b3f" roughness={1} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "whiteback_elk") {
    return (
      <>
        <mesh position={[0, s * 0.58, 0]} castShadow>
          <boxGeometry args={[s * 0.72, s * 0.7, s * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.94} />
        </mesh>
        <mesh position={[0, s * 1.0, s * 0.53]} rotation={[-0.1, 0, 0]} castShadow>
          <boxGeometry args={[s * 0.35, s * 0.72, s * 0.34]} />
          <meshStandardMaterial color="#89745c" roughness={0.92} />
        </mesh>
        <mesh position={[0, s * 1.33, s * 0.75]} castShadow>
          <boxGeometry args={[s * 0.44, s * 0.34, s * 0.52]} />
          <meshStandardMaterial color="#8b765e" roughness={0.92} />
        </mesh>
        <mesh position={[0, s * 0.83, -s * 0.36]} castShadow>
          <boxGeometry args={[s * 0.75, s * 0.16, s * 0.55]} />
          <meshStandardMaterial color="#d8d2bf" roughness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * s * 0.2, s * 1.68, s * 0.68]}>
            <mesh><boxGeometry args={[s * 0.07, s * 0.55, s * 0.07]} /><meshStandardMaterial color="#d9c9a7" roughness={0.84} /></mesh>
            <mesh position={[side * s * 0.12, s * 0.12, 0]} rotation={[0, 0, side * -0.65]}><boxGeometry args={[s * 0.3, s * 0.06, s * 0.06]} /><meshStandardMaterial color="#d9c9a7" roughness={0.84} /></mesh>
          </group>
        ))}
      </>
    );
  }

  if (c.kind === "highland_aurochs") {
    return (
      <>
        <mesh position={[0, s * 0.66, 0]} castShadow>
          <boxGeometry args={[s * 1.0, s * 0.9, s * 1.48]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0, s * 0.82, s * 0.72]} castShadow>
          <boxGeometry args={[s * 0.86, s * 0.72, s * 0.62]} />
          <meshStandardMaterial color="#40372f" roughness={0.98} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.62, s * 1.08, s * 0.74]} rotation={[0, 0, side * -0.72]} castShadow>
            <coneGeometry args={[s * 0.13, s * 0.7, 6]} />
            <meshStandardMaterial color="#d2c5a7" roughness={0.78} />
          </mesh>
        ))}
        <mesh position={[0, s * 1.12, s * 0.44]} castShadow>
          <boxGeometry args={[s * 0.92, s * 0.22, s * 0.36]} />
          <meshStandardMaterial color="#675849" roughness={1} />
        </mesh>
      </>
    );
  }

  if (c.kind === "reed_heron") {
    return (
      <>
        <mesh position={[0, s * 0.98, 0]} castShadow>
          <sphereGeometry args={[s * 0.42, 7, 6]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
        <mesh position={[0, s * 1.44, s * 0.12]} castShadow>
          <boxGeometry args={[s * 0.18, s * 0.78, s * 0.2]} />
          <meshStandardMaterial color="#aab2a8" roughness={0.84} />
        </mesh>
        <mesh position={[0, s * 1.82, s * 0.2]} castShadow>
          <sphereGeometry args={[s * 0.22, 7, 5]} />
          <meshStandardMaterial color="#9ca69d" roughness={0.86} />
        </mesh>
        <mesh position={[0, s * 1.79, s * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[s * 0.1, s * 0.65, 5]} />
          <meshStandardMaterial color="#c2a65c" roughness={0.72} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.16, s * 0.42, 0]} castShadow>
            <boxGeometry args={[s * 0.07, s * 0.85, s * 0.07]} />
            <meshStandardMaterial color="#9d8d65" roughness={0.9} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "river_otter") {
    return (
      <>
        <mesh position={[0, s * 0.34, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.48, s * 1.45]} />
          <meshStandardMaterial color={color} roughness={0.92} />
        </mesh>
        <mesh position={[0, s * 0.48, s * 0.73]} castShadow>
          <boxGeometry args={[s * 0.55, s * 0.48, s * 0.55]} />
          <meshStandardMaterial color="#6c5440" roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.38, -s * 1.0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[s * 0.2, s * 1.0, 6]} />
          <meshStandardMaterial color="#44352c" roughness={0.94} />
        </mesh>
        <mesh position={[0, s * 0.35, s * 1.03]} castShadow>
          <boxGeometry args={[s * 0.28, s * 0.2, s * 0.34]} />
          <meshStandardMaterial color="#bea786" roughness={0.88} />
        </mesh>
      </>
    );
  }

  if (c.kind === "brine_seal") {
    return (
      <>
        <mesh position={[0, s * 0.4, 0]} rotation={[0.08, 0, 0]} castShadow>
          <sphereGeometry args={[s * 0.62, 8, 6]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
        <mesh position={[0, s * 0.57, s * 0.62]} castShadow>
          <sphereGeometry args={[s * 0.42, 7, 5]} />
          <meshStandardMaterial color="#87949a" roughness={0.68} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.52, s * 0.22, s * 0.15]} rotation={[0, 0, side * 0.38]} castShadow>
            <boxGeometry args={[s * 0.58, s * 0.12, s * 0.32]} />
            <meshStandardMaterial color="#66757b" roughness={0.76} />
          </mesh>
        ))}
        <mesh position={[0, s * 0.55, s * 1.0]}>
          <boxGeometry args={[s * 0.2, s * 0.12, s * 0.18]} />
          <meshStandardMaterial color="#343a3d" roughness={0.8} />
        </mesh>
      </>
    );
  }

  if (c.kind === "cave_mole") {
    return (
      <>
        <mesh position={[0, s * 0.32, 0]} castShadow>
          <sphereGeometry args={[s * 0.5, 7, 5]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0, s * 0.4, s * 0.46]} castShadow>
          <sphereGeometry args={[s * 0.36, 7, 5]} />
          <meshStandardMaterial color="#51433b" roughness={0.98} />
        </mesh>
        <mesh position={[0, s * 0.36, s * 0.78]}>
          <sphereGeometry args={[s * 0.13, 6, 4]} />
          <meshStandardMaterial color="#b78378" roughness={0.82} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * s * 0.43, s * 0.12, s * 0.3]} rotation={[0, 0, side * 0.32]} castShadow>
            <boxGeometry args={[s * 0.48, s * 0.1, s * 0.24]} />
            <meshStandardMaterial color="#9b806b" roughness={0.92} />
          </mesh>
        ))}
      </>
    );
  }

  if (c.kind === "dusk_owl") {
    return (
      <>
        <mesh position={[0, s * 0.82, 0]} castShadow>
          <sphereGeometry args={[s * 0.48, 7, 6]} />
          <meshStandardMaterial color={color} roughness={0.94} />
        </mesh>
        <mesh position={[0, s * 1.23, s * 0.08]} castShadow>
          <boxGeometry args={[s * 0.72, s * 0.5, s * 0.46]} />
          <meshStandardMaterial color="#7d7669" roughness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * s * 0.25, s * 1.34, s * 0.34]}>
              <sphereGeometry args={[s * 0.11, 6, 4]} />
              <meshStandardMaterial color="#e4c66b" emissive="#806323" emissiveIntensity={0.45} />
            </mesh>
            <mesh position={[side * s * 0.46, s * 0.76, 0]} rotation={[0, 0, side * 0.2]} castShadow>
              <boxGeometry args={[s * 0.44, s * 0.88, s * 0.16]} />
              <meshStandardMaterial color="#514d48" roughness={0.96} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, s * 1.18, s * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[s * 0.1, s * 0.28, 4]} />
          <meshStandardMaterial color="#b8954d" roughness={0.8} />
        </mesh>
      </>
    );
  }

  if (isWolfBody) {
    return (
      <>
        <mesh position={[0, s * 0.48, 0]} castShadow>
          <boxGeometry args={[s * 0.75, s * 0.55, s * 1.35]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, s * 0.62]} castShadow>
          <boxGeometry args={[s * 0.5, s * 0.42, s * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.55, -s * 0.8]} castShadow>
          <boxGeometry args={[s * 0.16, s * 0.16, s * 0.5]} />
          <meshStandardMaterial color="#4a4a48" roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isBoar) {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.8, s * 0.6, s * 1.25]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.72, -s * 0.58]} castShadow>
          <boxGeometry args={[s * 0.55, s * 0.5, s * 0.45]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isSpider) {
    return (
      <>
        <mesh position={[0, s * 0.35, 0]} castShadow>
          <boxGeometry args={[s * 0.62, s * 0.25, s * 0.62]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (Math.PI / 2) * i;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * s * 0.42, s * 0.18, Math.sin(a) * s * 0.42]}
              rotation={[0, a, 0]}
              castShadow
            >
              <boxGeometry args={[s * 0.7, s * 0.08, s * 0.24]} />
              <meshStandardMaterial color={color} roughness={1} />
            </mesh>
          );
        })}
      </>
    );
  }

  if (isCrawler) {
    return (
      <>
        <mesh position={[0, s * 0.24, 0]} castShadow>
          <boxGeometry args={[s * 0.7, s * 0.24, s * 1.2]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.4, 0]} castShadow>
          <boxGeometry args={[s * 0.45, s * 0.22, s * 0.45]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      </>
    );
  }

  if (isTortoise) {
    return (
      <>
        <mesh position={[0, s * 0.45, 0]} castShadow>
          <boxGeometry args={[s * 1.05, s * 0.55, s * 0.95]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        <mesh position={[0, s * 0.82, 0]} castShadow>
          <boxGeometry args={[s * 0.35, s * 0.2, s * 0.25]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      </>
    );
  }

  if (isBird) {
    return (
      <>
        <mesh position={[0, s * 0.5, 0]} castShadow>
          <boxGeometry args={[s * 0.42, s * 0.34, s * 0.62]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[-s * 0.34, s * 0.28, s * 0.1]} rotation={[0, 0, 0.6]} castShadow>
          <boxGeometry args={[s * 0.68, s * 0.06, s * 0.17]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[s * 0.34, s * 0.28, s * 0.1]} rotation={[0, 0, -0.6]} castShadow>
          <boxGeometry args={[s * 0.68, s * 0.06, s * 0.17]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </>
    );
  }

  if (isGhost) {
    return (
      <>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.32, 1.1, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.7} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.28, 0.28, 0.24]} />
          <meshStandardMaterial color="#ece6d8" roughness={0.6} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, s * 0.5, 0]} castShadow>
        <boxGeometry args={[s * 0.62, s * 0.55, s * 1.05]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, s * 0.76, s * 0.36]} castShadow>
        <boxGeometry args={[s * 0.44, s * 0.48, s * 0.44]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </>
  );
}

function Beast({ c }: { c: Creature }) {
  const dead = c.task === "dead";
  const color = COLOR[c.kind];
  const root = useRef<Group>(null);

  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const deadNow = c.task === "dead";
    const world = getWorld();
    const fx = getCombatFx();
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const reacting = Boolean(fx && fx.targetId === c.id && age >= 0 && age < 0.34);
    const pulse = reacting ? Math.sin((age / 0.34) * Math.PI) : 0;
    const taming = world.player.intent.kind === "tame" && world.player.intent.targetId === c.id;
    const appeal = taming ? tamingPulse(world.player.workT) : 0;
    const result = getTamingFx();
    const resultAge = result ? (world.hour - result.at) * SECONDS_PER_HOUR : Infinity;
    const resultLive = Boolean(
      result && result.targetId === c.id && resultAge >= 0 && resultAge < 0.72,
    );
    const resultPulse = resultLive ? Math.sin((resultAge / 0.72) * Math.PI) : 0;
    const success = Boolean(resultLive && result?.success);
    const refusal = Boolean(resultLive && !result?.success);
    const companion = getCompanionFx(world);
    const companionAge = companion ? (world.hour - companion.at) * SECONDS_PER_HOUR : Infinity;
    const companionLive = Boolean(companion && companion.targetId === c.id && companionAge >= 0 && companionAge < COMPANION_DURATION);
    const companionMotion = companionLive && companion ? companionPose(companion.kind, companionAge) : { hop: 0, bow: 0, turn: 0, stretch: 0 };
    group.position.set(
      c.x,
      groundY(world, c.x, c.z) + pulse * 0.08 + appeal * 0.06 + (success ? resultPulse * 0.14 : 0) + companionMotion.hop,
      c.z,
    );
    group.rotation.set(
      deadNow ? Math.PI / 2 : -pulse * (fx?.clean ? 0.28 : 0.13) + (refusal ? resultPulse * -0.34 : 0) + companionMotion.bow,
      (taming ? Math.sin(world.player.workT * 20) * 0.2 : 0) + companionMotion.turn,
      deadNow ? 0 : pulse * 0.2 + appeal * 0.08 + (refusal ? resultPulse * 0.26 : 0),
    );
    group.scale.setScalar(
      1 +
        pulse * (fx?.clean ? 0.1 : 0.04) +
        (success ? resultPulse * 0.12 : 0) -
        (refusal ? resultPulse * 0.06 : 0) + companionMotion.stretch,
    );
  });

  return (
    <group
      ref={root}
      position={[c.x, groundY(getWorld(), c.x, c.z), c.z]}
      rotation={dead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
    >
      <FaunaArtBody kind={c.kind} size={SIZE[c.kind]}>
        <Body c={c} />
      </FaunaArtBody>
      {c.ownerId && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.22, 0.3, 12]} />
          <meshBasicMaterial color="#c9a36a" transparent opacity={0.7} />
        </mesh>
      )}
      {DARK_MONSTER_KINDS.has(c.kind) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
          <ringGeometry args={[SIZE[c.kind] * 0.5, SIZE[c.kind] * 0.68, 16]} />
          <meshBasicMaterial color="#9f4938" transparent opacity={0.42} />
        </mesh>
      )}
      {c.kind === "wight" && (
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[0.08, 0.02, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      )}
      <TamingBillboard c={c} />
      <CompanionBillboard c={c} />
    </group>
  );
}

function TamingBillboard({ c }: { c: Creature }) {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const world = getWorld();
    const attempting =
      world.player.intent.kind === "tame" &&
      world.player.intent.targetId === c.id &&
      world.player.workT < TAMING_DURATION;
    const result = getTamingFx();
    const resultAge = result ? (world.hour - result.at) * SECONDS_PER_HOUR : Infinity;
    const resultLive = Boolean(
      result && result.targetId === c.id && resultAge >= 0 && resultAge < 0.78,
    );
    const mode = attempting
      ? "Calming"
      : resultLive
        ? result!.success
          ? "Bonded"
          : "Refused"
        : null;
    element.style.display = mode ? "grid" : "none";
    if (!mode) return;
    element.textContent = mode;
    const success = mode === "Bonded";
    const failure = mode === "Refused";
    element.style.color = success ? "#fff8e7" : failure ? "#ece6d8" : "#ffd36a";
    element.style.borderColor = success
      ? "rgba(255, 211, 106, 0.9)"
      : failure
        ? "rgba(168, 90, 66, 0.9)"
        : "rgba(224, 181, 106, 0.75)";
    element.style.background = success
      ? "rgba(126, 88, 18, 0.92)"
      : failure
        ? "rgba(92, 38, 28, 0.94)"
        : "rgba(20, 18, 15, 0.88)";
    element.style.boxShadow = success
      ? "0 0 18px rgba(255, 211, 106, 0.85)"
      : failure
        ? "0 0 16px rgba(168, 90, 66, 0.8)"
        : "0 4px 16px rgba(0, 0, 0, 0.45)";
    element.style.transform = `scale(${0.94 + (attempting ? tamingPulse(world.player.workT) : Math.sin((resultAge / 0.78) * Math.PI)) * 0.12})`;
  });
  return (
    <Html position={[0, 2.8, 0]} center zIndexRange={[38, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={label}
        style={{
          display: "none",
          placeItems: "center",
          minWidth: 70,
          padding: "6px 9px",
          border: "1px solid rgba(224, 181, 106, 0.75)",
          borderRadius: 8,
          background: "rgba(20, 18, 15, 0.88)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
          fontFamily: "serif",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          transformOrigin: "center",
        }}
      />
    </Html>
  );
}

function CompanionBillboard({ c }: { c: Creature }) {
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const element = label.current;
    if (!element) return;
    const world = getWorld();
    const fx = getCompanionFx(world);
    const age = fx ? (world.hour - fx.at) * SECONDS_PER_HOUR : Infinity;
    const visible = Boolean(fx && fx.targetId === c.id && age >= 0 && age < COMPANION_DURATION);
    element.style.display = visible ? "grid" : "none";
    if (!fx || !visible) return;
    element.textContent = fx.kind === "name" ? `NAMED ${fx.name.toUpperCase()}` : companionLabel(fx.kind).toUpperCase();
    element.style.borderColor = fx.kind === "release" ? "rgba(168, 90, 66, 0.92)" : fx.kind === "feed" ? "rgba(122, 170, 88, 0.92)" : "rgba(255, 211, 106, 0.9)";
    element.style.color = fx.kind === "release" ? "#f0c0aa" : "#fff8e7";
  });
  return (
    <Html position={[0, 3.8, 0]} center zIndexRange={[37, 0]} style={{ pointerEvents: "none" }}>
      <div ref={label} style={{ display: "none", placeItems: "center", minWidth: 78, padding: "6px 9px", border: "1px solid", borderRadius: 8, background: "rgba(20, 18, 15, 0.92)", boxShadow: "0 0 16px rgba(0, 0, 0, 0.55)", fontFamily: "serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", whiteSpace: "nowrap" }} />
    </Html>
  );
}

export function Fauna() {
  const fauna = useGame((s) => s.snap.fauna);
  return (
    <group>
      {fauna.map((c) => (
        <Beast key={c.id} c={c} />
      ))}
    </group>
  );
}
