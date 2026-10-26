import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { loadSessions, hasSessionContent, type Session } from "../lib/transcript";
import {
  recordStoredEvents,
  saveStoredSession,
  type ActivityAction,
  type ActivityEvent,
} from "../queries/workspace";

let volatileKey = "";
export function getWorkspaceKey() {
  try {
    const stored = localStorage.getItem("nass-workspace-key");
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
  } catch {
    /* Non-persistent browser: continue with an in-memory capability. */
  }
  if (!volatileKey)
    volatileKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  try {
    localStorage.setItem("nass-workspace-key", volatileKey);
  } catch {
    /* Reported by outbox status. */
  }
  return volatileKey;
}
type Outbox = { sessions: Session[]; events: ActivityEvent[] };
export function useWorkspaceStorage(workspaceKey: string, session: Session) {
  const cache = useQueryClient();
  const initial = useRef<Outbox | null>(null);
  if (!initial.current) {
    try {
      initial.current = JSON.parse(localStorage.getItem("nass-outbox") || "null");
    } catch {
      /* Recover from corrupted fallback. */
    }
    if (
      !initial.current ||
      !Array.isArray(initial.current.sessions) ||
      !Array.isArray(initial.current.events)
    )
      initial.current = { sessions: [], events: [] };
  }
  const drafts = useRef(new Map(initial.current.sessions.map((s) => [s.id, s])));
  const events = useRef<ActivityEvent[]>(initial.current.events);
  const busy = useRef(false);
  const mounted = useRef(true);
  const drainRef = useRef<() => Promise<void>>(async () => {});
  const [pending, setPending] = useState(drafts.current.size + events.current.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fallbackError, setFallbackError] = useState("");
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const persist = useCallback(() => {
    setPending(drafts.current.size + events.current.length);
    try {
      localStorage.setItem(
        "nass-outbox",
        JSON.stringify({ sessions: [...drafts.current.values()], events: events.current }),
      );
      setFallbackError("");
    } catch {
      setFallbackError(
        "تعذّر حفظ النسخة الاحتياطية في المتصفح. لا تغلق الصفحة قبل اكتمال حفظ قاعدة البيانات.",
      );
    }
  }, []);
  drainRef.current = async () => {
    if (busy.current) return;
    busy.current = true;
    if (mounted.current) {
      setSaving(true);
      setError("");
    }
    try {
      while (drafts.current.size || events.current.length) {
        const draft = drafts.current.values().next().value;
        if (draft) {
          await saveStoredSession(workspaceKey, draft);
          if (drafts.current.get(draft.id) === draft) drafts.current.delete(draft.id);
        } else {
          const batch = events.current.slice(0, 50);
          await recordStoredEvents(workspaceKey, batch);
          events.current.splice(0, batch.length);
        }
        if (mounted.current) {
          setLastSaved(Date.now());
          persist();
        }
      }
      if (mounted.current) {
        void cache.invalidateQueries({ queryKey: orpc.workspace.list.key() });
        void cache.invalidateQueries({ queryKey: orpc.workspace.activity.key() });
      }
    } catch {
      if (mounted.current)
        setError("تعذّر الحفظ في SQLite. التغييرات معلّقة في المتصفح؛ أعد محاولة المزامنة.");
    } finally {
      busy.current = false;
      if (mounted.current) {
        setSaving(false);
        persist();
      }
    }
  };
  const record = useCallback(
    (action: ActivityAction, details: ActivityEvent["details"] = {}, sessionId?: string) => {
      events.current.push({
        eventId: crypto.randomUUID(),
        action,
        details,
        sessionId,
        occurred: Date.now(),
      });
      persist();
      void drainRef.current();
    },
    [persist],
  );
  useEffect(() => {
    mounted.current = true;
    // Existing local sessions are migrated once per workspace; the marker is set only after successful writes.
    let migrated = false;
    try {
      migrated = localStorage.getItem("nass-sqlite-migrated") === workspaceKey;
    } catch {
      /* no local storage */
    }
    if (!migrated) {
      for (const old of loadSessions())
        if (!drafts.current.has(old.id)) drafts.current.set(old.id, old);
      persist();
      void drainRef.current().then(() => {
        if (!drafts.current.size)
          try {
            localStorage.setItem("nass-sqlite-migrated", workspaceKey);
          } catch {
            /* optional marker */
          }
      });
    } else if (drafts.current.size || events.current.length) void drainRef.current();
    const online = () => void drainRef.current();
    window.addEventListener("online", online);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", online);
    };
  }, [workspaceKey, persist]);
  useEffect(() => {
    // Persist the snapshot immediately; only the network write is debounced.
    if (!hasSessionContent(session)) return;
    drafts.current.set(session.id, session);
    persist();
    const timer = setTimeout(() => void drainRef.current(), 650);
    return () => clearTimeout(timer);
  }, [session, persist]);
  return {
    record,
    pending,
    saving,
    error: error || fallbackError,
    lastSaved,
    retry: () => void drainRef.current(),
  };
}
