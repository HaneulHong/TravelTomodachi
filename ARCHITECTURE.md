# TravelTomodachi — 아키텍처 결정 기록

최초 작성: 2026-09-19

## 제품 개요
친구들과 여행 일정을 공유·공동 편집하는 웹앱. **전 세계 여행 대상.**

화면 구성: 홈(일정 리스트) → 일정 상세(날짜별 타임라인, 스와이프로 날짜 전환) → 항목 상세(설명/이동수단/소요시간) → 지도 탭(당일 루트 안내) + 체크리스트(메뉴).

## 확정된 결정

| 항목 | 결정 | 비고 |
|---|---|---|
| 프론트엔드 | React + TypeScript, **Vite SPA** | Next.js SSR 금지 — Capacitor 전환 불가 |
| 대상 지역 | **전 세계** (국내 포함) | 프로바이더를 KR / GLOBAL로 분기 |
| 공유 수준 | 친구 초대 후 **공동 편집 + 실시간 반영** | 백엔드 필수 |
| 백엔드 | **Supabase** (Postgres + Auth + Realtime + Edge Functions) | 자체 서버/Spring 미채택 |
| 배포 | **1단계 PWA(웹) → 사용량 늘면 2단계 Capacitor 앱 출시** | 코드 재사용, 웹 버전 계속 유지 |
| 도시간 이동 | **사용자 수동 입력** (항공편/기차 타입 항목) | Rome2rio 등 상용 API 미채택 |
| 대중교통 데이터 없는 지역 | 도보·차량만 표시 + 배지 + **수동 입력 유도** | 추정값 표시 안 함 |

## PWA → Capacitor 전환을 위해 처음부터 지킬 제약

1. Vite SPA로 빌드 (SSR 없음). Capacitor는 로컬 파일에서 `index.html`을 로드하므로 서버 렌더링 불가.
2. asset 경로는 상대 경로. `base: './'`
3. OAuth 리다이렉트·딥링크·파일 저장·위치 권한은 **플랫폼 추상화 레이어** 뒤로 숨긴다 (`src/platform/`).
4. Service Worker 캐싱 로직은 웹 전용 분기로 격리.
5. `window.location.origin`에 직접 의존하는 코드 금지 (앱에서는 `capacitor://localhost`).

## 지역 분기 아키텍처 (핵심)

경로만 분기하면 안 된다. **세 가지 모두** 지역별로 갈린다.

```ts
interface RouteProvider { route(from, to, mode): Promise<Route | null> }
interface PlaceProvider { search(q, near): Promise<Place[]> }
interface MapRenderer   { /* 타일·마커·폴리라인 */ }

function resolveRegion(coord): 'KR' | 'GLOBAL'
```

| 지역 | 경로 | 장소검색 | 지도 타일 |
|---|---|---|---|
| GLOBAL | Google Directions | Google Places | Google Maps JS |
| KR | 카카오모빌리티(차량) / Tmap·TAGO(대중교통) | 카카오 로컬 | 카카오맵 JS |

## 외부 API 제약 (2026-09 조사)

**Supabase Free**: DB 500MB, 스토리지 1GB, egress 5GB, MAU 50,000, 활성 프로젝트 2개,
Edge Function 호출 500,000, Realtime 동시접속 200 / 월 200만 메시지.
**7일 미사용 시 프로젝트 일시정지.**

**길찾기 프로바이더 — 전 세계 대중교통은 Google이 유일한 현실적 선택**

- **Mapbox Directions**: 대중교통 프로필 **없음**. `driving-traffic`, `driving`, `walking`, `cycling` 4종뿐.
- **HERE Public Transit**: 대중교통 있으나 **도시 단위 라이선스 구매** 방식. 글로벌 무료 불가.
- **Google Maps Platform**: $200 월 크레딧 2025-03-01 폐지 → SKU별 월 무료 사용량(제품당 최대 10,000건/월).
  - 한국 내 **자동차·도보 길찾기 미제공** (측량법상 지도 데이터 국외 반출 제한). 대중교통만 가능.
  - **대중교통 커버리지는 도시 단위**로 GTFS 피드 제공 여부에 의존. 동남아·인도·아프리카·남미 상당 지역 공백.
- **ODsay 무료(Basic)**: 30회/일 → 실사용 불가.
- **카카오모빌리티 자동차 길찾기**: 사용 권한 신청 필요.

## 타임존 처리 (전 세계 대응의 핵심)

**절대 UTC로 변환 저장하지 않는다.**

```
저장: date + local_time(벽시계) + IANA timezone
예:   2026-11-03, 09:00, "Asia/Bangkok"
```

이유: "오전 9시 조식"은 현지 9시여야 한다. UTC 저장 시 일정을 하루 미루거나
도시를 바꾸면 시간이 엉뚱하게 이동한다. 친구들이 서로 다른 나라에서 열어도
같은 화면을 봐야 한다.

→ **타임존은 day 단위로 부여.** 타임존을 넘는 날은 UI에 경고 표시.

## 데이터 모델

```
trips          (id, name, start_date, end_date, owner_id, invite_code)
trip_members   (trip_id, user_id, role)
trip_days      (trip_id, date, timezone)            -- 타임존은 day 단위
items          (id, trip_id, date, sort_key, kind, title, place_name,
                lat, lng, local_time, duration_min, description,
                transport_mode, transit_min, transit_is_manual)
checklist      (id, trip_id, title, checked, assignee_id)
routes         (cache_key, mode, region, polyline, duration_min, fetched_at)
```

- `sort_key`는 정수 인덱스가 아니라 **fractional index**(문자열).
  두 사람이 동시에 순서를 바꿔도 충돌하지 않고, 재정렬 시 전체 행 업데이트가 불필요.
- `kind`로 일반 방문지 / 항공편 / 기차 구분 → 도시간 이동은 수동 입력 항목으로 처리.
- `transit_is_manual` — 사용자가 직접 고친 이동시간은 API 결과로 덮어쓰지 않는다.

## 비용 절감 핵심

- 길찾기 결과는 **`routes` 테이블에 캐시**. 키 = (출발 좌표, 도착 좌표, 이동수단, 지역).
  친구 5명이 같은 일정을 봐도 API 호출은 1회.
- **Google Places Autocomplete가 비싼 SKU.** debounce + session token + 결과 캐싱 필수.
- API 키는 클라이언트에 노출하지 않고 **Supabase Edge Function을 프록시**로 사용.

## 미결 사항

- 국내 대중교통 API 최종 선택 (Tmap vs 공공데이터포털 TAGO)
- 인증 방식 (소셜 로그인 제공자 선택)
