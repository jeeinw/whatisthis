"use client";
// 장부 데이터 스토어: 전체 로드 → 낙관적 업데이트 → 문서별 450ms 디바운스 저장 (legacy write/flush와 같은 흐름).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowsToLedger, SETTINGS_ID, TABLE, type Row } from "@/lib/db";
import { clone, deepMerge, resolveSettings } from "@/lib/settings";
import { COLLECTIONS, type CollectionName, type Ledger, type Settings } from "@/lib/types";

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

export type Drawer = { col: "planners" | "vendors" | "halls" | "homes"; id: string } | { col: "dprice"; key: string } | null;

interface Store {
  ledger: Ledger;
  s: Settings;
  sync: string;
  write: (col: Col, id: string, patch: Obj) => void;
  setSettings: (patch: Obj) => void;
  create: (col: CollectionName, data: Obj) => string;
  remove: (col: CollectionName, id: string) => void;
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
  return { planners: {}, vendors: {}, quotes: {}, extras: {}, halls: {}, dresses: {}, budget: {}, homes: {}, priceLists: {}, settings: {} };
}

/** Storage에 올린 사진 경로인지 (legacy data URL·빈 값 제외) */
const isStoragePath = (p: unknown): p is string => typeof p === "string" && p !== "" && !p.startsWith("data:");

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
          const { data, error } = await supabase.from(TABLE[c]).select("id,data");
          if (error) throw error;
          return [c, data as Row[]] as const;
        }),
      ).catch((e: Error) => {
        if (!cancelled) {
          setStatus("error");
          setSync(`불러오지 못했어요 (${e.message})`);
        }
        return null;
      });
      if (!results || cancelled) return;
      for (const [c, r] of results) rows[c] = r;
      commit(rowsToLedger(rows));
      setStatus("ready");
      setSync("저장됨");
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
        const row = payload.new as Row;
        // 이 문서에 아직 저장 안 된 내 수정이 있으면 내 것을 유지 (곧 저장되면서 덮어씀)
        if (timers.current.has(`${col}/${row.id}`)) return;
        if (col === "settings") {
          if (row.id === SETTINGS_ID && JSON.stringify(L.settings) !== JSON.stringify(row.data)) commit({ ...L, settings: row.data });
          return;
        }
        const cur = (L[col] as Record<string, Obj>)[row.id];
        if (cur && JSON.stringify(cur) === JSON.stringify(row.data)) return; // 내 저장의 메아리
        commit({ ...L, [col]: { ...L[col], [row.id]: row.data } });
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
      timers.current.delete(`${col}/${id}`);
      const L = ledgerRef.current;
      const data = col === "settings" ? L.settings : (L[col] as Record<string, Obj>)[id];
      if (!data) return;
      const { error } = await supabase.from(TABLE[col]).upsert({ id: col === "settings" ? SETTINGS_ID : id, data });
      if (error) {
        toast(`저장하지 못했어요 (${error.message})`);
        setSync("저장 실패");
      } else if (!timers.current.size) setSync("저장됨");
    },
    [supabase, toast],
  );

  const schedule = useCallback(
    (col: Col, id: string) => {
      const key = `${col}/${id}`;
      clearTimeout(timers.current.get(key));
      timers.current.set(key, setTimeout(() => flush(col, id), 450));
      setSync("저장 중…");
    },
    [flush],
  );

  const write = useCallback(
    (col: Col, id: string, patch: Obj) => {
      const L = ledgerRef.current;
      let next: Ledger;
      if (col === "settings") next = { ...L, settings: deepMerge(clone(L.settings) as Obj, patch) };
      else {
        const cur = (L[col] as Record<string, Obj>)[id];
        if (!cur) return;
        next = { ...L, [col]: { ...L[col], [id]: deepMerge(clone(cur), patch) } };
        if ("photo" in patch && isStoragePath(cur.photo) && cur.photo !== patch.photo) void supabase.storage.from("photos").remove([cur.photo]);
      }
      commit(next);
      schedule(col, col === "settings" ? SETTINGS_ID : id);
    },
    [commit, schedule, supabase],
  );

  const setSettings = useCallback((patch: Obj) => write("settings", SETTINGS_ID, patch), [write]);

  const create = useCallback(
    (col: CollectionName, data: Obj) => {
      const id = newId(col);
      const L = ledgerRef.current;
      commit({ ...L, [col]: { ...L[col], [id]: data } });
      supabase
        .from(TABLE[col])
        .insert({ id, data })
        .then(({ error }) => (error ? toast(`추가하지 못했어요 (${error.message})`) : setSync("저장됨")));
      return id;
    },
    [commit, supabase, toast],
  );

  const remove = useCallback(
    (col: CollectionName, id: string) => {
      const L = ledgerRef.current;
      const rest = { ...(L[col] as Record<string, Obj>) };
      const photo = rest[id]?.photo;
      delete rest[id];
      commit({ ...L, [col]: rest });
      if (isStoragePath(photo)) void supabase.storage.from("photos").remove([photo]);
      clearTimeout(timers.current.get(`${col}/${id}`));
      timers.current.delete(`${col}/${id}`);
      supabase
        .from(TABLE[col])
        .delete()
        .eq("id", id)
        .then(({ error }) => error && toast(`삭제하지 못했어요 (${error.message})`));
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

  // 떠나기 전에 대기 중인 저장 밀어내기
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (timers.current.size) {
        timers.current.forEach((_t, key) => {
          const i = key.indexOf("/");
          void flush(key.slice(0, i) as Col, key.slice(i + 1));
        });
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [flush]);

  const s = useMemo(() => resolveSettings(ledger.settings), [ledger.settings]);
  const value = useMemo<Store>(
    () => ({ ledger, s, sync, write, setSettings, create, remove, ui, setUI, drawer, setDrawer, toast, supabase }),
    [ledger, s, sync, write, setSettings, create, remove, ui, setUI, drawer, toast, supabase],
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
