/**
 * OpenAI-compatible mind adapter — one HTTP shape for every backend.
 *
 * POST ${baseUrl}/chat/completions with the assembled messages and
 * temperature 0.7; returns the raw assistant text. Works against OpenAI,
 * Anthropic-compatible gateways, Kimi, and local servers (vLLM/ollama)
 * because it is just HTTP. `fetchImpl` is injectable so tests never touch
 * the network; the default is the platform fetch (Node 18+).
 *
 * Secrets: the apiKey only ever rides the Authorization header. It is
 * never logged and never included in error messages.
 */
import type { Message } from "../assembler.ts";
import type { MindAdapter } from "../mind.ts";

export interface OpenAIAdapterOptions {
  /** Root of the compatible API, e.g. "https://api.openai.com/v1". */
  baseUrl: string;
  /** Bearer token; omit for local servers that need no auth. */
  apiKey?: string;
  model: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createOpenAIAdapter(opts: OpenAIAdapterOptions): MindAdapter {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async complete(messages: Message[], signal?: AbortSignal): Promise<string> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
      const res = await doFetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: opts.model, messages, temperature: 0.7 }),
        signal,
      });
      if (!res.ok) throw new Error(`mind endpoint HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("mind endpoint returned no completion text");
      }
      return content;
    },
  };
}
