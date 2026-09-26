#!/usr/bin/env bash
# RLS·권한 시나리오 테스트 — 운영 DB를 건드리지 않고, 로컬에 일회용 DB를 띄워 돌린다.
#
#   npm run test:rls
#
# 필요: PostgreSQL 16 (brew install postgresql@16)
#
# 순서는 실제 DB에 적용한 순서와 같다:
#   Supabase 흉내 → 프로필(AUTH_SETUP.md의 SQL) → schema → sharing → realtime →
#   expenses → collab → profile-tag → limits → account-delete → security-hardening(있으면)
# 새 SQL 파일을 만들면 아래 FILES에 더한다.
set -euo pipefail
# macOS: 로케일 변수가 없으면 postgres가 "postmaster became multithreaded"로 시작하지 않는다
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(brew --prefix postgresql@16 2>/dev/null)/bin}"
PORT="${RLS_TEST_PORT:-54329}"
WORK="$(mktemp -d)"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

psql() { "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

# 프로필 테이블은 docs/AUTH_SETUP.md의 첫 SQL 블록이 원본이다 (복사해 두지 않는다)
awk '/^```sql/{f=1;n++;next} /^```/{f=0} f&&n==1' "$ROOT/docs/AUTH_SETUP.md" > "$WORK/profiles.sql"

FILES=(
  "$ROOT/scripts/security/supabase-shim.sql"
  "$WORK/profiles.sql"
  "$ROOT/supabase/schema.sql"
  "$ROOT/supabase/sharing.sql"
  "$ROOT/supabase/realtime.sql"
  "$ROOT/supabase/expenses.sql"
  "$ROOT/supabase/collab.sql"
  "$ROOT/supabase/profile-tag.sql"
  "$ROOT/supabase/limits.sql"
  "$ROOT/supabase/account-delete.sql"
)
# SKIP_HARDENING=1: 새 DB용 파일만으로도 안전한지 (덧붙이기 SQL 없이) 확인할 때
if [ -z "${SKIP_HARDENING:-}" ] && [ -f "$ROOT/supabase/security-hardening.sql" ]; then
  FILES+=("$ROOT/supabase/security-hardening.sql")
fi

for f in "${FILES[@]}"; do
  if ! psql -f "$f" >"$WORK/apply.log" 2>&1; then
    echo "✗ 적용 실패: ${f#"$ROOT"/}"
    cat "$WORK/apply.log"
    exit 1
  fi
done
echo "SQL 적용: ${#FILES[@]}개 파일"

# 알림(✓ ✗)만 보여 준다
psql -f "$ROOT/scripts/security/rls.test.sql" 2>&1 \
  | sed -E 's/^psql:[^:]*:[0-9]+: NOTICE:  //; s/^NOTICE:  //' \
  | tee "$WORK/raw.txt" | grep -E '^(  [✓✗]|──|결과)' | tee "$WORK/out.txt"

grep -q '  ✗' "$WORK/out.txt" && exit 1 || exit 0
