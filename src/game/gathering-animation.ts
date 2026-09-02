export type GatheringAnimationKind = "tilling" | "sowing" | "harvesting" | "forestry";

export interface GatheringFx {
  kind: GatheringAnimationKind;
  success: boolean;
  x: number;
  z: number;
  at: number;
  subject: string | null;
}

export const GATHERING_DURATION = 1.15;

let gatheringFx: GatheringFx | null = null;

export function emitGatheringFx(fx: GatheringFx) {
  gatheringFx = { ...fx };
}

export function getGatheringFx() {
  return gatheringFx;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function gatheringPose(kind: GatheringAnimationKind, age: number) {
  const phase = clamp01(age / GATHERING_DURATION);
  const envelope = phase <= 0 || phase >= 1 ? 0 : Math.sin(phase * Math.PI);
  const beat = Math.sin(phase * Math.PI * (kind === "tilling" ? 4 : 2));
  return {
    work: envelope,
    strike: kind === "tilling" ? envelope * Math.max(0, beat) : 0,
    scatter: kind === "sowing" ? envelope * (0.55 + 0.45 * Math.sin(phase * Math.PI)) : 0,
    pull: kind === "harvesting" ? envelope * Math.max(0, Math.sin(phase * Math.PI * 2)) : 0,
    settle: kind === "forestry" ? envelope * (0.7 + 0.3 * Math.sin(phase * Math.PI)) : 0,
  };
}

export function gatheringVisualProfile(kind: GatheringAnimationKind) {
  if (kind === "tilling") return { primary: "#a96f3d", secondary: "#5a3e28", label: "Tilling" } as const;
  if (kind === "sowing") return { primary: "#e7c76d", secondary: "#8aaa58", label: "Sowing" } as const;
  if (kind === "harvesting") return { primary: "#d9b65f", secondary: "#6f914e", label: "Harvesting" } as const;
  return { primary: "#80a958", secondary: "#6a4a32", label: "Planting tree" } as const;
}
