"use client";
import { useState } from "react";
import { closestArea, resolveLawd } from "@/lib/realestate";
import { eok } from "@/lib/format";
import type { Home } from "@/lib/types";
import { useStore } from "./store";
import { DealList, StatsTable, TrendBox, useRealPrice } from "./realestate";

/** 임장 후보 서랍 안의 국토부 실거래가 (최근 6·12개월, 전용면적별 + 월별 추이 + 거래 목록). */
export function RealPrice({ id, home }: { id: string; home: Omit<Home, "id"> }) {
  const { write, toast } = useStore();
  const { state, err, data, load } = useRealPrice();
  const [showList, setShowList] = useState(false);
  const [months, setMonths] = useState(12);
  const lawd = resolveLawd(home);
  const apt = (home.aptNm || home.name || "").trim();
  const mine = data ? closestArea(data.stats, home.area) : null;

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>국토부 실거래가</h3>
        <span style={{ display: "flex", gap: 6 }}>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="기간">
            <option value={6}>최근 6개월</option>
            <option value={12}>최근 12개월</option>
          </select>
          <button className="btn small" onClick={() => lawd && load(lawd, apt, home.dong || undefined, months)} disabled={!lawd || !apt || state === "loading"}>
            {state === "loading" ? "불러오는 중…" : state === "done" ? "다시 불러오기" : "불러오기"}
          </button>
        </span>
      </div>
      {!lawd && <p className="muted small">‘구’에 서울 구 이름을 적거나, 서울 밖이면 ‘법정동코드’ 5자리를 입력해 주세요.</p>}
      {state === "error" && <p className="no small">{err}</p>}
      {state === "done" && data && (
        <>
          <p className="muted small" style={{ margin: "6px 0" }}>
            {data.matchedNames.length ? `찾은 단지: ${data.matchedNames.join(", ")}` : `‘${apt}’과 일치하는 거래가 없어요. ‘실거래 단지명’에 국토부 표기(예: 래미안퍼스티지)를 적어 보세요.`}
          </p>
          <StatsTable stats={data.stats} highlight={mine?.area} />
          <TrendBox key={data.fetchedAt} data={data} initialArea={mine?.area} />
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
          {(data.trades.length > 0 || data.rents.length > 0) && (
            <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => setShowList((v) => !v)}>
              {showList ? "거래 목록 접기" : `거래 목록 보기 (매매 ${data.trades.length} · 전월세 ${data.rents.length})`}
            </button>
          )}
          {showList && <DealList trades={data.trades} rents={data.rents} />}
          <p className="why">해제된 거래는 뺐고, 전세는 월세 0원인 계약만 셌어요. 하루 한 번 새로 받아와요. KB시세는 공개 API가 없어 직접 입력해 주세요.</p>
        </>
      )}
    </div>
  );
}
