export const CAMERA_FOLLOW_RATE = 7;
export const CAMERA_MAX_DT = 0.1;
export const CAMERA_HEIGHT_RATE = 3.5;
export const CAMERA_HEIGHT_DEAD_ZONE = 0.08;

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

/**
 * Terrain-aware height follow. Tiny elevation changes stay inside a dead zone,
 * while meaningful slopes ease toward the nearest edge of that stable band.
 */
export function cameraVerticalAxis(
  current: number,
  target: number,
  dt: number,
  rate = CAMERA_HEIGHT_RATE,
  deadZone = CAMERA_HEIGHT_DEAD_ZONE,
) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(deadZone)) {
    return { next: current, delta: 0 };
  }
  const offset = target - current;
  const band = Math.max(0, deadZone);
  if (Math.abs(offset) <= band) return { next: current, delta: 0 };
  const stableTarget = target - Math.sign(offset) * band;
  const next = current + (stableTarget - current) * cameraFollowAlpha(dt, rate);
  return { next, delta: next - current };
}
