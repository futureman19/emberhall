// resolveLook — one pure seam from stored recipe to rendered pixels.
// Missing fields, missing recipe, malformed hexes: all land on the defaults
// the vale has always worn. Bit-for-bit parity is the whole point.
import { DEFAULT_LOOK, HAIR_STYLES } from "./catalog.ts";
import type { HairStyleId, LookRecipeV1 } from "./types.ts";

export interface ResolvedLook {
  skin: string;
  hairStyle: HairStyleId;
  hairColor: string;
  garb: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function hex(value: string | undefined, fallback: string): string {
  return value && HEX.test(value) ? value.toLowerCase() : fallback;
}

function style(value: string | undefined): HairStyleId {
  return HAIR_STYLES.some((s) => s.id === value) ? (value as HairStyleId) : DEFAULT_LOOK.hairStyle;
}

export function resolveLook(look?: LookRecipeV1 | null): ResolvedLook {
  return {
    skin: hex(look?.skin, DEFAULT_LOOK.skin),
    hairStyle: style(look?.hairStyle),
    hairColor: hex(look?.hairColor, DEFAULT_LOOK.hairColor),
    garb: hex(look?.garb, DEFAULT_LOOK.garb),
  };
}
