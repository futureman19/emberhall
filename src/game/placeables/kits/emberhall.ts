import type { Block, PlaceableDefinition, Vox } from "../types.ts";

const TURN: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
const TIMBER: Block[] = ["timber", "dark"];
const STONE: Block[] = ["stone", "cobble"];

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: Block, skip?: (x: number, y: number, z: number) => boolean): Vox[] {
  const out: Vox[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (skip?.(x, y, z)) continue;
        out.push({ x, y, z, t });
      }
    }
  }
  return out;
}

function piece(
  partial: Omit<PlaceableDefinition, "schemaVersion" | "rotations" | "snaps" | "weight" | "station"> & {
    rotations?: PlaceableDefinition["rotations"];
    snaps?: PlaceableDefinition["snaps"];
    station?: string | null;
  },
): PlaceableDefinition {
  const voxels = partial.voxels;
  return {
    schemaVersion: 1,
    rotations: partial.rotations ?? TURN,
    snaps: partial.snaps ?? [{ x: 0, y: 0, z: 0 }],
    station: partial.station ?? "bench",
    weight: voxels.length,
    ...partial,
    voxels,
  };
}

export const EMBERHALL_KIT: PlaceableDefinition[] = [
  piece({
    id: "floor_timber",
    category: "frames",
    label: "Timber floor",
    description: "A two-pace board floor.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 1, 0, 1, "timber"),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
  }),
  piece({
    id: "floor_stone",
    category: "frames",
    label: "Stone floor",
    description: "A two-pace cobble floor.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 1 },
    materialSlots: { stone: STONE },
    voxels: box(0, 0, 0, 1, 0, 1, "stone"),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
  }),
  piece({
    id: "wall_straight",
    category: "frames",
    label: "Straight wall",
    description: "A timber wall two paces wide.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 0, 3, 1, "timber"),
    cost: [{ item: "board", n: 3 }],
    skill: "carpentry",
  }),
  piece({
    id: "wall_window",
    category: "frames",
    label: "Window wall",
    description: "A wall with a glass light.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER, glass: ["glass"] },
    voxels: [
      ...box(0, 0, 0, 0, 3, 1, "timber", (_x, y, z) => y >= 1 && y <= 2 && z === 0),
      { x: 0, y: 1, z: 0, t: "glass" },
      { x: 0, y: 2, z: 0, t: "glass" },
    ],
    cost: [{ item: "board", n: 3 }],
    skill: "carpentry",
  }),
  piece({
    id: "wall_doorway",
    category: "frames",
    label: "Doorway",
    description: "A wall with a walking gap.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 0, 3, 1, "timber", (_x, y, z) => z === 0 && y <= 2),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
  }),
  piece({
    id: "post_beam",
    category: "frames",
    label: "Post",
    description: "A dark timber post.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 0 },
    materialSlots: { timber: ["dark", "timber"] },
    voxels: box(0, 0, 0, 0, 3, 0, "dark"),
    cost: [{ item: "board", n: 1 }],
    skill: "carpentry",
  }),
  piece({
    id: "fence_rail",
    category: "frames",
    label: "Fence",
    description: "A low timber rail.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 0, 1, 1, "timber"),
    cost: [{ item: "board", n: 1 }],
    skill: "carpentry",
  }),
  piece({
    id: "roof_slope",
    category: "roofs",
    label: "Roof slope",
    description: "A thatch roof plane.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 1 },
    materialSlots: { thatch: ["thatch", "dark"] },
    voxels: box(0, 3, 0, 1, 3, 1, "thatch"),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
  }),
  piece({
    id: "roof_ridge",
    category: "roofs",
    label: "Roof ridge",
    description: "The ridge of a gable.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { thatch: ["thatch", "dark"] },
    voxels: box(0, 4, 0, 1, 4, 0, "dark"),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
  }),
  piece({
    id: "door_timber",
    category: "doors",
    label: "Door",
    description: "A hung timber door.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 0, 2, 0, "timber"),
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
    fn: "door",
  }),
  piece({
    id: "hearth_stone",
    category: "hearths",
    label: "Hearth",
    description: "A stone fire for heat and cook-work.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { stone: STONE, coal: ["coal"] },
    voxels: [...box(0, 0, 0, 1, 0, 0, "stone"), { x: 0, y: 1, z: 0, t: "coal" }, { x: 1, y: 1, z: 0, t: "coal" }],
    cost: [{ item: "ingot", n: 2 }],
    skill: "smithing",
    station: "forge",
    fn: "hearth",
  }),
  piece({
    id: "lamp_ember",
    category: "hearths",
    label: "Lamp",
    description: "A small hanging light.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 0 },
    materialSlots: { gold: ["gold"], glass: ["glass"] },
    voxels: [
      { x: 0, y: 2, z: 0, t: "gold" },
      { x: 0, y: 1, z: 0, t: "glass" },
    ],
    cost: [{ item: "ingot", n: 1 }],
    skill: "smithing",
    station: "forge",
    fn: "light",
  }),
  piece({
    id: "bench_work",
    category: "work",
    label: "Workbench",
    description: "A carpenter's bench.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 1, 1, 0, "timber"),
    cost: [{ item: "board", n: 4 }],
    skill: "carpentry",
    fn: "craftStation",
  }),
  piece({
    id: "chest_keep",
    category: "keeping",
    label: "Chest",
    description: "A locked keep-box.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER },
    voxels: box(0, 0, 0, 1, 1, 0, "dark"),
    cost: [{ item: "board", n: 4 }],
    skill: "carpentry",
    fn: "storage",
  }),
  piece({
    id: "bed_simple",
    category: "comfort",
    label: "Bed",
    description: "A wool-covered bed.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER, wool: ["wool"] },
    voxels: [...box(0, 0, 0, 1, 0, 0, "timber"), { x: 0, y: 1, z: 0, t: "wool" }, { x: 1, y: 1, z: 0, t: "wool" }],
    cost: [{ item: "board", n: 4 }],
    skill: "carpentry",
    fn: "bed",
  }),
  piece({
    id: "table_stool",
    category: "comfort",
    label: "Table",
    description: "A table and stool.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 1 },
    materialSlots: { timber: TIMBER },
    voxels: [...box(0, 1, 0, 1, 1, 0, "timber"), { x: 0, y: 0, z: 1, t: "timber" }],
    cost: [{ item: "board", n: 3 }],
    skill: "carpentry",
  }),
  piece({
    id: "sign_board",
    category: "signs",
    label: "Sign",
    description: "A named board.",
    footprint: { x0: 0, x1: 0, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER, gold: ["gold"] },
    voxels: [
      { x: 0, y: 0, z: 0, t: "timber" },
      { x: 0, y: 1, z: 0, t: "timber" },
      { x: 0, y: 2, z: 0, t: "gold" },
    ],
    cost: [{ item: "board", n: 1 }],
    skill: "carpentry",
    fn: "sign",
  }),
  piece({
    id: "planter_box",
    category: "garden",
    label: "Planter",
    description: "A soil box for a garden.",
    footprint: { x0: 0, x1: 1, z0: 0, z1: 0 },
    materialSlots: { timber: TIMBER, soil: ["soil"] },
    voxels: [...box(0, 0, 0, 1, 0, 0, "timber"), { x: 0, y: 1, z: 0, t: "soil" }, { x: 1, y: 1, z: 0, t: "soil" }],
    cost: [{ item: "board", n: 2 }],
    skill: "carpentry",
    fn: "planter",
  }),
];
