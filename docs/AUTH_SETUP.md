# 로그인 · 백엔드 설정 (Supabase + Google)

설정하지 않아도 앱은 동작합니다 — 로그인이 **개발용 목**으로 돌고,
세션은 그 브라우저에만 남습니다. 혼자 일정을 짜보는 데는 충분합니다.

**친구 초대와 공동 편집은 이 문서를 끝내야 동작합니다.** 30~40분 걸립니다.

| 하는 일 | 서비스 | 비용 |
|---|---|---|
| 계정 · 세션 · 데이터 | Supabase | 무료 (아래 주의) |
| Google 로그인 | Google Cloud OAuth | 무료 |
| Apple 로그인 | Apple Developer Program | **$99/년** — 그래서 지금은 뺐습니다 |

```bash
cp .env.example .env.local
# 값 채우고
npm run dev     # ⚠️ Vite는 시작할 때만 env를 읽으므로 재시작 필수
```

---

## 0. 시작 전에 알아둘 것

### 무료 플랜은 **7일 쓰지 않으면 일시정지**됩니다

여행 앱은 이게 실제로 걸립니다. 여행 계획을 짜다가 2주쯤 손을 놓는 일이
흔한데, 그 사이 프로젝트가 멈춰 있으면 친구가 링크를 열었을 때 아무것도
뜨지 않습니다. 대시보드에서 직접 되살려야 합니다.

되살리는 건 버튼 한 번이지만, **일시정지 중에는 데이터를 읽을 수 없습니다.**
복구에 몇 분 걸립니다.

| 무료 플랜 한도 | |
|---|---|
| 데이터베이스 | 프로젝트당 500MB |
| 월 활성 사용자(MAU) | 50,000 |
| Egress | 5GB |
| 활성 프로젝트 | 계정당 2개 |

친구 몇 명이 쓰는 정도로는 한도가 문제되지 않습니다. **일시정지만 신경
쓰면 됩니다.**

### 공개 키는 노출해도 됩니다 (키 이름이 두 가지입니다)

브라우저에 넣는 키는 노출되도록 설계된 것입니다. 숨길 필요가 없고 숨길 수도
없습니다.

Supabase가 키 체계를 바꾸는 중이라 대시보드에서 두 가지를 볼 수 있습니다.

| 이름 | 모양 | 비고 |
|---|---|---|
| **publishable** | `sb_publishable_...` | 새 이름. 새로 만든 프로젝트는 이걸 줍니다 |
| anon | `eyJhbGciOi...` (JWT) | 옛 이름. **2026년 말 지원 종료 예정** |

둘 다 같은 자리에 들어가고 하는 일도 같습니다. **대시보드에 보이는 걸 그대로
붙여넣으면 됩니다** — 코드가 둘 다 받습니다.

**접근 제어는 키가 아니라 RLS(행 수준 보안)가 합니다.** 그래서 아래 4번의
RLS 설정이 이 문서에서 가장 중요합니다. 테이블을 만들고 RLS를 켜지 않으면,
anon 키를 가진 누구나 모든 사람의 일정을 읽고 고칠 수 있습니다.

`service_role` 키는 다릅니다 — **절대 클라이언트에 넣지 마세요.** RLS를
통째로 우회합니다. 이 앱은 쓰지 않습니다.

---

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com/) 가입 (GitHub 계정으로 가능)
2. **New project**
3. 입력할 것
   - **Name**: 아무거나 (예: `travel-tomodachi`)
   - **Database Password**: 강한 비밀번호. **따로 적어두세요** — 나중에 직접
     DB에 붙을 때 필요하고, 분실하면 재설정해야 합니다
   - **Region**: 사용자와 가까운 곳. 한국이면 `Northeast Asia (Seoul)`
4. 생성까지 2~3분 기다립니다

### 1-1. 키 두 개 복사

**Project Settings** → **API Keys**
(빠른 길: 상단 **Connect** 버튼에도 공개 키가 있습니다)

| 대시보드에 보이는 것 | 넣을 곳 |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_...`) | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| 또는 `anon` `public` (`eyJ...`) | `VITE_SUPABASE_ANON_KEY` |

```bash
# .env.local — 보이는 쪽 하나만 채우면 됩니다
VITE_SUPABASE_URL=https://abcdefghijklm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Project URL은 **Project Settings → General**이나 API Keys 화면 상단에 있습니다.

> 같은 화면에 **Secret key**(`sb_secret_...`)와 **service_role**도 있습니다.
> **복사하지 마세요.** RLS를 통째로 우회해서, 브라우저에 들어가는 순간
> 누구나 모든 데이터를 읽고 지울 수 있습니다.

---

## 2. Google OAuth 클라이언트 발급

지도용으로 이미 Google Cloud 프로젝트를 만드셨다면 **같은 프로젝트를 쓰면
됩니다.** 새로 만들 필요 없습니다.

### 2-1. 콜백 주소부터 확인

먼저 Supabase에서 주소를 복사해 둡니다. 이걸 Google에 등록해야 합니다.

Supabase 대시보드 → **Authentication** → **Sign In / Providers** → **Google**

거기 적힌 **Callback URL (for OAuth)**을 복사합니다. 이런 모양입니다:

```
https://<프로젝트-ref>.supabase.co/auth/v1/callback
```

> 손으로 입력하지 말고 대시보드에서 복사하세요. 한 글자만 달라도
> `redirect_uri_mismatch` 오류가 납니다.

### 2-2. 동의 화면 설정

[Google Cloud Console](https://console.cloud.google.com/) →
**API 및 서비스** → **OAuth 동의 화면**

- **User Type**: External
- **앱 이름**: 사용자가 로그인할 때 보게 될 이름입니다. "TravelTomodachi"처럼
  알아볼 수 있게 적으세요
- **사용자 지원 이메일**, **개발자 연락처**: 본인 이메일

**범위(Scopes)는 추가하지 마세요.** 기본값이면 충분합니다. 이 앱은 이메일도
프로필 사진도 쓰지 않습니다 — 닉네임은 사용자가 직접 정합니다.

테스트 단계에서는 **테스트 사용자**에 같이 쓸 친구들의 Google 계정을
추가해야 합니다. 안 그러면 그 사람들은 로그인할 수 없습니다.

### 2-3. 클라이언트 ID 만들기

**사용자 인증 정보** → **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**

- **애플리케이션 유형**: 웹 애플리케이션
- **승인된 JavaScript 원본**:
  ```
  http://localhost:5173
  ```
  배포 주소가 생기면 그것도 추가합니다.
- **승인된 리디렉션 URI**: 2-1에서 복사한 Supabase 콜백 주소

만들면 **클라이언트 ID**와 **클라이언트 보안 비밀번호**가 나옵니다.

> 이 둘은 `.env.local`에 넣지 **않습니다.** Supabase 대시보드에만 넣습니다.
> 클라이언트 보안 비밀번호는 이름 그대로 비밀이라 브라우저에 두면 안 됩니다.

### 2-4. Supabase에 등록

Supabase → **Authentication** → **Sign In / Providers** → **Google**

- **Enable Sign in with Google**: 켜기
- **Client ID**, **Client Secret**: 2-3에서 받은 값
- **Save**

---

## 3. 리다이렉트 주소 등록

Supabase → **Authentication** → **URL Configuration**

- **Site URL**: `http://localhost:5173` (배포 후에는 배포 주소)
- **Redirect URLs**에 추가:
  ```
  http://localhost:5173
  http://localhost:5173/**
  ```

> **Capacitor 전환 제약 #4.** 앱으로 감싸면 출처가 `capacitor://localhost`가
> 됩니다. 그때 여기에 `capacitor://localhost/**`를 추가하고, 코드에서는
> `platform.authRedirectUrl`을 쓰면 됩니다 — 화면 코드는 그대로입니다.

---

## 4. 테이블과 RLS

**이 단계를 건너뛰면 anon 키를 가진 누구나 모든 일정을 읽고 고칠 수 있습니다.**

Supabase → **SQL Editor** → 아래를 붙여넣고 실행합니다.

```sql
-- 프로필: 닉네임 하나만. 이메일·실명은 저장하지 않는다.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 읽기: 로그인한 사람은 다른 사람의 닉네임을 볼 수 있어야 한다.
-- 같은 일정을 보는 친구가 누구인지 표시해야 하기 때문이다.
create policy "프로필은 로그인한 사람이 읽는다"
  on public.profiles for select
  to authenticated
  using (true);

-- 쓰기: 자기 것만.
create policy "자기 프로필만 만든다"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "자기 프로필만 고친다"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 가입하면 프로필을 자동으로 만든다.
-- 닉네임 기본값은 '여행자'이고, 사용자가 프로필 화면에서 바꾼다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, '여행자');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

> `security definer`가 필요한 이유: 트리거는 새 사용자가 아직 인증되기 전에
> 돌기 때문에, 함수가 호출자 권한으로 실행되면 RLS에 막혀 프로필이
> 만들어지지 않습니다.

### 여행·일정 테이블

로그인이 동작하는 걸 확인한 뒤, [`supabase/schema.sql`](../supabase/schema.sql)을
같은 SQL Editor에 통째로 붙여넣고 실행합니다. 여행·멤버·날짜·항목·체크리스트
테이블과 각각의 RLS 정책, 초대 코드로 참가하는 함수까지 한 번에 만듭니다.

> ⚠️ 그 파일은 테이블을 **새로 만드는** 스크립트입니다. 이미 데이터가 있는
> 상태에서 돌리면 전부 지워집니다. 마이그레이션이 아닙니다.

이어서 순서대로 실행합니다 (모두 덧붙이기용이라 데이터를 지우지 않고, 여러 번 돌려도 안전):

| 파일 | 하는 일 |
|---|---|
| [`supabase/realtime.sql`](../supabase/realtime.sql) | 실시간 동기화 켜기 |
| [`supabase/sharing.sql`](../supabase/sharing.sql) | 누가 고쳤는지, 권한 구멍 막기, 초대 코드 바꾸기 (새 DB면 schema.sql에 이미 있음 — 돌려도 무해) |
| [`supabase/profile-tag.sql`](../supabase/profile-tag.sql) | 닉네임 번호(#1234) |
| [`supabase/limits.sql`](../supabase/limits.sql) | 글자 수·개수 상한 — 한 사람이 DB를 채우지 못하게 (**새 DB도 실행**) |
| [`supabase/account-delete.sql`](../supabase/account-delete.sql) | 회원 탈퇴 함수 + "누가 고쳤는지" 트리거가 탈퇴를 막지 않게 (새 DB면 schema.sql에 이미 있음) |
| [`supabase/security-hardening.sql`](../supabase/security-hardening.sql) | 보안 보강 — 프로필은 같은 여행 멤버만, 멤버 직접 추가 금지, 후보 장소 사칭 금지 (새 DB면 schema.sql에 이미 있음) |

> 위 프로필 SQL의 읽기 정책("로그인한 누구나")은 schema.sql·security-hardening.sql이
> "자기와 같은 여행 멤버만"으로 좁힌다. 보안 시나리오 테스트: `npm run test:rls`
| [`supabase/expenses.sql`](../supabase/expenses.sql) | 공동 가계부 + 예약 번호 칸 (새 DB면 schema.sql에 이미 있음 — 돌려도 무해) |
| [`supabase/collab.sql`](../supabase/collab.sql) | 후보 장소 투표 + 일정 댓글 (새 DB면 schema.sql에 이미 있음 — 돌려도 무해) |

---

## 5. 코드 연결

여기까지 하면 설정은 끝이고, 코드에 구현체 하나를 추가하면 됩니다.

```
src/auth/
  types.ts              AuthProvider 인터페이스 — 화면은 이것만 본다
  mockAuthProvider.ts   개발용 (지금 동작하는 것)
  supabaseAuthProvider.ts   ← 여기에 추가
  index.ts              둘 중 하나를 고르는 분기
```

`index.ts`의 `hasBackend`가 이미 env 두 개를 보고 판단합니다. 구현체를 만들고
분기에 끼우면 **화면 코드는 한 줄도 바뀌지 않습니다.**

`@supabase/supabase-js` 설치가 필요합니다.

---

## 6. 안 될 때

| 증상 | 원인 |
|---|---|
| `redirect_uri_mismatch` | Google의 리디렉션 URI가 Supabase 콜백 주소와 다름. 대시보드에서 다시 복사해 붙여넣기 |
| 로그인 후 빈 화면으로 돌아옴 | Supabase **URL Configuration**에 `http://localhost:5173`이 없음 |
| `403 access_denied` | 동의 화면이 테스트 모드인데 그 계정이 **테스트 사용자**에 없음 |
| 친구가 아무것도 못 봄 | 프로젝트가 일시정지됨 (7일 미사용). 대시보드에서 복구 |
| 데이터가 안 읽힘 | RLS는 켰는데 select 정책이 없음. 정책 없이 RLS만 켜면 **전부 차단**됩니다 |
| env를 넣었는데 그대로 목으로 동작 | dev 서버 재시작 안 함 (Vite는 시작할 때만 env를 읽음) |

---

## 7. Apple 로그인을 나중에 추가한다면

**Apple Developer Program 가입($99/년)이 필요합니다.** 그래서 지금은 빼뒀습니다.

가입 후에는 Service ID와 키를 만들어 Supabase의 Apple 제공자에 등록하고,
`src/auth/` 구현체에서 방식 목록에 `'apple'`을 더하면 화면에 버튼이 생깁니다.
로그인 화면은 방식 목록을 그대로 그리므로 **화면 코드는 고치지 않습니다.**

> 참고: iOS 앱스토어에 올릴 때는 다른 소셜 로그인을 제공하면 Apple 로그인도
> 제공해야 합니다. 웹으로만 쓰는 동안에는 선택입니다.
