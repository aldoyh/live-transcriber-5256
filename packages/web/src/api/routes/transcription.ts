import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { transcribeAudio } from "../transcription/engine";
import { recordActivity, workspaceKeySchema } from "../database/activity-store";
let globalWindow = Date.now();
let globalCount = 0;
let globalActive = 0;
const callers = new Map<string, { active: boolean; last: number; window: number; count: number }>();
export const transcription = {
  chunk: base
    .input(
      z.object({
        audio: z.string().min(60).max(1_500_000),
        clientId: z.string().uuid(),
        workspaceKey: workspaceKeySchema.optional(),
        sessionId: z.string().uuid().optional(),
        chunkId: z.string().uuid().optional(),
        start: z.number().min(0).optional(),
        end: z.number().min(0).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const now = Date.now();
      const audit = (action: string, details: Record<string, unknown>) =>
        input.workspaceKey
          ? recordActivity(
              input.workspaceKey,
              action,
              {
                chunkId: input.chunkId ?? null,
                start: input.start ?? null,
                end: input.end ?? null,
                ...details,
              },
              input.sessionId,
            )
          : Promise.resolve();
      if (now - globalWindow > 60_000) {
        globalWindow = now;
        globalCount = 0;
      }
      if (globalActive >= 4 || globalCount >= 30)
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "خدمة التفريغ مشغولة. انتظر قليلاً وأعد المحاولة.",
        });
      for (const [key, value] of callers)
        if (!value.active && now - value.last > 120_000) callers.delete(key);
      const forwarded = context.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const key = forwarded || input.clientId;
      const state = callers.get(key) ?? { active: false, last: 0, window: now, count: 0 };
      if (now - state.window > 60_000) {
        state.window = now;
        state.count = 0;
      }
      if (state.active || state.count >= 10)
        throw new ORPCError("TOO_MANY_REQUESTS", { message: "يرجى الانتظار قبل إرسال مقطع آخر." });
      if (!process.env.AI_GATEWAY_API_KEY)
        throw new ORPCError("SERVICE_UNAVAILABLE", { message: "خدمة التفريغ غير متصلة حالياً." });
      const bytes = Buffer.from(input.audio, "base64");
      if (
        bytes.length > 1_000_000 ||
        bytes.length < 44 ||
        bytes.toString("ascii", 0, 4) !== "RIFF" ||
        bytes.toString("ascii", 8, 12) !== "WAVE"
      ) {
        throw new ORPCError("BAD_REQUEST", { message: "يجب إرسال مقطع صوتي WAV صالح." });
      }
      if (
        bytes.readUInt16LE(20) !== 1 ||
        bytes.readUInt16LE(22) !== 1 ||
        bytes.readUInt32LE(24) !== 16000 ||
        bytes.readUInt16LE(34) !== 16 ||
        bytes.length > 32_000 * 24 + 44
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "صيغة الصوت المطلوبة: WAV أحادي، 16 كيلوهرتز، بحد أقصى 24 ثانية.",
        });
      }
      globalActive += 1;
      globalCount += 1;
      state.active = true;
      state.last = now;
      state.count += 1;
      callers.set(key, state);
      try {
        await audit("chunk.submitted", { bytes: bytes.length, model: "google/gemini-3-flash" });
        const text = await transcribeAudio(bytes);
        await audit("chunk.completed", {
          text,
          characters: text.length,
          latencyMs: Date.now() - now,
          model: "google/gemini-3-flash",
          speech: Boolean(text),
        });
        return { text };
      } catch (error) {
        await audit("chunk.error", {
          message: error instanceof Error ? error.message : "Unknown error",
          latencyMs: Date.now() - now,
        }).catch((auditError) => console.error("Activity storage failed", auditError));
        console.error(
          "Audio transcription failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
        throw new ORPCError("BAD_GATEWAY", {
          message: "تعذّر تفريغ المقطع. أعد المحاولة؛ لم يتم إنشاء نص بديل.",
        });
      } finally {
        globalActive -= 1;
        state.active = false;
        state.last = Date.now();
      }
    }),
};
