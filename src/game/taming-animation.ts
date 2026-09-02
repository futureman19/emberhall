export const TAMING_DURATION = 0.55;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export interface TamingPose {
  reach: number;
  bow: number;
}

export function tamingPose(ageSeconds: number): TamingPose {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0 || ageSeconds >= TAMING_DURATION)
    return { reach: 0, bow: 0 };
  const t = ageSeconds / TAMING_DURATION;
  const enter = smooth(t / 0.28);
  const leave = 1 - smooth((t - 0.76) / 0.24);
  const reach = enter * leave;
  return { reach, bow: reach * 0.24 };
}

export function tamingPulse(ageSeconds: number) {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0 || ageSeconds >= TAMING_DURATION) return 0;
  return Math.sin((ageSeconds / TAMING_DURATION) * Math.PI);
}
