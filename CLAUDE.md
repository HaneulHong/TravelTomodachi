# TravelTomodachi — Claude 작업 규칙

친구와 같이 짜는 여행 일정 웹앱. Vite + React + TS SPA, Supabase, Capacitor(iOS·Android).
서비스: https://traveltomodachi.pages.dev (Cloudflare Pages, main 머지 시 자동 배포) · v0.9.0 베타

**작업을 시작하기 전에 [docs/STATUS.md](docs/STATUS.md)를 읽는다.** 무엇이 끝났고,
사용자가 무엇을 해야 하고, 무엇이 확인되지 않았는지가 거기 있다. 작업을 마치면 갱신한다.

## 반드시

- **모든 답변은 한국어.** 커밋 메시지·코드 주석·문서도 한국어 (기존 관례).
- **유료 서비스를 쓰지 않는다.** 새 API·라이브러리·호스팅은 무료인지 먼저 확인한다.
  (Google Maps는 사용자가 무료 한도 안에서 쓰기로 정했다. Google Places는 유료라 빼고 Photon을 쓴다.)
- 비밀 키를 클라이언트·`.env.local`·Cloudflare 변수에 넣지 않는다
  (Supabase secret/service_role 키, Google OAuth Client Secret). 공개 키만 쓴다.
- `.env.local`은 커밋하지 않는다.
- 계정 로그인·가입, 대시보드 설정, 결제, 비밀번호가 필요한 명령은 **사용자가 한다.**
  절차를 정확히 안내하고 결과를 확인한다. 사용자 세션을 로그아웃시키지 않는다.
- Supabase Realtime에 `replica identity full`을 켜지 않는다 — DELETE 이벤트는 RLS를 안 거쳐
  남의 여행 데이터가 모든 구독자에게 샌다.

## Git · 배포 흐름

1. `main`에서 새 브랜치 (`git switch -c feat/<이름> origin/main`). **main에 직접 푸시하지 않는다.**
2. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
3. 푸시 후 `gh pr create`로 PR을 만들고 **PR 주소를 준다** (gh는 HaneulHong 계정으로 로그인돼 있다).
   본문은 한국어, 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   gh가 안 되면 링크로: `https://github.com/HaneulHong/TravelTomodachi/compare/main...<브랜치>?expand=1`
4. 사용자가 머지 → Cloudflare Pages가 자동 배포. **Claude가 머지하지 않는다.**

## DB (Supabase)

- `supabase/schema.sql`은 **새 DB 전용** — 다시 돌리면 데이터가 전부 지워진다. 운영 DB에 쓰지 않는다.
- 스키마를 바꿀 때는 **덧붙이는 SQL 파일**(멱등, 데이터 보존)을 새로 만들고, schema.sql에도
  같은 내용을 반영해 새 DB와 맞춘다. 사용자가 SQL Editor에서 실행한다.
- 실행 순서와 파일 목록: [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md) 4단계
- 앱은 SQL 실행 전 DB에서도 깨지지 않게 짠다 (예: 없는 칸을 이름으로 부르지 말고 `select('*')`).
- 멤버십 확인은 security definer 함수로 (RLS 재귀 방지). 칸 단위 권한은 grant로.

## 구조

- 화면은 인터페이스만 본다: `src/providers/`(지도·길찾기·장소), `src/auth/`, `src/data/`,
  `src/platform/`(웹 ↔ 앱). 설정이 있으면 실제, 없으면 목.
- 배포 빌드에서 백엔드 설정이 없으면 목 대신 `UnavailableScreen`.
- 개발자용 안내(키 설정법 등)는 `SHOW_DEV_HINTS`(개발 서버에서만)로 감싼다.
- 버전은 `package.json` 한 곳 (`src/config.ts`가 읽는다). 앱 버전은 iOS `MARKETING_VERSION`,
  Android `versionName`도 같이 올린다.
- HashRouter, `base: './'` 유지 (Capacitor 제약 — README 참고).
- **화면 문구는 코드에 직접 쓰지 않는다.** `src/i18n/messages/ko.ts`에 넣고 `en.ts`·`ja.ts`에도
  번역을 넣는다(빠지면 빌드 실패). 화면은 `useT()`, React 밖은 `getMessages()`.
  날짜·시간 포맷은 `useLocale()`을 넘긴다. 개발자용 안내(`SHOW_DEV_HINTS`)는 한국어 그대로.

## 확인

- `npm run typecheck`, `npm run typecheck:logic`, `npm test`, `npm run build`
- 화면을 바꾸면 브라우저로 직접 확인한다. 좁은 폰(320·360px)에서 넘침·잘림도 본다.
- dev 서버: `.claude/launch.json`의 `dev` (포트 5173, 카카오에 등록된 포트라 바꾸지 않는다).

## 문서

- [docs/STATUS.md](docs/STATUS.md) 진행 현황 · [docs/DEPLOY.md](docs/DEPLOY.md) 배포
- [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md) Supabase·로그인 · [docs/MAP_SETUP.md](docs/MAP_SETUP.md) 지도 키
- [docs/APP_SETUP.md](docs/APP_SETUP.md) iOS·Android · [ARCHITECTURE.md](ARCHITECTURE.md) 설계
