export const VOX = 0.5;

export type Block =
  | "timber"
  | "dark"
  | "cobble"
  | "wool"
  | "gold"
  | "glass"
  | "thatch"
  | "stone"
  | "coal"
  | "soil"
  | "leaf";

export interface Vox {
  x: number;
  y: number;
  z: number;
  t: Block;
  cut?: boolean;
}

export interface BuildingSpec {
  voxels: Vox[];
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  enterable: boolean;
  fuse?: boolean;
}

export const PLACEABLE_CATEGORIES = [
  "frames",
  "roofs",
  "doors",
  "hearths",
  "work",
  "keeping",
  "comfort",
  "signs",
  "garden",
] as const;

export type PlaceableCategory = (typeof PLACEABLE_CATEGORIES)[number];

export type PlaceableFunction =
  | "door"
  | "bed"
  | "storage"
  | "craftStation"
  | "hearth"
  | "light"
  | "sign"
  | "planter";

export interface PlaceableFootprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface SnapPoint {
  x: number;
  y: number;
  z: number;
}

export interface PlaceableCost {
  item: string;
  n: number;
}

export interface PlaceableDefinition {
  id: string;
  schemaVersion: 1;
  category: PlaceableCategory;
  label: string;
  description: string;
  rotations: Array<0 | 1 | 2 | 3>;
  footprint: PlaceableFootprint;
  snaps: SnapPoint[];
  materialSlots: Record<string, Block[]>;
  voxels: Vox[];
  cost: PlaceableCost[];
  skill: string;
  station: string | null;
  fn?: PlaceableFunction;
  weight: number;
}
