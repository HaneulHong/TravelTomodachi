-- 글자 수·개수 상한 — 한 사람이 무료 DB(500MB)를 채우거나 여행을 느리게 만드는 것을 막는다
--
-- 이미 쓰던 DB에 덧붙이는 스크립트. 데이터를 지우지 않고, 여러 번 돌려도 안전하다.
-- 새 DB도 이 파일을 schema.sql·realtime·expenses·collab 뒤에 돌린다(AUTH_SETUP.md 4단계).
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 숫자는 앱 입력칸과 같다 — src/domain/limits.ts. 한쪽을 바꾸면 다른 쪽도 바꾼다.
-- 상한은 평소 쓰임으로는 닿지 않을 만큼 넉넉하게 잡았다(막으려는 건 공격이지 긴 여행이 아니다).
--
-- 도우미 함수 없이 평범한 문장만 쓴다 — Supabase SQL Editor에서 그대로 돌아가게.
--
-- 글자 수 제약은 NOT VALID로 건다 — 이미 있는 행은 검사하지 않고 새로 쓰는 값부터 막는다.
-- 혹시 기존 값이 넘어도 이 스크립트가 실패하지 않는다.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 글자 수
-- ═══════════════════════════════════════════════════════════════════

alter table public.items drop constraint if exists items_place_name_len;
alter table public.items
  add constraint items_place_name_len check (place_name is null or char_length(place_name) <= 200) not valid;

alter table public.items drop constraint if exists items_to_place_name_len;
alter table public.items
  add constraint items_to_place_name_len check (to_place_name is null or char_length(to_place_name) <= 200) not valid;

alter table public.items drop constraint if exists items_description_len;
alter table public.items
  add constraint items_description_len check (description is null or char_length(description) <= 2000) not valid;

alter table public.items drop constraint if exists items_carrier_code_len;
alter table public.items
  add constraint items_carrier_code_len check (carrier_code is null or char_length(carrier_code) <= 40) not valid;

alter table public.items drop constraint if exists items_sort_key_len;
alter table public.items
  add constraint items_sort_key_len check (sort_key is null or char_length(sort_key) <= 200) not valid;

alter table public.trip_days drop constraint if exists trip_days_city_label_len;
alter table public.trip_days
  add constraint trip_days_city_label_len check (city_label is null or char_length(city_label) <= 30) not valid;

alter table public.trip_days drop constraint if exists trip_days_timezone_len;
alter table public.trip_days
  add constraint trip_days_timezone_len check (timezone is null or char_length(timezone) <= 64) not valid;

alter table public.trips drop constraint if exists trips_cover_emoji_len;
alter table public.trips
  add constraint trips_cover_emoji_len check (cover_emoji is null or char_length(cover_emoji) <= 16) not valid;

alter table public.places drop constraint if exists places_place_name_len;
alter table public.places
  add constraint places_place_name_len check (place_name is null or char_length(place_name) <= 200) not valid;

-- 나눠 낼 사람 목록 (배열 길이)
alter table public.expenses drop constraint if exists expenses_split_among_len;
alter table public.expenses
  add constraint expenses_split_among_len check (cardinality(split_among) <= 100) not valid;

-- ═══════════════════════════════════════════════════════════════════
-- 2. 개수 — 한 여행에 넣을 수 있는 행 수
--
-- 멤버 한 명이 일정·댓글을 수만 개 넣으면 DB가 차고 그 여행을 여는 모든 사람이 느려진다.
-- 넣기 전에 센다. trip_id 색인이 있어 빠르다(없는 표는 아래에서 만든다).
-- 초대 코드 참가(security definer 함수)도 이 트리거를 거친다 — 멤버 수 상한도 같이 걸린다.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.enforce_trip_row_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap int := tg_argv[0]::int;
  n int;
begin
  execute format('select count(*) from public.%I where trip_id = $1', tg_table_name)
    into n using new.trip_id;
  if n >= cap then
    -- 앞부분은 앱이 번역에 쓰는 고정 문구다(i18n serverErrors.tooMany) — 바꾸면 거기도
    raise exception '한 여행에 넣을 수 있는 개수를 넘었습니다 (%: 최대 %)', tg_table_name, cap;
  end if;
  return new;
end;
$$;

create index if not exists checklist_trip_idx on public.checklist (trip_id);
create index if not exists comments_trip_idx on public.comments (trip_id);

drop trigger if exists items_row_cap on public.items;
create trigger items_row_cap
  before insert on public.items
  for each row execute procedure public.enforce_trip_row_cap(3000);

drop trigger if exists checklist_row_cap on public.checklist;
create trigger checklist_row_cap
  before insert on public.checklist
  for each row execute procedure public.enforce_trip_row_cap(500);

drop trigger if exists expenses_row_cap on public.expenses;
create trigger expenses_row_cap
  before insert on public.expenses
  for each row execute procedure public.enforce_trip_row_cap(3000);

drop trigger if exists places_row_cap on public.places;
create trigger places_row_cap
  before insert on public.places
  for each row execute procedure public.enforce_trip_row_cap(500);

drop trigger if exists comments_row_cap on public.comments;
create trigger comments_row_cap
  before insert on public.comments
  for each row execute procedure public.enforce_trip_row_cap(5000);

drop trigger if exists trip_days_row_cap on public.trip_days;
create trigger trip_days_row_cap
  before insert on public.trip_days
  for each row execute procedure public.enforce_trip_row_cap(400);

drop trigger if exists trip_members_row_cap on public.trip_members;
create trigger trip_members_row_cap
  before insert on public.trip_members
  for each row execute procedure public.enforce_trip_row_cap(100);

-- ── 한 사람이 만들 수 있는 여행 수 ─────────────────────────────────
create or replace function public.enforce_trips_per_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.trips where owner_id = new.owner_id) >= 200 then
    raise exception '만들 수 있는 여행 수를 넘었습니다 (최대 200)';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_per_owner_cap on public.trips;
create trigger trips_per_owner_cap
  before insert on public.trips
  for each row execute procedure public.enforce_trips_per_owner();

notify pgrst, 'reload schema';
