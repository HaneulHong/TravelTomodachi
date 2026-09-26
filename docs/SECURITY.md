# 보안 점검

마지막 점검: **2026-09-26**

## 테스트 돌리기

| 명령 | 무엇을 | 데이터 |
|---|---|---|
| `npm run test:rls` | 사용자 A(소유자)·B(멤버)·C(남)·익명으로 **권한 시나리오 64개** — 남의 여행 읽기·쓰기, 소유권 탈취, 사칭, 초대 코드 | 로컬 일회용 DB (운영 DB 안 건드림) |
| `npm run test:live` | 운영 서비스를 **밖에서** — 로그인 없이 읽기·쓰기·함수 호출, 로그인 방식, 배포 사이트 헤더·민감 파일·번들 속 비밀 키 | 읽기만 (쓰기 시도는 막혀야 정상) |

- `test:rls`는 PostgreSQL 16이 필요하다 (`brew install postgresql@16`). Supabase 흉내
  (`scripts/security/supabase-shim.sql`)를 깔고 `supabase/*.sql`을 **운영과 같은 순서**로 적용한 뒤
  `scripts/security/rls.test.sql`을 돌린다. `SKIP_HARDENING=1`이면 덧붙이기 SQL 없이 새 DB용 파일만.
- **SQL을 고치면 `npm run test:rls`를 돌린다.** 새 SQL 파일을 만들면 `run-rls-test.sh`의 FILES에 더한다.
- 새 테이블을 만들면 `rls.test.sql`에 C(남)가 못 보고 못 쓰는지, B(멤버)가 남의 이름으로 못 쓰는지를 더한다.

## 2026-09-25 점검 결과

### 막혀 있는 것 (확인함)
- 로그인 안 한 요청: 모든 테이블 읽기·쓰기, 초대 코드 참가·재발급
- **여행 멤버가 아닌 사람**: 남의 여행·날짜·일정·체크리스트·가계부·후보·투표·댓글을
  보기·넣기·고치기·지우기 전부. 남의 멤버 내보내기, 남의 여행 초대 코드 바꾸기
- **초대받은 멤버**: 소유자 바꾸기(여행 빼앗기), 초대 코드 직접 바꾸기·재발급, 여행 지우기,
  소유자 내보내기, 자기를 owner로, 남을 멤버로 넣기, 일정을 모르는 여행으로 옮기기
- 사칭: 남의 이름으로 댓글·투표·프로필, 남의 댓글·표 지우기, 일정·지출의 "고친 사람" 속이기
  (DB가 실제 로그인한 사람으로 기록), 자기 번호(#1234) 고르기, 남의 닉네임 바꾸기
- 소유자가 자기 자신을 내보내기(주인 없는 여행)
- 옛 초대 코드로 참가 (코드를 바꾸면 막힌다)
- 실시간: 삭제 이벤트에 지워진 행의 **내용**이 실리지 않는다(id만) — replica identity 기본값
- 배포 사이트: `.env`·`.git`·SQL 파일 노출 없음, 번들에 비밀 키(Supabase secret·service_role,
  Google OAuth 시크릿) 없음

### 찾아서 고친 것 — `supabase/security-hardening.sql`
| # | 문제 | 위험 | 고침 |
|---|---|---|---|
| 1 | 로그인한 누구나 **모든 사용자**의 id·닉네임·번호를 볼 수 있음 | 중 — 사용자 목록 수집, 2번과 겹치면 모르는 사람을 겨냥 | 자기 것과 같은 여행 멤버 것만 (`shares_trip_with`) |
| 2 | 여행 소유자가 **동의 없이 아무나** 자기 여행 멤버로 넣을 수 있음 | 중 — 스팸 여행을 남의 목록에 띄움 | 직접 넣기 정책 삭제. 멤버는 초대 코드로만 |
| 3 | 후보 장소의 "올린 사람"을 **다른 사람으로 속일 수** 있음(넣을 때·고칠 때) | 하 — 기록 조작 | 트리거가 로그인한 사람으로 기록, 고칠 때 그대로 |
| 4 | 로그인 없이 내부 함수(`is_trip_member` 등) 호출 가능 | 하 — 새는 정보는 없음 | anon 실행 권한 회수 |

### 찾아서 고친 것 — 코드
| # | 문제 | 위험 | 고침 |
|---|---|---|---|
| 5 | 다른 사이트가 이 앱을 **iframe에 넣을 수** 있음 (클릭재킹) | 중 — 투명한 창 위 가짜 버튼으로 "여행 삭제" 등을 누르게 함 | `public/_headers`: X-Frame-Options DENY, frame-ancestors 'none' |
| 6 | React Router 6 — 열린 리다이렉트 취약점 (중간) | 하 — 이 앱은 사용자 입력 주소로 이동하지 않음 | 7.18.4로 (화면 이동 전부 확인) |

### 글자 수·개수 상한 — `supabase/limits.sql` (2026-09-26)
- 길이 제한이 없던 칸 9개(메모 2,000자, 장소 200자, 편명 40자, 도시 30자 등)와 나눠 낼 사람 수(100명)
- 한 여행에 넣을 수 있는 개수: 일정 3,000 · 지출 3,000 · 댓글 5,000 · 체크리스트 500 · 후보 500 ·
  날짜 400 · 멤버 100, 한 사람이 만들 수 있는 여행 200
- 앱 입력칸도 같은 숫자(`src/domain/limits.ts`) — 저장 뒤에 서버 오류로 알게 되지 않게

### 사용자가 할 것 — 대시보드 설정

**① Supabase 이메일 가입 끄기** — 앱은 Google만 쓴다. 열려 있으면 누구나 API로 이메일 계정을
만들 수 있다(봇 가입), 무료 메일 한도도 소진될 수 있다.
Supabase → Authentication → Sign In / Providers → **Email → 끄기(Enable 해제)** → Save.
확인: `npm run test:live`의 "이메일 가입 꺼짐"

**② Google 지도 키 — 과금 안전장치** ("유료는 쓰지 않는다")
- Google Cloud Console → API 및 서비스 → **Maps JavaScript API → 할당량 및 시스템 한도** →
  "Map loads per day"(하루 지도 로드)를 **300** 정도로. 무료 한도(월 1만)를 하루로 나눈 값이다.
  넘으면 그날은 지도가 간략 지도로 내려간다(앱은 그대로 동작)
- 결제 → **예산 및 알림** → 예산 1,000원, 알림 50%·90%·100%
- 사용자 인증 정보 → 이 키 → **애플리케이션 제한사항: 웹사이트**, 허용 목록에
  `https://traveltomodachi.pages.dev/*`, `http://localhost:5173/*`만.
  **API 제한사항: 키 제한 → Maps JavaScript API만**

**③ Supabase Security Advisor** — Supabase → **Advisors → Security Advisor** → Refresh.
Supabase가 직접 RLS 누락·함수 설정 문제를 찾아 준다. 결과를 Claude에게 보여 주면 해석하고 고친다.

**④ 로그인 복귀 주소(Redirect URLs) 정리** — Supabase → Authentication → URL Configuration.
필요한 것만 남긴다:
- Site URL: `https://traveltomodachi.pages.dev`
- Redirect URLs: `https://traveltomodachi.pages.dev`, `https://*.traveltomodachi.pages.dev`(PR 미리보기),
  `http://localhost:5173`, `com.traveltomodachi.app://auth`(앱)
- `localhost:3000`, `*`, `**`처럼 넓거나 안 쓰는 주소는 지운다 — 로그인 후 엉뚱한 곳으로 보내는 데 쓰일 수 있다

**⑤ 백업** — `npm run backup` ([BACKUP.md](./BACKUP.md)). 큰 SQL 실행 전에 꼭.

### 콘텐츠 보안 정책(CSP) — 2026-09-26
`public/_headers`에 **보고 모드**(`Content-Security-Policy-Report-Only`)로 넣었다.
- 로컬에서 **실제 적용 상태로** 시험: 카카오·Google 지도, 이동 시간(도보·대중교통), 장소 검색, 날씨,
  환율, 실시간 동기화 모두 동작. 목록에 없는 주소(example.com)는 막힘
- 카카오 지도 SDK가 `eval`을 쓰지만 막아도 지도가 정상으로 뜬다 → `'unsafe-eval'`은 넣지 않는다
- 적용 순서: 배포 후 운영 주소(https)에서 브라우저 콘솔에 `[Report Only]` 경고가 없는지 확인 →
  `public/_headers`의 이름을 `Content-Security-Policy`로 바꾼다
- 로컬 확인: `npm run build && npx vite preview` — `vite.config.ts`가 `_headers`를 읽어 같은 헤더를 붙인다.
  주의: 헤더만 바꾸고 index.html이 그대로면 브라우저가 옛 헤더를 재사용한다(304) — 주소에 `?v=2` 등을 붙여 연다

### 알고 두는 것 (고치지 않음)
- **실시간 삭제 이벤트의 식별자**: `trip_members`(여행 id·사용자 id)와 `trip_days`(여행 id·날짜)의
  삭제 이벤트는 RLS를 거치지 않아 다른 여행 구독자에게도 간다. 내용은 없고 무작위 id뿐이라 그 id로는
  아무것도 볼 수 없다. 막으려면 두 표에 별도 id 칸을 두고 앱이 매번 전체를 다시 읽어야 해서 비용이 크다.
- ~~개발 도구 취약점: Vite 5(높음)·esbuild(중간)~~ → **Vite 8로 올려 해결 (2026-09-26)**.
  그래도 `vite.config.ts`가 `host: true`라 같은 와이파이에서 개발 서버에 접근할 수 있다 — 공용
  와이파이에서는 개발 서버를 켜 두지 않는다.
- Capacitor CLI(uuid) — 앱 빌드할 때만 쓰는 도구. 실제 앱·웹에는 들어가지 않는다.
- 소스맵(`.js.map`)이 배포돼 있다 — 저장소가 공개라 더 드러나는 것은 없다.
- 초대 코드 무작위 대입: 8자 × 31종 ≈ 8,500억 가지라 현실적이지 않다. 별도 속도 제한은 없다.
