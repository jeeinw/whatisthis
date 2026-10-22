// 캘린더 내보내기: .ics 파일 (구글·애플 캘린더 가져오기) + 구글 캘린더 '일정 추가' 링크
export interface CalEvent {
  uid: string;
  title: string;
  /** 'YYYY-MM-DD' 종일 일정 */
  date: string;
  details?: string;
}

const compact = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => {
  const x = new Date(d + "T00:00:00");
  x.setDate(x.getDate() + 1);
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
};

/** RFC 5545 TEXT 이스케이프 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 75바이트(UTF-8) 넘는 줄 접기 */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(events: CalEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JD Wedding Ledger//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:결혼 준비"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@jd-wedding-ledger`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.details ? [`DESCRIPTION:${esc(e.details)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** 구글 캘린더 '일정 만들기' 화면 링크 (종일 일정) */
export function gcalUrl(e: Omit<CalEvent, "uid">): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${compact(e.date)}/${nextDay(e.date)}` });
  if (e.details) q.set("details", e.details);
  return `https://calendar.google.com/calendar/render?${q}`;
}
