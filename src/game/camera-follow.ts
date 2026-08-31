export const CAMERA_FOLLOW_RATE = 7;
export const CAMERA_MAX_DT = 0.1;

/** Frame-rate-independent exponential follow weight for one rendered frame. */
export function cameraFollowAlpha(dt: number, rate = CAMERA_FOLLOW_RATE) {
  if (!Number.isFinite(dt) || !Number.isFinite(rate) || dt <= 0 || rate <= 0) return 0;
  return -Math.expm1(-rate * Math.min(dt, CAMERA_MAX_DT));
}
