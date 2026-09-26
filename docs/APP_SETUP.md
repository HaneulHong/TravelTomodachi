# 앱(iOS · Android) 만들기

웹 빌드(`dist/`)를 Capacitor로 감싸 앱으로 만든다. 화면 코드는 웹과 같고,
공유·진동·외부 링크·로그인만 `src/platform/native.ts`가 네이티브로 처리한다.

```
npm run app:ios        # 빌드 → iOS 프로젝트에 복사 → Xcode 열기
npm run app:android    # 빌드 → Android 프로젝트에 복사 → Android Studio 열기
npm run app:sync       # 빌드 → 둘 다 복사 (코드를 고친 뒤)
```

웹 코드를 고치면 **항상 `app:sync`(또는 위 명령)를 다시 돌려야** 앱에 반영된다.
앱은 `dist/`의 복사본을 들고 있다.

---

## 1. 한 번만 하는 준비

### Xcode (iOS) — 무료

1. App Store에서 **Xcode** 설치 (용량이 커서 오래 걸린다)
2. 터미널에서 Xcode를 기본 개발 도구로 지정 (비밀번호를 묻는다)
   ```
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Xcode를 한 번 열어 약관 동의 → 추가 구성요소 설치 → **iOS 시뮬레이터** 받기
   (Settings → Components)

CocoaPods는 필요 없다. 이 프로젝트는 Swift Package Manager를 쓴다.

### Android Studio (Android) — 무료

1. https://developer.android.com/studio 에서 설치
2. 처음 열 때 나오는 설치 마법사로 SDK와 에뮬레이터를 받는다

### Supabase — 로그인 돌아올 주소 등록

앱은 로그인이 끝나면 `com.traveltomodachi.app://auth`로 돌아온다. Supabase가
이 주소를 모르면 로그인 뒤 웹 주소로 튕겨 버린다.

Supabase 대시보드 → **Authentication → URL Configuration → Redirect URLs** →
**Add URL** → `com.traveltomodachi.app://auth` → Save

Google Cloud 쪽은 바꿀 게 없다. Google은 여전히 Supabase로 돌려보내고,
Supabase가 앱으로 넘겨준다.

### 지도 키 — 앱 주소 허용

앱의 웹뷰 주소는 웹과 다르다.

| | 주소 |
|---|---|
| iOS | `capacitor://localhost` |
| Android | `https://localhost` |

- **Google Maps 키** (Cloud Console → 사용자 인증 정보 → 키 → 웹사이트 제한):
  `capacitor://localhost/*`, `https://localhost/*` 추가
- **카카오맵** (Kakao Developers → 플랫폼 → Web 사이트 도메인):
  `https://localhost` 추가. iOS의 `capacitor://`는 등록이 안 될 수 있다.
  ⚠️ 아직 확인하지 못했다. 안 되면 국내 지도가 **개략도로 표시**된다(앱이
  멈추지는 않는다).

### 초대 링크 — 공개 웹 주소

앱에서 만든 초대 링크는 친구가 열 수 있는 **웹 주소**여야 한다.
`.env.local`의 `VITE_PUBLIC_BASE_URL`에 배포한 웹 주소를 넣는다.

비워 두면 앱은 링크 없이 **초대 코드만** 보낸다. 친구가 앱에서
"초대 코드로 참가"에 입력하면 들어온다. 웹을 배포하기 전까지는 이렇게 쓴다.

---

## 2. 시뮬레이터에서 실행

```
npm run app:ios
```

Xcode가 열리면 위쪽에서 시뮬레이터(예: iPhone 16)를 고르고 ▶ Run.

Android는 `npm run app:android` → Android Studio에서 에뮬레이터를 고르고 ▶ Run.

---

## 3. 로그인이 앱에서 도는 방식

```
[앱] Google로 계속하기
  → 시스템 브라우저(iOS SFSafariViewController / Android Custom Tabs)로 Google 로그인
  → Supabase가 com.traveltomodachi.app://auth?code=... 로 돌려보냄
  → 앱이 딥링크를 받아 브라우저를 닫고, code를 세션으로 교환
```

앱 안 웹뷰로 Google 로그인을 열지 않는 이유: Google이 웹뷰 로그인을 막는다
(`disallowed_useragent`).

---

## 4. 실제 폰 · 스토어 (비용 안내)

| | 비용 | 없으면 |
|---|---|---|
| 내 아이폰에 설치 | 무료 (Apple ID) | 7일마다 다시 설치해야 한다 |
| App Store 배포 · Apple 로그인 | Apple Developer $99/년 | 배포 불가 |
| 내 안드로이드 폰에 설치 | 무료 | — |
| Google Play 배포 | $25 (한 번) | 배포 불가 |

---

## 5. 아직 확인하지 못한 것

Xcode·Android Studio가 없는 상태에서 만들었다. 설치하고 실행하면 아래를 확인한다.

- [ ] 앱에서 Google 로그인 → 앱으로 돌아와 로그인 완료
- [ ] 로그인 창을 그냥 닫으면 "로그인을 취소했습니다"
- [ ] 초대 공유 시트가 뜨고 코드가 들어가는지
- [ ] Google 지도(해외)와 카카오맵(국내)이 뜨는지 — 안 뜨면 개략도
- [ ] 길찾기(Valhalla·Transitous)와 장소 검색(Photon·카카오)이 앱 주소에서도 응답하는지 (카카오가 막혀도 Photon 결과는 뜬다)
- [ ] 노치·홈바 영역에 화면이 가려지지 않는지
