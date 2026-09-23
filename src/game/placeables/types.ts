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
