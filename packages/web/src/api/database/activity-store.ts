import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./index";
import { activity } from "./schema";

// A device-held capability, not a login. Never persist the plaintext capability.
export const workspaceKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
export function workspaceHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}
export async function recordActivity(
  key: string,
  action: string,
  details: Record<string, unknown> = {},
  sessionId?: string,
  eventId = randomUUID(),
  occurred = Date.now(),
) {
  await db
    .insert(activity)
    .values({
      workspace: workspaceHash(key),
      eventId,
      sessionId: sessionId ?? null,
      action,
      details,
      occurred,
      received: Date.now(),
    })
    .onConflictDoNothing({ target: activity.eventId });
}
