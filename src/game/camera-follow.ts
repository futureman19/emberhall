export const CAMERA_FOLLOW_RATE = 7;
export const CAMERA_MAX_DT = 0.1;

/** Frame-rate-independent exponential follow weight for one rendered frame. */
export function cameraFollowAlpha(dt: number, rate = CAMERA_FOLLOW_RATE) {
  if (!Number.isFinite(dt) || !Number.isFinite(rate) || dt <= 0 || rate <= 0) return 0;
  return -Math.expm1(-rate * Math.min(dt, CAMERA_MAX_DT));
}

/** Advance one independent follow-anchor axis and report its translation. */
export function cameraFollowAxis(current: number, target: number, dt: number) {
  const next = current + (target - current) * cameraFollowAlpha(dt);
  return { next, delta: next - current };
}

/** Exact rendered displacement for the horizontal follow plane. */
export function cameraLockedAxis(current: number, target: number) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return { next: current, delta: 0 };
  return { next: target, delta: target - current };
}

/** Keep walking height fixed; only an explicit large-jump snap may recenter it. */
export function cameraFixedHeight(current: number, target: number, snap: boolean) {
  if (!snap || !Number.isFinite(current) || !Number.isFinite(target)) return { next: current, delta: 0 };
  return { next: target, delta: target - current };
}
