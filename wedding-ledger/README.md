# J & D 결혼 준비 장부

claude.ai 아티팩트 앱(`legacy/wedding-ledger.html`)을 Next.js + Supabase로 옮기는 프로젝트. 작업 규칙은 `CLAUDE.md`.

## 처음 세팅

```bash
cd wedding-ledger
npm install
cp .env.example .env.local   # Supabase URL / anon key / service role key 채우기
```

1. **스키마**: Supabase 대시보드 → SQL Editor에 `supabase/migrations/0001_init.sql`, `0002_sync_trash_features.sql`을 차례로 붙여넣고 실행 (여러 번 실행해도 안전)
   - 0002: 부분 저장(`patch_doc`), 휴지통, 수정자 기록, 백업 버킷, 하객·축의금·지불·체크리스트 테이블
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
| `npm run lint` | ESLint (PR마다 GitHub Actions가 lint·typecheck·test·build 실행) |

## 구조

| 경로 | 내용 |
|---|---|
| `lib/rules.ts` | 대출·세금·중개보수 규제 상수 (2026-09 기준 추정, 출처 메모 포함) |
| `lib/calc/` | 예산·웨딩홀·스드메·자금·대출·상환 순수 함수 |
| `lib/db.ts` | 테이블 행 ↔ 계산용 `Ledger` 변환 |
| `supabase/migrations/` | 스키마 + RLS + Storage 버킷 |
| `scripts/import-seed.ts` | seed 적재 |
| `components/store.tsx` | 전체 로드 → 낙관적 업데이트 → 바뀐 필드만 450ms 디바운스 저장(`patch_doc`) → 실시간 반영. 삭제는 휴지통(30일) |
| `components/tabs/` | legacy 탭 10개 + 일정(지불·체크리스트·캘린더), 하객·축의금 |
| `app/api/backup` | 매일 자동 백업 (Vercel Cron, `vercel.json`) |
| `app/api/realestate` | 국토부 실거래가 (전용면적별 요약 + 월별 추이) |
| `proxy.ts`, `app/login`, `app/auth/*` | 매직링크 로그인, 비로그인 시 /login |

## 로그인 설정 (Supabase 대시보드)

- Authentication → URL Configuration: **Site URL**을 배포 주소로, **Redirect URLs**에 `http://localhost:3000/auth/callback`과 `https://<배포 주소>/auth/callback` 추가
- 새 가입 막기 권장 (로그인 화면은 `shouldCreateUser: false`)
- 접근 허용은 `allowed_emails` 테이블 (Authentication 사용자 목록만으로는 데이터가 안 보임)

## 매일 자동 백업 (Vercel)

Vercel 프로젝트 → Settings → Environment Variables에 아래 두 개를 **Production**으로 추가하고 재배포하면 매일 새벽 3시(한국)에 Supabase Storage `backups` 버킷에 JSON이 쌓인다 (최근 30개 보관).

| 이름 | 값 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys의 service_role 키 (서버 전용, `NEXT_PUBLIC_` 붙이지 말 것) |
| `CRON_SECRET` | 아무 긴 랜덤 문자열 (예: 비밀번호 생성기 40자) — Vercel Cron이 자동으로 `Authorization: Bearer`에 실어 보낸다 |

백업 파일 받기: Supabase → Storage → `backups` → 날짜 파일 다운로드. 앱의 휴지통 화면에서도 지금 상태를 JSON으로 받을 수 있다.

## 보안

- 모든 테이블 RLS: `allowed_emails`에 있는 이메일로 로그인한 사용자만 읽기/쓰기. 목록이 비어 있으면 아무도 못 봄.
- `seed/`, `private/`, `.env*`는 커밋 금지 (`.gitignore`). 이 저장소는 공개 저장소다.
