# J & D 결혼 준비 장부

claude.ai 아티팩트 앱(`legacy/wedding-ledger.html`)을 Next.js + Supabase로 옮기는 프로젝트. 작업 규칙은 `CLAUDE.md`.

## 처음 세팅

```bash
cd wedding-ledger
npm install
cp .env.example .env.local   # Supabase URL / anon key / service role key 채우기
```

1. **스키마**: Supabase 대시보드 → SQL Editor에 `supabase/migrations/0001_init.sql` 붙여넣고 실행 (여러 번 실행해도 안전)
2. **이관 데이터 배치** (git에 안 올라감)
   - `seed/*.json` — 아티팩트 DB 내보내기 (`_empty_collections.json` 포함)
   - `private/settings.json` — 자금·소득 설정
3. **적재**
   ```bash
   npm run import-seed -- --dry-run   # 건수만 확인
   npm run import-seed                # upsert
   npm run import-seed -- --replace   # DB를 seed와 똑같이 (seed에 없는 행 삭제)
   ```
   프록시 뒤(Claude Code 클라우드 세션 등)에서는 `NODE_USE_ENV_PROXY=1 npm run import-seed` — Node 내장 fetch는 `HTTPS_PROXY`를 기본으로 읽지 않는다.

## 명령어

| 명령 | 내용 |
|---|---|
| `npm test` | 계산 로직 + legacy 동등성 테스트 (legacy HTML 스크립트를 직접 실행해 비교) |
| `npm run typecheck` | 타입 검사 |
| `npm run dev` | 개발 서버 |

## 구조

| 경로 | 내용 |
|---|---|
| `lib/rules.ts` | 대출·세금·중개보수 규제 상수 (2026-09 기준 추정, 출처 메모 포함) |
| `lib/calc/` | 예산·웨딩홀·스드메·자금·대출·상환 순수 함수 |
| `lib/db.ts` | 테이블 행 ↔ 계산용 `Ledger` 변환 |
| `supabase/migrations/` | 스키마 + RLS + Storage 버킷 |
| `scripts/import-seed.ts` | seed 적재 |

## 보안

- 모든 테이블 RLS: `allowed_emails`에 있는 이메일로 로그인한 사용자만 읽기/쓰기. 목록이 비어 있으면 아무도 못 봄.
- `seed/`, `private/`, `.env*`는 커밋 금지 (`.gitignore`). 이 저장소는 공개 저장소다.
