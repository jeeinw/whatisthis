// 하객 명단 · 축의금 장부 집계 (순수 함수)
import { isNum } from "../format";
import type { Gift, Guest, Side } from "../types";

export const SIDES: Side[] = ["J", "D", "공동"];
export const GUEST_GROUPS = ["가족", "친척", "친구", "직장", "지인", "부모님 지인", "기타"];
export const RSVP = ["미정", "참석", "불참"] as const;

const n = (v: unknown) => (isNum(v) && v > 0 ? v : 1);

export interface GuestStats {
  /** 불참을 뺀 예상 인원 (웨딩홀 하객 수에 쓰는 값) */
  expected: number;
  confirmed: number;
  pending: number;
  declined: number;
  invited: number;
  rows: number;
  bySide: Record<string, number>;
  byGroup: Record<string, number>;
}

export function guestStats(guests: Guest[]): GuestStats {
  const st: GuestStats = { expected: 0, confirmed: 0, pending: 0, declined: 0, invited: 0, rows: guests.length, bySide: {}, byGroup: {} };
  for (const g of guests) {
    const c = n(g.count);
    const r = g.rsvp || "미정";
    if (r === "불참") {
      st.declined += c;
      continue;
    }
    st.expected += c;
    if (r === "참석") st.confirmed += c;
    else st.pending += c;
    if (g.invite) st.invited += c;
    const side = g.side || "공동";
    st.bySide[side] = (st.bySide[side] ?? 0) + c;
    const grp = g.group || "기타";
    st.byGroup[grp] = (st.byGroup[grp] ?? 0) + c;
  }
  return st;
}

/** 여러 줄 붙여넣기 → 하객 행. "이름", "이름 2", "이름, 2, 친구" 형식을 받는다. */
export function parseGuestLines(text: string, side: Side, group: string): Omit<Guest, "id">[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,\t]/).map((x) => x.trim()).filter(Boolean);
      let name = parts[0] ?? "";
      let count = 1;
      const m = name.match(/^(.*?)\s+(\d+)\s*(명)?$/);
      if (m) {
        name = m[1];
        count = Number(m[2]);
      }
      const num = parts.slice(1).find((x) => /^\d+\s*명?$/.test(x));
      if (num) count = parseInt(num, 10);
      const grp = parts.slice(1).find((x) => !/^\d+\s*명?$/.test(x));
      return { name, side, group: grp || group, count: count > 0 ? count : 1, invite: false, rsvp: "미정" as const, memo: "" };
    })
    .filter((g) => g.name);
}

export interface GiftStats {
  total: number;
  count: number;
  avg: number | null;
  bySide: Record<string, number>;
  thanksLeft: number;
}

export function giftStats(gifts: Gift[]): GiftStats {
  const st: GiftStats = { total: 0, count: 0, avg: null, bySide: {}, thanksLeft: 0 };
  for (const g of gifts) {
    if (!isNum(g.amount) || g.amount <= 0) continue;
    st.total += g.amount;
    st.count++;
    const side = g.side || "공동";
    st.bySide[side] = (st.bySide[side] ?? 0) + g.amount;
    if (!g.thanks) st.thanksLeft++;
  }
  st.avg = st.count ? Math.round(st.total / st.count) : null;
  return st;
}

/** 아직 축의금 장부에 없는 하객 (guestId 기준) */
export function guestsWithoutGift(guests: Guest[], gifts: Gift[]): Guest[] {
  const linked = new Set(gifts.map((g) => g.guestId).filter(Boolean));
  return guests.filter((g) => g.rsvp !== "불참" && !linked.has(g.id));
}
