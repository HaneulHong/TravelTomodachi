#!/usr/bin/env bash
# 운영 서비스를 **밖에서** 점검한다 — 로그인 안 한 사람이 할 수 있는 것만 시도한다.
#
#   npm run test:live
#
# 데이터를 만들거나 바꾸지 않는다(쓰기 시도는 전부 막혀야 정상이고, 실제로 막힌다).
# 로그인한 사용자 사이의 권한은 로컬 DB로 시험한다: npm run test:rls
#
# 읽는 것: .env.local의 VITE_SUPABASE_URL · 공개 키, 배포 주소(VITE_PUBLIC_BASE_URL)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a
# shellcheck disable=SC1091
. "$ROOT/.env.local"
set +a

API="$VITE_SUPABASE_URL"
KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
SITE="${VITE_PUBLIC_BASE_URL:-https://traveltomodachi.pages.dev}"
[ -z "$SITE" ] && SITE="https://traveltomodachi.pages.dev"

fails=0
ok()   { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1  ($2)"; fails=$((fails + 1)); }
warn() { echo "  ! $1"; }

req() { curl -s -o /tmp/tt-live-body -w "%{http_code}" -H "apikey: $KEY" -H "Content-Type: application/json" "$@"; }

echo "── 로그인 없이 읽기 (빈 목록이어야) ──"
for t in trips trip_members trip_days items checklist expenses places place_votes comments profiles; do
  code=$(req "$API/rest/v1/$t?select=*&limit=1")
  body=$(cat /tmp/tt-live-body)
  if [ "$code" = "200" ] && [ "$body" = "[]" ] || [ "$code" = "401" ]; then ok "$t"; else bad "$t" "$code $body"; fi
done

echo "── 로그인 없이 쓰기 (막혀야) ──"
Z=00000000-0000-0000-0000-000000000001
try_insert() {
  code=$(req -X POST -d "$2" "$API/rest/v1/$1")
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then ok "$1 INSERT"; else bad "$1 INSERT" "$code $(head -c 120 /tmp/tt-live-body)"; fi
}
try_insert trips "{\"name\":\"x\",\"start_date\":\"2026-01-01\",\"end_date\":\"2026-01-01\",\"owner_id\":\"$Z\"}"
try_insert profiles "{\"id\":\"$Z\",\"nickname\":\"x\"}"
try_insert trip_members "{\"trip_id\":\"$Z\",\"user_id\":\"$Z\"}"
try_insert items "{\"trip_id\":\"$Z\",\"date\":\"2026-01-01\",\"sort_key\":\"a0\",\"title\":\"x\"}"

echo "── 로그인 없이 함수 호출 (막혀야) ──"
for f in "join_trip_by_code:{\"code\":\"AAAAAAAA\"}" "regenerate_invite_code:{\"trip\":\"$Z\"}" \
         "is_trip_member:{\"trip\":\"$Z\"}" "is_trip_owner:{\"trip\":\"$Z\"}" "new_invite_code:{}" \
         "shares_trip_with:{\"other\":\"$Z\"}"; do
  name=${f%%:*}; body=${f#*:}
  code=$(req -X POST -d "$body" "$API/rest/v1/rpc/$name")
  case "$code" in
    401|403|404) ok "$name" ;;
    *) bad "$name" "$code $(head -c 80 /tmp/tt-live-body)" ;;
  esac
done

echo "── 로그인 방식 ──"
settings=$(curl -s -H "apikey: $KEY" "$API/auth/v1/settings")
enabled=$(printf %s "$settings" | python3 -c "import json,sys; d=json.load(sys.stdin); print(' '.join(k for k,v in d.get('external',{}).items() if v))")
echo "  켜진 방식: $enabled"
if printf %s " $enabled " | grep -q " email "; then
  bad "이메일 가입이 켜져 있음" "앱은 Google만 쓴다 — Supabase → Authentication → Sign In / Providers → Email 끄기"
else ok "이메일 가입 꺼짐"; fi
printf %s " $enabled " | grep -q " anonymous_users " && bad "익명 로그인이 켜져 있음" "끄기" || ok "익명 로그인 꺼짐"

echo "── 배포 사이트 ($SITE) ──"
headers=$(curl -sI "$SITE/")
printf %s "$headers" | grep -qi '^x-frame-options: *deny' && ok "다른 사이트 iframe 금지(X-Frame-Options)" || bad "X-Frame-Options 없음" "public/_headers가 배포됐는지"
printf %s "$headers" | grep -qi "frame-ancestors 'none'" && ok "frame-ancestors 'none'" || bad "frame-ancestors 없음" "public/_headers"
printf %s "$headers" | grep -qi "^content-security-policy: *default-src" && ok "콘텐츠 보안 정책(CSP) 적용" || bad "CSP가 적용되지 않음(보고 모드이거나 없음)" "public/_headers"
for p in .env .env.local .git/config supabase/schema.sql; do
  first=$(curl -s "$SITE/$p" | head -c 200)
  if printf %s "$first" | grep -qi '<!doctype html'; then ok "/$p 노출 안 됨"; else bad "/$p" "$(printf %s "$first" | head -c 60)"; fi
done
js=$(curl -s "$SITE/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
bundle=$(curl -s "$SITE/$js")
printf %s "$bundle" | grep -Eq 'sb_secret_[A-Za-z0-9_-]{10,}' && bad "번들에 Supabase 비밀 키" "즉시 키 교체" || ok "번들에 Supabase 비밀 키 없음"
printf %s "$bundle" | grep -q 'GOCSPX' && bad "번들에 Google OAuth 시크릿" "즉시 교체" || ok "번들에 Google OAuth 시크릿 없음"
roles=$(printf %s "$bundle" | grep -o 'eyJ[A-Za-z0-9_-]\{10,\}\.[A-Za-z0-9_-]\{10,\}\.[A-Za-z0-9_-]*' | sort -u | while read -r t; do printf %s "$t" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | grep -o '"role":"[a-z_]*"'; done)
printf %s "$roles" | grep -q service_role && bad "번들에 service_role 키" "즉시 키 교체" || ok "번들에 service_role 키 없음"

rm -f /tmp/tt-live-body
echo
echo "결과: 실패 $fails건"
[ "$fails" -eq 0 ]
