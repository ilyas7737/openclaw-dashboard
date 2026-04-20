// Normalize + persist token-usage events from the OpenClaw chat stream.
// Lives in localStorage so page refreshes don't lose accumulated data.

export type UsageEntry = {
  ts: number;              // ms epoch
  runId: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

const STORAGE_KEY = "openclaw:usage-log:v1";
const MAX_ENTRIES = 5000; // ring buffer

function readObj<T = unknown>(u: unknown, key: string): T | undefined {
  if (u && typeof u === "object" && key in (u as Record<string, unknown>)) {
    return (u as Record<string, T>)[key];
  }
  return undefined;
}

function asNumber(u: unknown): number {
  return typeof u === "number" && Number.isFinite(u) ? u : 0;
}

// Accept both Anthropic (`inputTokens`) and OpenAI (`prompt_tokens`) shapes.
export function parseUsage(
  usage: unknown,
  ctx: { runId: string; sessionKey: string; agentId?: string; ts?: number }
): UsageEntry | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;

  const input =
    asNumber(u.inputTokens) ||
    asNumber(u.prompt_tokens) ||
    asNumber(u.input_tokens) ||
    asNumber(readObj(u, "input"));
  const output =
    asNumber(u.outputTokens) ||
    asNumber(u.completion_tokens) ||
    asNumber(u.output_tokens) ||
    asNumber(readObj(u, "output"));
  const cacheRead =
    asNumber(u.cacheReadInputTokens) ||
    asNumber(u.cache_read_input_tokens) ||
    asNumber(u.cachedInputTokens);
  const cacheWrite =
    asNumber(u.cacheCreationInputTokens) ||
    asNumber(u.cache_creation_input_tokens) ||
    asNumber(u.cacheWriteInputTokens);

  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) {
    return null;
  }

  const model =
    (typeof u.model === "string" && u.model) ||
    (typeof u.modelId === "string" && u.modelId) ||
    undefined;

  return {
    ts: ctx.ts ?? Date.now(),
    runId: ctx.runId,
    sessionKey: ctx.sessionKey,
    agentId: ctx.agentId,
    model,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
  };
}

export function loadUsageLog(): UsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsageLog(entries: UsageEntry[]) {
  if (typeof window === "undefined") return;
  const trimmed =
    entries.length > MAX_ENTRIES
      ? entries.slice(-MAX_ENTRIES)
      : entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — drop older half and retry once
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(trimmed.slice(-Math.floor(MAX_ENTRIES / 2)))
      );
    } catch {
      /* give up */
    }
  }
}

export function clearUsageLog() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
