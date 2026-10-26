import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, RefreshCw, LoaderCircle } from "lucide-react";
import { useStoredActivity } from "../queries/workspace";

const labels: Record<string, string> = {
  "app.opened": "فتح التطبيق",
  "navigation.changed": "تغيير القسم",
  "session.created": "إنشاء جلسة",
  "session.saved": "حفظ جلسة",
  "session.updated": "تحديث الجلسة والنص",
  "session.opened": "فتح جلسة",
  "source.opened": "فتح المصدر",
  "consent.changed": "تغيير الموافقة",
  "capture.requested": "طلب التقاط الصوت",
  "capture.started": "بدء الالتقاط",
  "capture.stopped": "إيقاف الالتقاط",
  "capture.error": "خطأ في الالتقاط",
  "audio.warning": "تنبيه الصوت",
  "chunk.submitted": "إرسال مقطع",
  "chunk.completed": "اكتمال التفريغ",
  "chunk.error": "فشل التفريغ",
  "chunk.retry": "إعادة معالجة المقاطع",
  "chunk.discarded": "تجاهل المقاطع",
  "transcript.copied": "نسخ النص",
  "transcript.exported": "تصدير النص",
  "search.changed": "بحث",
  "preference.changed": "تغيير الإعداد",
  "activity.exported": "تصدير سجل النشاط",
};
function time(value: number) {
  return new Intl.DateTimeFormat("ar", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}
export default function ActivityView({
  workspaceKey,
  sessionId,
  compact = false,
}: {
  workspaceKey: string;
  sessionId?: string;
  compact?: boolean;
}) {
  const [cursors, setCursors] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const query = useStoredActivity(workspaceKey, sessionId, cursors.at(-1));
  const rows = compact ? query.data?.rows.slice(0, 7) : query.data?.rows;
  if (query.isLoading)
    return (
      <div className="data-placeholder">
        <LoaderCircle className="spin" size={16} /> تحميل السجل…
      </div>
    );
  if (query.isError)
    return (
      <div className="data-placeholder error-text">
        تعذّر تحميل سجل SQLite.{" "}
        <button className="plain-button" onClick={() => void query.refetch()}>
          <RefreshCw size={14} /> إعادة المحاولة
        </button>
      </div>
    );
  return (
    <div className={compact ? "activity-list compact" : "activity-list"}>
      {!rows?.length ? (
        <div className="data-placeholder">
          لا توجد أحداث محفوظة{sessionId ? " لهذه الجلسة" : ""}.
        </div>
      ) : (
        rows.map((row) => (
          <div
            className={`activity-row ${row.action.endsWith("error") ? "failed" : ""}`}
            key={row.id}
          >
            <button
              className="activity-summary"
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              aria-expanded={expanded === row.id}
            >
              <span className="event-dot" />
              <span className="event-label">
                {labels[row.action] ?? row.action}
                <small dir="ltr">{row.action}</small>
              </span>
              {!compact && (
                <span className="event-session" dir="ltr">
                  {row.sessionId?.slice(0, 8) ?? "—"}
                </span>
              )}
              <time>{time(row.occurred)}</time>
              <ChevronDown size={13} />
            </button>
            {expanded === row.id && (
              <div className="event-details">
                <dl>
                  <div>
                    <dt>رقم الحدث</dt>
                    <dd dir="ltr">{row.eventId}</dd>
                  </div>
                  <div>
                    <dt>استلام الخادم</dt>
                    <dd>{time(row.received)}</dd>
                  </div>
                </dl>
                <pre dir="ltr">{JSON.stringify(row.details, null, 2)}</pre>
              </div>
            )}
          </div>
        ))
      )}
      {!compact && (
        <div className="table-pagination">
          <span>
            صفحة {cursors.length + 1} · {rows?.length ?? 0} حدث
          </span>
          <div>
            <button
              className="plain-button"
              disabled={!cursors.length || query.isFetching}
              onClick={() => setCursors(cursors.slice(0, -1))}
            >
              <ChevronRight size={15} /> الأحدث
            </button>
            <button
              className="plain-button"
              disabled={!query.data?.next || query.isFetching}
              onClick={() => query.data?.next && setCursors([...cursors, query.data.next])}
            >
              الأقدم <ChevronLeft size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="تحديث سجل النشاط"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
