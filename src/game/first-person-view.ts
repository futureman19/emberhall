/** Eye-height look: same click-to-walk, camera on the body. */

export const FIRST_PERSON_EYE = 1.55;
export const FIRST_PERSON_LOOK = 12;
export const FIRST_PERSON_FOV = 68;
export const ORBIT_FOV = 48;
export const FIRST_PERSON_NEAR = 0.08;
export const ORBIT_NEAR = 0.2;

export type Vec3 = { x: number; y: number; z: number };

export type FirstPersonPose = {
  position: Vec3;
  lookAt: Vec3;
};

export type OrbitRestPose = {
  position: Vec3;
  target: Vec3;
};

function finite(n: number, fallback: number) {
  return Number.isFinite(n) ? n : fallback;
}

/** Simulation facing is atan2(dx, dz): 0 looks +Z, π/2 looks +X. */
export function firstPersonPose(args: {
  x: number;
  z: number;
  facing: number;
  groundY: number;
  storyY?: number;
}): FirstPersonPose {
  const x = finite(args.x, 0);
  const z = finite(args.z, 0);
  const facing = finite(args.facing, 0);
  const groundY = finite(args.groundY, 0);
  const storyY = finite(args.storyY ?? 0, 0);
  const eyeY = groundY + storyY + FIRST_PERSON_EYE;
  const sin = Math.sin(facing);
  const cos = Math.cos(facing);
  return {
    position: { x, y: eyeY, z },
    lookAt: {
      x: x + sin * FIRST_PERSON_LOOK,
      y: eyeY - 0.35,
      z: z + cos * FIRST_PERSON_LOOK,
    },
  };
}

/** Same tactical offset the canvas opens with, recentered on the body. */
export function orbitRestPose(x: number, z: number, groundY: number, storyY = 0): OrbitRestPose {
  const gx = finite(x, 0);
  const gz = finite(z, 0);
  const gy = finite(groundY, 0) + finite(storyY, 0);
  return {
    position: { x: gx + 16, y: gy + 23, z: gz + 20 },
    target: { x: gx, y: gy + 0.3, z: gz },
  };
}

export function toggleFirstPerson(current: boolean) {
  return !current;
}

export function firstPersonHotkey(key: string, inField: boolean): "toggle" | "ignore" {
  if (inField) return "ignore";
  if (key === "v" || key === "V") return "toggle";
  return "ignore";
}
