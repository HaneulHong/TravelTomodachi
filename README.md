# TravelTomodachi

친구들과 함께 만드는 여행 일정. 전 세계 대상.

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

화면 흐름과 도메인 로직이 완성된 단계입니다. 외부 연동은 전부 목(mock)입니다.

**되는 것**

- 홈 → 일정 타임라인 → 항목 상세 → 지도 → 체크리스트 전체 흐름
- 날짜별 타임라인, 가로 스와이프로 날짜 전환 (세로 스크롤과 충돌 없음)
- 항목 사이 이동 구간을 도보·대중교통·차량으로 비교, 더 나은 쪽 자동 추천
- 대중교통 데이터 없는 지역 감지 → 추정값 대신 "정보 없음" 표시 + 수동 입력
- 이동 시간 직접 입력 (자동 계산이 덮어쓰지 않음)
- 타임존이 바뀌는 날 경고
- 다크 모드, 초대 링크 공유(Web Share → 클립보드 폴백)
- **실제 지도 타일** — 국내는 카카오맵, 그 외 전 세계는 Google Maps.
  키가 없으면 개략도로 폴백하고 무엇을 설정해야 하는지 화면에 안내합니다.

**아직 목(mock)인 것**

- 길찾기 — `src/providers/mock/mockRouteProvider.ts`
  (지도에 그려지는 선은 지점 간 직선입니다. 실제 경로 폴리라인은 아직 없음)
- 장소 검색 — `src/providers/mock/mockPlaceProvider.ts`
- 데이터 — 메모리 상태 (`src/store/tripStore.ts`)
- 로그인 · 실시간 동기화 — 없음

## 구조

```
src/
  domain/         순수 로직. 외부 의존 없음. 테스트 대상.
    types.ts          도메인 타입
    fractionalIndex.ts  순서 키 (실시간 공동 편집용)
    time.ts           타임존 · 시간 표기
    geo.ts            거리 · 좌표 정규화
  providers/      외부 지도·길찾기 서비스 추상화
    types.ts          RouteProvider / PlaceProvider
    region.ts         KR / GLOBAL 판별 (길찾기용)
    index.ts          지역별 구현체 선택 (팩토리)
    mock/             목 길찾기·장소검색
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

순서대로 하는 게 좋습니다.

1. **Supabase** — 스키마는 ARCHITECTURE.md의 데이터 모델 그대로. RLS 먼저.
   `tripStore.ts`의 각 액션이 낙관적 업데이트 지점입니다.
2. **실시간 동기화** — `postgres_changes` 구독. `sortKey`가 fractional index라
   동시 순서 변경에도 충돌하지 않습니다.
3. ~~**지도 SDK**~~ — 완료. `src/providers/maps/` 참고.
4. **실제 길찾기** — `mockRouteProvider.ts`를 대체.
   API 키는 클라이언트에 두지 말고 Supabase Edge Function 프록시를 쓰고,
   결과는 `routes` 테이블에 캐시합니다. (친구 5명이 같은 일정을 봐도 호출 1회)
5. **Capacitor** — `npx cap add ios android`. 아래 제약을 지켜왔다면 그대로 붙습니다.

## Capacitor 전환 제약 (계속 지켜야 함)

1. Vite SPA 유지. SSR 도입 금지.
2. `vite.config.ts`의 `base: './'` 유지.
3. 라우팅은 HashRouter. (`src/App.tsx`에 이유 적어둠)
4. `window.location.origin`을 직접 쓰지 말고 `platform.publicBaseUrl` 사용.
5. 위치·공유·햅틱·외부링크는 `src/platform/` 뒤에서만.
   네이티브 구현은 `platform/native.ts`를 추가하고 `platform/index.ts`의
   분기만 바꾸면 됩니다.
