// 지불 일정 · D-day 체크리스트 (순수 함수). 날짜는 'YYYY-MM-DD' 문자열, 계산은 현지 날짜 기준.
import { isNum } from "../format";
import type { Payment, Task } from "../types";

export const PAY_STAGES = ["계약금", "중도금", "잔금", "기타"] as const;

const DAY = 864e5;
const parse = (d: string) => new Date(d + "T00:00:00");
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayYmd = (now = new Date()) => ymd(now);

/** a → b 까지 남은 날 (b가 미래면 양수) */
export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
}

export function addDays(d: string, n: number) {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return ymd(x);
}

/** 'D-12' / 'D-DAY' / 'D+3' */
export function ddayLabel(target: string, today: string) {
  const d = daysBetween(today, target);
  return d > 0 ? `D-${d}` : d === 0 ? "D-DAY" : `D+${-d}`;
}

/** 체크리스트 항목의 마감일: due가 있으면 그 날, 없으면 결혼식 날짜 − dday */
export function taskDue(t: Pick<Task, "due" | "dday">, weddingDate: string): string | null {
  if (t.due) return t.due;
  if (isNum(t.dday) && weddingDate) return addDays(weddingDate, -t.dday);
  return null;
}

export type TaskBucket = "overdue" | "soon" | "later" | "nodate" | "done";

/** 지난 마감 / 30일 안 / 그 뒤 / 날짜 없음 / 완료 */
export function taskBucket(t: Task, weddingDate: string, today: string): TaskBucket {
  if (t.done) return "done";
  const due = taskDue(t, weddingDate);
  if (!due) return "nodate";
  const d = daysBetween(today, due);
  return d < 0 ? "overdue" : d <= 30 ? "soon" : "later";
}

export interface PayStats {
  total: number;
  paid: number;
  left: number;
  overdue: number;
  next30: number;
  nextDue: Payment | null;
}

export function payStats(payments: Payment[], today: string): PayStats {
  const st: PayStats = { total: 0, paid: 0, left: 0, overdue: 0, next30: 0, nextDue: null };
  for (const p of payments) {
    const a = isNum(p.amount) ? p.amount : 0;
    st.total += a;
    if (p.paid) {
      st.paid += a;
      continue;
    }
    st.left += a;
    if (!p.due) continue;
    const d = daysBetween(today, p.due);
    if (d < 0) st.overdue += a;
    else if (d <= 30) st.next30 += a;
    if (d >= 0 && (!st.nextDue || p.due < (st.nextDue.due as string))) st.nextDue = p;
  }
  return st;
}

/** 날짜순 (날짜 없는 것은 뒤로) */
export const byDue = <T extends { due?: string }>(a: T, b: T) => (a.due || "9999").localeCompare(b.due || "9999");

/** 기본 준비 체크리스트 — 결혼식 n일 전 기준. 일반적인 준비 순서를 참고한 안내용이라 상황에 맞게 고쳐 쓰면 된다. */
export const DEFAULT_TASKS: ReadonlyArray<{ title: string; cat: string; dday: number }> = [
  { title: "양가 상견례", cat: "가족", dday: 300 },
  { title: "예산·하객 규모 정하기", cat: "준비", dday: 300 },
  { title: "웨딩홀 투어·계약", cat: "웨딩홀", dday: 270 },
  { title: "플래너 정하기 (스드메 계약)", cat: "스드메", dday: 240 },
  { title: "신혼여행지 정하고 항공·숙소 예약", cat: "신혼여행", dday: 180 },
  { title: "본식 스냅·영상 업체 예약", cat: "스드메", dday: 180 },
  { title: "신혼집 알아보기 시작", cat: "신혼집", dday: 180 },
  { title: "드레스 투어", cat: "스드메", dday: 150 },
  { title: "예물·예복 준비", cat: "예물·예복", dday: 120 },
  { title: "웨딩 촬영 (리허설)", cat: "스드메", dday: 100 },
  { title: "청첩장 주문", cat: "하객", dday: 90 },
  { title: "하객 명단 정리", cat: "하객", dday: 75 },
  { title: "청첩장 발송·모바일 청첩장", cat: "하객", dday: 60 },
  { title: "혼수·가전 구매", cat: "신혼집", dday: 60 },
  { title: "본식 드레스 가봉", cat: "스드메", dday: 30 },
  { title: "사회자·축가·식순 확정", cat: "예식", dday: 30 },
  { title: "웨딩홀 최종 인원·식사 확정", cat: "웨딩홀", dday: 14 },
  { title: "잔금 일정 확인", cat: "지불", dday: 14 },
  { title: "답례품·포토테이블 준비", cat: "예식", dday: 10 },
  { title: "당일 준비물·동선 최종 점검", cat: "예식", dday: 3 },
  { title: "축의금 정리·감사 인사", cat: "하객", dday: -7 },
];
