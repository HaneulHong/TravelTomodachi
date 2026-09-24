# TravelTomodachi

친구들과 함께 만드는 여행 일정. 전 세계 대상.

**서비스**: https://traveltomodachi.pages.dev · **v0.9.0 베타** · 진행 현황은 [docs/STATUS.md](./docs/STATUS.md)

설계 결정과 그 이유는 [ARCHITECTURE.md](./ARCHITECTURE.md)에 정리돼 있습니다.
코드를 고치기 전에 그쪽을 먼저 읽는 게 빠릅니다.

## 시작하기

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev`는 `host: true`로 떠 있어서, 같은 와이파이의 휴대폰에서
터미널에 표시되는 네트워크 주소로 접속하면 실기기에서 바로 볼 수 있습니다.
스와이프 제스처와 safe-area 처리는 실기기에서 확인하는 게 정확합니다.

```bash
npm test                 # 순수 로직 테스트 (54개)
npm run typecheck        # 전체 타입체크
npm run typecheck:logic  # 로직 + 지도 렌더러만, React 타입 없이 엄격 검사
npm run build            # 프로덕션 빌드
```

### 지도 API 키 (선택)

키 없이도 앱은 돌아갑니다 — 지도만 개략도로 표시됩니다.
실제 타일을 보려면 [docs/MAP_SETUP.md](./docs/MAP_SETUP.md)를 따라
Google Maps 키와 카카오 JavaScript 키를 발급한 뒤:

```bash
cp .env.example .env.local
# 값 채우고 → dev 서버 재시작 (Vite는 시작할 때만 env를 읽습니다)
```

## 지금 상태

화면 흐름과 도메인 로직, 지도·장소검색·길찾기, **로그인·저장·공유·실시간
동기화까지 실제로 붙어 있습니다.** iOS·Android 앱 프로젝트도 만들어 두었습니다
(실행 확인은 Xcode 설치 후 — [docs/APP_SETUP.md](./docs/APP_SETUP.md)).

**되는 것**

- 홈 → 일정 타임라인 → 항목 상세 → 지도 → 체크리스트 전체 흐름
- 일정 추가·수정·삭제. 장소 자동완성(OpenStreetMap)으로 좌표까지 채워진다
- 날짜별 타임라인, 가로 스와이프로 날짜 전환 (세로 스크롤과 충돌 없음)
- 항목 사이 이동 구간을 도보·대중교통·차량으로 비교, 더 나은 쪽 자동 추천
- 대중교통 데이터 없는 지역 감지 → 추정값 대신 "정보 없음" 표시 + 수동 입력
- 이동 시간 직접 입력 (자동 계산이 덮어쓰지 않음)
- 타임존이 바뀌는 날 경고
- 다크 모드, 초대 링크 공유(Web Share → 클립보드 폴백)
- **실제 지도 타일** — 국내는 카카오맵, 그 외 전 세계는 Google Maps.
  키가 없으면 개략도로 폴백하고 무엇을 설정해야 하는지 화면에 안내합니다.
- **실제 경로선** — 도로를 따라 그려진다. 못 구한 구간은 점선 직선으로 두어
  "아직 모른다"를 숨기지 않는다.
- **터미널 이동** — 기차·시외버스·배편을 구간 항목으로 넣으면 출발·도착
  터미널을 잇는 선이 그려진다. 지도에 그려진 선의 출처도 상세에서 밝힌다.
- **Google 로그인 + 닉네임 프로필** (Supabase). 닉네임 외에는 저장하지 않는다
- **여행 만들기, 초대 링크·코드로 참가**, 로그인 도중에도 초대 코드 유지
- **실시간 동기화** — 친구가 고친 일정이 새로고침 없이 반영된다
- **누가 고쳤는지** — 일정 카드에 마지막으로 고친 사람 아바타
- **멤버 · 초대 코드 화면** — 내보내기, 초대 코드 바꾸기(소유자), 나가기·삭제
- **날짜별 도시·타임존 편집** — 도시를 옮기는 날(과 이어지는 날)만 고친다

**외부 서비스 (전부 무료)**

| 기능 | 서비스 | 키 |
|---|---|---|
| 해외 지도 | Google Maps JS | 필요 ([docs/MAP_SETUP.md](./docs/MAP_SETUP.md)) |
| 국내 지도 | 카카오맵 | 필요 (같은 문서) |
| 장소 검색 | Photon (OSM) | 불필요 |
| 도보·차량 길찾기 | Valhalla (OSM) | 불필요 |
| 대중교통 | Transitous | 불필요 |

**Supabase를 연결하지 않으면** 로그인과 데이터가 목(mock)으로 돈다. 세션은
이 브라우저에만 남고 새로고침하면 데이터가 초기화된다. 연결 절차는
[docs/AUTH_SETUP.md](./docs/AUTH_SETUP.md), DB는 `supabase/schema.sql`(새 DB) →
`supabase/realtime.sql` 순서. 이미 쓰던 DB는 `supabase/sharing.sql`만 덧붙인다.

## 구조

```
src/
  domain/         순수 로직. 외부 의존 없음. 테스트 대상.
    types.ts          도메인 타입
    fractionalIndex.ts  순서 키 (실시간 공동 편집용)
    time.ts           타임존 · 시간 표기
    geo.ts            거리 · 좌표 정규화
  auth/           로그인 추상화. Supabase Auth를 붙일 지점.
  providers/      외부 지도·길찾기·장소검색 추상화
    types.ts          RouteProvider / PlaceProvider
    region.ts         KR / GLOBAL 판별 (길찾기용)
    index.ts          지역별 구현체 선택 (팩토리)
    routeCache.ts     조회 캐시 + 동시 요청 제한
    places/           장소 검색 (Photon)
    route/            길찾기 (Valhalla · Transitous)
    maps/             지도 렌더러 (실제 SDK)
      types.ts          MapRenderer / MapHandle, 공용 마커 DOM
      googleMapRenderer.ts   해외 — Advanced Marker, mapId 필수
      kakaoMapRenderer.ts    국내 — CustomOverlay, 도메인 등록 필수
      schematicMapRenderer.ts  키 없을 때 폴백 (같은 인터페이스)
      index.ts          지도용 지역 판정 + 렌더러 캐시
  platform/       웹 ↔ 네이티브 차이 흡수 (Capacitor 전환 대비)
  store/          앱 상태. Supabase를 붙일 지점.
  hooks/          useDayLegs (구간 조회), useSwipe
  components/     헤더 · 탭바 · 날짜 스트립 · 칩 · 시트 · MapCanvas
  screens/        화면 5개
  data/           목 데이터
  types/          환경변수 + 지도 SDK 타입 선언 (직접 작성)
```

### 지도 렌더러에서 유의할 점

**지역 판정 규칙이 길찾기와 다릅니다.** 길찾기는 좌표가 한국인지로 갈리지만,
타일 렌더링은 비대칭입니다 — 모든 지점이 국내면 카카오, **하나라도 해외면
Google**. Google은 한국 지도도 그려주지만 카카오는 해외를 못 그리기 때문입니다.
이게 없으면 1일차 "서울 → 방콕"에서 방콕 마커가 카카오 지도 위에 떠버립니다.

**지도 SDK는 리액트 렌더링 주기에 태우지 않습니다.** `MapCanvas`가 한 번
mount하고, 이후에는 `setStops` / `setPath` / `fit` 명령형 핸들로 갱신합니다.
지점 배열을 effect 의존성에 그냥 넣으면 날짜를 넘길 때마다 지도가 깜빡입니다
(그래서 `MapScreen`에서 `useMemo`로 배열을 고정합니다).

## 목 데이터가 왜 이렇게 생겼나

`src/data/mockTrips.ts`의 "동남아 + 도쿄 6일"은 예시가 아니라
**어려운 경우를 일부러 모아둔 테스트 시나리오**입니다.

| 일차 | 도시 | 이걸로 확인하는 것 |
|---|---|---|
| 1 | 서울 → 방콕 | 국내(KR) 프로바이더, 항공편 수동 입력 항목 |
| 2–3 | 방콕 | 해외(GLOBAL) 프로바이더, 타임존 −2시간 경고 |
| 4 | 하노이 | **대중교통 데이터 없는 도시** → 폴백 동작 |
| 5–6 | 도쿄 | 타임존 +2시간 경고 |

화면을 날짜별로 넘겨보기만 해도 지역 분기·폴백·타임존 경고가 전부 보입니다.
특히 4일차를 꼭 확인해 보세요.

## 다음에 붙일 것

1. **앱 실행 확인** — Xcode·Android Studio 설치 후 [docs/APP_SETUP.md](./docs/APP_SETUP.md)의
   확인 목록
2. **웹 배포** — Cloudflare(무료). 절차는 [docs/DEPLOY.md](./docs/DEPLOY.md)
3. **Apple 로그인** — Apple Developer($99/년) 가입 후

## Capacitor 전환 제약 (계속 지켜야 함)

1. Vite SPA 유지. SSR 도입 금지.
2. `vite.config.ts`의 `base: './'` 유지.
3. 라우팅은 HashRouter. (`src/App.tsx`에 이유 적어둠)
4. `window.location.origin`을 직접 쓰지 말고 `platform.publicBaseUrl` 사용.
5. 위치·공유·햅틱·외부링크·로그인 브라우저는 `src/platform/` 뒤에서만.
   웹은 `platform/web.ts`, 앱은 `platform/native.ts`.
