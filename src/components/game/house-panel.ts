import { isHouseKind } from "../../game/house.ts";
import type { Building } from "../../game/types.ts";

type CompetingPanels = {
  panel?: string;
  openBook?: boolean;
  openCraft?: boolean;
  openVault?: boolean;
  openSettings?: boolean;
  openPets?: boolean;
};

/** Preserve other panels' precedence without closing/retargeting the owned chest. */
export function housePanelActive(buildings: readonly Pick<Building, "id" | "kind">[], id: string | null, panels: CompetingPanels = {}) {
  if (!id || (panels.panel && panels.panel !== "none") || panels.openBook || panels.openCraft || panels.openVault || panels.openSettings || panels.openPets) return false;
  const house = buildings.find((building) => building.id === id);
  return Boolean(house && isHouseKind(house.kind));
}
