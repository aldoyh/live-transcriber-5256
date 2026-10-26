import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpLeft,
  AudioLines,
  Check,
  Clock3,
  Copy,
  Database,
  FileText,
  History,
  Link2,
  LoaderCircle,
  Menu,
  MonitorUp,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Volume2,
  X,
  Youtube,
} from "lucide-react";
import { useTabTranscription } from "../hooks/use-tab-transcription";
import { getWorkspaceKey, useWorkspaceStorage } from "../hooks/use-workspace-storage";
import { useStoredSessions, exportStoredActivity } from "../queries/workspace";
import {
  asSrt,
  clock,
  downloadText,
  loadSessions,
  hasSessionContent,
  videoId,
  type Segment,
  type Session,
} from "../lib/transcript";
import ActivityView from "./activity-view";

const fresh = (): Session => ({
  id: crypto.randomUUID(),
  title: "جلسة جديدة",
  url: "",
  created: Date.now(),
  segments: [],
  seconds: 0,
  mode: "live",
});
const date = (value: number) =>
  new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
type View = "workspace" | "history" | "activity";
export default function TranscriptionApp() {
  const [workspaceKey] = useState(getWorkspaceKey);
  const [session, setSession] = useState<Session>(fresh);
  const [localSessions, setLocalSessions] = useState<Session[]>(loadSessions);
  const [url, setUrl] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("youtube") || "";
    return videoId(value) ? value : "";
  });
  const [nav, setNav] = useState<View>("workspace");
  const [inspector, setInspector] = useState<"details" | "activity">("details");
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [startError, setStartError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [find, setFind] = useState("");
  const [consent, setConsent] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const storage = useWorkspaceStorage(workspaceKey, session);
  const stored = useStoredSessions(workspaceKey);
  const recordRef = useRef(storage.record);
  recordRef.current = storage.record;
  const opened = useRef(false);
  const capture = useTabTranscription(
    (segment: Segment) =>
      setSession((s) => ({
        ...s,
        segments: [...s.segments, segment],
        seconds: Math.max(s.seconds, segment.end),
      })),
    { workspaceKey, sessionId: session.id },
  );
  const active = capture.state === "live";
  const requesting = capture.state === "requesting";
  const working = capture.pending > 0 || capture.state === "finishing";
  const locked = active || requesting || working;
  const id = videoId(url);
  const embedded = window.self !== window.top;
  const policy = document as Document & {
    permissionsPolicy?: { allowsFeature: (name: string) => boolean };
    featurePolicy?: { allowsFeature: (name: string) => boolean };
  };
  const blocked =
    !(policy.permissionsPolicy ?? policy.featurePolicy)?.allowsFeature("display-capture") &&
    Boolean(policy.permissionsPolicy ?? policy.featurePolicy);
  const supported = Boolean(navigator.mediaDevices?.getDisplayMedia);
  const sessions = [
    ...(stored.data ?? []),
    ...localSessions.filter((s) => !stored.data?.some((row) => row.id === s.id)),
  ];
  const words = session.segments.reduce(
    (n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  const elapsed = Math.max(session.seconds, capture.seconds);
  const status = active
    ? "التقاط الصوت"
    : requesting
      ? capture.setupPhase
      : capture.failed
        ? "توقفت المعالجة"
        : working
          ? "معالجة المقاطع"
          : "جاهز";
  const dbStatus =
    storage.error || stored.isError
      ? "تعذّر الاتصال"
      : storage.saving
        ? "جارٍ الحفظ"
        : storage.pending
          ? "تغييرات معلّقة"
          : stored.isLoading
            ? "جارٍ الاتصال"
            : "متصل";
  const log = (
    action: Parameters<typeof storage.record>[0],
    details: Parameters<typeof storage.record>[1] = {},
  ) => storage.record(action, details, session.id);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);
  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      recordRef.current("app.opened", {
        embedded,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        captureSupported: supported,
      });
    }
  }, [embedded, supported]);
  useEffect(() => {
    if (!hasSessionContent(session)) return;
    setLocalSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)].slice(0, 30));
  }, [session]);
  useEffect(() => {
    try {
      localStorage.setItem("nass-sessions", JSON.stringify(localSessions));
      setStorageError("");
    } catch {
      setStorageError("تعذّر حفظ النسخة المحلية. انتظر اكتمال المزامنة قبل إغلاق الصفحة.");
    }
  }, [localSessions]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (active && autoScroll) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.segments.length, active, autoScroll]);
  useEffect(() => {
    if (!active && capture.state === "idle" && capture.seconds > sessionRef.current.seconds)
      setSession((s) => ({ ...s, seconds: capture.seconds }));
  }, [active, capture.state, capture.seconds]);
  const previousState = useRef(capture.state);
  useEffect(() => {
    if (capture.state === "live" && previousState.current !== "live")
      recordRef.current(
        "capture.started",
        { source: capture.sourceName, mode: sessionRef.current.mode ?? "live" },
        sessionRef.current.id,
      );
    if (previousState.current === "live" && capture.state !== "live")
      recordRef.current(
        "capture.stopped",
        { seconds: capture.seconds, pending: capture.pending, reason: capture.error || "stop" },
        sessionRef.current.id,
      );
    previousState.current = capture.state;
  }, [capture.state, capture.sourceName, capture.seconds, capture.pending, capture.error]);
  useEffect(() => {
    if (capture.error)
      recordRef.current("capture.error", { message: capture.error }, sessionRef.current.id);
  }, [capture.error]);
  useEffect(() => {
    if (capture.audioWarning)
      recordRef.current("audio.warning", { message: capture.audioWarning }, sessionRef.current.id);
  }, [capture.audioWarning]);
  useEffect(() => {
    if (!locked && !storage.pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked, storage.pending]);

  function navigate(view: View) {
    setNav(view);
    setMenu(false);
    log("navigation.changed", { view });
  }
  function create() {
    if (locked) return;
    capture.discard();
    const next = fresh();
    setSession(next);
    setUrl("");
    setConsent(false);
    setFind("");
    setStartError("");
    setNav("workspace");
    setMenu(false);
    storage.record("session.created", { mode: "live" }, next.id);
  }
  function openSession(s: Session) {
    if (locked) return;
    capture.discard();
    setSession(s);
    setUrl(s.url);
    setNav("workspace");
    setConsent(false);
    setStartError("");
    setMenu(false);
    setFind("");
    storage.record("session.opened", { title: s.title, source: s.url }, s.id);
  }
  function standalone() {
    const target = new URL(window.location.href);
    if (id) target.searchParams.set("youtube", url);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  }
  async function start() {
    setStartError("");
    if (!id) {
      setStartError("أدخل رابط يوتيوب صالحاً.");
      return;
    }
    if (!consent) {
      setStartError("فعّل الموافقة على معالجة الصوت أولاً.");
      return;
    }
    if (!supported) {
      setStartError("التقاط صوت التبويب يحتاج Chrome على الكمبيوتر واتصال HTTPS.");
      return;
    }
    if (embedded || blocked) {
      standalone();
      setStartError("افتح التبويب المستقل ثم ابدأ الالتقاط فيه؛ المعاينة المضمّنة لا تُستخدم للتفريغ.");
      return;
    }
    setSession((s) => ({
      ...s,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: s.title === "جلسة جديدة" ? `جلسة · ${id}` : s.title,
    }));
    log("capture.requested", { url, mode: session.mode ?? "live", offset: session.seconds });
    await capture.start(session.seconds);
  }
  function exportFile(type: "txt" | "srt") {
    const text =
      type === "srt" ? asSrt(session.segments) : session.segments.map((s) => s.text).join("\n\n");
    downloadText(`نص-${session.id.slice(0, 8)}.${type}`, text);
    log("transcript.exported", {
      format: type,
      segments: session.segments.length,
      characters: text.length,
    });
    setToast("تم تنزيل الملف.");
  }
  async function copy() {
    try {
      const text = session.segments.map((s) => s.text).join("\n\n");
      await navigator.clipboard.writeText(text);
      log("transcript.copied", { characters: text.length });
      setToast("تم نسخ النص.");
    } catch {
      setToast("تعذّر النسخ. استخدم تصدير TXT.");
    }
  }
  async function exportActivity() {
    setExporting(true);
    try {
      const rows = await exportStoredActivity(workspaceKey);
      downloadText("سجل-النشاط.json", JSON.stringify(rows, null, 2));
      log("activity.exported", { format: "json", events: rows.length });
    } catch {
      setToast("تعذّر تحميل السجل من SQLite.");
    } finally {
      setExporting(false);
    }
  }
  const filtered = sessions.filter((s) =>
    `${s.title} ${s.url} ${s.segments.map((t) => t.text).join(" ")}`.includes(historySearch),
  );
  const message =
    startError || capture.error || capture.audioWarning || storage.error || storageError;
  return (
    <div className="nass-shell" dir="rtl">
      {menu && (
        <button className="nav-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenu(false)} />
      )}
      <aside className={`nass-sidebar ${menu ? "open" : ""}`}>
        <button className="nass-brand" onClick={() => navigate("workspace")}>
          <span className="brand-symbol">
            <AudioLines size={23} />
          </span>
          <b>
            نصّ<span>.</span>
          </b>
          <span className="brand-version" dir="ltr">
            WORKSPACE
          </span>
        </button>
        <div className="side-caption">التفريغ الصوتي</div>
        <nav aria-label="التنقل الرئيسي">
          <button
            className={`side-link ${nav === "workspace" ? "selected" : ""}`}
            onClick={() => navigate("workspace")}
          >
            <FileText size={17} /> مساحة التفريغ
          </button>
          <button
            className={`side-link ${nav === "history" ? "selected" : ""}`}
            disabled={locked}
            onClick={() => navigate("history")}
          >
            <History size={17} /> التفريغات السابقة <small>{sessions.length}</small>
          </button>
          <button
            className={`side-link ${nav === "activity" ? "selected" : ""}`}
            onClick={() => navigate("activity")}
          >
            <Activity size={17} /> سجل النشاط
          </button>
        </nav>
        <button className="new-session" onClick={create} disabled={locked}>
          <Plus size={16} /> جلسة جديدة
        </button>
        <div className="sidebar-bottom">
          <button className="side-link" onClick={() => setHelp(true)}>
            <MonitorUp size={17} /> دليل المشاركة
          </button>
          <div className="database-note">
            <Database size={16} />
            <div>
              <b>SQLite</b>
              <span>جلسات وسجل نشاط</span>
            </div>
            <span className={`connection-dot ${stored.isError || storage.error ? "error" : ""}`} />
          </div>
        </div>
      </aside>
      <div className="nass-main">
        <header className="nass-topbar">
          <div>
            <button
              className="nass-mobile-menu icon-button"
              aria-label="فتح القائمة"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              نصّ <i>/</i>{" "}
              {nav === "workspace"
                ? "مساحة التفريغ"
                : nav === "history"
                  ? "التفريغات السابقة"
                  : "سجل النشاط"}
            </span>
          </div>
          <div
            className={`sync-status ${storage.error || stored.isError ? "error-text" : ""}`}
            title={
              storage.lastSaved ? `آخر حفظ: ${date(storage.lastSaved)}` : "قاعدة بيانات SQLite"
            }
          >
            {storage.saving || stored.isLoading ? (
              <LoaderCircle className="spin" size={13} />
            ) : (
              <Database size={13} />
            )}
            <span>SQLite · {dbStatus}</span>
            {(storage.error || stored.isError) && (
              <button
                className="icon-button"
                aria-label="إعادة مزامنة قاعدة البيانات"
                onClick={() => {
                  storage.retry();
                  void stored.refetch();
                }}
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </header>
        <main className="nass-content">
          <div className="page-heading">
            <div>
              <span className="section-kicker">
                {nav === "workspace" ? "جلسة التفريغ" : nav === "history" ? "الأرشيف" : "المراقبة"}
              </span>
              <h1>
                {nav === "workspace"
                  ? "تفريغ صوت يوتيوب"
                  : nav === "history"
                    ? "التفريغات السابقة"
                    : "سجل النشاط"}
              </h1>
            </div>
            <div className="heading-meta">
              {nav === "workspace" ? (
                <>
                  <span className="language-tag">AR</span> مخرجات عربية
                </>
              ) : nav === "history" ? (
                `${sessions.length} جلسة`
              ) : (
                <>
                  <Database size={14} /> أحداث محفوظة في SQLite
                </>
              )}
            </div>
          </div>
          {nav === "workspace" ? (
            <>
              {(embedded || blocked) && (
                <div className="browser-notice standalone-notice">
                  <MonitorUp size={17} />
                  <span>التقاط الصوت متاح في تبويب التطبيق المستقل، خارج المعاينة.</span>
                  <button className="plain-button" onClick={standalone}>
                    فتح التطبيق في تبويب مستقل <ArrowUpLeft size={14} />
                  </button>
                </div>
              )}
              {!supported && (
                <div className="browser-notice">
                  <MonitorUp size={17} /> مشاركة صوت التبويب غير مدعومة في هذا المتصفح. التحرير
                  والتصدير متاحان.
                </div>
              )}
              <section className="source-card" aria-label="مصدر الصوت والتحكم">
                <div className="source-top">
                  <h2>
                    <Youtube size={18} /> مصدر الصوت
                  </h2>
                  <div className="mode-toggle">
                    <button
                      className={session.mode !== "video" ? "selected" : ""}
                      disabled={locked}
                      onClick={() => {
                        setSession((s) => ({ ...s, mode: "live" }));
                        log("preference.changed", { name: "mode", value: "live" });
                      }}
                    >
                      <Radio size={13} /> بث مباشر
                    </button>
                    <button
                      className={session.mode === "video" ? "selected" : ""}
                      disabled={locked}
                      onClick={() => {
                        setSession((s) => ({ ...s, mode: "video" }));
                        log("preference.changed", { name: "mode", value: "video" });
                      }}
                    >
                      <FileText size={13} /> فيديو
                    </button>
                  </div>
                </div>
                <label className="url-label" htmlFor="youtube-url">
                  رابط يوتيوب
                </label>
                <div className="source-controls">
                  <div className={`youtube-input ${url && !id ? "invalid" : ""}`}>
                    <Link2 size={16} />
                    <input
                      id="youtube-url"
                      aria-label="رابط يوتيوب"
                      type="url"
                      dir="ltr"
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={url}
                      disabled={locked}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setSession((s) => ({ ...s, url: e.target.value.slice(0, 2000) }));
                        setStartError("");
                      }}
                      maxLength={2000}
                    />
                    {id && <Check className="valid-check" size={15} />}
                    <button
                      className="source-open"
                      disabled={!id}
                      onClick={() => {
                        if (id) {
                          window.open(
                            `https://www.youtube.com/watch?v=${id}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          log("source.opened", { url });
                        }
                      }}
                    >
                      فتح الفيديو <ArrowUpLeft size={14} />
                    </button>
                  </div>
                  <div className="capture-actions">
                    {active ? (
                      <button className="btn-stop" onClick={capture.stop}>
                        <Square size={13} fill="currentColor" /> إيقاف الالتقاط
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        disabled={requesting || working}
                        onClick={() => void start()}
                      >
                        {requesting || working ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <AudioLines size={16} />
                        )}
                        {requesting
                          ? "اختيار التبويب"
                          : working
                            ? "جارٍ التفريغ"
                            : session.seconds
                              ? "استئناف الالتقاط"
                              : "ابدأ التفريغ"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="source-subline">
                  <label className="consent">
                    <input
                      aria-label="الموافقة على معالجة الصوت"
                      type="checkbox"
                      checked={consent}
                      disabled={active || requesting}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        setStartError("");
                        log("consent.changed", { allowed: e.target.checked });
                      }}
                    />
                    <span>لدي الإذن لإرسال الصوت إلى خدمة التفريغ.</span>
                  </label>
                  <button className="plain-button" onClick={() => setHelp(true)}>
                    Chrome Tab → Share tab audio <MonitorUp size={13} />
                  </button>
                </div>
              </section>
              {message && (
                <div className="error-banner" role="alert">
                  <span>{message}</span>
                  {capture.failed && (
                    <>
                      <button
                        onClick={() => {
                          log("chunk.retry", { pending: capture.pending });
                          capture.retry();
                        }}
                        disabled={active}
                      >
                        إعادة المحاولة
                      </button>
                      <button
                        onClick={() => {
                          log("chunk.discarded", { pending: capture.pending });
                          capture.discard();
                        }}
                        disabled={capture.state !== "idle"}
                      >
                        تجاهل المقاطع
                      </button>
                    </>
                  )}
                  {storage.error && <button onClick={storage.retry}>إعادة المزامنة</button>}
                </div>
              )}
              <div className="session-status">
                <div className="capture-status">
                  <i
                    className={`status-led ${active ? "live" : ""} ${capture.failed ? "error" : ""}`}
                  />
                  <b>{status}</b>
                  {active && (
                    <span className="capture-source-line" title={capture.sourceName}>
                      <Volume2 size={13} />
                      {capture.level > 0.01 ? "صوت مسموع" : "بانتظار الصوت"}
                    </span>
                  )}
                </div>
                <div className="status-metrics">
                  <span>
                    <Clock3 size={13} />
                    <b dir="ltr">{clock(elapsed)}</b>
                  </span>
                  <span>{words.toLocaleString("ar")} كلمة</span>
                  <span>{session.segments.length} مقطع</span>
                  <span>{capture.pending} قيد المعالجة</span>
                  <div className="audio-bars" aria-label="مستوى الصوت">
                    {Array.from({ length: 9 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: `${4 + capture.level * 22 * (0.4 + Math.abs(Math.sin(i * 2)))}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="workspace-grid">
                <section className="transcript-panel">
                  <div className="transcript-heading">
                    <h2>النص</h2>
                    <div className="transcript-actions">
                      <button
                        className="icon-button"
                        aria-label="نسخ النص"
                        title="نسخ النص"
                        disabled={!session.segments.length}
                        onClick={() => void copy()}
                      >
                        <Copy size={15} />
                      </button>
                      <span className="action-divider" />
                      <button
                        className="plain-button"
                        disabled={!session.segments.length}
                        onClick={() => exportFile("txt")}
                      >
                        <ArrowDownToLine size={14} /> TXT
                      </button>
                      <button
                        className="plain-button"
                        disabled={!session.segments.length}
                        onClick={() => exportFile("srt")}
                      >
                        SRT
                      </button>
                    </div>
                  </div>
                  <div className="transcript-tools">
                    <label>
                      <Search size={14} />
                      <input
                        aria-label="البحث في النص"
                        placeholder="البحث في النص"
                        value={find}
                        onChange={(e) => setFind(e.target.value)}
                        onBlur={() => log("search.changed", { scope: "transcript", query: find })}
                      />
                    </label>
                    <button
                      className={`plain-button ${autoScroll ? "selected" : ""}`}
                      onClick={() => {
                        setAutoScroll(!autoScroll);
                        log("preference.changed", { name: "autoScroll", value: !autoScroll });
                      }}
                    >
                      {autoScroll && <Check size={12} />} تمرير تلقائي
                    </button>
                  </div>
                  <div className="transcript-body">
                    {session.segments.length ? (
                      session.segments
                        .filter((s) => !find || s.text.includes(find))
                        .map((segment, i) => (
                          <div className="transcript-segment" key={segment.id}>
                            <div className="segment-meta">
                              <span dir="ltr">
                                {clock(segment.start)} — {clock(segment.end)}
                              </span>
                              <span>مقطع {i + 1}</span>
                            </div>
                            <textarea
                              aria-label={`تعديل المقطع ${i + 1}`}
                              value={segment.text}
                              rows={Math.max(2, Math.ceil(segment.text.length / 85))}
                              maxLength={30000}
                              onChange={(e) =>
                                setSession((s) => ({
                                  ...s,
                                  segments: s.segments.map((row) =>
                                    row.id === segment.id ? { ...row, text: e.target.value } : row,
                                  ),
                                }))
                              }
                            />
                          </div>
                        ))
                    ) : (
                      <div className="transcript-empty">
                        <FileText size={28} strokeWidth={1.4} />
                        <h3>لا يوجد نص بعد</h3>
                        <p>ابدأ التقاط صوت التبويب لعرض التفريغ.</p>
                        <small>المقاطع: نحو ١٢ ثانية، بالإضافة إلى وقت المعالجة.</small>
                      </div>
                    )}
                    {find &&
                      session.segments.length > 0 &&
                      !session.segments.some((s) => s.text.includes(find)) && (
                        <p className="data-placeholder">لا توجد نتائج.</p>
                      )}
                    {working && (
                      <div className="processing-line">
                        <LoaderCircle className="spin" size={14} />
                        {capture.failed ? "بانتظار إعادة المحاولة" : "جارٍ تفريغ الصوت…"}
                      </div>
                    )}
                    <div ref={end} />
                  </div>
                  <div className="transcript-footer">
                    <span>
                      <Database size={12} />
                      {storage.saving
                        ? "جارٍ حفظ التغييرات"
                        : storage.pending
                          ? "تغييرات بانتظار الحفظ"
                          : "محفوظ في SQLite"}
                    </span>
                    <span>التوقيت تقريبي · قابل للتحرير</span>
                  </div>
                </section>
                <aside className="workspace-inspector">
                  <div className="inspector-tabs">
                    <button
                      className={inspector === "details" ? "selected" : ""}
                      onClick={() => setInspector("details")}
                    >
                      تفاصيل الجلسة
                    </button>
                    <button
                      className={inspector === "activity" ? "selected" : ""}
                      onClick={() => setInspector("activity")}
                    >
                      النشاط
                    </button>
                  </div>
                  {inspector === "details" ? (
                    <div className="session-details">
                      <label htmlFor="session-title">اسم الجلسة</label>
                      <input
                        id="session-title"
                        aria-label="اسم الجلسة"
                        value={session.title}
                        maxLength={120}
                        onChange={(e) => setSession((s) => ({ ...s, title: e.target.value }))}
                      />
                      <dl>
                        <div>
                          <dt>معرّف الجلسة</dt>
                          <dd dir="ltr" className="mono">
                            {session.id.slice(0, 8)}
                          </dd>
                        </div>
                        <div>
                          <dt>الإنشاء</dt>
                          <dd>{date(session.created)}</dd>
                        </div>
                        <div>
                          <dt>المصدر</dt>
                          <dd>يوتيوب</dd>
                        </div>
                        <div>
                          <dt>نوع المحتوى</dt>
                          <dd>{session.mode === "video" ? "فيديو" : "بث مباشر"}</dd>
                        </div>
                        <div>
                          <dt>العربية</dt>
                          <dd>تفريغ كما هو</dd>
                        </div>
                        <div>
                          <dt>اللغات الأخرى</dt>
                          <dd>ترجمة إلى العربية</dd>
                        </div>
                        <div>
                          <dt>صيغة الصوت</dt>
                          <dd dir="ltr" className="mono">
                            WAV · 16 kHz
                          </dd>
                        </div>
                      </dl>
                      <div className="storage-disclosure">
                        <ShieldCheck size={15} />
                        <p>
                          تُحفظ الجلسات والنصوص وسجل العمليات في SQLite. لا تُحفظ تسجيلات الصوت أو
                          الفيديو.
                        </p>
                      </div>
                      <button className="plain-button" onClick={() => setInspector("activity")}>
                        <Activity size={14} /> عرض نشاط الجلسة
                      </button>
                    </div>
                  ) : (
                    <ActivityView
                      key={session.id}
                      workspaceKey={workspaceKey}
                      sessionId={session.id}
                      compact
                    />
                  )}
                </aside>
              </div>
            </>
          ) : nav === "history" ? (
            <section className="table-panel">
              <div className="table-toolbar">
                <label className="table-search">
                  <Search size={15} />
                  <input
                    aria-label="البحث في التفريغات السابقة"
                    placeholder="بحث بالعنوان أو الرابط أو النص"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(0);
                    }}
                    onBlur={() => log("search.changed", { scope: "history", query: historySearch })}
                  />
                </label>
                <button
                  className="plain-button"
                  onClick={() => void stored.refetch()}
                  disabled={stored.isFetching}
                >
                  <RefreshCw size={14} /> تحديث
                </button>
              </div>
              {stored.isLoading && (
                <div className="data-placeholder">
                  <LoaderCircle className="spin" size={16} /> تحميل جلسات SQLite…
                </div>
              )}
              {stored.isError && (
                <div className="error-banner" role="alert">
                  تعذّر تحميل الأرشيف. تظهر النسخة المحلية إن وُجدت.
                  <button onClick={() => void stored.refetch()}>إعادة المحاولة</button>
                </div>
              )}
              <div className="table-scroll">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>الجلسة</th>
                      <th>تاريخ الإنشاء</th>
                      <th>المدة</th>
                      <th>المقاطع</th>
                      <th>فتح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(historyPage * 15, (historyPage + 1) * 15).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <button className="session-open" onClick={() => openSession(s)}>
                            <FileText size={16} />
                            <span>
                              <b>{s.title}</b>
                              <small dir="ltr">{s.url || s.id.slice(0, 8)}</small>
                            </span>
                          </button>
                        </td>
                        <td>{date(s.created)}</td>
                        <td dir="ltr" className="mono">
                          {clock(s.seconds)}
                        </td>
                        <td>{s.segments.length}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`فتح ${s.title}`}
                            onClick={() => openSession(s)}
                          >
                            <ArrowUpLeft size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && !stored.isLoading && (
                <div className="data-placeholder">لا توجد جلسات مطابقة.</div>
              )}
              <div className="table-pagination">
                <span>
                  {filtered.length} جلسة · صفحة {historyPage + 1}
                </span>
                <div>
                  <button
                    className="plain-button"
                    disabled={historyPage === 0}
                    onClick={() => setHistoryPage(historyPage - 1)}
                  >
                    السابق
                  </button>
                  <button
                    className="plain-button"
                    disabled={(historyPage + 1) * 15 >= filtered.length}
                    onClick={() => setHistoryPage(historyPage + 1)}
                  >
                    التالي
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="table-panel">
              <div className="table-toolbar">
                <span className="muted">
                  عمليات الجلسات، تعديلات النص، الالتقاط، المعالجة والتصدير
                </span>
                <button
                  className="plain-button"
                  onClick={() => void exportActivity()}
                  disabled={exporting}
                >
                  {exporting ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <ArrowDownToLine size={14} />
                  )}{" "}
                  تصدير JSON
                </button>
              </div>
              <ActivityView workspaceKey={workspaceKey} />
            </section>
          )}
          <footer className="nass-footer">
            <span>الصوت يُرسل للمعالجة فقط</span>
            <span>
              SQLite · سجل عمليات دائم <span className="footer-red-mark" />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <output className="nass-toast">
          <Check size={15} />
          {toast}
          <button className="icon-button" aria-label="إغلاق الإشعار" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </output>
      )}
      {help && (
        <div className="nass-modal-overlay">
          <dialog open className="nass-help" aria-modal="true" aria-label="دليل المشاركة والخصوصية">
            <button
              className="help-close icon-button"
              aria-label="إغلاق الدليل"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <h2>مشاركة صوت التبويب</h2>
            <ol>
              <li>افتح فيديو يوتيوب أو البث في تبويب Chrome منفصل.</li>
              <li>افتح التطبيق خارج المعاينة، وافق على معالجة الصوت ثم اضغط «ابدأ التفريغ».</li>
              <li>اختر Chrome Tab، وحدّد تبويب يوتيوب ثم فعّل Share tab audio.</li>
              <li>
                اضغط «مشاركة» وشغّل الفيديو. يظهر النص في مقاطع، نحو ١٢ ثانية بالإضافة إلى وقت
                المعالجة.
              </li>
            </ol>
            <h3>التخزين والخصوصية</h3>
            <p>
              تُحفظ الجلسات والنصوص وتفاصيل العمليات وتعديلات النص في قاعدة SQLite على الخادم. مفتاح
              مساحة العمل محفوظ في هذا المتصفح؛ لا توجد قائمة عامة بالجلسات. فقدان المفتاح عند مسح
              بيانات المتصفح يمنع الوصول إلى السجل السابق. النسخة المحلية مخصّصة للاستعادة عند انقطاع
              الاتصال.
            </p>
            <p>
              لا يُحفظ الصوت أو الفيديو داخل التطبيق. الصوت يمر بخدمة الذكاء الاصطناعي، وفق سياسات مزوّد
              الخدمة، وقد يستهلك رصيد الاستخدام. الرابط وحده لا يلتقط الصوت. الميزة تحتاج Chrome على
              الكمبيوتر عبر HTTPS.
            </p>
            <p>
              راجع دقة النص والترجمة. توقيت SRT يعتمد على الالتقاط، وليس توقيت الكلمات الدقيق في
              الفيديو.
            </p>
            <button className="btn-secondary" onClick={() => setHelp(false)}>
              إغلاق
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
