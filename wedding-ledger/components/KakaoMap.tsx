"use client";
// 카카오맵 (JavaScript SDK). 키: NEXT_PUBLIC_KAKAO_MAP_KEY — 카카오 개발자 콘솔에 등록한 도메인에서만 동작한다.
import { useEffect, useRef, useState } from "react";
import { eok, isNum } from "@/lib/format";
import { listOf } from "@/lib/calc/wedding";
import { homesVerdict, verdictText, type Verdict } from "@/lib/calc/housing";
import type { Home } from "@/lib/types";
import { useStore } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Kakao = any;
declare global {
  interface Window {
    kakao?: Kakao;
  }
}

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
let loading: Promise<Kakao> | null = null;

function loadKakao(): Promise<Kakao> {
  if (!KEY) return Promise.reject(new Error("no_key"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false&libraries=services`;
    s.async = true;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error("sdk")));
    s.onerror = () => reject(new Error("sdk"));
    document.head.appendChild(s);
  });
  loading.catch(() => (loading = null));
  return loading;
}

/** 주소 → 좌표, 실패하면 키워드(장소) 검색. 빈 문자열은 건너뛴다. */
export async function geocode(address: string, keyword?: string): Promise<{ lat: number; lng: number } | null> {
  const kakao = await loadKakao();
  const S = kakao.maps.services;
  const byAddr = address.trim()
    ? await new Promise<{ lat: number; lng: number } | null>((res) =>
        new S.Geocoder().addressSearch(address, (r: any[], st: string) => res(st === S.Status.OK && r[0] ? { lat: +r[0].y, lng: +r[0].x } : null)),
      )
    : null;
  if (byAddr || !keyword?.trim()) return byAddr;
  return new Promise((res) =>
    new S.Places().keywordSearch(keyword, (r: any[], st: string) => {
      if (st !== S.Status.OK || !r.length) return res(null);
      const apt = r.find((x) => /아파트/.test(x.category_name || "")) ?? r[0];
      res({ lat: +apt.y, lng: +apt.x });
    }),
  );
}

/** 위치를 찾을 근거(구 또는 법정동코드 + 이름)가 있는 후보만. 이 값이 바뀌면 좌표를 다시 찾는다. */
export function geoKeyOf(h: Pick<Home, "name" | "aptNm" | "gu" | "dong" | "jibun" | "lawdCd">): string | null {
  const name = (h.aptNm || h.name || "").trim();
  const where = (h.gu || "").trim() || (h.lawdCd || "").trim();
  if (!name || !where || name === "새 단지") return null;
  return [name, h.gu ?? "", h.dong ?? "", h.jibun ?? "", h.lawdCd ?? ""].join("|");
}

export interface MapPoint {
  key: string;
  label: string;
  sub?: string;
  lat: number;
  lng: number;
  kind: "home" | "search";
  /** 자금 판정 색 (임장 후보) */
  tone?: Verdict;
  onClick?: () => void;
}

/** 지도 하나에 점들을 표시 (라벨형 오버레이). */
export function KakaoMap({ points, height = 320 }: { points: MapPoint[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Kakao>(null);
  const overlays = useRef<Kakao[]>([]);
  const [err, setErr] = useState<string | null>(KEY ? null : "no_key");

  useEffect(() => {
    if (!KEY) return;
    let alive = true;
    loadKakao()
      .then((kakao) => {
        if (!alive || !el.current) return;
        map.current = new kakao.maps.Map(el.current, { center: new kakao.maps.LatLng(37.5326, 127.0246), level: 8 });
        map.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        setErr(null);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  // 점이 바뀌면 오버레이 다시 그리기 + 화면 맞추기
  const sig = points.map((p) => `${p.key}:${p.lat},${p.lng}:${p.label}:${p.sub}:${p.tone}`).join("|");
  useEffect(() => {
    const kakao = window.kakao;
    if (!map.current || !kakao?.maps) return;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    if (!points.length) return;
    const bounds = new kakao.maps.LatLngBounds();
    for (const p of points) {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const node = document.createElement("button");
      node.className = `kmap-pin ${p.kind} ${p.tone ?? ""}`;
      node.innerHTML = `<b></b><span></span>`;
      (node.querySelector("b") as HTMLElement).textContent = p.label;
      (node.querySelector("span") as HTMLElement).textContent = p.sub ?? "";
      if (p.onClick) node.onclick = p.onClick;
      const o = new kakao.maps.CustomOverlay({ position: pos, content: node, yAnchor: 1.2, clickable: true });
      o.setMap(map.current);
      overlays.current.push(o);
      bounds.extend(pos);
    }
    if (points.length === 1) map.current.setCenter(new kakao.maps.LatLng(points[0].lat, points[0].lng));
    else map.current.setBounds(bounds, 40, 40, 40, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, err]);

  if (err)
    return (
      <div className="note small">
        {err === "no_key"
          ? "지도 키(NEXT_PUBLIC_KAKAO_MAP_KEY)가 아직 없어요."
          : "카카오 지도를 불러오지 못했어요. 카카오 개발자 콘솔의 ‘플랫폼 키 → JavaScript SDK 도메인’에 이 사이트 주소가 있는지, ‘카카오맵’ 사용 설정이 켜져 있는지 확인해 주세요."}
      </div>
    );
  return <div ref={el} className="kmap" style={{ height }} />;
}

/** 임장 후보들을 지도에 표시. 좌표가 없는 후보는 한 번 찾아서 저장해 둔다. */
export function HomesMap({ extra }: { extra?: MapPoint | null }) {
  const { ledger, s, write, setDrawer } = useStore();
  const tried = useRef(new Set<string>());
  const homes = listOf<Home>(ledger.homes);
  const V = homesVerdict(ledger, s);
  const verdictOf = new Map(V.rows.map((r) => [r.id, r]));

  useEffect(() => {
    if (!KEY) return;
    for (const h of homes) {
      const key = geoKeyOf(h);
      if (!key || h.geoKey === key || tried.current.has(`${h.id}:${key}`)) continue;
      tried.current.add(`${h.id}:${key}`);
      const seoul = !h.lawdCd || h.lawdCd.startsWith("11");
      const addr = h.jibun ? `${seoul ? "서울 " : ""}${h.gu ?? ""} ${h.dong ?? ""} ${h.jibun}`.trim() : "";
      const kw = `${seoul ? "서울 " : ""}${h.gu ?? ""} ${h.dong ?? ""} ${h.aptNm || h.name}`.replace(/\s+/g, " ").trim();
      geocode(addr, kw)
        .then((p) => write("homes", h.id, p ? { lat: p.lat, lng: p.lng, geoKey: key } : { lat: null, lng: null, geoKey: key }))
        .catch(() => {});
    }
  }, [homes, write]);

  const points: MapPoint[] = homes
    // 좌표를 찾은 뒤 이름·위치가 바뀌었으면(geoKey 불일치) 다시 찾을 때까지 숨긴다
    .filter((h) => isNum(h.lat) && isNum(h.lng) && h.geoKey === geoKeyOf(h))
    .map((h) => {
      const v = verdictOf.get(h.id);
      const short = (n: number) => eok(n).replace(" 원", "");
      const price = h.kind === "전세" ? (isNum(h.jeonse) ? `전세 ${short(h.jeonse)}` : "") : isNum(h.price) ? short(h.price) : isNum(h.recent) ? `실거래 ${short(h.recent)}` : "";
      return {
        key: h.id,
        kind: "home" as const,
        tone: v?.verdict,
        label: h.name,
        sub: [price, v ? verdictText(v, short) : "제외"].filter(Boolean).join(" · "),
        lat: h.lat as number,
        lng: h.lng as number,
        onClick: () => setDrawer({ col: "homes", id: h.id }),
      };
    });
  if (extra) points.push(extra);
  if (!homes.length && !extra) return null;
  return (
    <>
      {V.rows.length > 0 && (
        <p className="small" style={{ margin: "0 0 6px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <b>지금 자금으로</b>
          <span><i className="dot ok" /> 가능 {V.ok}</span>
          <span><i className="dot short" /> 부족 {V.short}</span>
          {V.none > 0 && <span><i className="dot none" /> 가격 입력 필요 {V.none}</span>}
          <span className="muted">(신혼집 탭 자금·대출 조건 기준 · 핀을 누르면 상세)</span>
        </p>
      )}
      <KakaoMap points={points} />
    </>
  );
}
