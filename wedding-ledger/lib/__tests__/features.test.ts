import { describe, expect, it } from "vitest";
import { homeCalc, homesVerdict, verdictText } from "../calc/housing";
import { eok } from "../format";
import { resolveSettings } from "../settings";
import { sampleLedger } from "./fixtures";
import { giftStats, guestStats, guestsWithoutGift, parseGuestLines } from "../calc/guests";
import { addDays, ddayLabel, payStats, taskBucket, taskDue } from "../calc/schedule";
import { buildIcs, gcalUrl } from "../calendar";
import type { Guest } from "../types";

describe("하객 집계", () => {
  const guests: Guest[] = [
    { id: "a", name: "이모네", side: "J", group: "친척", count: 3, rsvp: "참석", invite: true },
    { id: "b", name: "민수", side: "D", group: "친구", count: null },
    { id: "c", name: "팀장님", side: "D", group: "직장", count: 1, rsvp: "불참", invite: true },
  ];
  it("불참은 빼고, 인원이 비면 1명", () => {
    const s = guestStats(guests);
    expect(s.expected).toBe(4);
    expect(s.confirmed).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.declined).toBe(1);
    expect(s.invited).toBe(3);
    expect(s.bySide).toEqual({ J: 3, D: 1 });
  });
  it("붙여넣기 파싱", () => {
    const r = parseGuestLines("김철수\n박영희 2\n이민호, 3, 친구\n\n최가람\t2명", "J", "지인");
    expect(r.map((x) => [x.name, x.count, x.group])).toEqual([
      ["김철수", 1, "지인"],
      ["박영희", 2, "지인"],
      ["이민호", 3, "친구"],
      ["최가람", 2, "지인"],
    ]);
  });
  it("축의금 집계 + 장부에 없는 하객", () => {
    const s = giftStats([
      { id: "1", name: "a", side: "J", amount: 100000, thanks: true },
      { id: "2", name: "b", side: "D", amount: 50000 },
      { id: "3", name: "c", amount: null },
    ]);
    expect(s).toEqual({ total: 150000, count: 2, avg: 75000, bySide: { J: 100000, D: 50000 }, thanksLeft: 1 });
    expect(guestsWithoutGift(guests, [{ id: "1", name: "이모네", guestId: "a" }]).map((g) => g.id)).toEqual(["b"]);
  });
});

describe("일정", () => {
  it("D-day / 마감일", () => {
    expect(ddayLabel("2026-10-11", "2026-10-01")).toBe("D-10");
    expect(ddayLabel("2026-10-01", "2026-10-01")).toBe("D-DAY");
    expect(ddayLabel("2026-09-29", "2026-10-01")).toBe("D+2");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(taskDue({ dday: 30 }, "2027-05-01")).toBe("2027-04-01");
    expect(taskDue({ dday: 30, due: "2027-01-02" }, "2027-05-01")).toBe("2027-01-02");
    expect(taskDue({ dday: 30 }, "")).toBeNull();
  });
  it("체크리스트 구분", () => {
    const t = (x: object) => ({ id: "x", title: "t", ...x });
    expect(taskBucket(t({ due: "2026-09-30" }), "", "2026-10-01")).toBe("overdue");
    expect(taskBucket(t({ due: "2026-10-31" }), "", "2026-10-01")).toBe("soon");
    expect(taskBucket(t({ due: "2026-11-01" }), "", "2026-10-01")).toBe("later");
    expect(taskBucket(t({}), "", "2026-10-01")).toBe("nodate");
    expect(taskBucket(t({ due: "2026-09-30", done: true }), "", "2026-10-01")).toBe("done");
  });
  it("지불 집계", () => {
    const s = payStats(
      [
        { id: "1", title: "홀 계약금", amount: 1000000, due: "2026-09-01", paid: true },
        { id: "2", title: "스드메 중도금", amount: 2000000, due: "2026-09-20" },
        { id: "3", title: "홀 잔금", amount: 5000000, due: "2026-10-20" },
        { id: "4", title: "스냅", amount: 700000, due: "2026-12-20" },
      ],
      "2026-10-01",
    );
    expect(s).toMatchObject({ total: 8700000, paid: 1000000, left: 7700000, overdue: 2000000, next30: 5000000 });
    expect(s.nextDue?.id).toBe("3");
  });
});

describe("캘린더", () => {
  it("ICS: 종일 일정, 이스케이프, CRLF", () => {
    const ics = buildIcs([{ uid: "p-1", title: "홀 잔금, 500만", date: "2026-12-31", details: "줄1\n줄2" }], new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:홀 잔금\\, 500만");
    expect(ics).toContain("DESCRIPTION:줄1\\n줄2");
    expect(ics).toContain("DTSTAMP:20261001T000000Z");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it("긴 제목은 75바이트로 접는다", () => {
    const ics = buildIcs([{ uid: "x", title: "가".repeat(60), date: "2026-01-01" }]);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:" + "가".repeat(60));
  });
  it("구글 캘린더 링크", () => {
    const u = new URL(gcalUrl({ title: "웨딩홀 잔금", date: "2026-12-31" }));
    expect(u.searchParams.get("dates")).toBe("20261231/20270101");
    expect(u.searchParams.get("text")).toBe("웨딩홀 잔금");
  });
});

describe("임장 후보 자동 판정 요약", () => {
  it("homeCalc 결과로 가능/부족/가격 없음을 세고, 제외는 뺀다", () => {
    const L = sampleLedger();
    const s = resolveSettings(L.settings);
    L.homes = {
      a: { name: "싼 전세", kind: "전세", jeonse: 1e7 },
      b: { name: "비싼 매매", kind: "매매", price: 300e8 },
      c: { name: "가격 없음", kind: "매매" },
      d: { name: "제외", kind: "전세", jeonse: 1e7, status: "제외" },
    };
    const v = homesVerdict(L, s);
    expect(v.rows.map((r) => [r.id, r.verdict])).toEqual([["a", "ok"], ["b", "short"], ["c", "none"]]);
    expect([v.ok, v.short, v.none]).toEqual([1, 1, 1]);
    const a = v.rows[0];
    expect(a.gap).toBe(homeCalc(L.homes.a, L, s)!.gap);
    expect(verdictText(v.rows[2], eok)).toBe("가격 입력 필요");
    expect(verdictText(v.rows[1], eok)).toMatch(/^부족 /);
  });
});
