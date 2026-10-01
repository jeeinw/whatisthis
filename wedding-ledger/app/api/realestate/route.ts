import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchesApt, parseRtmsXml, recentMonths, rtmsUrl, summarize, toRent, toTrade, type Rent, type Trade } from "@/lib/realestate";

/**
 * GET /api/realestate?lawd=11650&apt=래미안퍼스티지&dong=반포동&months=6
 * 국토부 매매·전월세 실거래가를 가져와 단지명으로 걸러 전용면적별로 집계한다.
 * - 허용된 로그인 사용자만 (공공데이터 키 남용 방지)
 * - DATA_GO_KR_KEY 는 서버에서만 사용
 * - 월별 원본 응답은 하루 캐시 (Next data cache, revalidate 86400)
 */
const DAY = 86400;
const PAGE = 1000;
const MAX_PAGES = 10;

async function fetchMonth(kind: "trade" | "rent", key: string, lawd: string, ymd: string) {
  const items: Record<string, string>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(rtmsUrl(kind, key, lawd, ymd, page, PAGE), { next: { revalidate: DAY } });
    const xml = await res.text();
    const p = parseRtmsXml(xml);
    if (!res.ok || !p.ok) throw new Error(`${kind} ${ymd}: ${p.msg || `HTTP ${res.status}`}`);
    items.push(...p.items);
    if (items.length >= p.totalCount || p.items.length < PAGE) break;
  }
  return items;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_allowed");
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return NextResponse.json({ error: "no_key", message: "서버에 DATA_GO_KR_KEY 가 없어요" }, { status: 503 });

  const sp = request.nextUrl.searchParams;
  const lawd = sp.get("lawd") ?? "";
  const apt = (sp.get("apt") ?? "").trim();
  const dong = (sp.get("dong") ?? "").trim() || undefined;
  const months = Math.min(12, Math.max(1, Number(sp.get("months")) || 6));
  if (!/^\d{5}$/.test(lawd) || !apt) return NextResponse.json({ error: "bad_request", message: "법정동코드 5자리와 단지명이 필요해요" }, { status: 400 });

  try {
    const yms = recentMonths(months);
    const [tradeRaw, rentRaw] = await Promise.all([
      Promise.all(yms.map((m) => fetchMonth("trade", key, lawd, m))).then((x) => x.flat()),
      Promise.all(yms.map((m) => fetchMonth("rent", key, lawd, m))).then((x) => x.flat()),
    ]);
    const trades = tradeRaw.map(toTrade).filter((t): t is Trade => !!t && matchesApt(t.apt, apt, t.dong, dong));
    const rents = rentRaw.map(toRent).filter((r): r is Rent => !!r && matchesApt(r.apt, apt, r.dong, dong));
    const names = [...new Set([...trades.map((t) => t.apt), ...rents.map((r) => r.apt)])];
    const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1);
    return NextResponse.json({
      lawd,
      apt,
      months: yms,
      matchedNames: names,
      stats: summarize(trades, rents),
      trades: trades.sort(byDate).slice(0, 100),
      rents: rents.sort(byDate).slice(0, 100),
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api/realestate]", (e as Error).message);
    return NextResponse.json({ error: "upstream", message: (e as Error).message }, { status: 502 });
  }
}
