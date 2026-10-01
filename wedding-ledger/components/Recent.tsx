"use client";
// 요약 탭: 최근 변경 (누가·언제·무엇을)
import { useStore, type Drawer } from "./store";
import { relTime, whoLabel } from "./shared";
import { nameOf } from "./TrashPanel";

const COL: Record<string, { label: string; tab: string }> = {
  planners: { label: "플래너", tab: "planner" },
  vendors: { label: "업체", tab: "studio" },
  quotes: { label: "견적", tab: "planner" },
  extras: { label: "추가비용", tab: "planner" },
  halls: { label: "웨딩홀", tab: "hall" },
  dresses: { label: "드레스 보드", tab: "board" },
  budget: { label: "예산", tab: "budget" },
  homes: { label: "임장 후보", tab: "house" },
  priceLists: { label: "드레스 가격표", tab: "dprice" },
  guests: { label: "하객", tab: "guests" },
  gifts: { label: "축의금", tab: "guests" },
  payments: { label: "지불 일정", tab: "schedule" },
  tasks: { label: "준비 체크리스트", tab: "schedule" },
  settings: { label: "설정", tab: "summary" },
};

const DRAWER_COLS = new Set(["planners", "vendors", "halls", "homes"]);

export function Recent({ go, limit = 8 }: { go: (tab: string) => void; limit?: number }) {
  const { meta, me, ledger, setDrawer } = useStore();
  const rows = Object.entries(meta)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, limit)
    .map(([k, m]) => {
      const i = k.indexOf("/");
      const col = k.slice(0, i);
      const id = k.slice(i + 1);
      const doc = col === "settings" ? null : ((ledger as unknown as Record<string, Record<string, Record<string, unknown>>>)[col]?.[id] ?? null);
      return { k, col, id, m, doc };
    })
    .filter((r) => r.col === "settings" || r.doc);
  if (!rows.length) return null;
  return (
    <section className="section">
      <h2>최근 변경</h2>
      <ul className="recent" style={{ marginTop: 8 }}>
        {rows.map((r) => {
          const c = COL[r.col] ?? { label: r.col, tab: "summary" };
          const open = () => (DRAWER_COLS.has(r.col) ? setDrawer({ col: r.col, id: r.id } as Drawer) : go(r.col === "vendors" ? String(r.doc?.cat ?? "studio") : c.tab));
          return (
            <li key={r.k}>
              <button onClick={open}>
                <span className="muted small">{c.label}</span> {r.doc ? nameOf(r.doc) : "결혼식·자금 설정"}
              </button>
              <span className="muted small" style={{ whiteSpace: "nowrap" }}>
                {[whoLabel(r.m.by, me), relTime(r.m.at)].filter(Boolean).join(" · ")}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
