-- 글자 수·개수 상한 — 한 사람이 무료 DB(500MB)를 채우거나 여행을 느리게 만드는 것을 막는다
--
-- 이미 쓰던 DB에 덧붙이는 스크립트. 데이터를 지우지 않고, 여러 번 돌려도 안전하다.
-- 새 DB도 이 파일을 schema.sql·realtime·expenses·collab 뒤에 돌린다(AUTH_SETUP.md 4단계).
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 숫자는 앱 입력칸과 같다 — src/domain/limits.ts. 한쪽을 바꾸면 다른 쪽도 바꾼다.
-- 상한은 평소 쓰임으로는 닿지 않을 만큼 넉넉하게 잡았다(막으려는 건 공격이지 긴 여행이 아니다).
--
-- 글자 수 제약은 NOT VALID로 건다 — 이미 있는 행은 검사하지 않고 새로 쓰는 값부터 막는다.
-- 혹시 기존 값이 넘어도 이 스크립트가 실패하지 않는다.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 글자 수
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.add_len(tbl text, col text, max int)
returns void language plpgsql as $$
declare cname text := format('%s_%s_len', tbl, col);
begin
  execute format('alter table public.%I drop constraint if exists %I', tbl, cname);
  execute format(
    'alter table public.%I add constraint %I check (%I is null or char_length(%I) <= %s) not valid',
    tbl, cname, col, col, max);
end;
$$;

select pg_temp.add_len('items', 'place_name', 200);
select pg_temp.add_len('items', 'to_place_name', 200);
select pg_temp.add_len('items', 'description', 2000);
select pg_temp.add_len('items', 'carrier_code', 40);
select pg_temp.add_len('items', 'sort_key', 200);
select pg_temp.add_len('trip_days', 'city_label', 30);
select pg_temp.add_len('trip_days', 'timezone', 64);
select pg_temp.add_len('trips', 'cover_emoji', 16);
select pg_temp.add_len('places', 'place_name', 200);

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

create or replace function pg_temp.add_cap(tbl text, cap int)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists %I on public.%I', tbl || '_row_cap', tbl);
  execute format(
    'create trigger %I before insert on public.%I for each row execute procedure public.enforce_trip_row_cap(%s)',
    tbl || '_row_cap', tbl, cap);
end;
$$;

select pg_temp.add_cap('items', 3000);
select pg_temp.add_cap('checklist', 500);
select pg_temp.add_cap('expenses', 3000);
select pg_temp.add_cap('places', 500);
select pg_temp.add_cap('comments', 5000);
select pg_temp.add_cap('trip_days', 400);
select pg_temp.add_cap('trip_members', 100);

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
