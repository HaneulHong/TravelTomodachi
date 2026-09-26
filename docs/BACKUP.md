# 백업과 되살리기

Supabase 무료 요금제는 자동 백업을 내려받을 수 없다. 친구들 일정이 쌓이면 가끔 직접 떠 둔다.
**큰 변경(SQL 실행) 전에는 꼭.**

## 백업

```
npm run backup
```

1. Supabase 대시보드 → 위쪽 **Connect** → **Session pooler** → URI 복사
2. `[YOUR-PASSWORD]` 자리에 DB 비밀번호(프로젝트 만들 때 정한 것)를 넣는다.
   잊었으면 Project Settings → Database → Reset database password
3. 스크립트가 물으면 붙여넣는다 — 화면에 안 보이고 어디에도 저장되지 않는다

`backups/tt-날짜-시각/`에 두 파일이 생긴다(`.gitignore`에 걸려 커밋되지 않는다).

| 파일 | 내용 |
|---|---|
| `public.dump` | 앱의 표·정책·함수·데이터 전부 |
| `auth-users.sql` | 로그인 계정 — **이메일이 들어 있다. 공유 폴더·메신저에 올리지 않는다** |

서버가 PostgreSQL 17이면 `brew install postgresql@17`이 필요하다(스크립트가 알려 준다).

## 되살리기 (새 Supabase 프로젝트로)

사고로 프로젝트를 잃었을 때. 같은 프로젝트에 덮어쓰지 않는다 — 새 프로젝트를 만든다.

1. 새 프로젝트를 만들고 Google 로그인을 다시 연결한다([AUTH_SETUP.md](./AUTH_SETUP.md) 1~3단계)
2. 로그인 계정부터 (프로필·멤버가 이 계정들을 가리킨다):
   ```
   psql "<새 프로젝트 Session pooler URI>" -f backups/tt-…/auth-users.sql
   ```
3. 앱 표·데이터:
   ```
   pg_restore --no-owner -d "<새 프로젝트 Session pooler URI>" backups/tt-…/public.dump
   ```
   `schema "public" already exists` 오류 하나는 무시해도 된다.
4. SQL Editor에서 이어서:
   - [AUTH_SETUP.md](./AUTH_SETUP.md) 첫 SQL 블록의 **마지막 트리거 문장**(`create trigger on_auth_user_created …`) —
     auth 쪽 트리거라 백업에 안 들어 있다
   - `supabase/realtime.sql` — 실시간 설정은 백업에 안 들어 있다
5. `.env.local`과 Cloudflare 환경 변수의 Supabase URL·키를 새 프로젝트 것으로 바꾸고 다시 배포

Google 로그인 연결 정보(auth.identities)는 백업하지 않는다. 사용자가 같은 Google 계정으로 다시
로그인하면 같은 이메일의 계정에 이어진다.

## 확인한 것 (2026-09-26)

로컬 일회용 DB에 계정·여행·일정을 넣고 백업 → 새 DB에 되살려 계정 1·여행 1·일정 1·정책 35개가
그대로 돌아오는 것을 확인했다. 운영 DB로는 아직 돌려 보지 않았다(비밀번호가 필요해 사용자가 한다).
