#!/usr/bin/env bash
# 운영 DB 백업 — Supabase 무료 요금제는 자동 백업을 내려받을 수 없어서 직접 떠 둔다.
#
#   npm run backup
#
# 무엇을: public 스키마 전체(표·정책·함수·데이터) + 로그인 계정(auth.users)
# 어디에: backups/tt-날짜-시각/  ← .gitignore에 걸려 있다. **이메일이 들어 있으니 공유하지 말 것**
# 필요:   PostgreSQL 클라이언트 — 서버와 같거나 높은 버전 (brew install postgresql@17 등)
#
# 연결 문자열은 Supabase 대시보드 → 위쪽 **Connect** → **Session pooler**의 URI.
# (Direct connection은 IPv6만 돼서 집 인터넷에서 안 될 수 있다)
# [YOUR-PASSWORD] 자리에 DB 비밀번호를 넣은 전체 문자열을 붙여넣는다.
# 비밀번호는 화면에 보이지 않고, 어디에도 저장되지 않는다(셸 기록에도 안 남는다).
#
# 되살리기는 docs/BACKUP.md.
set -euo pipefail
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  URL="$SUPABASE_DB_URL"
else
  read -rsp "Supabase DB 연결 문자열(Session pooler URI): " URL
  echo
fi
[ -z "$URL" ] && { echo "연결 문자열이 비었습니다"; exit 1; }

# 서버보다 낮은 pg_dump는 거부된다 — 설치된 것 중 가장 높은 버전을 쓴다
pick_bin() {
  if [ -n "${PG_BIN:-}" ]; then echo "$PG_BIN"; return; fi
  for v in 18 17 16 15; do
    d="$(brew --prefix "postgresql@$v" 2>/dev/null)/bin"
    [ -x "$d/pg_dump" ] && { echo "$d"; return; }
  done
  dirname "$(command -v pg_dump)"
}
BIN="$(pick_bin)"
client_major=$("$BIN/pg_dump" --version | grep -oE '[0-9]+' | head -1)
server_major=$("$BIN/psql" "$URL" -XAtc 'show server_version_num' | cut -c1-2)
if [ "$client_major" -lt "$server_major" ]; then
  echo "서버는 PostgreSQL $server_major, 이 컴퓨터의 pg_dump는 $client_major입니다."
  echo "  brew install postgresql@$server_major   후 다시 실행하세요."
  exit 1
fi

OUT="$ROOT/backups/tt-$(date +%Y%m%d-%H%M)"
mkdir -p "$OUT"
chmod 700 "$ROOT/backups" "$OUT"

echo "public 스키마(표·정책·함수·데이터) …"
"$BIN/pg_dump" "$URL" --schema=public --no-owner --no-privileges -Fc -f "$OUT/public.dump"

echo "로그인 계정(auth.users) …"
# 프로필·멤버가 auth.users를 가리켜서, 되살릴 때 계정이 먼저 있어야 한다
"$BIN/pg_dump" "$URL" --table=auth.users --data-only --no-owner -f "$OUT/auth-users.sql"

chmod 600 "$OUT"/*
echo
echo "완료: ${OUT#"$ROOT"/}"
ls -lh "$OUT" | tail -n +2
echo
echo "⚠️  로그인 이메일이 들어 있습니다. 클라우드 공유 폴더·메신저에 올리지 마세요."
