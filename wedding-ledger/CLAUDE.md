# J & D 결혼 준비 장부 — 프로젝트 가이드

이 저장소는 claude.ai 아티팩트(단일 HTML + 아티팩트 DB)로 만든 결혼 준비 앱을
정식 웹앱으로 옮기는 프로젝트다. 사용자는 두 명(J, D)이고, 둘 다 로그인해서
같은 데이터를 함께 편집한다. 응답·UI 문구는 한국어.

## 폴더 구조 (이관 패키지)

| 경로 | 내용 |
|---|---|
| `legacy/wedding-ledger.html` | 현재 동작하는 원본 앱. **모든 화면·계산 로직의 기준(source of truth)**. 기능이 애매하면 여기 코드를 읽고 그대로 재현할 것 |
| `seed/*.json` | 아티팩트 DB 전체 내보내기. 컬렉션별 `{docId: document}` |
| `private/settings.json` | 자금·소득·대출 설정. **민감정보 — git에 커밋 금지** (`.gitignore`에 포함) |
| `source/` | 원본 드레스 견적 엑셀 3개 + 파싱 스크립트 (`parse_dress_quotes.py`) |

## 기술 스택 (권장)

- **Next.js (App Router) + TypeScript + Tailwind**
- **Supabase**: Postgres + Auth(이메일 매직링크) + Storage(사진) + Row Level Security
- **Vercel** 배포 (사용자 계정 연결돼 있음)
- 엑셀 내보내기: SheetJS (`xlsx`)
- 차트: 가벼운 SVG 직접 구현 또는 Recharts

다른 선택을 하려면 먼저 이유를 설명하고 확인받을 것.

## 보안 원칙 (필수)

- 사용자는 J, D 두 명뿐. Supabase RLS로 **허용된 두 이메일만 읽기/쓰기** 가능하게 한다. 허용 이메일은 환경변수 `ALLOWED_EMAILS`로 관리.
- `private/`, `.env*` 는 절대 커밋하지 않는다. 서비스 키는 서버에서만 사용.
- 비로그인 상태에서는 어떤 데이터도 보이지 않아야 한다 (공개 링크 없음).
- 공공데이터 API 키(`DATA_GO_KR_KEY`)는 서버 라우트에서만 사용.

## 데이터 모델

아티팩트 DB의 문서 구조를 그대로 가져온다. 테이블은 컬렉션 단위로 만들고,
자주 필터·정렬하는 필드만 컬럼으로 빼고 나머지는 `jsonb`로 둬도 된다.
금액은 전부 **원 단위 정수**(UI에서만 만원/억 표기).

| 컬렉션 | 건수 | 핵심 필드 |
|---|---|---|
| `planners` | 6 | name, kind(동행/비동행/앱), manager, phone, features, benefits, fee, scores{resp,price,lineup,trans,care}, status, memo |
| `vendors` | 8 | cat(studio/dress/makeup/snap/etc), name, planner, location, features, price(견적가), listPrice(정가), listNote, quoteDelta(플래너 견적 대비 추가금), priceNote, extraFees, insta, blog, scores, status, photo, memo |
| `quotes` | 1 | 제이웨딩 계약: items[{cat,vendor,product,list,sale,count}], contractTotal, deposit, balance, options{studio,dress,makeup:[{name,delta}]}, selected{studio,dress,makeup:index}, notes |
| `extras` | 15 | 계약서 밖 추가비용: name, range, cat, amount, include(bool), order |
| `halls` | 193 | name, zone(권역), gu, dong, type, mealMin, mealMax, rental, rentalNote, minGuests, maxGuests, times, interval, flowerFee, productionFee, snapFee, otherOptions, includes, station, walk, parking, split, exclusive, address, phone, homepage, insta, naverPlace, tags[], mood[], plannerQuote{src,cat}, scores{loc,mood,food,price,park,flow}, status, source, memo |
| `priceLists` | 3 | 플래너별 드레스 가격표: planner, asOf, unitNote, rows[{shop,key,main,mainMax,combo,comboMax,helper,design,firstWear,extraDress,fitting,refit,penalty,extras,notes}] |
| `budget` | 38 | group, name, link(''/hall/sdm/sdmExtras/houseCosts), status, amount, cap(상한선), payer(공동/J/D/J 부모님/D 부모님), memo, order, subs[{name,amount,cap}], meta{destination,nights} |
| `homes` | 0 | 임장 후보: name, kind(매매/전세), gu, dong, area, price(호가), kb, recent, jeonse, units, year, station, walk, school, visit, agent, link, scores{transit,life,school,complex,light,noise,future}, checks{key:bool}, status, memo, photo |
| `dresses` | 0 | 드레스 보드: photo, shop, silhouette, use, rating(0~5), memo |
| `settings` | 1행 | guests, mainHall, mainQuote, weddingDate, target, giftIncome, fin{…}, house{…}, loanSim{…} |

`scores` 값은 1~5 정수 또는 null. 평균은 채워진 항목만으로 계산.

## 화면 (탭)

legacy HTML의 탭 구성을 그대로 유지한다. 모바일(390px)에서도 쓸 수 있어야 한다.

1. **요약** — 이니셜 헤더 `J & D` + D-day, 결혼식 비용 예상 vs 목표(프로그레스), 확정/지불완료, 축의금 차감 실부담, 그룹별 막대, 기준 웨딩홀/스드메/신혼집 카드, 상한선 미설정 항목 경고, 부담 주체별 합계, 카테고리별 점수 상위 3
2. **전체 예산** — 그룹별 표. 금액·상한선은 만원 입력. `link` 항목은 자동 계산(아래). 세부 항목(subs) 펼치기/추가/삭제. 신혼여행은 여행지·일정 meta
3. **플래너·견적** — 플래너 표(점수 드롭다운) + 계약 견적표 + 라인업 시뮬레이터 + 추가비용 체크리스트
4. **스튜디오 / 드레스 / 메이크업** — 업체 표(사진, 정가, 견적 대비, 점수, 상태, 링크)
5. **드레스 견적 비교** — priceLists를 샵 key로 합친 비교표. 우리 후보 샵은 상단 별도 표. 샵별 최저가 강조. 행 클릭 시 플래너별 상세(위약금 포함)
6. **웨딩홀** — 필터(권역/구/유형/상태/플래너 추천/식대 상한), 기준 홀 라디오, 예상 총액, 점수
7. **드레스 보드** — 사진 여러 장 업로드, 하트 평점, 샵·실루엣·용도·메모
8. **신혼집·임장** — 자금, 소득, 전세/매매 모드, 대출 이자 시뮬레이터, 임장 후보표 + 체크리스트

## 계산 로직 (legacy 코드와 결과가 같아야 함)

- **웨딩홀 예상액** = 평균식대 × max(하객수, 최소보증) + 대관료 + 꽃장식 + 연출 + 스냅
- **스드메 총액** = 견적 items 중 `count !== false`인 sale 합 + 선택된 옵션 delta 합
- **예산 반영액**: subs 있으면 각 sub의 (amount ?? cap ?? 0) 합(아무것도 없으면 부모 cap), link면 자동값 ?? cap, 아니면 amount ?? cap ?? 0
- **결혼식 비용** = `신혼집·살림` 그룹 제외 합계. **신혼집 세팅** = 그 그룹에서 houseCosts 제외
- **집에 쓸 수 있는 돈** = 자산 합 − (옵션)결혼식 실부담(비용−축의금) − (옵션)세팅비
- **매매 대출한도** = min(LTV, 가격별 한도, DSR 한도)
  - LTV: 생애최초 70%, 규제지역 40%, 비규제 70%
  - 규제지역 가격별 한도: ≤15억 6억 / ≤25억 4억 / 초과 2억
  - DSR 한도: (연소득 × DSR% − 기존 연상환) / 12 ÷ 원리금균등 계수(금리 + 스트레스 가산, 기간)
- **취득세**(1주택 추정): ≤6억 1%, 6~9억 (억×2/3−3)%, >9억 3%, 지방교육세 ×0.1, 85㎡ 초과 농특세 0.2%, 생애최초 ≤12억 200만 원 감면
- **중개보수**: 매매 <9억 0.4%, 9~12억 0.5%, 12~15억 0.6%, 15억+ 0.7% / 임대 <6억 0.3%, 6~12억 0.4%, 12~15억 0.5%, 15억+ 0.6% (저가 구간 상한은 legacy 참조)
- **전세대출 상품 자격**
  - 서울시 신혼부부 임차보증금 이자지원: 보증금 ≤7억, 부부합산 ≤1.3억, 한도 min(3억, 보증금 90%), 금리 = 협약금리 − (소득구간 지원 3.0/2.5/2.0/1.5/1.0%p + 예비신혼 0.2%p)
  - 신혼부부 버팀목: 수도권 보증금 ≤4억, 소득 ≤7,500만, 한도 min(3억, 80%)
  - 시중은행(HF): 한도 min(설정값, 80%)
  - 선택 상품이 불가하면 가능한 상품으로 자동 전환
- **최대 매수 가능가**: 필요현금 ≤ 가용자금이 되는 최대 가격을 이분탐색
- **상환 스케줄**: 원리금균등 / 원금균등 / 만기일시, 거치기간 지원. 연말 잔액 배열, 금리 ±1.5%p 민감도 표

규제 수치는 **2026년 9월 기준 추정**이다. `lib/rules.ts` 같은 한 파일에 상수로 모으고,
기준일과 출처 메모를 주석으로 남겨 나중에 쉽게 갱신할 수 있게 한다.

## 신규 기능 로드맵

### P0 — 이식 (먼저)
- Next.js + Supabase 세팅, 스키마 생성, `scripts/import-seed.ts`로 `seed/*.json` + `private/settings.json` 적재
- legacy 기능을 탭별로 이식. 각 탭 완료 시 legacy와 같은 입력으로 숫자가 같은지 확인
- 사진은 Supabase Storage에 업로드 (legacy의 `/_blob/` 사진은 이관 대상 없음)

### P1 — 로그인·공유
- 매직링크 로그인, `ALLOWED_EMAILS` 2개만 허용, RLS 적용
- Supabase Realtime으로 두 사람 동시 편집 반영
- 엑셀 내보내기(시트: 전체예산, 플래너, 스드메견적, 추가비용, 스튜디오, 드레스, 메이크업, 드레스정가, 웨딩홀, 신혼집후보, 드레스보드)

### P2 — 실거래가 연동
- 공공데이터포털(data.go.kr) 국토교통부 **아파트 매매 실거래가 상세**, **아파트 전월세 실거래가** OpenAPI 사용
  - 요청 파라미터: 법정동코드 앞 5자리(LAWD_CD), 계약년월(DEAL_YMD)
  - 엔드포인트 경로·응답 포맷은 포털 최신 문서에서 확인 후 구현 (추측으로 짜지 말 것)
- `homes`에 단지명+법정동코드를 저장하고, 서버 라우트가 최근 3~6개월 거래를 가져와 전용면적별 최근가·평균가 표시
- 하루 1회 캐시 (Vercel Cron 또는 on-demand revalidate)
- **KB부동산은 공식 공개 API가 없음 → 스크래핑하지 말고** KB시세는 수동 입력 + 외부 링크 유지

### P3 — 모바일
- PWA(홈 화면 추가), 임장 현장에서 사진 촬영 → 바로 업로드, 체크리스트 한 손 조작

## 작업 방식

- 큰 변경 전에 계획을 짧게 보여주고 진행
- 계산 로직은 순수 함수로 분리하고 단위 테스트(Vitest) 작성. legacy 값과 비교하는 테스트 포함
- 커밋은 기능 단위로 작게
- UI 문구는 짧고 구체적으로, 한국어

## 이 폴더 메모

- 앱 루트는 저장소의 `wedding-ledger/` 하위 폴더다 (저장소 루트에는 기존 폰트 파일이 있음). Vercel Root Directory도 `wedding-ledger`로 둔다.
- 계산 로직: `lib/calc/*`, 규제 상수: `lib/rules.ts`. legacy 동등성 테스트는 `lib/__tests__/legacy-parity.test.ts`가 legacy HTML의 스크립트를 직접 실행해 비교한다.

@AGENTS.md
