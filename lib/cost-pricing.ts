// Model price table — USD per 1M tokens (input, output). Rough 2026 list prices.
// Keys are matched case-insensitively by substring; first match wins.
export type ModelPrice = { in: number; out: number };

export const MODEL_PRICING: Array<[string, ModelPrice]> = [
  // Anthropic
  ["claude-opus-4-7", { in: 15, out: 75 }],
  ["claude-opus-4-6", { in: 15, out: 75 }],
  ["claude-opus", { in: 15, out: 75 }],
  ["claude-sonnet-4-6", { in: 3, out: 15 }],
  ["claude-sonnet", { in: 3, out: 15 }],
  ["claude-haiku-4-5", { in: 0.8, out: 4 }],
  ["claude-haiku", { in: 0.8, out: 4 }],

  // OpenAI
  ["gpt-5.2-codex", { in: 2.5, out: 10 }],
  ["gpt-5.2-mini", { in: 0.25, out: 2 }],
  ["gpt-5.2", { in: 2.5, out: 10 }],
  ["gpt-5", { in: 2.5, out: 10 }],
  ["gpt-4o-mini", { in: 0.15, out: 0.6 }],
  ["gpt-4o", { in: 2.5, out: 10 }],

  // Google
  ["gemini-2.5-pro", { in: 1.25, out: 10 }],
  ["gemini-2.5-flash", { in: 0.1, out: 0.4 }],
  ["gemini-2", { in: 1.25, out: 10 }],

  // Local / unknown
  ["ollama", { in: 0, out: 0 }],
  ["llama", { in: 0, out: 0 }],
];

export function priceFor(model: string | undefined): ModelPrice {
  if (!model) return { in: 0, out: 0 };
  const m = model.toLowerCase();
  for (const [key, price] of MODEL_PRICING) {
    if (m.includes(key)) return price;
  }
  return { in: 0, out: 0 };
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string | undefined
): number {
  const p = priceFor(model);
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

export function formatUSD(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
