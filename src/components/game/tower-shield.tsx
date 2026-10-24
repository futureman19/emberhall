import { useEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { useGame } from "@/game/store";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import { createTowerShieldGeometry } from "./offhand-geometry";
import { equipmentMaterial } from "./equipment-material";

export function TowerShield({ ghost }: { ghost: boolean }) {
  const ref = useRef<Group>(null);
  const item = useGame(s => s.snap.player.rares.find(r => r.uid === s.snap.player.wearRare.off && r.base === "tower_shield"));
  const plate = item?.components?.find(c => c.role === "plate");
  const color = plate ? RESOURCE_CATALOG[plate.resourceId].visual.primary : "#8a8680";
  const metallic = !plate || RESOURCE_CATALOG[plate.resourceId].kind === "ore";
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const parts = createTowerShieldGeometry();
    const faceMaterial = new MeshStandardMaterial(equipmentMaterial(ghost, { color, metalness: metallic ? .5 : 0, roughness: .4 }));
    const bossMaterial = new MeshStandardMaterial(equipmentMaterial(ghost, { color: "#c9a36a", roughness: .5 }));
    const face = new Mesh(parts.face, faceMaterial), boss = new Mesh(parts.boss, bossMaterial);
    face.castShadow = boss.castShadow = !ghost;
    group.add(face, boss);
    return () => { group.remove(face, boss); parts.face.dispose(); parts.boss.dispose(); faceMaterial.dispose(); bossMaterial.dispose(); };
  }, [ghost, color, metallic]);
  return <group name="emberhall-tower-shield" ref={ref} position={[-.02, -.28, .08]} rotation={[.2, .15, -.35]} />;
}
