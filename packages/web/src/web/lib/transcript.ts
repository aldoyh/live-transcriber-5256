export type Segment = { id: string; start: number; end: number; text: string };
export type Session = {
  id: string;
  title: string;
  url: string;
  created: number;
  segments: Segment[];
  seconds: number;
  mode?: "video" | "live";
};
export function videoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      id =
        url.searchParams.get("v") ||
        (/^\/(live|shorts|embed)\//.test(url.pathname) ? url.pathname.split("/")[2] : null);
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function clock(value: number) {
  const n = Math.floor(value);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function hasSessionContent(session: Session) {
  return Boolean(
    session.url ||
    session.seconds ||
    session.segments.length ||
    session.title !== "جلسة جديدة" ||
    session.mode === "video",
  );
}
function stamp(value: number) {
  const ms = Math.round(value * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function asSrt(segments: Segment[]) {
  return segments
    .map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.text.trim()}\n`)
    .join("\n");
}
export function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function loadSessions(): Session[] {
  try {
    const data = JSON.parse(localStorage.getItem("nass-sessions") || "[]");
    return Array.isArray(data)
      ? data.filter((s) => s && typeof s.id === "string" && Array.isArray(s.segments)).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
