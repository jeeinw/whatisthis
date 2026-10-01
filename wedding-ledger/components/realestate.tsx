"use client";
// 실거래가 공용 UI: 조회 훅, 전용면적별 요약표, 거래 목록.
import { useCallback, useState } from "react";
import type { AreaStat, Rent, Trade } from "@/lib/realestate";
import { eok } from "@/lib/format";

export interface RealResult {
  lawd: string;
  apt: string;
  matchedNames: string[];
  months: string[];
  stats: AreaStat[];
  trades: Trade[];
  rents: Rent[];
  fetchedAt: string;
}

export function useRealPrice() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [data, setData] = useState<RealResult | null>(null);
  const load = useCallback(async (lawd: string, apt: string, dong?: string, months = 6) => {
    setState("loading");
    const q = new URLSearchParams({ lawd, apt, months: String(months) });
    if (dong) q.set("dong", dong);
    try {
      const res = await fetch(`/api/realestate?${q}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error === "no_key" ? "공공데이터 키가 아직 설정되지 않았어요" : j.message || j.error);
      setData(j);
      setState("done");
      return j as RealResult;
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
      return null;
    }
  }, []);
  return { state, err, data, load };
}

export function StatsTable({ stats, highlight }: { stats: AreaStat[]; highlight?: number | null }) {
  if (!stats.length) return null;
  return (
    <div className="tablebox">
      <table className="sheet">
        <thead>
          <tr><th>전용</th><th>매매 최근</th><th>매매 평균</th><th>건수</th><th>전세 최근</th><th>전세 평균</th><th>월세</th></tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.area} style={highlight === s.area ? { fontWeight: 600 } : undefined}>
              <td>{s.area}㎡ <span className="unit">{Math.round(s.area / 3.3058)}평</span></td>
              <td className="num">{s.trade.latest ? <>{eok(s.trade.latest.price)}<br /><span className="unit">{s.trade.latest.date} · {s.trade.latest.floor ?? "-"}층</span></> : "—"}</td>
              <td className="num">{s.trade.avg != null ? eok(s.trade.avg) : "—"}</td>
              <td className="num">{s.trade.count}</td>
              <td className="num">{s.jeonse.latest ? <>{eok(s.jeonse.latest.deposit)}<br /><span className="unit">{s.jeonse.latest.date}</span></> : "—"}</td>
              <td className="num">{s.jeonse.avg != null ? eok(s.jeonse.avg) : "—"}</td>
              <td className="num">{s.wolseCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DealTab = "trade" | "jeonse" | "wolse";

/** 개별 거래 목록 (최신순). 전용면적으로 거를 수 있다. */
export function DealList({ trades, rents }: { trades: Trade[]; rents: Rent[] }) {
  const [tab, setTab] = useState<DealTab>("trade");
  const [area, setArea] = useState<string>("");
  const areas = [...new Set([...trades, ...rents].map((x) => Math.round(x.area)))].sort((a, b) => a - b);
  const inArea = <T extends { area: number }>(x: T) => !area || Math.round(x.area) === Number(area);
  const jeonse = rents.filter((r) => r.monthly === 0);
  const wolse = rents.filter((r) => r.monthly > 0);
  const counts = { trade: trades.length, jeonse: jeonse.length, wolse: wolse.length };
  // 단지가 하나뿐이면 단지 열은 빼서 좁은 화면에서 금액이 보이게
  const multi = new Set([...trades, ...rents].map((x) => x.apt)).size > 1;

  return (
    <div style={{ marginTop: 10 }}>
      <div className="filters" style={{ marginBottom: 6 }}>
        <div className="seg" role="group" aria-label="거래 종류" style={{ margin: 0 }}>
          {(["trade", "jeonse", "wolse"] as DealTab[]).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "trade" ? "매매" : t === "jeonse" ? "전세" : "월세"} {counts[t]}
            </button>
          ))}
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="전용면적">
          <option value="">모든 면적</option>
          {areas.map((a) => <option key={a} value={a}>{a}㎡ ({Math.round(a / 3.3058)}평)</option>)}
        </select>
      </div>
      <div className="tablebox" style={{ maxHeight: 360, overflow: "auto" }}>
        <table className="sheet">
          <thead>
            <tr><th>계약일</th>{multi && <th>단지</th>}<th>전용</th><th>층</th><th>{tab === "trade" ? "거래가" : tab === "jeonse" ? "보증금" : "보증금 / 월세"}</th>{tab !== "trade" && <th>구분</th>}</tr>
          </thead>
          <tbody>
            {tab === "trade"
              ? trades.filter(inArea).map((t, i) => (
                  <tr key={i}>
                    <td>{t.date}</td>{multi && <td className="small">{t.apt}</td>}<td className="num">{Math.round(t.area)}㎡</td><td className="num">{t.floor ?? "-"}</td>
                    <td className="num"><b>{eok(t.price)}</b></td>
                  </tr>
                ))
              : (tab === "jeonse" ? jeonse : wolse).filter(inArea).map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>{multi && <td className="small">{r.apt}</td>}<td className="num">{Math.round(r.area)}㎡</td><td className="num">{r.floor ?? "-"}</td>
                    <td className="num"><b>{eok(r.deposit)}</b>{r.monthly > 0 && <> / {Math.round(r.monthly / 10000)}만</>}</td>
                    <td className="small muted">{r.contractType || "—"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="unit" style={{ marginTop: 4 }}>최근 거래부터 최대 100건 · 해제된 매매는 제외</p>
    </div>
  );
}
