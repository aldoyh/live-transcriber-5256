import { useQuery } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";
import type { Session } from "../lib/transcript";

export type ActivityAction =
  | "app.opened"
  | "navigation.changed"
  | "session.created"
  | "session.opened"
  | "source.opened"
  | "consent.changed"
  | "capture.requested"
  | "capture.started"
  | "capture.stopped"
  | "capture.error"
  | "audio.warning"
  | "chunk.retry"
  | "chunk.discarded"
  | "transcript.copied"
  | "transcript.exported"
  | "search.changed"
  | "preference.changed"
  | "activity.exported";
export type ActivityEvent = {
  eventId: string;
  sessionId?: string;
  action: ActivityAction;
  details: Record<string, string | number | boolean | null>;
  occurred: number;
};
export function useStoredSessions(workspaceKey: string) {
  return useQuery(orpc.workspace.list.queryOptions({ input: { workspaceKey }, retry: 1 }));
}
export function useStoredActivity(workspaceKey: string, sessionId?: string, before?: number) {
  return useQuery(
    orpc.workspace.activity.queryOptions({
      input: { workspaceKey, sessionId, before, limit: 50 },
      retry: 1,
    }),
  );
}
export async function saveStoredSession(workspaceKey: string, session: Session) {
  return client.workspace.save({
    workspaceKey,
    session: { ...session, mode: session.mode ?? "live" },
  });
}
export async function recordStoredEvents(workspaceKey: string, events: ActivityEvent[]) {
  return client.workspace.record({ workspaceKey, events });
}
export async function exportStoredActivity(workspaceKey: string) {
  const rows = [];
  let before: number | undefined;
  do {
    const page = await client.workspace.activity({ workspaceKey, before, limit: 200 });
    rows.push(...page.rows);
    before = page.next ?? undefined;
  } while (before !== undefined);
  return rows;
}
