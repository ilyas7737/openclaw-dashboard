"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import {
  clearUsageLog,
  loadUsageLog,
  parseUsage,
  saveUsageLog,
  type UsageEntry,
} from "@/lib/usage-store";
import type { ChatEvent } from "@/lib/types";

export function useUsageLog() {
  const { subscribe, isConnected } = useOpenClaw();
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const seenRunIds = useRef<Set<string>>(new Set());

  // Initial hydrate from localStorage
  useEffect(() => {
    const initial = loadUsageLog();
    setEntries(initial);
    initial.forEach((e) => seenRunIds.current.add(e.runId));
  }, []);

  // Subscribe to chat events and capture usage on finalization
  useEffect(() => {
    if (!isConnected) return;
    return subscribe("chat", (evt: ChatEvent) => {
      if (evt.state !== "final") return;
      if (seenRunIds.current.has(evt.runId)) return;
      const parsed = parseUsage(evt.usage, {
        runId: evt.runId,
        sessionKey: evt.sessionKey,
      });
      if (!parsed) return;
      seenRunIds.current.add(evt.runId);
      setEntries((prev) => {
        const next = [...prev, parsed];
        saveUsageLog(next);
        return next;
      });
    });
  }, [isConnected, subscribe]);

  const clear = useCallback(() => {
    clearUsageLog();
    seenRunIds.current.clear();
    setEntries([]);
  }, []);

  return { entries, clear };
}
