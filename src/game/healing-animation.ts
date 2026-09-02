export const HEALING_DURATION = 0.9;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export interface HealingPose {
  lean: number;
  crouch: number;
  wrap: number;
}

export function healingPose(ageSeconds: number): HealingPose {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0 || ageSeconds >= HEALING_DURATION) {
    return { lean: 0, crouch: 0, wrap: 0 };
  }
  const t = ageSeconds / HEALING_DURATION;
  const enter = smooth(t / 0.24);
  const leave = 1 - smooth((t - 0.72) / 0.28);
  const wrap = enter * leave;
  return {
    lean: wrap * 0.34,
    crouch: wrap * 0.18,
    wrap,
  };
}

export function healingPulse(ageSeconds: number) {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0 || ageSeconds >= HEALING_DURATION) return 0;
  const t = ageSeconds / HEALING_DURATION;
  return Math.sin(clamp01((t - 0.1) / 0.9) * Math.PI);
}
