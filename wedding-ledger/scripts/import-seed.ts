/**
 * seed/*.json + private/settings.json 을 Supabase에 적재한다.
 *
 *   npm run import-seed -- --dry-run          # DB 연결 없이 건수·경고만 확인
 *   npm run import-seed                        # upsert (여러 번 실행해도 결과 동일)
 *   npm run import-seed -- --replace           # 적재 전에 seed에 없는 행 삭제 (DB를 seed와 똑같이)
 *
 * 필요한 환경변수 (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ALLOWED_EMAILS 가 있으면 allowed_emails 테이블도 그 목록으로 맞춘다.
 * service role 키는 RLS를 우회하므로 이 스크립트(로컬)에서만 쓴다.
 */
import { config } from "dotenv";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildSeedPlan } from "./seed-data";

const ROOT = join(__dirname, "..");
config({ path: join(ROOT, ".env.local"), quiet: true });

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");
const CHUNK = 200;

function parseEmails(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const plan = buildSeedPlan(ROOT);
  for (const t of plan.tables) console.log(`  ${t.table.padEnd(12)} ${String(t.rows.length).padStart(4)}건`);
  for (const w of plan.warnings) console.warn(`  ! ${w}`);
  if (dryRun) {
    console.log("dry-run: DB에는 쓰지 않았어요.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const t of plan.tables) {
    if (replace) {
      const keep = new Set(t.rows.map((r) => r.id));
      const { data, error } = await db.from(t.table).select("id");
      if (error) throw new Error(`${t.table} 조회 실패: ${error.message}`);
      const stale = (data ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
      if (stale.length) {
        const { error: e2 } = await db.from(t.table).delete().in("id", stale);
        if (e2) throw new Error(`${t.table} 삭제 실패: ${e2.message}`);
        console.log(`  ${t.table}: seed에 없는 ${stale.length}건 삭제`);
      }
    }
    for (let i = 0; i < t.rows.length; i += CHUNK) {
      const { error } = await db.from(t.table).upsert(t.rows.slice(i, i + CHUNK), { onConflict: "id" });
      if (error) throw new Error(`${t.table} 적재 실패: ${error.message}`);
    }
    const { count, error } = await db.from(t.table).select("id", { count: "exact", head: true });
    if (error) throw new Error(`${t.table} 건수 확인 실패: ${error.message}`);
    const ok = replace ? count === t.rows.length : (count ?? 0) >= t.rows.length;
    console.log(`  ${ok ? "✓" : "✗"} ${t.table}: DB ${count}건`);
    if (!ok) process.exitCode = 1;
  }

  const emails = parseEmails(process.env.ALLOWED_EMAILS);
  if (emails.length) {
    const { error } = await db.from("allowed_emails").upsert(emails.map((email) => ({ email })), { onConflict: "email" });
    if (error) throw new Error(`allowed_emails 적재 실패: ${error.message}`);
    const { error: e2 } = await db.from("allowed_emails").delete().not("email", "in", `(${emails.map((e) => `"${e}"`).join(",")})`);
    if (e2) throw new Error(`allowed_emails 정리 실패: ${e2.message}`);
    console.log(`  ✓ allowed_emails: ${emails.length}개`);
  } else {
    console.log("  ALLOWED_EMAILS 가 비어 있어 접근 허용 목록은 건드리지 않았어요 (P1에서 설정).");
  }
}

main().catch((e) => {
  console.error(`실패: ${(e as Error).message}`);
  process.exit(1);
});
