// Intro story beats — the first-run cinematic's script (emberhall intro/1).
//
// Pure content + types: no store, no renderer imports. The cinematic
// component (look-lane, Phase 3) renders these as full-screen cards over
// art (or, per DP2, over a live camera path). Boot-order wiring into
// store.ts is deliberately NOT part of this file — coordination rule 1.

export type IntroBeat = {
  id: string;
  title: string;
  text: string;
  /** Art panel under public/art (used as card background; optional per DP2). */
  art: string;
  /** Call-to-action label — final beat only. */
  cta?: string;
};

/**
 * The vale's welcome. Voice rules: gentle, second person, short sentences —
 * the same register as the boot loader ("Laying the hills." … "The door is
 * open."). The final beat echoes that last loading note on purpose.
 */
export const INTRO_BEATS: IntroBeat[] = [
  {
    id: "vale",
    title: "The Vale",
    text: "Beyond the last road, the hills fold around a quiet vale. No maps name it. No king taxes it.",
    art: "/art/intro_vale.png",
  },
  {
    id: "hall",
    title: "The Hall",
    text: "At its heart stands Emberhall — old stone, warm windows, and a door that has been waiting for someone.",
    art: "/art/intro_hall.png",
  },
  {
    id: "folk",
    title: "The Folk",
    text: "Ranger, warrior, mage, rogue, merchant — the folk of the vale keep their own counsel. They are waiting to see who you are.",
    art: "/art/intro_folk.png",
  },
  {
    id: "land",
    title: "The Land",
    text: "The land gives to those who learn it. Timber and ore, field and flame, gem and hide — patience makes them yours.",
    art: "/art/intro_land.png",
  },
  {
    id: "arrival",
    title: "Your Arrival",
    text: "The door is open. Who walks through it?",
    art: "/art/intro_arrival.png",
    cta: "Answer the door",
  },
];
