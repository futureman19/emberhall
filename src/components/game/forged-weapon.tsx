import { useEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { createExactWeaponGeometry } from "./weapon-geometry";

/** Minimal shared held mesh; per-material polish is a separate equipment pass. */
export function ForgedWeapon({ id, ghost }: { id: "dagger" | "spear" | "war_axe"; ghost: boolean }) {
  const ref = useRef<Group>(null);
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const parts = createExactWeaponGeometry(id);
    const wood = new MeshStandardMaterial({ color: "#5a3e28", roughness: 0.8, transparent: ghost, opacity: ghost ? 0.35 : 1 });
    const metal = new MeshStandardMaterial({ color: "#c9c3b6", metalness: 0.65, roughness: 0.28, transparent: ghost, opacity: ghost ? 0.35 : 1 });
    const hilt = new Mesh(parts.hilt, wood);
    const edge = new Mesh(parts.edge, metal);
    hilt.castShadow = edge.castShadow = !ghost;
    group.add(hilt, edge);
    return () => {
      group.remove(hilt, edge);
      parts.hilt.dispose(); parts.edge.dispose(); wood.dispose(); metal.dispose();
    };
  }, [id, ghost]);
  return <group ref={ref} position={[0.02, -0.38, 0.04]} rotation={[0.12, 0, 0.2]} />;
}
