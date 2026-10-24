import { COMBAT_BEAT } from "./combat-animation.ts";

export type WeaponForm = "dagger" | "spear" | "war_axe";
export type WeaponAction = "idle" | "draw" | "sheathe" | "attack" | "hit";
export interface WeaponPose { pitch: number; yaw: number; roll: number; reach: number; lean: number }
// Different anticipation/recovery, not different DPS: damage still lands on COMBAT_BEAT.
export const WEAPON_PROFILES = {
  dagger: { beat: COMBAT_BEAT, windup: 0.78, draw: 0.48, recover: 0.16 },
  spear: { beat: COMBAT_BEAT, windup: 0.56, draw: 0.7, recover: 0.22 },
  war_axe: { beat: COMBAT_BEAT, windup: 0.7, draw: 0.82, recover: 0.3 },
} as const;
const IDLE: Record<WeaponForm, WeaponPose> = {
  dagger: { pitch: 0.45, yaw: -0.16, roll: -0.24, reach: 0, lean: 0 },
  spear: { pitch: 0.75, yaw: -0.1, roll: -0.15, reach: 0, lean: 0 },
  war_axe: { pitch: 0.24, yaw: 0.1, roll: -0.32, reach: 0, lean: 0 },
};
const WINDUP: Record<WeaponForm, WeaponPose> = {
  dagger: { pitch: 0.1, yaw: -0.35, roll: -0.2, reach: -0.12, lean: -0.03 },
  spear: { pitch: 1.1, yaw: -0.15, roll: -0.15, reach: -0.22, lean: -0.08 },
  war_axe: { pitch: 2.8, yaw: 0.12, roll: -0.18, reach: -0.04, lean: -0.12 },
};
const STRIKE: Record<WeaponForm, WeaponPose> = {
  dagger: { pitch: 1.55, yaw: 0, roll: -0.16, reach: 0.3, lean: 0.08 },
  spear: { pitch: 1.62, yaw: 0, roll: -0.1, reach: 0.55, lean: 0.2 },
  war_axe: { pitch: 1.45, yaw: 0.1, roll: -0.25, reach: 0.12, lean: 0.22 },
};
const STOW: WeaponPose = { pitch: -0.32, yaw: -0.6, roll: -0.45, reach: 0, lean: 0.04 };
export function weaponForm(item: string | null | undefined): WeaponForm | null {
  return item === "dagger" || item === "spear" || item === "war_axe" ? item : null;
}
function smooth(t: number) {
  const u = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : t === Infinity ? 1 : 0;
  return u * u * (3 - 2 * u);
}
function mix(a: WeaponPose, b: WeaponPose, t: number): WeaponPose {
  const u = smooth(t);
  if (u === 0) return { ...a };
  if (u === 1) return { ...b };
  return { pitch: a.pitch + (b.pitch - a.pitch) * u, yaw: a.yaw + (b.yaw - a.yaw) * u, roll: a.roll + (b.roll - a.roll) * u, reach: a.reach + (b.reach - a.reach) * u, lean: a.lean + (b.lean - a.lean) * u };
}
export function weaponPose(form: WeaponForm, action: WeaponAction, seconds: number): WeaponPose {
  const p = WEAPON_PROFILES[form];
  const age = Number.isNaN(seconds) ? 0 : Math.max(0, seconds);
  if (action === "idle") return { ...IDLE[form] };
  if (action === "draw" || action === "sheathe") {
    const t = Math.min(1, age / p.draw);
    return mix(STOW, IDLE[form], action === "draw" ? t : 1 - t);
  }
  if (action === "hit") return mix(STRIKE[form], IDLE[form], age / p.recover);
  const phase = Math.min(1, age / p.beat);
  return phase < p.windup ? mix(IDLE[form], WINDUP[form], phase / p.windup) : mix(WINDUP[form], STRIKE[form], (phase - p.windup) / (1 - p.windup));
}
