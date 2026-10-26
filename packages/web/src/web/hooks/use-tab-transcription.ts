import { useEffect, useRef, useState } from "react";
import { useTranscribeChunk } from "../queries/transcription";
import { encodeWav } from "../lib/wav";
import type { Segment } from "../lib/transcript";
import { tabCaptureOptions } from "../lib/capture-options";
type Chunk = { audio: string; start: number; end: number; id: string };
type Pipeline = {
  stream: MediaStream;
  context: AudioContext;
  node: AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
  mute: GainNode;
  frames: Float32Array[];
  length: number;
  offset: number;
  stopped: boolean;
  meter: number;
};
export function useTabTranscription(
  onSegment: (segment: Segment) => void,
  storage?: { workspaceKey: string; sessionId: string },
) {
  const mutation = useTranscribeChunk();
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const send = useRef(mutation.mutateAsync);
  send.current = mutation.mutateAsync;
  const callback = useRef(onSegment);
  callback.current = onSegment;
  const pipeline = useRef<Pipeline | null>(null);
  const busy = useRef(false);
  const chunks = useRef<Chunk[]>([]);
  const clientId = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const keepResult = useRef(true);
  const soundSeen = useRef(false);
  const [sourceName, setSourceName] = useState("");
  const [audioWarning, setAudioWarning] = useState("");
  const [setupPhase, setSetupPhase] = useState("");
  const [state, setState] = useState<"idle" | "requesting" | "live" | "finishing">("idle");
  const [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0),
    [pending, setPending] = useState(0),
    [level, setLevel] = useState(0),
    [failed, setFailed] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  async function drain() {
    if (busy.current || !mounted.current) return;
    busy.current = true;
    setFailed(false);
    while (chunks.current.length && mounted.current) {
      const chunk = chunks.current[0];
      setPending(chunks.current.length);
      try {
        const result = await send.current({
          audio: chunk.audio,
          clientId: clientId.current,
          ...storageRef.current,
          chunkId: chunk.id,
          start: chunk.start,
          end: chunk.end,
        });
        if (!mounted.current) break;
        if (result.text && keepResult.current)
          callback.current({ id: chunk.id, start: chunk.start, end: chunk.end, text: result.text });
        chunks.current.shift();
        setError("");
      } catch (e) {
        if (mounted.current) {
          setError(e instanceof Error ? e.message : "تعذّر تفريغ المقطع.");
          setFailed(true);
          stopRef.current();
        }
        break;
      }
      if (mounted.current) setPending(chunks.current.length);
    }
    busy.current = false;
    if (mounted.current) {
      setPending(chunks.current.length);
      if (!pipeline.current) setState("idle");
    }
  }
  function flush(p: Pipeline) {
    if (!p.length) return;
    const combined = new Float32Array(p.length);
    let offset = 0;
    for (const frame of p.frames) {
      combined.set(frame, offset);
      offset += frame.length;
    }
    const duration = p.length / p.context.sampleRate;
    const rms = Math.sqrt(combined.reduce((sum, x) => sum + x * x, 0) / combined.length);
    if (rms > 0.001)
      chunks.current.push({
        audio: encodeWav(combined, p.context.sampleRate),
        id: crypto.randomUUID(),
        start: p.offset,
        end: p.offset + duration,
      });
    p.offset += duration;
    p.frames = [];
    p.length = 0;
    setSeconds(p.offset);
    setPending(chunks.current.length);
    if (!failed && !busy.current) void drain();
  }
  function stop() {
    const p = pipeline.current;
    if (p) {
      p.stopped = true;
      pipeline.current = null;
      flush(p);
      p.node.port.onmessage = null;
      p.node.disconnect();
      p.source.disconnect();
      p.mute.disconnect();
      p.stream.getTracks().forEach((t) => t.stop());
      void p.context.close();
      setLevel(0);
      setAudioWarning("");
    }
    setState(busy.current || chunks.current.length ? "finishing" : "idle");
  }
  stopRef.current = stop;
  async function start(offset = 0) {
    if (pipeline.current || busy.current || chunks.current.length) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("التقاط صوت علامة التبويب يحتاج Chrome على الكمبيوتر واتصال HTTPS.");
      return;
    }
    setError("");
    setFailed(false);
    setState("requesting");
    setSetupPhase("اختيار تبويب الصوت في Chrome");
    setAudioWarning("");
    setSourceName("");
    soundSeen.current = false;
    keepResult.current = true;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      // Start Web Audio during the button's user gesture, not after a long picker interaction.
      context = new AudioContext();
      const audioReady = context.resume();
      stream = await navigator.mediaDevices.getDisplayMedia(tabCaptureOptions);
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        return;
      }
      setSetupPhase("توصيل قناة الصوت");
      const videoTrack = stream.getVideoTracks()[0];
      const surface = videoTrack?.getSettings().displaySurface;
      if (surface && surface !== "browser")
        throw new Error(
          "تم اختيار نافذة أو شاشة، وليس تبويباً. أعد المحاولة واختر قسم «علامة تبويب Chrome / Chrome Tab» ثم تبويب يوتيوب. خيار مشاركة الصوت يظهر بعد تحديد التبويب.",
        );
      if (!stream.getAudioTracks().length)
        throw new Error(
          "لم تصل قناة صوت. أعد المحاولة: افتح قسم «Chrome Tab»، اختر تبويب يوتيوب أولاً، ثم فعّل «Share tab audio / مشاركة صوت علامة التبويب» أسفل النافذة قبل الضغط على مشاركة.",
        );
      const label = videoTrack?.label || "تبويب Chrome";
      setSourceName(
        label.startsWith("web-contents-media-stream") ? "تبويب Chrome — قناة صوت متصلة" : label,
      );
      await Promise.race([
        audioReady,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "لم يبدأ محرك الصوت. أعد الضغط على بدء التفريغ في تبويب التطبيق المستقل.",
                ),
              ),
            8000,
          ),
        ),
      ]);
      setSetupPhase("تشغيل معالج الصوت");
      await Promise.race([
        context.audioWorklet.addModule("/audio/capture-worklet.js"),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("تعذّر تحميل معالج الصوت. أعد تحميل التطبيق ثم حاول مرة أخرى.")),
            10000,
          ),
        ),
      ]);
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        void context.close();
        return;
      }
      const source = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const node = new AudioWorkletNode(context, "tab-audio-capture");
      const mute = context.createGain();
      mute.gain.value = 0;
      source.connect(node);
      node.connect(mute);
      mute.connect(context.destination);
      const p: Pipeline = {
        stream,
        context,
        node,
        source,
        mute,
        frames: [],
        length: 0,
        offset,
        stopped: false,
        meter: 0,
      };
      pipeline.current = p;
      setSeconds(offset);
      setState("live");
      setSetupPhase("");
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (p.stopped) return;
        const frame = event.data;
        p.frames.push(frame);
        p.length += frame.length;
        if (performance.now() - p.meter > 150) {
          const rms = Math.sqrt(frame.reduce((sum, x) => sum + x * x, 0) / frame.length);
          setLevel(Math.min(1, rms * 6));
          if (rms > 0.001) {
            soundSeen.current = true;
            setAudioWarning("");
          }
          setSeconds(p.offset + p.length / p.context.sampleRate);
          p.meter = performance.now();
        }
        if (p.length >= p.context.sampleRate * 12) {
          flush(p);
          if (chunks.current.length >= 5) {
            setError("تراكمت المقاطع؛ تم إيقاف الالتقاط لحماية النص. انتظر المعالجة ثم استأنف.");
            stop();
          }
        }
      };
      stream.getVideoTracks()[0].addEventListener("ended", () => stopRef.current(), { once: true });
      stream.getAudioTracks()[0].addEventListener("ended", () => stopRef.current(), { once: true });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (context) void context.close();
      pipeline.current = null;
      setState("idle");
      setSetupPhase("");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "تم إلغاء المشاركة أو رفض الإذن. يمكنك المحاولة مجدداً."
          : e instanceof Error
            ? e.message
            : "تعذّر بدء التقاط الصوت.",
      );
    }
  }
  function discard() {
    keepResult.current = false;
    chunks.current = [];
    setPending(0);
    setFailed(false);
    setError("");
    setSeconds(0);
    setAudioWarning("");
    setSourceName("");
  }
  useEffect(() => {
    if (state !== "live") return;
    const timer = setTimeout(() => {
      if (!soundSeen.current)
        setAudioWarning(
          "تمت مشاركة التبويب، لكن لا يصل صوت مسموع. شغّل الفيديو وارفع صوته. إذا ظل المؤشر ساكناً، أوقف الالتقاط وأعد المشاركة مع تفعيل صوت التبويب.",
        );
    }, 8000);
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      keepResult.current = false;
      chunks.current = [];
      const p = pipeline.current;
      if (p) {
        p.stopped = true;
        p.node.port.onmessage = null;
        p.node.disconnect();
        p.source.disconnect();
        p.stream.getTracks().forEach((t) => t.stop());
        void p.context.close();
        pipeline.current = null;
      }
    };
  }, []);
  return {
    start,
    stop,
    sourceName,
    setupPhase,
    audioWarning,
    state,
    error,
    seconds,
    pending,
    level,
    failed,
    retry: () => {
      setError("");
      void drain();
    },
    discard,
  };
}
