"use client";
import { useState } from "react";
import { guOfLawd, SEOUL_GU, SEOUL_LAWD } from "@/lib/realestate";
import { eok } from "@/lib/format";
import { useStore } from "./store";
import { DealList, StatsTable, useRealPrice } from "./realestate";
import { geocode, type MapPoint } from "./KakaoMap";

/** 단지를 등록하지 않고 구 + 단지명으로 바로 실거래가 조회. 결과 위치는 onPoint 로 지도에 넘긴다. */
export function RealSearch({ onPoint }: { onPoint: (p: MapPoint | null) => void }) {
  const { s, create, setDrawer, toast } = useStore();
  const { state, err, data, load } = useRealPrice();
  const [gu, setGu] = useState("서초구");
  const [code, setCode] = useState("");
  const [apt, setApt] = useState("");
  const [dong, setDong] = useState("");
  const [months, setMonths] = useState(6);
  const [area, setArea] = useState<number | null>(null);
  const lawd = gu === "기타" ? code.trim() : SEOUL_LAWD[gu];

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!lawd || !apt.trim()) return;
    onPoint(null);
    setArea(null);
    const r = await load(lawd, apt.trim(), dong.trim() || undefined, months);
    const first = r?.trades[0] ?? r?.rents[0];
    if (!r || !first) return;
    const guName = guOfLawd(lawd) ?? "";
    const p = await geocode(`${guName ? "서울 " + guName : ""} ${first.dong} ${first.jibun}`.trim(), `${guName} ${first.dong} ${first.apt}`).catch(() => null);
    if (p) onPoint({ key: "search", kind: "search", label: first.apt, sub: "조회한 단지", ...p });
  }

  function addCandidate() {
    if (!data) return;
    const first = data.trades[0] ?? data.rents[0];
    const st = data.stats.find((x) => x.area === area) ?? data.stats.find((x) => x.trade.count) ?? data.stats[0];
    const id = create("homes", {
      name: first?.apt || apt,
      aptNm: first?.apt || apt,
      kind: s.house.mode === "buy" ? "매매" : "전세",
      gu: guOfLawd(data.lawd) ?? "",
      lawdCd: data.lawd,
      dong: first?.dong ?? dong,
      jibun: first?.jibun ?? "",
      area: st?.area ?? null,
      recent: st?.trade.latest?.price ?? null,
      jeonse: st?.jeonse.avg ?? null,
      status: "관심",
      scores: {},
      checks: {},
      memo: "",
    });
    toast(`${first?.apt || apt}을(를) 임장 후보에 추가했어요`);
    setDrawer({ col: "homes", id });
  }

  return (
    <div className="panel">
      <form className="filters" onSubmit={search} style={{ marginBottom: 8 }}>
        <select value={gu} onChange={(e) => setGu(e.target.value)} aria-label="구">
          {SEOUL_GU.map((g) => <option key={g}>{g}</option>)}
          <option value="기타">서울 밖 (코드 입력)</option>
        </select>
        {gu === "기타" && <input placeholder="법정동코드 5자리" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 130 }} inputMode="numeric" aria-label="법정동코드" />}
        <input placeholder="단지명 (예: 래미안퍼스티지)" value={apt} onChange={(e) => setApt(e.target.value)} aria-label="단지명" style={{ minWidth: 180, flex: 1 }} />
        <input placeholder="동 (선택)" value={dong} onChange={(e) => setDong(e.target.value)} aria-label="동" style={{ width: 100 }} />
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="기간">
          <option value={3}>3개월</option>
          <option value={6}>6개월</option>
          <option value={12}>12개월</option>
        </select>
        <button className="btn primary" disabled={!lawd || !apt.trim() || state === "loading"}>{state === "loading" ? "조회 중…" : "조회"}</button>
      </form>
      {state === "error" && <p className="no small">{err}</p>}
      {state === "done" && data && (
        <>
          <p className="muted small" style={{ margin: "4px 0 8px" }}>
            {data.matchedNames.length
              ? `찾은 단지: ${data.matchedNames.join(", ")} · ${data.months.at(-1)}~${data.months[0]}`
              : `‘${apt}’과 일치하는 거래가 없어요. 국토부 표기(띄어쓰기 없이, 예: 래미안퍼스티지)로 다시 찾아보세요.`}
          </p>
          <StatsTable stats={data.stats} highlight={area} />
          {(data.trades.length > 0 || data.rents.length > 0) && <DealList trades={data.trades} rents={data.rents} />}
          {data.stats.length > 0 && (
            <div className="filters" style={{ marginTop: 10 }}>
              <select value={area ?? ""} onChange={(e) => setArea(e.target.value ? Number(e.target.value) : null)} aria-label="후보로 담을 평형">
                <option value="">평형 선택</option>
                {data.stats.map((x) => (
                  <option key={x.area} value={x.area}>{x.area}㎡ {x.trade.latest ? `· 최근 ${eok(x.trade.latest.price)}` : ""}</option>
                ))}
              </select>
              <button className="btn" onClick={addCandidate}>임장 후보로 추가</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
