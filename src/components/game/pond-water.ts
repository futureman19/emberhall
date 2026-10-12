import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from "three";
import type { IUniform } from "three";
import { EMBERHALL_POND, isEmberhallPondWaterSample } from "../../game/emberhall-pond.ts";
import type { Tile } from "../../game/types.ts";

type PondWorld = { tiles: Tile[][]; landRev?: number; seed: number };
type PondShader = { fragmentShader: string; uniforms: Record<string, IUniform> };
const { x: X, z: Z, width: W, height: H } = EMBERHALL_POND;

function smooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** CPU reference for the GPU's bounded ambient ripple; not a simulation timer. */
export function pondRippleEnvelope(age: number) {
  return smooth(0, 0.35, age) * (1 - smooth(2.4, 4.8, age));
}
export function pondRippleHeight(radius: number, age: number) {
  const front = radius - age * 0.58;
  const packet = 1 - smooth(0.12, 0.62, Math.abs(front));
  return 0.018 * Math.cos(front * 13) * packet * pondRippleEnvelope(age)
    * (1 - smooth(2.2, 2.8, radius));
}

// vWp comes from the existing ground shader, in world coordinates. The small
// linear mask uses the SAME integer samples/bilinear weights as terrain color.
// No second surface, polygon offset, vertex displacement or picking geometry.
const POND_GLSL = `
uniform sampler2D uPondMask;
uniform float uPondTime;
uniform float uPondEnabled;
float pondMask(vec2 p) {
  if (uPondEnabled < 0.5 || p.x <= ${X}.0 || p.x >= ${X + W - 1}.0 || p.y <= ${Z}.0 || p.y >= ${Z + H - 1}.0) return 0.0;
  float wet = texture2D(uPondMask, (p - vec2(${X}.0, ${Z}.0) + 0.5) / vec2(${W}.0, ${H}.0)).r;
  return smoothstep(0.65, 0.98, wet);
}
float pondRing(float radius, float age) {
  float front = radius - age * 0.58;
  float packet = 1.0 - smoothstep(0.12, 0.62, abs(front));
  float envelope = smoothstep(0.0, 0.35, age) * (1.0 - smoothstep(2.4, 4.8, age));
  return 0.018 * cos(front * 13.0) * packet * envelope * (1.0 - smoothstep(2.2, 2.8, radius));
}
float pondHeight(vec2 p) {
  float t = uPondTime;
  float h = 0.014 * sin(dot(p, vec2(2.2, 1.1)) - t * 0.85)
          + 0.009 * sin(dot(p, vec2(-1.4, 3.1)) - t * 0.63)
          + 0.004 * sin(dot(p, vec2(5.2, -2.4)) - t * 1.15);
  // Three fixed, staggered GPU packets; all expire before their next cycle.
  // Suppress an emitter if a saved scar removes its water sample.
  h += pondRing(length(p - vec2(-0.65, -0.55)), mod(t + 1.1, 8.0)) * pondMask(vec2(249.35, 303.45));
  h += pondRing(length(p - vec2(0.85, 0.45)), mod(t + 4.0, 10.0)) * pondMask(vec2(250.85, 304.45));
  h += pondRing(length(p - vec2(0.05, 1.15)), mod(t + 6.5, 13.0)) * pondMask(vec2(250.05, 305.15));
  return h;
}
`;

export function createPondWater() {
  const data = new Uint8Array(W * H);
  const texture = new DataTexture(data, W, H, RedFormat, UnsignedByteType);
  texture.name = "emberhall-starter-pond-wet-mask";
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const uniforms = {
    uPondMask: { value: texture },
    uPondTime: { value: 0 },
    uPondEnabled: { value: 0 },
  };
  let previousWorld: PondWorld | null = null;
  let previousTiles: Tile[][] | null = null;
  let previousRev = -1;
  let previousSeed = -1;
  let wetCount = 0;

  return {
    texture,
    uniforms,
    update(world: PondWorld, playerX: number, playerZ: number, delta: number) {
      // The pond is tiny; do not upload masks or advance time out of local view.
      const near = Math.abs(playerX - 250) < 48 && Math.abs(playerZ - 304) < 48;
      if (!near) {
        uniforms.uPondEnabled.value = 0;
        return;
      }
      if (world !== previousWorld || world.tiles !== previousTiles || (world.landRev ?? 0) !== previousRev || world.seed !== previousSeed) {
        wetCount = 0;
        for (let z = 0; z < H; z++) {
          for (let x = 0; x < W; x++) {
            const tile = world.tiles[Z + z]?.[X + x];
            const wet = isEmberhallPondWaterSample(X + x, Z + z) && tile?.kind === "water" && tile.h === 0;
            data[z * W + x] = wet ? 255 : 0;
            if (wet) wetCount++;
          }
        }
        texture.needsUpdate = true;
        previousWorld = world;
        previousTiles = world.tiles;
        previousRev = world.landRev ?? 0;
        previousSeed = world.seed;
      }
      uniforms.uPondEnabled.value = wetCount ? 1 : 0;
      if (wetCount && Number.isFinite(delta)) uniforms.uPondTime.value += Math.max(0, Math.min(delta, 0.05));
    },
    /** Reference sampler for scope/scar tests, matching linear texel centers. */
    sampleMask(x: number, z: number) {
      if (x <= X || x >= X + W - 1 || z <= Z || z >= Z + H - 1) return 0;
      const ix = Math.floor(x - X), iz = Math.floor(z - Z);
      const fx = x - X - ix, fz = z - Z - iz;
      const a = data[iz * W + ix]! / 255, b = data[iz * W + ix + 1]! / 255;
      const c = data[(iz + 1) * W + ix]! / 255, d = data[(iz + 1) * W + ix + 1]! / 255;
      return smooth(0.65, 0.98, (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz);
    },
    inject(shader: PondShader) {
      Object.assign(shader.uniforms, uniforms);
      // Insert AFTER common: viewMatrix is provided by Three's fragment prefix.
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${POND_GLSL}`)
        .replace("#include <color_fragment>", `#include <color_fragment>
float pondWet = pondMask(vWp.xz);
if (pondWet > 0.0) {
  // Linear-space teal/slate water, not a bright opaque ring decal. Replace the
  // grass splat only inside the wet core, preserving the authored bank blend.
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.048, 0.105, 0.125), pondWet * 0.88);
}`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.24, pondWet);`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (pondWet > 0.0) {
  vec2 p = vWp.xz - vec2(250.0, 304.0);
  // Central differences of one height field: traveling waves AND expanding
  // ring packets bend the surface normal used by real scene lights/shadows.
  float dx = (pondHeight(p + vec2(0.025, 0.0)) - pondHeight(p - vec2(0.025, 0.0))) / 0.05;
  float dz = (pondHeight(p + vec2(0.0, 0.025)) - pondHeight(p - vec2(0.0, 0.025))) / 0.05;
  normal = normalize(normal + (viewMatrix * vec4(-dx, 0.0, -dz, 0.0)).xyz * pondWet);
}`)
        .replace("#include <opaque_fragment>", `
if (pondWet > 0.0) {
  // Restrained broad sky sheen; real lighting still supplies the body color.
  // View-dependent Fresnel and perturbed reflection make rings read as water.
  float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float fresnel = 0.035 + 0.38 * pow(1.0 - facing, 3.0);
  vec3 reflection = reflect(-normalize(vViewPosition), normal);
  float sheen = smoothstep(-0.3, 0.85, reflection.y);
  outgoingLight = mix(outgoingLight, vec3(0.24, 0.32, 0.35) * (0.72 + 0.28 * sheen), pondWet * fresnel);
}
#include <opaque_fragment>`);
    },
    dispose() { texture.dispose(); },
  };
}
