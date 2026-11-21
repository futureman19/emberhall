/**
 * Mind prompt assembler — turns a MindRequest into chat messages.
 *
 * system = role pack + vale manual + cadence rules + the strict-JSON demand.
 * user   = directive + standing goals + compact observation + journal tail.
 *
 * The observation is compacted before it goes on the wire: logTail keeps
 * only the last LOG_TAIL_LINES lines and zero-count pack entries are
 * dropped. The request is never mutated.
 */
import type { ItemId } from "../types.ts";
import { DEFAULT_CADENCE, type MindRequest, type Observation } from "./types.ts";

/** One chat message on the OpenAI-compatible wire. */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Lines of sim log the mind sees (the observation carries up to 20). */
export const LOG_TAIL_LINES = 10;

function compactObservation(obs: Observation): Observation {
  const pack: Partial<Record<ItemId, number>> = {};
  for (const [id, n] of Object.entries(obs.you.pack)) {
    if (typeof n === "number" && n > 0) pack[id as ItemId] = n;
  }
  return {
    ...obs,
    you: { ...obs.you, pack },
    logTail: obs.logTail.slice(-LOG_TAIL_LINES),
  };
}

export function assembleMindMessages(req: MindRequest): Message[] {
  const system = [
    req.rolePack,
    "",
    "## Vale manual",
    req.manual,
    "",
    "## Cadence",
    `You are the mind of one body in Emberhall. You think every ${DEFAULT_CADENCE.mindHeartbeatHours} vale hours; between your thoughts, bundled reflexes keep the body alive on autopilot. Quiet window ${DEFAULT_CADENCE.sleepStartHour}:00-${DEFAULT_CADENCE.sleepEndHour}:00 unless the body is in danger. You set goals, interpret the owner's directive and write the journal; fast tactical choices belong to the reflexes, not to you.`,
    "",
    "## Reply format (strict)",
    'Reply with a single strict JSON object and NOTHING else: no prose, no markdown fences, no explanations. The shape is {"goals": string[], "journalEntry": string, "intentHints": Intent[]}. goals is the updated list of standing goals. journalEntry is one line for the owner\'s journal, in the character\'s own voice. Each intent hint is {"kind": string, "tx": integer, "ty": integer, "targetId": string|null, "spell": string|null} using only kinds from the legal verb menu in the observation. intentHints are advisory: the harness checks every hint against the live verb candidates before it can become an action, so never invent verbs.',
  ].join("\n");

  const goals = req.goals.length > 0 ? req.goals.map((g) => `- ${g}`).join("\n") : "(none yet)";
  const journal = req.journalTail.length > 0 ? req.journalTail.join("\n") : "(empty)";
  const user = [
    `Directive from your owner: ${req.directive}`,
    "",
    "Current goals:",
    goals,
    "",
    "Observation (JSON):",
    JSON.stringify(compactObservation(req.observation)),
    "",
    "Recent journal:",
    journal,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
