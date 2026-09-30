"use client";
import { useEffect, useState } from "react";
import { SCORE, rank } from "@/lib/constants";
import { eok, isNum } from "@/lib/format";
import type { CollectionName, ScoreKind } from "@/lib/types";
import { useStore } from "./store";

export const blogLink = (name: string) => "https://search.naver.com/search.naver?where=blog&query=" + encodeURIComponent(name + " 후기");
export const naverQ = (q: string) => "https://search.naver.com/search.naver?query=" + encodeURIComponent(q);
export const stripParen = (s: string) => (s || "").replace(/\s*\(.*\)/, "");

/* ---------- 점수·상태 ---------- */

export function ScoreSelect({ col, id, kind, k, val }: { col: CollectionName; id: string; kind: ScoreKind; k: string; val: unknown }) {
  const { write } = useStore();
  const label = SCORE[kind].find((s) => s[0] === k)?.[1];
  return (
    <select
      className="score"
      aria-label={`${label} 점수`}
      value={isNum(val) ? String(val) : ""}
      onChange={(e) => write(col, id, { scores: { [k]: e.target.value === "" ? null : Number(e.target.value) } })}
    >
      <option value=""></option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n}>{n}</option>
      ))}
    </select>
  );
}

export function StatusSelect({ col, id, val, opts }: { col: CollectionName; id: string; val?: string; opts: string[] }) {
  const { write } = useStore();
  return (
    <select className={`st st-${val ?? ""}`} aria-label="상태" value={val ?? ""} onChange={(e) => write(col, id, { status: e.target.value })}>
      {val != null && !opts.includes(val) && <option>{val}</option>}
      {opts.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export function AvgCell({ a }: { a: number | null }) {
  if (a == null) return <span className="muted">—</span>;
  return (
    <span className="avg">
      {a.toFixed(1)}
      <span className="bar">
        <i style={{ width: `${(a / 5) * 100}%` }} />
      </span>
    </span>
  );
}

/* ---------- 정렬 ---------- */

type Getter<T> = (r: T) => string | number | null | undefined;

export function useSort<T>(tabKey: string, rows: T[], getters: Record<string, Getter<T>>, fallback?: { key: string; dir: "asc" | "desc" }) {
  const { ui, setUI } = useStore();
  const s = ui.sort[tabKey] ?? fallback;
  let sorted = rows;
  const g = s && getters[s.key];
  if (s && g) {
    const dir = s.dir === "asc" ? 1 : -1;
    sorted = rows.slice().sort((a, b) => {
      const x = g(a), y = g(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }
  const sortProps = (k: string) => ({
    "data-dir": s && s.key === k ? s.dir : undefined,
    onClick: () => setUI((u) => ({ ...u, sort: { ...u.sort, [tabKey]: { key: k, dir: s && s.key === k && s.dir === "desc" ? ("asc" as const) : ("desc" as const) } } })),
  });
  const th = (k: string, children: React.ReactNode, className?: string) => (
    <th key={k} className={className} {...sortProps(k)}>
      {children}
    </th>
  );
  return { rows: sorted, th, sortProps };
}

export const statusRank = (r: { status?: string }) => rank(r.status);

/* ---------- 입력 ---------- */

/** 입력 중에는 입력값(draft)을, 그 외에는 바깥 값을 보여주는 텍스트 상태. */
function useDraft(external: string) {
  const [draft, setDraft] = useState<string | null>(null);
  return {
    draft: draft ?? external,
    setDraft,
    bind: { onFocus: () => setDraft(external), onBlur: () => setDraft(null) },
  };
}

const manStr = (v: unknown, digits = 2) => (isNum(v) ? String(+(v / 10000).toFixed(digits)) : "");

/** 만원 단위로 입력받아 원 단위로 저장하는 셀 입력. */
export function ManCell({ value, onChange, label, placeholder, className = "cell", digits = 1 }: { value: unknown; onChange: (won: number | null) => void; label: string; placeholder?: string; className?: string; digits?: number }) {
  const { draft, setDraft, bind } = useDraft(manStr(value, digits));
  return (
    <input
      className={className}
      type="number"
      step="any"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      {...bind}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value === "" ? null : Math.round(Number(e.target.value) * 10000));
      }}
    />
  );
}

export function TextCell({ value, onChange, label, placeholder, className = "cell memo", style, list }: { value: string | undefined; onChange: (v: string) => void; label: string; placeholder?: string; className?: string; style?: React.CSSProperties; list?: string }) {
  const { draft, setDraft, bind } = useDraft(value ?? "");
  return (
    <input
      className={className}
      style={style}
      aria-label={label}
      placeholder={placeholder}
      list={list}
      value={draft}
      {...bind}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

/** 설정용 만원 입력 (formgrid 라벨 + 억/만 힌트). */
export function ManInput({ path, value, label, hint }: { path: string; value: unknown; label: string; hint?: string }) {
  const { setSettings } = useStore();
  return (
    <label>
      {label}
      <ManCell className="" digits={2} value={value} label={label} placeholder="만원" onChange={(v) => setSettings(pathObj(path, v))} />
      <span className="hint">{isNum(value) ? eok(value) : hint || ""}</span>
    </label>
  );
}

export function NumInput({ path, value, label, unit, step }: { path: string; value: unknown; label: string; unit?: string; step?: number }) {
  const { setSettings } = useStore();
  const { draft, setDraft, bind } = useDraft(isNum(value) ? String(value) : "");
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step ?? "any"}
        placeholder={unit}
        value={draft}
        {...bind}
        onChange={(e) => {
          setDraft(e.target.value);
          setSettings(pathObj(path, e.target.value === "" ? null : Number(e.target.value)));
        }}
      />
      <span className="hint">{unit || ""}</span>
    </label>
  );
}

export function Chk({ path, value, label }: { path: string; value: boolean; label: string }) {
  const { setSettings } = useStore();
  return (
    <label className="chk">
      <input type="checkbox" checked={!!value} onChange={(e) => setSettings(pathObj(path, e.target.checked))} /> {label}
    </label>
  );
}

export function pathObj(p: string, v: unknown): Record<string, unknown> {
  const ks = p.split(".");
  const o: Record<string, unknown> = {};
  let c = o;
  ks.forEach((k, i) => {
    if (i === ks.length - 1) c[k] = v;
    else {
      c[k] = {};
      c = c[k] as Record<string, unknown>;
    }
  });
  return o;
}

/* ---------- 사진 (Supabase Storage, 비공개 버킷 → 서명 URL) ---------- */

const urlCache = new Map<string, { url: string; exp: number }>();

export function usePhotoUrl(path: string | undefined) {
  const { supabase } = useStore();
  const [fetched, setFetched] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path || path.startsWith("data:")) return;
    const c = urlCache.get(path);
    if (c && c.exp > Date.now()) return;
    let alive = true;
    supabase.storage
      .from("photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!data?.signedUrl) return;
        urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3500_000 });
        if (alive) setFetched({ path, url: data.signedUrl });
      });
    return () => {
      alive = false;
    };
  }, [path, supabase]);
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  if (fetched?.path === path) return fetched.url;
  return urlCache.get(path)?.url ?? null;
}

/** 이미지 축소 후 JPEG Blob. */
function shrink(file: File, max = 1280, q = 0.85): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob((b) => (b ? res(b) : rej(new Error("이미지 변환 실패"))), "image/jpeg", q);
    };
    img.onerror = rej;
    img.src = u;
  });
}

export function useUploadPhoto() {
  const { supabase, toast } = useStore();
  return async (col: string, id: string, file: File): Promise<string | null> => {
    try {
      const blob = await shrink(file);
      const path = `${col}/${id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      return path;
    } catch (e) {
      toast(`사진을 올리지 못했어요 (${(e as Error).message})`);
      return null;
    }
  };
}

export function Photo({ path, alt, className, style }: { path?: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const url = usePhotoUrl(path || undefined);
  if (!path) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className={className} style={style} src={url} alt={alt} /> : <div className={`${className ?? ""} thumb empty`} style={style} />;
}

/** 숨은 파일 input을 눌러 사진 하나를 골라 업로드하고 photo 필드에 저장. */
export function usePickPhoto() {
  const { write } = useStore();
  const upload = useUploadPhoto();
  return (col: CollectionName, id: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const path = await upload(col, id, f);
      if (path) write(col, id, { photo: path, photoData: "" });
    };
    input.click();
  };
}
