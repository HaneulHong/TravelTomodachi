# 지도 API 키 발급

키가 없어도 앱은 동작합니다 — 지도만 개략도(번호 찍힌 SVG)로 표시됩니다.
실제 타일을 보려면 아래 두 개를 발급하세요. 각각 10~15분 걸립니다.

| 지역 | 서비스 | 환경변수 |
|---|---|---|
| 한국 제외 전 세계 | Google Maps JavaScript API | `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID` |
| 국내 | 카카오맵 Web SDK | `VITE_KAKAO_MAPS_JS_KEY` |

```bash
cp .env.example .env.local
# 값 채우고
npm run dev     # ⚠️ Vite는 시작할 때만 env를 읽으므로 재시작 필수
```

---

## 1. Google Maps

### 1-1. 프로젝트와 결제 계정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단에서 **새 프로젝트** 생성 (이름은 아무거나, 예: `travel-tomodachi`)
3. **결제** → 결제 계정 연결

> ⚠️ **결제수단 등록을 건너뛸 수 없습니다.** 무료 사용량이 있어도
> 결제 계정이 없으면 지도에 "For development purposes only" 워터마크가
> 대각선으로 깔리고 타일이 흐려집니다. 카드 등록만으로 과금되지는 않지만,
> 아래 1-5의 예산 알림은 꼭 설정하세요.

### 1-2. API 활성화

**API 및 서비스** → **라이브러리** → `Maps JavaScript API` 검색 → **사용**

지금은 이 하나만 켜면 됩니다. Directions API는 나중에 Supabase Edge Function
프록시를 붙일 때 별도 키로 켤 겁니다 (같은 키를 쓰지 않습니다 — 이유는 아래).

### 1-3. API 키 발급과 제한

**API 및 서비스** → **사용자 인증 정보** → **사용자 인증 정보 만들기** → **API 키**

발급 직후 바로 **키 수정**을 눌러 제한을 거세요. 지도 SDK 키는 브라우저에
노출되는 것이 정상이고, **출처 제한이 유일한 방어선**입니다.

**애플리케이션 제한** → **웹사이트**, 아래 항목 추가:

```
http://localhost:5173/*
http://192.168.*.*:5173/*      ← 휴대폰 실기기 테스트용 (자기 대역에 맞게)
https://배포도메인/*            ← 배포 후 추가
```

**API 제한** → **키 제한** → `Maps JavaScript API`만 선택

### 1-4. Map ID 발급

`google.maps.Marker`는 2024-02-21(v3.56)부터 deprecated라서 이 프로젝트는
**Advanced Marker**를 씁니다. 그런데 Advanced Marker는 **Map ID가 필수**입니다 —
없으면 마커가 아예 안 뜹니다.

**Google Maps Platform** → **지도 관리**(Map management) → **지도 ID 만들기**

- 지도 유형: **JavaScript**
- 래스터/벡터: **벡터** 권장 (Advanced Marker와 궁합이 좋습니다)

`VITE_GOOGLE_MAPS_MAP_ID`를 비워두면 `DEMO_MAP_ID`로 동작합니다. 개발 중에는
그걸로 충분하지만 **배포 전에는 반드시 실제 Map ID로 바꾸세요** — 데모 ID는
개발 전용이고, 클라우드 기반 지도 스타일링도 실제 ID에만 걸립니다.

### 1-5. 예산 알림 (건너뛰지 마세요)

널리 알려진 **월 $200 크레딧은 2025-03-01에 폐지**됐습니다. 지금은 SKU별
월 무료 사용량(제품당 최대 10,000건/월) 방식이라, 예전 감각으로 두면
모르는 사이에 청구됩니다.

1. **결제** → **예산 및 알림** → 예산 만들기 → 월 $1 같은 낮은 금액 + 이메일 알림
2. **API 및 서비스** → `Maps JavaScript API` → **할당량** → 일일 상한을 낮게 설정

이 프로젝트처럼 친구 몇 명이 쓰는 규모라면 무료 사용량을 넘길 일이 거의
없습니다. 그래도 키가 유출됐을 때의 방어선으로 두 개 다 걸어두세요.

### 1-6. `.env.local`

```bash
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_GOOGLE_MAPS_MAP_ID=1a2b3c4d5e6f
```

---

## 2. 카카오맵

### 2-1. 앱 생성과 키

1. [Kakao Developers](https://developers.kakao.com/) → 카카오 계정으로 로그인
2. 상단 **내 애플리케이션** → **애플리케이션 추가하기**
   - 앱 이름 / 사업자명(개인이면 본인 이름) 입력 → 저장
3. 만든 앱을 클릭 → **앱 키** 메뉴
4. 목록에서 **JavaScript 키**를 복사

> REST API 키가 아니라 **JavaScript 키**입니다. 웹 SDK는 JavaScript 키만 받습니다.
> 네 종류(REST API / JavaScript / 네이티브 앱 / 어드민)가 앱 생성 시 자동으로
> 하나씩 발급되며, 그중 JavaScript 키를 쓰면 됩니다.

### 2-2. 도메인 등록 (이게 핵심)

카카오는 **등록되지 않은 출처에서 호출하면 키가 맞아도 401 Unauthorized**를
돌려줍니다. 카카오에서 막히는 건 거의 전부 이 문제입니다.

⚠️ **콘솔 개편으로 등록 위치가 두 군데로 나뉘었습니다.** 앱이 만들어진 시점과
계정에 따라 화면이 다를 수 있으니, 아래 중 **자기 콘솔에 보이는 쪽**에 등록하세요.
둘 다 보이면 둘 다 넣어도 문제 없습니다.

**(신규 구조 — API 검증용)**
**앱 키** → **JavaScript 키** 항목 하위의 **JavaScript SDK 도메인**

**(기존 구조)**
**앱 설정** → **플랫폼** → **Web** → **사이트 도메인 등록**

등록할 값:

```
http://localhost:5173
http://192.168.0.10:5173     ← 휴대폰 실기기 테스트용 (자기 IP로)
https://배포도메인            ← 배포 후 추가
```

규칙:

- **와일드카드가 없습니다.** `http://localhost:*` 같은 건 안 됩니다.
- **포트까지 정확히** 적어야 합니다. `http://localhost`와 `http://localhost:5173`은 다릅니다.
- 프로토콜(`http://` / `https://`)도 정확히 맞춰야 합니다.
- 최대 10개까지 등록할 수 있습니다.
- 등록 후 반영까지 잠깐 걸릴 수 있습니다.

> 참고: 개편으로 예전 "웹 도메인"이 목적별로 분리됐습니다. **API 검증용**은
> JavaScript 키 하위의 'JavaScript SDK 도메인', **제품 링크용**은 별도의
> '제품 링크 관리'입니다. 우리가 필요한 건 **API 검증용**입니다.

### 2-3. `.env.local`

```bash
VITE_KAKAO_MAPS_JS_KEY=abc123...
```

---

## 3. 확인하는 방법

`npm run dev` 재시작 후 지도 탭에서:

| 확인할 날짜 | 떠야 하는 지도 | 왜 |
|---|---|---|
| 동남아 여행 **1일차** (서울 → 방콕) | **Google** | 지점 하나라도 해외면 Google |
| 동남아 여행 **4일차** (하노이) | **Google** | 전부 해외 |
| **제주 워케이션** 전체 | **카카오** | 모든 지점이 국내 |

지도 우하단에 출처(`© Google` / `© Kakao`)가 표시되고, 항목 상세 화면
맨 아래 **"이 구간에 쓰인 서비스"** 패널에서도 어느 렌더러가 선택됐는지
확인할 수 있습니다.

### 지역 판정 규칙이 길찾기와 다른 이유

길찾기는 "이 좌표가 한국이냐"로 갈립니다 (Google이 한국 내 차량·도보
길찾기를 제공하지 않으므로). 하지만 타일 렌더링은 규칙이 **비대칭**입니다:

```
모든 지점이 한국 안  →  카카오맵
하나라도 해외        →  Google Maps
```

Google은 한국 지도도 그려줍니다 (디테일이 얕을 뿐). 반대로 카카오는 해외
지도를 제대로 못 그립니다. 그래서 첫 지점만 보고 고르면 1일차
"서울 → 방콕"에서 방콕 마커가 카카오 지도 위에 떠 아무것도 안 보입니다.

---

## 4. 자주 걸리는 것

| 증상 | 원인 |
|---|---|
| 지도에 "For development purposes only" 워터마크 | Google 결제 계정 미연결 |
| 지도는 뜨는데 **번호 마커가 안 보임** | Map ID 누락 (Advanced Marker 필수 조건) |
| 카카오 **401 Unauthorized** | 도메인 미등록, 포트/프로토콜 불일치. 신규 구조에서는 [앱 키] > [JavaScript 키] > [JavaScript SDK 도메인] |
| 카카오에서 REST API 키를 넣음 | JavaScript 키를 써야 함 |
| `.env.local`을 채웠는데 그대로 개략도 | dev 서버 재시작 안 함 |
| 콘솔에 `RefererNotAllowedMapError` | Google 리퍼러 제한에 현재 주소가 없음 |

---

## 5. Capacitor로 감쌀 때 (2단계에서 읽을 내용)

네이티브 앱에서는 출처가 `capacitor://localhost` 또는 `https://localhost`가
됩니다. 여기서 두 가지가 깨집니다.

**Google — 리퍼러 제한을 걸 수 없습니다.** 웹뷰가 보내는 출처에는 의미 있는
리퍼러 제한을 적용할 수 없어서, 웹에서 쓰던 방어선이 사라집니다. 선택지:

- 네이티브용 키를 **따로** 발급하고 일일 할당량 상한 + 예산 알림으로 방어
- 또는 지도만 **Maps SDK for iOS/Android**로 전환 (번들 ID / 패키지명 제한이
  걸립니다). 웹뷰 안의 JS SDK를 계속 쓸 거라면 이 방법은 못 씁니다.

**카카오 — `capacitor://` 스킴은 도메인으로 등록할 수 없습니다.**
Capacitor 설정에서 `server.hostname`으로 https 호스트명을 지정하고
(예: `app.traveltomodachi.com`), 그 도메인을 카카오에 등록하세요.

두 경우 모두, **길찾기 API 키는 이 문제와 무관합니다** — 서버(Edge Function)
뒤에 있으므로 클라이언트 출처와 상관없이 안전합니다. 이것이 지도 키와
길찾기 키를 분리하는 이유입니다.

---

**출처**

- [Load the Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Migrate to advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration)
- [Google Maps Platform pricing overview](https://developers.google.com/maps/billing-and-pricing/overview)
- [Kakao 지도 Web API 가이드](https://apis.map.kakao.com/web/guide/)
- [카카오 JavaScript SDK 시작하기](https://developers.kakao.com/docs/latest/ko/javascript/getting-started)
- [카카오 앱과 앱 키 변경 사항](https://developers.kakao.com/docs/ko/getting-started/app-key-migration)
- [카카오 앱 설정 문서](https://developers.kakao.com/docs/latest/ko/app-setting/app)
