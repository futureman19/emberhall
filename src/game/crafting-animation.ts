export type CraftAnimationKind = "smithing" | "carpentry" | "cooking";
export const CRAFTING_DURATION = 1.1;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function craftingPose(kind: CraftAnimationKind, ageSeconds: number) {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0 || ageSeconds >= CRAFTING_DURATION) {
    return { work: 0, strike: 0, stir: 0 };
  }
  const t = ageSeconds / CRAFTING_DURATION;
  const work = smooth(t / 0.18) * (1 - smooth((t - 0.84) / 0.16));
  if (kind === "smithing") {
    return { work, strike: work * Math.max(0, Math.sin(t * Math.PI * 5)), stir: 0 };
  }
  if (kind === "carpentry") {
    return { work, strike: work * (0.5 + Math.sin(t * Math.PI * 8) * 0.5), stir: 0 };
  }
  return { work, strike: 0, stir: work * (0.5 + Math.sin(t * Math.PI * 4) * 0.5) };
}

const PROFILES = Object.freeze({
  smithing: Object.freeze({ label: "Smithing", primary: "#ffb347", secondary: "#fff1a8" }),
  carpentry: Object.freeze({ label: "Carpentry", primary: "#d4a15d", secondary: "#fff0cf" }),
  cooking: Object.freeze({ label: "Cooking", primary: "#e8e1d4", secondary: "#ffd36a" }),
});

export function craftingVisualProfile(kind: CraftAnimationKind) {
  return PROFILES[kind];
}
