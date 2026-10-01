"use client";
import { useState } from "react";
import { closestArea, resolveLawd, type AreaStat, type Rent, type Trade } from "@/lib/realestate";
import { eok } from "@/lib/format";
import type { Home } from "@/lib/types";
import { useStore } from "./store";

interface Result {
  matchedNames: string[];
  months: string[];
  stats: AreaStat[];
  trades: Trade[];
  rents: Rent[];
  fetchedAt: string;
}

/** 임장 후보 서랍 안의 국토부 실거래가 (최근 6개월, 전용면적별). */
export function RealPrice({ id, home }: { id: string; home: Omit<Home, "id"> & { aptNm?: string; lawdCd?: string } }) {
  const { write, toast } = useStore();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const lawd = resolveLawd(home);
  const apt = (home.aptNm || home.name || "").trim();

  async function load() {
    if (!lawd) return;
    setState("loading");
    const q = new URLSearchParams({ lawd, apt, months: "6" });
    if (home.dong) q.set("dong", home.dong);
    try {
      const res = await fetch(`/api/realestate?${q}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error === "no_key" ? "공공데이터 키가 아직 설정되지 않았어요" : j.message || j.error);
      setData(j);
      setState("done");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }

  const mine = data ? closestArea(data.stats, home.area) : null;

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>국토부 실거래가 (최근 6개월)</h3>
        <button className="btn small" onClick={load} disabled={!lawd || !apt || state === "loading"}>
          {state === "loading" ? "불러오는 중…" : state === "done" ? "다시 불러오기" : "불러오기"}
        </button>
      </div>
      {!lawd && <p className="muted small">‘구’에 서울 구 이름을 적거나, 서울 밖이면 ‘법정동코드’ 5자리를 입력해 주세요.</p>}
      {state === "error" && <p className="no small">{err}</p>}
      {state === "done" && data && (
        <>
          <p className="muted small" style={{ margin: "6px 0" }}>
            {data.matchedNames.length ? `찾은 단지: ${data.matchedNames.join(", ")}` : `‘${apt}’과 일치하는 거래가 없어요. ‘실거래 단지명’에 국토부 표기(예: 래미안퍼스티지)를 적어 보세요.`}
          </p>
          {data.stats.length > 0 && (
            <div className="tablebox">
              <table className="sheet">
                <thead>
                  <tr><th>전용</th><th>매매 최근</th><th>매매 평균</th><th>건수</th><th>전세 최근</th><th>전세 평균</th><th>월세</th></tr>
                </thead>
                <tbody>
                  {data.stats.map((s) => (
                    <tr key={s.area} style={mine?.area === s.area ? { fontWeight: 600 } : undefined}>
                      <td>{s.area}㎡</td>
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
          )}
          {mine && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {mine.trade.latest && (
                <button className="btn small" onClick={() => { write("homes", id, { recent: mine.trade.latest!.price }); toast(`최근 실거래가 ${eok(mine.trade.latest!.price)} 반영`); }}>
                  {mine.area}㎡ 최근 매매가를 ‘최근 실거래가’에 반영
                </button>
              )}
              {mine.jeonse.avg != null && (
                <button className="btn small ghost" onClick={() => { write("homes", id, { jeonse: mine.jeonse.avg }); toast(`전세가 ${eok(mine.jeonse.avg)} 반영`); }}>
                  {mine.area}㎡ 전세 평균을 ‘전세가’에 반영
                </button>
              )}
            </div>
          )}
          <p className="why">해제된 거래는 뺐고, 전세는 월세 0원인 계약만 셌어요. 하루 한 번 새로 받아와요. KB시세는 공개 API가 없어 직접 입력해 주세요.</p>
        </>
      )}
    </div>
  );
}
