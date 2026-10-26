import { z } from "zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { base } from "../__core/app";
import { db } from "../database";
import { sessions, activity } from "../database/schema";
import { recordActivity, workspaceHash, workspaceKeySchema } from "../database/activity-store";

const scope = z.object({ workspaceKey: workspaceKeySchema });
const segment = z.object({
  id: z.string().uuid(),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().max(30000),
});
const session = z.object({
  id: z.string().uuid(),
  title: z.string().max(120),
  url: z.string().max(2000),
  mode: z.enum(["live", "video"]).default("live"),
  created: z.number().int().min(0),
  seconds: z.number().min(0),
  segments: z.array(segment).max(10000),
});
const event = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  action: z.enum([
    "app.opened",
    "navigation.changed",
    "session.created",
    "session.opened",
    "source.opened",
    "consent.changed",
    "capture.requested",
    "capture.started",
    "capture.stopped",
    "capture.error",
    "audio.warning",
    "chunk.retry",
    "chunk.discarded",
    "transcript.copied",
    "transcript.exported",
    "search.changed",
    "preference.changed",
    "activity.exported",
  ]),
  details: z
    .record(z.string().max(100), z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]))
    .default({}),
  occurred: z.number().int().min(0),
});

export const workspace = {
  list: base.input(scope).handler(async ({ input }) => {
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.workspace, workspaceHash(input.workspaceKey)))
      .orderBy(desc(sessions.updated));
    return rows.map(({ workspace: _workspace, updated: _updated, ...row }) => row);
  }),
  save: base.input(scope.extend({ session })).handler(async ({ input }) => {
    const key = workspaceHash(input.workspaceKey);
    const [previous] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.workspace, key), eq(sessions.id, input.session.id)))
      .limit(1);
    const value = { ...input.session, workspace: key, updated: Date.now() };
    if (previous && previous.title === value.title && previous.url === value.url && previous.mode === value.mode && previous.seconds === value.seconds && JSON.stringify(previous.segments) === JSON.stringify(value.segments))
      return { saved: true, updated: previous.updated };
    const changes = input.session.segments
      .filter((s) => !previous || previous.segments.find((p) => p.id === s.id)?.text !== s.text)
      .map((s) => ({
        ...s,
        previousText: previous?.segments.find((p) => p.id === s.id)?.text ?? null,
      }));
    const eventId = crypto.randomUUID();
    await db.batch([
      db
        .insert(sessions)
        .values(value)
        .onConflictDoUpdate({
          target: [sessions.workspace, sessions.id],
          set: {
            title: value.title,
            url: value.url,
            previousUrl: previous?.url ?? null,
            mode: value.mode,
            previousMode: previous?.mode ?? null,
            seconds: value.seconds,
            previousSeconds: previous?.seconds ?? null,
            segments: value.segments,
            updated: value.updated,
          },
        }),
      db
        .insert(activity)
        .values({
          workspace: key,
          eventId,
          sessionId: value.id,
          action: previous ? "session.updated" : "session.saved",
          occurred: value.updated,
          received: value.updated,
          details: {
            title: value.title,
            previousTitle: previous?.title ?? null,
            url: value.url,
            mode: value.mode,
            seconds: value.seconds,
            segmentCount: value.segments.length,
            changedSegments: changes,
          },
        }),
    ]);
    return { saved: true, updated: value.updated };
  }),
  record: base
    .input(scope.extend({ events: z.array(event).min(1).max(50) }))
    .handler(async ({ input }) => {
      for (const e of input.events)
        await recordActivity(
          input.workspaceKey,
          e.action,
          e.details,
          e.sessionId,
          e.eventId,
          e.occurred,
        );
      return { recorded: input.events.length };
    }),
  activity: base
    .input(
      scope.extend({
        sessionId: z.string().uuid().optional(),
        before: z.number().int().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .handler(async ({ input }) => {
      const rows = await db
        .select()
        .from(activity)
        .where(
          and(
            eq(activity.workspace, workspaceHash(input.workspaceKey)),
            input.sessionId ? eq(activity.sessionId, input.sessionId) : undefined,
            input.before ? lt(activity.id, input.before) : undefined,
          ),
        )
        .orderBy(desc(activity.id))
        .limit(input.limit + 1);
      const hasMore = rows.length > input.limit;
      const page = rows.slice(0, input.limit);
      return {
        rows: page.map(({ workspace: _workspace, ...row }) => row),
        next: hasMore ? page.at(-1)!.id : null,
      };
    }),
};
