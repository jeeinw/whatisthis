"use client";
// 장부 데이터 스토어: 전체 로드 → 낙관적 업데이트 → 문서별 450ms 디바운스 저장 (legacy write/flush와 같은 흐름).
// 저장은 바뀐 필드만 보낸다 (patch_doc RPC가 서버에서 깊은 병합) → 두 사람이 같은 문서의 다른 칸을 고쳐도 덮어쓰지 않는다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowsToLedger, SETTINGS_ID, TABLE, type Row } from "@/lib/db";
import { clone, deepMerge, resolveSettings } from "@/lib/settings";
import { COLLECTIONS, NEW_COLLECTIONS, type CollectionName, type Ledger, type Settings } from "@/lib/types";

type Col = CollectionName | "settings";
type Obj = Record<string, unknown>;

export interface UIState {
  tab: string;
  sort: Record<string, { key: string; dir: "asc" | "desc" }>;
  hall: { q: string; zone: string; gu: string; type: string; status: string; maxMeal: string; hideExcluded: boolean; src: string };
  vendor: { q: string; status: string };
  price: { q: string; only: string };
  open: Record<string, boolean>;
}

const DEFAULT_UI: UIState = {
  tab: "summary",
  sort: {},
  hall: { q: "", zone: "", gu: "", type: "", status: "", maxMeal: "", hideExcluded: true, src: "" },
  vendor: { q: "", status: "" },
  price: { q: "", only: "" },
  open: {},
};

function loadUI(): UIState {
  try {
    const s = JSON.parse(localStorage.getItem("wl-ui") || "null");
    if (s) return { ...DEFAULT_UI, ...s, hall: { ...DEFAULT_UI.hall, ...s.hall }, vendor: { ...DEFAULT_UI.vendor, ...s.vendor }, price: { ...DEFAULT_UI.price, ...s.price }, open: s.open || {} };
  } catch {}
  return DEFAULT_UI;
}

/** 문서별 마지막 수정 (누가·언제) */
export interface DocMeta {
  at: string;
  by: string | null;
}

export interface TrashItem {
  id: number;
  tbl: string;
  doc_id: string;
  data: Obj;
  deleted_at: string;
  deleted_email: string | null;
}

export type Drawer = { col: "planners" | "vendors" | "halls" | "homes"; id: string } | { col: "dprice"; key: string } | null;

interface Store {
  ledger: Ledger;
  s: Settings;
  sync: string;
  write: (col: Col, id: string, patch: Obj) => void;
  setSettings: (patch: Obj) => void;
  create: (col: CollectionName, data: Obj) => string;
  remove: (col: CollectionName, id: string) => void;
  restore: (item: TrashItem) => Promise<void>;
  meta: Record<string, DocMeta>;
  me: string | null;
  needsMigration: boolean;
  ui: UIState;
  setUI: (fn: (u: UIState) => UIState) => void;
  drawer: Drawer;
  setDrawer: (d: Drawer) => void;
  toast: (msg: string) => void;
  supabase: ReturnType<typeof createClient>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider 밖에서 useStore 호출");
  return s;
};

function emptyLedger(): Ledger {
  return { planners: {}, vendors: {}, quotes: {}, extras: {}, halls: {}, dresses: {}, budget: {}, homes: {}, priceLists: {}, guests: {}, gifts: {}, payments: {}, tasks: {}, settings: {} };
}

/** Storage에 올린 사진 경로인지 (legacy data URL·빈 값 제외) */
const isStoragePath = (p: unknown): p is string => typeof p === "string" && p !== "" && !p.startsWith("data:");

/** undefined → null (JSON으로 보내면 undefined 키가 사라져 서버와 화면이 달라지므로) */
function normalize(patch: Obj): Obj {
  return JSON.parse(JSON.stringify(patch, (_k, v) => (v === undefined ? null : v)));
}

/** patch_doc / trash_doc 마이그레이션(0002)이 아직 안 된 DB */
const missingFn = (e: { code?: string; message?: string }) => e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? "");

const metaOf = (r: { updated_at?: string; updated_email?: string | null }): DocMeta | null => (r.updated_at ? { at: r.updated_at, by: r.updated_email ?? null } : null);

function newId(col: string) {
  return col[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ledger, setLedger] = useState<Ledger>(emptyLedger);
  const ledgerRef = useRef(ledger);
  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [sync, setSync] = useState("불러오는 중");
  const [ui, setUIState] = useState<UIState>(() => (typeof window === "undefined" ? DEFAULT_UI : loadUI()));
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** 아직 서버에 안 보낸 변경 (문서별로 합쳐 둔 patch) */
  const pending = useRef(new Map<string, Obj>());
  /** 보내는 중인 저장 (삭제가 생성보다 먼저 도착하지 않게) */
  const inflight = useRef(new Map<string, Promise<void>>());
  const [meta, setMeta] = useState<Record<string, DocMeta>>({});
  const [me, setMe] = useState<string | null>(null);
  const meRef = useRef<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [needsMigration, setNeedsMigration] = useState(false);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const commit = useCallback((next: Ledger) => {
    ledgerRef.current = next;
    setLedger(next);
  }, []);

  /* ---------- 로드 ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: allowed, error: allowErr } = await supabase.rpc("is_allowed");
      if (allowErr) {
        if (!cancelled) {
          setStatus("error");
          setSync(`불러오지 못했어요 (${allowErr.message})`);
        }
        return;
      }
      if (!allowed) {
        if (!cancelled) setStatus("denied");
        return;
      }
      const rows: Record<string, Row[]> = {};
      const results = await Promise.all(
        ([...COLLECTIONS, "settings"] as Col[]).map(async (c) => {
          const { data, error } = await supabase.from(TABLE[c]).select("*");
          // 0002 마이그레이션 전이면 새 테이블이 없다 → 빈 컬렉션으로 두고 안내만
          if (error && (NEW_COLLECTIONS as readonly string[]).includes(c) && /PGRST205|42P01/.test(error.code ?? "")) {
            if (!cancelled) setNeedsMigration(true);
            return [c, []] as const;
          }
          if (error) throw error;
          return [c, data as (Row & { updated_at?: string; updated_email?: string | null })[]] as const;
        }),
      ).catch((e: Error) => {
        if (!cancelled) {
          setStatus("error");
          setSync(`불러오지 못했어요 (${e.message})`);
        }
        return null;
      });
      if (!results || cancelled) return;
      const m: Record<string, DocMeta> = {};
      for (const [c, r] of results) {
        rows[c] = r.map(({ id, data }) => ({ id, data }));
        for (const x of r) {
          const mm = metaOf(x);
          if (mm) m[`${c}/${x.id}`] = mm;
        }
      }
      commit(rowsToLedger(rows));
      setMeta(m);
      setStatus("ready");
      setSync("저장됨");
      supabase.auth.getUser().then(({ data }) => {
        meRef.current = data.user?.email ?? null;
        if (!cancelled) setMe(meRef.current);
      });
      // 30일 지난 휴지통 비우기 + 그 문서들의 사진 파일 정리
      supabase.rpc("purge_trash").then(({ data }) => {
        const files = ((data as Obj[] | null) ?? []).flatMap((d) => [d?.photo, ...(Array.isArray(d?.photos) ? d.photos : [])]).filter(isStoragePath);
        if (files.length) void supabase.storage.from("photos").remove(files);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, commit]);

  /* ---------- Realtime: 다른 사람(또는 다른 탭)의 변경 반영 ---------- */
  useEffect(() => {
    if (status !== "ready") return;
    const colOf = Object.fromEntries(Object.entries(TABLE).map(([c, t]) => [t, c as Col]));
    const channel = supabase.channel("ledger");
    for (const table of Object.values(TABLE)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const col = colOf[table];
        const L = ledgerRef.current;
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (!id || col === "settings" || !(id in L[col])) return;
          const rest = { ...(L[col] as Record<string, Obj>) };
          delete rest[id];
          commit({ ...L, [col]: rest });
          return;
        }
        const row = payload.new as Row & { updated_at?: string; updated_email?: string | null };
        const key = `${col}/${row.id}`;
        const mm = metaOf(row);
        if (mm) setMeta((x) => ({ ...x, [key]: mm }));
        // 아직 안 보낸 내 수정이 있으면 서버 값 위에 다시 얹는다 (곧 저장됨)
        const mine = pending.current.get(key);
        const data = mine ? deepMerge(clone(row.data), clone(mine)) : row.data;
        if (col === "settings") {
          if (row.id === SETTINGS_ID && JSON.stringify(L.settings) !== JSON.stringify(data)) commit({ ...L, settings: data });
          return;
        }
        const cur = (L[col] as Record<string, Obj>)[row.id];
        if (cur && JSON.stringify(cur) === JSON.stringify(data)) return; // 내 저장의 메아리
        commit({ ...L, [col]: { ...L[col], [row.id]: data } });
      });
    }
    channel.subscribe((st) => {
      if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") setSync("실시간 연결 끊김 — 새로고침 필요");
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [status, supabase, commit]);

  /* ---------- 저장 ---------- */
  const flush = useCallback(
    async (col: Col, id: string) => {
      const key = `${col}/${id}`;
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const patch = pending.current.get(key);
      if (!patch) return;
      pending.current.delete(key);
      const req = supabase.rpc("patch_doc", { tbl: TABLE[col], doc_id: id, patch });
      inflight.current.set(key, Promise.resolve(req).then(() => undefined));
      let { error } = await req;
      inflight.current.delete(key);
      if (error && missingFn(error)) {
        // 마이그레이션 전 DB: 문서 전체 저장 (예전 방식)
        const L = ledgerRef.current;
        const data = col === "settings" ? L.settings : (L[col] as Record<string, Obj>)[id];
        ({ error } = data ? await supabase.from(TABLE[col]).upsert({ id, data }) : { error: null });
      }
      if (error) {
        // 실패한 변경은 다시 대기열로 (그 사이 새로 고친 값이 우선)
        pending.current.set(key, deepMerge(patch, pending.current.get(key) ?? {}));
        toast(`저장하지 못했어요 (${error.message})`);
        setSync("저장 실패 — 잠시 후 다시 시도");
        setTimeout(() => setRetryTick((t) => t + 1), 5000);
      } else {
        setMeta((x) => ({ ...x, [key]: { at: new Date().toISOString(), by: meRef.current } }));
        if (!pending.current.size) setSync("저장됨");
      }
    },
    [supabase, toast],
  );

  const flushAll = useCallback(() => {
    for (const key of [...pending.current.keys()]) {
      const i = key.indexOf("/");
      void flush(key.slice(0, i) as Col, key.slice(i + 1));
    }
  }, [flush]);

  const queue = useCallback(
    (col: Col, id: string, patch: Obj, delay = 450) => {
      const key = `${col}/${id}`;
      pending.current.set(key, deepMerge(pending.current.get(key) ?? {}, clone(patch)));
      clearTimeout(timers.current.get(key));
      timers.current.set(key, setTimeout(() => flush(col, id), delay));
      setSync("저장 중…");
    },
    [flush],
  );

  const write = useCallback(
    (col: Col, id: string, raw: Obj) => {
      const patch = normalize(raw);
      const L = ledgerRef.current;
      let next: Ledger;
      if (col === "settings") next = { ...L, settings: deepMerge(clone(L.settings) as Obj, clone(patch)) };
      else {
        const cur = (L[col] as Record<string, Obj>)[id];
        if (!cur) return;
        next = { ...L, [col]: { ...L[col], [id]: deepMerge(clone(cur), clone(patch)) } };
        if ("photo" in patch && isStoragePath(cur.photo) && cur.photo !== patch.photo) void supabase.storage.from("photos").remove([cur.photo]);
      }
      commit(next);
      queue(col, col === "settings" ? SETTINGS_ID : id, patch);
    },
    [commit, queue, supabase],
  );

  const setSettings = useCallback((patch: Obj) => write("settings", SETTINGS_ID, patch), [write]);

  const create = useCallback(
    (col: CollectionName, raw: Obj) => {
      const id = newId(col);
      const data = normalize(raw);
      const L = ledgerRef.current;
      commit({ ...L, [col]: { ...L[col], [id]: data } });
      queue(col, id, data, 0);
      return id;
    },
    [commit, queue],
  );

  const remove = useCallback(
    (col: CollectionName, id: string) => {
      const L = ledgerRef.current;
      const rest = { ...(L[col] as Record<string, Obj>) };
      const doc = rest[id];
      delete rest[id];
      commit({ ...L, [col]: rest });
      const key = `${col}/${id}`;
      const unsent = pending.current.get(key);
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      pending.current.delete(key);
      (async () => {
        await inflight.current.get(key);
        // 아직 안 보낸 수정까지 담아서 휴지통으로
        if (unsent) await supabase.rpc("patch_doc", { tbl: TABLE[col], doc_id: id, patch: unsent });
        const { error } = await supabase.rpc("trash_doc", { tbl: TABLE[col], doc_id: id });
        if (!error) return toast("삭제했어요 · 휴지통에서 30일 동안 되살릴 수 있어요");
        if (!missingFn(error)) return toast(`삭제하지 못했어요 (${error.message})`);
        // 마이그레이션 전 DB: 바로 삭제
        const files = [doc?.photo, ...(Array.isArray(doc?.photos) ? doc.photos : [])].filter(isStoragePath);
        if (files.length) void supabase.storage.from("photos").remove(files);
        const r = await supabase.from(TABLE[col]).delete().eq("id", id);
        if (r.error) toast(`삭제하지 못했어요 (${r.error.message})`);
      })();
    },
    [commit, supabase, toast],
  );

  const restore = useCallback(
    async (item: TrashItem) => {
      const { error } = await supabase.rpc("restore_doc", { trash_id: item.id });
      if (error) return toast(`되살리지 못했어요 (${error.message})`);
      const col = (Object.entries(TABLE).find(([, t]) => t === item.tbl)?.[0] ?? item.tbl) as CollectionName;
      const L = ledgerRef.current;
      commit({ ...L, [col]: { ...L[col], [item.doc_id]: item.data } });
      toast("되살렸어요");
    },
    [commit, supabase, toast],
  );

  const setUI = useCallback((fn: (u: UIState) => UIState) => {
    setUIState((u) => {
      const n = fn(u);
      try {
        localStorage.setItem("wl-ui", JSON.stringify(n));
      } catch {}
      return n;
    });
  }, []);

  // 저장 실패 후 5초 뒤 다시 시도
  useEffect(() => {
    if (retryTick) flushAll();
  }, [retryTick, flushAll]);

  // 앱을 닫거나 다른 앱으로 넘어갈 때 대기 중인 저장을 바로 보낸다 (요청은 keepalive라 페이지가 닫혀도 끝까지 간다)
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushAll();
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current.size) return;
      flushAll();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flushAll]);

  const s = useMemo(() => resolveSettings(ledger.settings), [ledger.settings]);
  const value = useMemo<Store>(
    () => ({ ledger, s, sync, write, setSettings, create, remove, restore, meta, me, needsMigration, ui, setUI, drawer, setDrawer, toast, supabase }),
    [ledger, s, sync, write, setSettings, create, remove, restore, meta, me, needsMigration, ui, setUI, drawer, toast, supabase],
  );

  if (status === "denied")
    return (
      <div className="wrap">
        <div className="panel empty-state">
          이 계정은 장부에 접근할 수 없어요. 허용된 이메일로 로그인했는지 확인해 주세요.
          <form action="/auth/signout" method="post" style={{ marginTop: 12 }}>
            <button className="btn small">다른 계정으로 로그인</button>
          </form>
        </div>
      </div>
    );

  return (
    <Ctx.Provider value={value}>
      {status === "loading" ? (
        <div className="wrap loading">불러오는 중…</div>
      ) : status === "error" ? (
        <div className="wrap">
          <p className="note">{sync}</p>
        </div>
      ) : (
        children
      )}
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="status">
          {t.msg}
        </div>
      ))}
    </Ctx.Provider>
  );
}
