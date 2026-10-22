import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TABLE } from "@/lib/db";

/**
 * GET /api/backup — Vercel Cron이 매일 호출 (vercel.json).
 * 전체 테이블 + 휴지통을 JSON 한 파일로 비공개 버킷 `backups`에 저장하고, 30개 넘게 쌓이면 오래된 것부터 지운다.
 * - Authorization: Bearer ${CRON_SECRET} 이 맞을 때만 (Vercel Cron이 자동으로 붙임)
 * - SUPABASE_SERVICE_ROLE_KEY 는 이 서버 라우트에서만 사용
 */
const KEEP = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "no_service_key" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const tables: Record<string, unknown[]> = {};
  for (const t of [...new Set([...Object.values(TABLE), "trash"])]) {
    const { data, error } = await db.from(t).select("*");
    if (error) return NextResponse.json({ error: `${t}: ${error.message}` }, { status: 500 });
    tables[t] = data;
  }
  const now = new Date();
  const name = `${now.toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({ createdAt: now.toISOString(), tables });
  const up = await db.storage.from("backups").upload(name, body, { contentType: "application/json", upsert: true });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // 오래된 백업 정리
  const { data: files } = await db.storage.from("backups").list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
  const old = (files ?? []).filter((f) => f.name.endsWith(".json")).slice(KEEP).map((f) => f.name);
  if (old.length) await db.storage.from("backups").remove(old);

  return NextResponse.json({ ok: true, file: name, bytes: body.length, rows: Object.fromEntries(Object.entries(tables).map(([t, r]) => [t, r.length])), removed: old.length });
}
