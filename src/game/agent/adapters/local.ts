/**
 * Local mind adapter — the same OpenAI-compatible wire pointed at a
 * user-run endpoint (vLLM, ollama, llama.cpp server, LM Studio...).
 * No apiKey: local servers are reached on the owner's own machine/LAN.
 * Thin wrapper over createOpenAIAdapter — one HTTP implementation, DRY.
 */
import type { MindAdapter } from "../mind.ts";
import { createOpenAIAdapter } from "./openai-compatible.ts";

export interface LocalAdapterOptions {
  /** e.g. "http://127.0.0.1:11434/v1" (ollama) or "http://127.0.0.1:8000/v1" (vLLM). */
  baseUrl: string;
  model: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createLocalAdapter(opts: LocalAdapterOptions): MindAdapter {
  return createOpenAIAdapter({
    baseUrl: opts.baseUrl,
    model: opts.model,
    fetchImpl: opts.fetchImpl,
  });
}
