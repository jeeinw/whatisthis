"use client";
// 실거래가 공용 UI: 조회 훅, 전용면적별 요약표, 거래 목록.
import { useCallback, useState } from "react";
import { seriesChange, type AreaStat, type MonthPoint, type Rent, type Trade } from "@/lib/realestate";
import { eok } from "@/lib/format";

export interface RealResult {
  lawd: string;
  apt: string;
  matchedNames: string[];
  months: string[];
  stats: AreaStat[];
  /** 전용면적(정수 ㎡) → 월별 점 (오래된 달부터) */
  series?: Record<string, MonthPoint[]>;
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

/* ---------- 월별 추이 그래프 ---------- */

const W = 640, H = 220, L = 54, R = 12, T = 14, B = 30;

/** 매매 평균(선 + 최저~최고 막대)과 전세 평균(점선)을 같은 축에. 점 크기는 거래 건수. */
export function TrendChart({ points, area }: { points: MonthPoint[]; area: number }) {
  const vals = points.flatMap((p) => [p.trade.min, p.trade.max, p.jeonse.avg]).filter((v): v is number => v != null);
  if (!vals.length) return <p className="muted small">이 면적은 기간 안에 매매·전세 거래가 없어요.</p>;
  // 눈금은 1·2·2.5·5 × 10^k 단위로 딱 떨어지게
  const rawLo = Math.min(...vals), rawHi = Math.max(...vals);
  const span = Math.max(rawHi - rawLo, rawHi * 0.1);
  const mag = 10 ** Math.floor(Math.log10(span / 3));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= 4) ?? 10 * mag;
  const lo = Math.max(0, Math.floor(rawLo / step) * step);
  const hi = Math.ceil(rawHi / step) * step + (rawHi % step === 0 ? step * 0.25 : 0);
  const n = points.length;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (get: (p: MonthPoint) => number | null) =>
    points
      .map((p, i) => [i, get(p)] as const)
      .filter(([, v]) => v != null)
      .map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v as number).toFixed(1)}`)
      .join(" ");
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1; v += step) ticks.push(v);
  const label = (v: number) => (v === 0 ? "0" : v >= 1e8 ? `${+(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e4).toLocaleString()}만`);
  const tc = seriesChange(points, "trade");
  const jc = seriesChange(points, "jeonse");
  const fmt = (c: number | null) => (c == null ? "—" : `${c > 0 ? "+" : ""}${c}%`);

  return (
    <figure style={{ margin: "10px 0 0", maxWidth: 760 }}>
      <figcaption className="small" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <b>{area}㎡ 월별 추이</b>
        <span><i className="lg lg-trade" /> 매매 평균 <span className={tc != null && tc > 0 ? "no" : "muted"}>{fmt(tc)}</span></span>
        <span><i className="lg lg-jeonse" /> 전세 평균 <span className="muted">{fmt(jc)}</span></span>
        <span className="muted">세로 막대 = 그 달 최저~최고</span>
      </figcaption>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${area}㎡ 월별 매매·전세 평균`}>
        {ticks.map((v, k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={k ? "2 4" : undefined} />
            <text x={L - 6} y={y(v) + 4} fontSize="11" fill="var(--muted)" textAnchor="end">{label(v)}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.ym} x={x(i)} y={H - 10} fontSize="11" fill="var(--muted)" textAnchor="middle">
            {i === 0 || p.ym.endsWith("01") ? `${p.ym.slice(2, 4)}.${p.ym.slice(4)}` : String(Number(p.ym.slice(4)))}
          </text>
        ))}
        {points.map((p, i) =>
          p.trade.min != null && p.trade.max != null && p.trade.max > p.trade.min ? (
            <line key={"r" + p.ym} x1={x(i)} x2={x(i)} y1={y(p.trade.min)} y2={y(p.trade.max)} stroke="var(--ribbon)" strokeOpacity=".3" strokeWidth="6" strokeLinecap="round" />
          ) : null,
        )}
        <path d={path((p) => p.jeonse.avg)} fill="none" stroke="var(--sage)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={path((p) => p.trade.avg)} fill="none" stroke="var(--ribbon)" strokeWidth="2.2" />
        {points.map((p, i) =>
          p.jeonse.avg != null ? (
            <circle key={"j" + p.ym} cx={x(i)} cy={y(p.jeonse.avg)} r={2.5 + Math.min(4, p.jeonse.count)} fill="var(--surface)" stroke="var(--sage)" strokeWidth="2">
              <title>{`${p.ym.slice(0, 4)}.${p.ym.slice(4)} 전세 평균 ${eok(p.jeonse.avg)} (${p.jeonse.count}건)`}</title>
            </circle>
          ) : null,
        )}
        {points.map((p, i) =>
          p.trade.avg != null ? (
            <circle key={"t" + p.ym} cx={x(i)} cy={y(p.trade.avg)} r={2.5 + Math.min(4, p.trade.count)} fill="var(--ribbon)">
              <title>{`${p.ym.slice(0, 4)}.${p.ym.slice(4)} 매매 평균 ${eok(p.trade.avg)} (${p.trade.count}건, ${eok(p.trade.min)}~${eok(p.trade.max)})`}</title>
            </circle>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/** 면적을 골라 보는 추이 그래프 (데이터가 있는 면적만) */
export function TrendBox({ data, initialArea }: { data: RealResult; initialArea?: number | null }) {
  const series = data.series ?? {};
  const areas = Object.keys(series).map(Number).sort((a, b) => a - b);
  // 그래프는 매매·전세가 있는 면적만 (월세만 있는 면적은 series에 없다) — 기본은 거래가 가장 많은 면적
  const deals = (a: number) => series[String(a)].reduce((n, p) => n + p.trade.count + p.jeonse.count, 0);
  const most = areas.reduce<number | null>((best, a) => (best == null || deals(a) > deals(best) ? a : best), null);
  const [pick, setPick] = useState<number | null>(null);
  const area = pick ?? (initialArea != null && areas.includes(initialArea) ? initialArea : most);
  if (area == null || !series[String(area)]) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {areas.length > 1 && (
        <select value={area} onChange={(e) => setPick(Number(e.target.value))} aria-label="추이 볼 전용면적">
          {areas.map((a) => <option key={a} value={a}>{a}㎡ ({Math.round(a / 3.3058)}평)</option>)}
        </select>
      )}
      <TrendChart points={series[String(area)]} area={area} />
    </div>
  );
}
