import { useEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { FIGURE } from "@/game/look/figure.ts";
import type { RareItem } from "@/game/types";
import { createExactWeaponGeometry, type ExactWeaponId } from "./weapon-geometry";
import { equipmentMaterial, exactWeaponSurfaces } from "./equipment-material";

/** One grip-space mesh shared by all equipment views; owns its resources. */
export function ForgedWeapon({ id, ghost, item }: { id: ExactWeaponId; ghost: boolean; item?: RareItem | null }) {
  const ref = useRef<Group>(null);
  const surfaces = exactWeaponSurfaces(id, item);
  const { color: edgeColor, roughness } = surfaces.edge;
  const hiltColor = surfaces.hilt.color;
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const parts = createExactWeaponGeometry(id);
    const wood = new MeshStandardMaterial(equipmentMaterial(ghost, { color: hiltColor, roughness: .8 }));
    const metal = new MeshStandardMaterial(equipmentMaterial(ghost, { color: edgeColor, metalness: id === "quarterstaff" ? 0 : .65, roughness }));
    const hilt = new Mesh(parts.hilt, wood);
    const edge = new Mesh(parts.edge, metal);
    hilt.name = "weapon-hilt"; edge.name = "weapon-edge";
    hilt.castShadow = edge.castShadow = !ghost;
    group.add(hilt, edge);
    return () => {
      group.remove(hilt, edge);
      parts.hilt.dispose(); parts.edge.dispose(); wood.dispose(); metal.dispose();
    };
  }, [id, ghost, hiltColor, edgeColor, roughness]);
  return <group name={`emberhall-weapon-${id}`} ref={ref} position={[0.02, FIGURE.hand.y, 0.04]} rotation={[0.12, 0, 0.2]}>
    {surfaces.gem && <mesh name="weapon-inlay" position={[0, id === "dagger" ? -.065 : .16, -.035]} castShadow={!ghost}>
      <octahedronGeometry args={[.038, 0]} />
      <meshStandardMaterial {...equipmentMaterial(ghost, surfaces.gem)} />
    </mesh>}
  </group>;
}
