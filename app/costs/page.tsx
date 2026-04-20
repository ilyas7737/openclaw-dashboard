"use client";

import { useMemo } from "react";
import { DollarSign, TrendingUp, Zap, Trash2 } from "lucide-react";
import { useUsageLog } from "@/hooks/use-usage-log";
import { estimateCost, formatUSD, priceFor } from "@/lib/cost-pricing";
import type { UsageEntry } from "@/lib/usage-store";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type AgentModelRow = {
  agentId: string;
  model: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
};

function aggregateByAgentModel(entries: UsageEntry[]): AgentModelRow[] {
  const map = new Map<string, AgentModelRow>();
  for (const e of entries) {
    const agentId = e.agentId || "—";
    const model = e.model || "unknown";
    const key = `${agentId}::${model}`;
    const row =
      map.get(key) ?? {
        agentId,
        model,
        calls: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
      };
    row.calls += 1;
    row.input += e.inputTokens;
    row.output += e.outputTokens;
    row.cacheRead += e.cacheReadTokens;
    row.cacheWrite += e.cacheWriteTokens;
    row.cost += estimateCost(e.inputTokens, e.outputTokens, e.model);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

function aggregateByDay(
  entries: UsageEntry[],
  days: number
): { day: number; tokens: number; cost: number }[] {
  const today = startOfDay(Date.now());
  const buckets = new Map<number, { tokens: number; cost: number }>();
  for (let i = 0; i < days; i++) {
    buckets.set(today - i * DAY_MS, { tokens: 0, cost: 0 });
  }
  for (const e of entries) {
    const day = startOfDay(e.ts);
    const b = buckets.get(day);
    if (!b) continue;
    b.tokens += e.inputTokens + e.outputTokens;
    b.cost += estimateCost(e.inputTokens, e.outputTokens, e.model);
  }
  return Array.from(buckets.entries())
    .map(([day, v]) => ({ day, tokens: v.tokens, cost: v.cost }))
    .sort((a, b) => a.day - b.day);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "var(--muted, rgba(0,0,0,0.04))" }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}

export default function CostsPage() {
  const { entries, clear } = useUsageLog();

  const today0 = startOfDay(Date.now());
  const todayEntries = entries.filter((e) => startOfDay(e.ts) === today0);
  const week = aggregateByDay(entries, 7);
  const month = aggregateByDay(entries, 30);

  const todayTokens = todayEntries.reduce(
    (s, e) => s + e.inputTokens + e.outputTokens,
    0
  );
  const todayCost = todayEntries.reduce(
    (s, e) => s + estimateCost(e.inputTokens, e.outputTokens, e.model),
    0
  );
  const weekTokens = week.reduce((s, d) => s + d.tokens, 0);
  const weekCost = week.reduce((s, d) => s + d.cost, 0);
  const monthTokens = month.reduce((s, d) => s + d.tokens, 0);
  const monthCost = month.reduce((s, d) => s + d.cost, 0);

  const projectedMonthly = weekCost * (30 / 7);

  const rows = useMemo(() => aggregateByAgentModel(entries), [entries]);
  const maxDayTokens = Math.max(1, ...week.map((d) => d.tokens));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Costs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Token usage &amp; estimated spend. Captured live from chat events.
          </p>
        </div>
        <button
          onClick={clear}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border hover:bg-white/5 transition-colors"
          style={{ borderColor: "var(--border)" }}
          title="Clear local usage log"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear log
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Today"
          value={formatUSD(todayCost)}
          hint={`${todayTokens.toLocaleString()} tokens`}
          icon={Zap}
        />
        <StatCard
          label="Last 7 days"
          value={formatUSD(weekCost)}
          hint={`${weekTokens.toLocaleString()} tokens`}
          icon={TrendingUp}
        />
        <StatCard
          label="Last 30 days"
          value={formatUSD(monthCost)}
          hint={`${monthTokens.toLocaleString()} tokens`}
          icon={DollarSign}
        />
        <StatCard
          label="Projected monthly"
          value={formatUSD(projectedMonthly)}
          hint="7-day average × 30"
          icon={TrendingUp}
        />
      </div>

      {/* 7-day bar chart */}
      <div
        className="rounded-xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Last 7 days</h2>
          <span className="text-xs text-muted-foreground">
            Total tokens per day
          </span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {week.map((d) => {
            const h = Math.round((d.tokens / maxDayTokens) * 100);
            const isToday = d.day === today0;
            return (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center justify-end gap-2"
              >
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    background: isToday
                      ? "rgb(59 130 246)"
                      : "rgb(59 130 246 / 0.3)",
                  }}
                  title={`${d.tokens.toLocaleString()} tokens · ${formatUSD(d.cost)}`}
                />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {dayLabel(d.day)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent × Model table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold">Agent × Model</h2>
          <span className="text-xs text-muted-foreground">
            {entries.length.toLocaleString()} calls tracked
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            No usage captured yet. Start a chat and costs will appear here
            once the first response finalizes.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead
              className="text-xs uppercase tracking-wider text-muted-foreground"
              style={{ background: "rgba(0,0,0,0.02)" }}
            >
              <tr>
                <th className="text-left px-5 py-3 font-medium">Agent</th>
                <th className="text-left px-5 py-3 font-medium">Model</th>
                <th className="text-right px-5 py-3 font-medium">Calls</th>
                <th className="text-right px-5 py-3 font-medium">Input</th>
                <th className="text-right px-5 py-3 font-medium">Output</th>
                <th className="text-right px-5 py-3 font-medium">Cache R/W</th>
                <th className="text-right px-5 py-3 font-medium">Rate</th>
                <th className="text-right px-5 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rate = priceFor(row.model);
                const rateLabel =
                  rate.in === 0 && rate.out === 0
                    ? "—"
                    : `$${rate.in}/${rate.out}`;
                return (
                  <tr
                    key={`${row.agentId}::${row.model}`}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3 font-mono text-xs">
                      {row.agentId}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{row.model}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {row.calls.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {row.input.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {row.output.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {row.cacheRead.toLocaleString()} /{" "}
                      {row.cacheWrite.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                      {rateLabel}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">
                      {formatUSD(row.cost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Cost estimates are based on public 2026 list prices and may not reflect
        your actual bill (enterprise discounts, cached inputs, fine-tuned
        models, and local providers are not priced). Usage is stored locally
        in your browser — no data leaves this device.
      </p>
    </div>
  );
}
