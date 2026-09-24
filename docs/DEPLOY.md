# 웹 배포 — Cloudflare (무료)

앱 스토어 비용 없이 먼저 웹으로 공개한다. 이 앱은 서버 없는 정적 웹이라
`npm run build`가 만든 `dist/`만 올리면 된다. HashRouter라서 새로고침 404를
막는 리다이렉트 설정도 필요 없다.

**왜 Cloudflare인가**: 무료로 상업적 이용 가능, 트래픽 무제한,
GitHub에 푸시하면 자동 배포. (Vercel 무료는 비상업 전용)

---

## 1. Cloudflare Pages 프로젝트 (현재: `tabitomo.pages.dev`)

**지금 쓰는 곳: https://tabitomo.pages.dev** (Pages 프로젝트 `tabitomo`)

처음엔 Workers 방식으로 만들었다가 주소(`traveltomodachi.hongha303.workers.dev`)가
길고 계정 이름이 드러나서 Pages로 옮겼다. Workers 프로젝트 `traveltomodachi`는
**지워도 된다** — 남겨 두면 푸시할 때마다 두 곳에서 빌드된다.
(저장소의 `wrangler.jsonc`는 Workers용이고 Pages는 무시한다.)

새로 만든다면:

1. https://dash.cloudflare.com → **Workers & Pages → Create** → 아래쪽 **Pages** 탭 →
   **Connect to Git** → `HaneulHong/TravelTomodachi`
2. 빌드 설정

   | 항목 | 값 |
   |---|---|
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   Node 버전은 저장소의 `.node-version`(22)을 따른다.

3. **환경 변수** — 프로젝트 → **Settings → Variables and Secrets** → **Production**

   | 이름 | 값 |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
   | `VITE_GOOGLE_MAPS_API_KEY` | Google Maps 키 |
   | `VITE_GOOGLE_MAPS_MAP_ID` | Map ID |
   | `VITE_KAKAO_MAPS_JS_KEY` | 카카오 JavaScript 키 |
   | `VITE_PUBLIC_BASE_URL` | `https://tabitomo.pages.dev` |

   ⚠️ **secret / service_role 키는 절대 넣지 않는다.** 여기 값은 전부 번들에
   들어가 누구나 볼 수 있다. 공개 키만 넣는다(접근 제어는 RLS가 한다).

   ⚠️ 변수를 넣거나 바꾼 뒤에는 **다시 배포해야** 반영된다
   (Deployments → 최신 배포 ⋯ → Retry deployment, 또는 main에 푸시).
   `VITE_` 값은 빌드할 때 번들에 박히기 때문이다.

   변수가 빠진 채 배포되면 앱은 "잠시 서비스를 이용할 수 없습니다" 화면을
   띄운다(개발용 목으로 몰래 돌지 않는다).

이후로는 main에 머지할 때마다 자동으로 다시 배포된다.

---

## 2. 배포 주소를 각 서비스에 알려주기

배포 주소: `https://tabitomo.pages.dev`

### Supabase — 로그인 후 돌아올 곳
**Authentication → URL Configuration**
- **Site URL**: `https://tabitomo.pages.dev`
- **Redirect URLs**에 추가: `https://tabitomo.pages.dev`
  (개발용 `http://localhost:5173`, 앱용 `com.traveltomodachi.app://auth`는 그대로 둔다)

안 하면 로그인 후 localhost로 튕긴다.

### Google Maps 키 — 허용 웹사이트
Cloud Console → 사용자 인증 정보 → 해당 키 → 웹사이트 제한에 추가:
`https://tabitomo.pages.dev/*`

안 하면 해외 지도가 인증 실패로 개략도가 된다.

### 카카오맵 — 사이트 도메인
Kakao Developers → 앱 → 플랫폼 → Web → 사이트 도메인에 추가:
`https://tabitomo.pages.dev`

안 하면 국내 지도가 401로 개략도가 된다.

### Google 로그인 — 누구나 로그인할 수 있게
Google Cloud Console → **Google 인증 플랫폼(OAuth 동의 화면) → 대상(Audience)**

게시 상태가 **테스트**면 "테스트 사용자"에 등록한 계정만 로그인된다.
친구들이 쓰려면 **앱 게시(프로덕션으로 푸시)**. 이 앱은 기본 범위
(openid·email·profile)만 쓰므로 Google 심사 없이 바로 게시된다.

---

## 3. 배포 후 확인

- [ ] 배포 주소에서 Google 로그인 → 홈으로 돌아옴
- [ ] 해외(Google)·국내(카카오) 지도가 개략도가 아닌 실제 지도
- [ ] 초대 링크 보내기 → 링크 주소가 배포 주소
- [ ] 다른 계정(친구)으로 초대 링크 열기 → 로그인 → 여행 참가
- [ ] 두 브라우저에서 동시에 고치면 실시간 반영

---

## 도메인

처음엔 무료 `*.workers.dev`(또는 `*.pages.dev`) 주소로 충분하다.

내 도메인을 쓰려면 사서(.com 등은 Cloudflare Registrar에서 원가, .kr은 국내
업체) 프로젝트 → **Settings → Domains & Routes**에 연결한다.

⚠️ 주소를 바꾸면 위 2단계의 네 곳과 `VITE_PUBLIC_BASE_URL`을 모두 새 주소로
바꿔야 하고, **이미 보낸 초대 링크는 옛 주소를 가리킨다.** 도메인을 살
계획이면 링크를 많이 돌리기 전에 정하는 게 편하다.

---

## 무료 한도

| 서비스 | 한도 | 넘으면 |
|---|---|---|
| Cloudflare (정적 파일) | 정적 파일 요청 무료·무제한, 빌드 월 제한 있음 | — |
| Supabase Free | DB 500MB, **1주일 미사용 시 일시정지** | 대시보드에서 다시 켜면 됨 (데이터 유지) |
| Google Maps | 월 10,000 로드 | 과금 — 결제 알림 설정 권장 |
| Transitous | 비상업 조건 | 유료화하면 재검토 |

---

## 남은 손질

- `public/manifest.webmanifest`가 가리키는 `icon-192.png`, `icon-512.png`가 없다.
  홈 화면에 추가했을 때 아이콘이 깨진다. 아이콘 이미지를 만들어 `public/`에 넣는다.
