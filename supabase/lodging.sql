-- 날마다 숙소
--
-- 이미 데이터가 있는 DB에 **덧붙이는** 스크립트다. 아무것도 지우지 않고,
-- 여러 번 실행해도 안전하다. (새 DB라면 schema.sql에 이미 들어 있다 — 돌려도 무해)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 앱은 이걸 실행하기 전에도 깨지지 않는다. 숙소를 저장하려 할 때만 실패를 알린다.
--
-- 그 날 묵는 숙소를 날짜에 붙인다. 하루의 끝(마지막 일정 → 숙소)이 되고, 다음 날의
-- 시작(숙소 → 첫 일정)이 된다. 이동 시간 계산이 하루의 양 끝까지 닿는다.
-- 권한은 날짜와 같다 — 멤버가 고친다(trip_days 정책).

alter table public.trip_days add column if not exists lodging_name text;
alter table public.trip_days add column if not exists lodging_lat double precision;
alter table public.trip_days add column if not exists lodging_lng double precision;

-- 다른 이름 칸과 같은 상한 (limits.sql의 place_name 200자)
alter table public.trip_days drop constraint if exists trip_days_lodging_name_len;
alter table public.trip_days
  add constraint trip_days_lodging_name_len
  check (lodging_name is null or char_length(lodging_name) <= 200) not valid;

-- API가 새 칸을 알아보게 캐시를 새로고침한다
notify pgrst, 'reload schema';
