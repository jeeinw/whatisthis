"use client";
import { useEffect, useState } from "react";
import { CAT_LABEL, CHECKS, H_STATUS, HALL_TYPES, HOME_STATUS, SCORE, V_STATUS, ZONES } from "@/lib/constants";
import { dressPriceIndex } from "@/lib/calc/dress";
import { isNum, won } from "@/lib/format";
import type { ScoreKind } from "@/lib/types";
import { useStore } from "./store";
import { blogLink, Edited, Photo, stripParen, TextCell, useDraft, usePickPhoto, useUploadPhoto } from "./shared";
import { RealPrice } from "./RealPrice";
import type { Home } from "@/lib/types";

type FieldType = "text" | "select" | "area" | "wide" | "num" | "date";
type Field = [key: string, label: string, type?: FieldType, opts?: string[]];

// legacy FIELDS 그대로
const FIELDS: Record<"planners" | "vendors" | "halls" | "homes", Field[]> = {
  planners: [["name", "플래너 이름"], ["kind", "유형", "select", ["동행 플래너", "비동행 플래너", "온라인·앱", "기타"]], ["manager", "담당자"], ["phone", "연락처"], ["address", "주소", "wide"], ["features", "특징", "area"], ["benefits", "혜택", "area"], ["fee", "비용·결제 조건", "area"], ["insta", "인스타그램 링크"], ["blog", "사이트·후기 링크"], ["source", "출처"], ["memo", "메모", "area"]],
  vendors: [["name", "업체명"], ["cat", "분류", "select", ["studio", "dress", "makeup", "snap", "etc"]], ["planner", "제휴 플래너"], ["location", "위치"], ["features", "특징", "area"], ["price", "견적가 (원)", "num"], ["listPrice", "정가 (원)", "num"], ["listNote", "정가 메모"], ["quoteDelta", "플래너 견적 대비 추가금 (원)", "num"], ["priceNote", "견적 조건", "area"], ["extraFees", "추가금·조건", "area"], ["insta", "인스타그램 링크"], ["blog", "저장한 블로그 후기 링크"], ["blogSummary", "후기 요약", "area"], ["source", "출처"], ["memo", "메모", "area"]],
  halls: [["name", "웨딩홀 이름"], ["zone", "권역", "select", ZONES], ["gu", "구"], ["dong", "동"], ["type", "유형", "select", ["", ...HALL_TYPES]], ["mealType", "식사 형식"], ["mealMin", "식대 최소 (1인, 원)", "num"], ["mealMax", "식대 최대 (1인, 원)", "num"], ["rental", "대관료 (원)", "num"], ["rentalNote", "대관료 비고", "area"], ["checkedAt", "가격 확인일 (상담·견적 받은 날)", "date"], ["minGuests", "최소 보증인원", "num"], ["maxGuests", "최대 수용", "num"], ["times", "가능 시간대 (예: 토 11:00 / 13:30 / 17:00)", "wide"], ["interval", "예식 간격 (분)", "num"], ["flowerFee", "꽃장식 (원)", "num"], ["productionFee", "연출·음향 (원)", "num"], ["snapFee", "본식 스냅·영상 (원)", "num"], ["otherOptions", "기타 옵션비용", "area"], ["includes", "기본 포함", "area"], ["station", "가까운 역"], ["walk", "역 도보 (분)", "num"], ["parking", "주차 (대)", "num"], ["address", "주소", "wide"], ["phone", "전화"], ["homepage", "홈페이지"], ["insta", "인스타그램"], ["naverPlace", "네이버 플레이스"], ["blog", "저장한 블로그 후기"], ["source", "출처", "wide"], ["memo", "메모", "area"]],
  homes: [["name", "단지명"], ["kind", "유형", "select", ["매매", "전세"]], ["gu", "구"], ["dong", "동"], ["aptNm", "실거래 단지명 (국토부 표기, 비우면 단지명)"], ["lawdCd", "법정동코드 5자리 (서울은 구로 자동)"], ["area", "전용면적 (㎡)", "num"], ["price", "매매 호가 (원)", "num"], ["kb", "KB시세 (원)", "num"], ["recent", "최근 실거래가 (원)", "num"], ["jeonse", "전세가 (원)", "num"], ["units", "세대수", "num"], ["year", "준공연도", "num"], ["station", "가까운 역"], ["walk", "역 도보 (분)", "num"], ["school", "배정 초등학교"], ["visit", "임장일"], ["agent", "부동산·연락처"], ["link", "매물 링크", "wide"], ["memo", "메모", "area"]],
};

export function Drawer() {
  const { drawer, setDrawer } = useStore();
  useEffect(() => {
    if (!drawer) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [drawer, setDrawer]);
  if (!drawer) return null;
  return (
    <>
      <div className="scrim" onClick={() => setDrawer(null)} />
      {drawer.col === "dprice" ? <DressPriceDetail k={drawer.key} /> : <EntityDrawer key={`${drawer.col}/${drawer.id}`} col={drawer.col} id={drawer.id} />}
    </>
  );
}

type Doc = Record<string, unknown> & { name?: string; status?: string; scores?: Record<string, number | null>; checks?: Record<string, boolean>; photo?: string; insta?: string; cat?: string; plannerQuote?: { src?: string } };

function EntityDrawer({ col, id }: { col: "planners" | "vendors" | "halls" | "homes"; id: string }) {
  const { ledger, s, write, remove, setSettings, setDrawer } = useStore();
  const pick = usePickPhoto();
  const d = (ledger[col] as Record<string, Doc>)[id];
  if (!d) return null;
  const kind: ScoreKind = col === "halls" ? "hall" : col === "planners" ? "planner" : col === "homes" ? "home" : ["studio", "dress", "makeup"].includes(d.cat as string) ? (d.cat as ScoreKind) : "studio";
  const st = col === "halls" ? H_STATUS : col === "homes" ? HOME_STATUS : V_STATUS;
  const set = (patch: Record<string, unknown>) => write(col, id, patch);

  const field = ([k, label, type, opts]: Field) => {
    const v = d[k];
    const full = type === "area" || type === "wide";
    let input: React.ReactNode;
    if (type === "select")
      input = (
        <select value={(v as string) ?? ""} onChange={(e) => set({ [k]: e.target.value })}>
          {v != null && v !== "" && !opts!.includes(v as string) && <option value={v as string}>{v as string}</option>}
          {opts!.map((o) => <option key={o} value={o}>{CAT_LABEL[o] || o || "—"}</option>)}
        </select>
      );
    else if (type === "area") input = <AreaField value={(v as string) ?? ""} onChange={(x) => set({ [k]: x })} />;
    else if (type === "num") input = <NumField value={v} onChange={(x) => set({ [k]: x })} />;
    else if (type === "date")
      input = (
        <span style={{ display: "flex", gap: 6 }}>
          <input type="date" value={(v as string) ?? ""} onChange={(e) => set({ [k]: e.target.value })} />
          <button type="button" className="btn small" onClick={() => set({ [k]: new Date().toLocaleDateString("sv-SE") })}>오늘</button>
        </span>
      );
    else input = <TextCell className="" value={(v as string) ?? ""} label={label} onChange={(x) => set({ [k]: x })} />;
    return (
      <label key={k} style={full ? { gridColumn: "1/-1" } : undefined}>
        {label}
        {input}
      </label>
    );
  };

  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${d.name} 편집`}>
      <header>
        <div>
          <h2>{d.name || "새 항목"}</h2>
          <Edited k={`${col}/${id}`} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm(`'${d.name || "이 항목"}'을(를) 삭제할까요?`)) {
                setDrawer(null);
                remove(col, id);
              }
            }}
          >
            삭제
          </button>
          <button className="btn small" onClick={() => setDrawer(null)}>닫기</button>
        </div>
      </header>
      <div className="content">
        <div className="photo">
          {d.photo ? <Photo path={d.photo} alt="대표 사진" /> : <div className="thumb empty" style={{ width: 120, height: 150 }}>사진 없음</div>}
          <div style={{ display: "grid", gap: 6 }}>
            <button className="btn small" onClick={() => pick(col, id)}>{d.photo ? "사진 바꾸기" : "대표 사진 올리기"}</button>
            {d.photo && <button className="btn small ghost" onClick={() => set({ photo: "", photoData: "" })}>사진 지우기</button>}
            <span className="muted small">{col === "homes" ? "임장 때 찍은 사진을 올려 두세요" : "인스타그램 게시물을 캡처해서 올리면 돼요"}</span>
          </div>
        </div>
        {col === "halls" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className={`btn small ${s.mainHall === id ? "primary" : ""}`} onClick={() => setSettings({ mainHall: id })}>
              {s.mainHall === id ? "기준 홀로 지정됨" : "기준 홀로 지정 (예산 반영)"}
            </button>
            {d.plannerQuote && <span className="pill src">{d.plannerQuote.src}</span>}
          </div>
        )}
        <label>
          상태
          <select value={d.status ?? ""} onChange={(e) => set({ status: e.target.value })}>
            {d.status && !st.includes(d.status) && <option>{d.status}</option>}
            {st.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <div>
          <div className="muted small" style={{ marginBottom: 4 }}>평가 (1~5)</div>
          <div className="scores">
            {SCORE[kind].map(([k, l]) => (
              <label key={k}>
                {l}
                <select value={isNum(d.scores?.[k]) ? String(d.scores![k]) : ""} onChange={(e) => set({ scores: { [k]: e.target.value === "" ? null : Number(e.target.value) } })}>
                  <option value=""></option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        {col === "homes" && (
          <>
            <SitePhotos id={id} photos={(d.photos as string[] | undefined) ?? []} />
            <div className="checklist">
              <div className="muted small">임장 체크리스트 · {Object.values(d.checks || {}).filter(Boolean).length}/{CHECKS.reduce((a, g) => a + g[1].length, 0)}</div>
              {CHECKS.map(([g, items]) => (
                <div className="checkgroup" key={g}>
                  <h4>
                    {g} <span className="muted small">{items.filter(([k]) => d.checks?.[k]).length}/{items.length}</span>
                  </h4>
                  {items.map(([k, l]) => (
                    <label key={k} className={d.checks?.[k] ? "done" : ""}>
                      <input type="checkbox" checked={!!d.checks?.[k]} onChange={(e) => set({ checks: { [k]: e.target.checked } })} /> {l}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <RealPrice id={id} home={d as unknown as Omit<Home, "id">} />
          </>
        )}
        <div className="two">{FIELDS[col].map(field)}</div>
        {col !== "planners" && (
          <div className="links">
            <a href={blogLink(stripParen(d.name || ""))} target="_blank" rel="noopener">네이버 블로그 후기 검색</a>
            {d.insta && <a href={d.insta} target="_blank" rel="noopener">인스타그램 열기</a>}
          </div>
        )}
      </div>
    </aside>
  );
}

function AreaField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { draft, setDraft, bind } = useDraft(value);
  return <textarea value={draft} {...bind} onChange={(e) => (setDraft(e.target.value), onChange(e.target.value))} />;
}

function NumField({ value, onChange }: { value: unknown; onChange: (v: number | null) => void }) {
  const { draft, setDraft, bind } = useDraft(isNum(value) ? String(value) : "");
  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      {...bind}
      onChange={(e) => (setDraft(e.target.value), onChange(e.target.value === "" ? null : Number(e.target.value)))}
    />
  );
}

function DressPriceDetail({ k }: { k: string }) {
  const { ledger, setDrawer } = useStore();
  const r = dressPriceIndex(ledger).by[k];
  if (!r) return null;
  const br = (t?: string) => (t || "").split("\n").map((x, i, a) => <span key={i}>{x}{i < a.length - 1 && <br />}</span>);
  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${r.name} 가격표`}>
      <header>
        <h2>{r.name}</h2>
        <button className="btn small" onClick={() => setDrawer(null)}>닫기</button>
      </header>
      <div className="content">
        {Object.entries(r.p).map(([p, x]) => (
          <div className="panel" style={{ padding: 12 }} key={p}>
            <h3>{p}</h3>
            <dl className="kv">
              <dt>본식</dt><dd>{won(x.main)}{x.mainMax ? " ~ " + won(x.mainMax) : ""}</dd>
              <dt>촬영+본식</dt><dd>{won(x.combo)}{x.comboMax ? " ~ " + won(x.comboMax) : ""}</dd>
              <dt>헬퍼</dt><dd>{x.helper}</dd>
              <dt>피팅비</dt><dd>{x.fitting}</dd>
              {x.refit && <><dt>재가봉비</dt><dd>{x.refit}</dd></>}
              <dt>디자인 추가금</dt><dd>{br(x.design)}{p === "다이렉트" && x.design ? " (만원)" : ""}</dd>
              {x.firstWear && <><dt>퍼스트웨어</dt><dd>{x.firstWear}</dd></>}
              {x.extraDress && <><dt>드레스 추가</dt><dd>{x.extraDress}</dd></>}
              {x.notes && <><dt>기타</dt><dd>{x.notes}</dd></>}
              {x.extras && <><dt>추가금</dt><dd>{br(x.extras)}</dd></>}
              {x.penalty && <><dt>위약금</dt><dd className="small">{br(x.penalty)}</dd></>}
            </dl>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** 임장 현장 사진: 카메라로 바로 찍거나 앨범에서 여러 장 골라 올린다. */
function SitePhotos({ id, photos }: { id: string; photos: string[] }) {
  const { ledger, write, supabase, toast } = useStore();
  const upload = useUploadPhoto();
  const [busy, setBusy] = useState(0);

  async function add(files: FileList | null) {
    const list = [...(files || [])].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    let acc = photos;
    for (const f of list) {
      const path = await upload("homes", id, f);
      if (path) {
        const cur = ((ledger.homes[id] as { photos?: string[] } | undefined)?.photos ?? []);
        // 업로드 사이에 다른 사진이 추가됐을 수 있어 매번 최신 배열에 붙인다
        acc = [...new Set([...cur, ...acc, path])];
        write("homes", id, { photos: acc });
      }
      setBusy((n) => n - 1);
    }
    toast(`사진 ${list.length}장을 올렸어요`);
  }

  function del(path: string) {
    if (!confirm("이 사진을 지울까요?")) return;
    write("homes", id, { photos: photos.filter((p) => p !== path) });
    void supabase.storage.from("photos").remove([path]);
  }

  return (
    <div>
      <div className="muted small" style={{ marginBottom: 6 }}>현장 사진 {photos.length ? `${photos.length}장` : ""}</div>
      <div className="sitephotos">
        {photos.map((p) => (
          <div key={p} className="sp">
            <Photo path={p} alt="현장 사진" />
            <button className="sp-del" aria-label="사진 지우기" onClick={() => del(p)}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <label className="btn small">
          {busy ? `올리는 중… ${busy}` : "사진 찍기"}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
        <label className="btn small ghost">
          앨범에서
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
