-- TravelTomodachi 스키마
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 짰다 (drop if exists / create or replace).
--
-- ⚠️ 이미 데이터가 있는 상태에서 돌리면 trips·items가 전부 지워진다.
--    테이블을 새로 만드는 스크립트이지 마이그레이션이 아니다.
--
-- ─────────────────────────────────────────────────────────────────────
-- 이 파일에서 가장 조심한 것: RLS 재귀
--
-- trips 정책이 "내가 이 여행의 멤버인가?"를 trip_members에서 확인하고,
-- trip_members 정책도 같은 걸 trip_members에서 확인하면 무한 재귀가 난다
-- (infinite recursion detected in policy for relation "trip_members").
--
-- 그래서 멤버십 확인을 security definer 함수 하나로 빼냈다. 이 함수는
-- 호출자가 아니라 **소유자 권한**으로 돌기 때문에 RLS를 거치지 않고,
-- 따라서 정책 안에서 불러도 재귀가 생기지 않는다.
-- ─────────────────────────────────────────────────────────────────────

-- ── 정리 ──────────────────────────────────────────────────────────
drop trigger if exists on_trip_created on public.trips;
drop trigger if exists on_item_updated on public.items;
drop function if exists public.handle_new_trip();
drop function if exists public.touch_updated_at();
drop function if exists public.join_trip_by_code(text);
drop function if exists public.is_trip_member(uuid);
drop function if exists public.is_trip_owner(uuid);
drop function if exists public.new_invite_code();

drop table if exists public.checklist cascade;
drop table if exists public.items cascade;
drop table if exists public.trip_days cascade;
drop table if exists public.trip_members cascade;
drop table if exists public.trips cascade;

-- ── 초대 코드 ─────────────────────────────────────────────────────
-- 사람이 불러줄 수 있어야 해서 8자로 짧게 하고, 헷갈리는 글자를 뺀다.
-- (0/O, 1/I/L — 전화로 코드를 불러주다 틀리는 일이 실제로 잦다)
create function public.new_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
           (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 8);
$$;

-- ── 여행 ──────────────────────────────────────────────────────────
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  start_date date not null,
  end_date date not null,
  owner_id uuid not null references auth.users on delete cascade,
  invite_code text not null unique default public.new_invite_code(),
  cover_emoji text not null default '🧳',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ── 멤버 ──────────────────────────────────────────────────────────
create table public.trip_members (
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ── 날짜별 타임존 ─────────────────────────────────────────────────
-- 타임존을 day 단위로 두는 이유는 ARCHITECTURE.md 참고.
-- 벽시계 시간을 그대로 저장하고, 그 날이 어느 타임존인지를 여기에 붙인다.
create table public.trip_days (
  trip_id uuid not null references public.trips on delete cascade,
  date date not null,
  timezone text not null,
  city_label text not null default '',
  primary key (trip_id, date)
);

-- ── 일정 항목 ─────────────────────────────────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  date date not null,

  -- 정수 인덱스가 아니라 fractional index(문자열)다.
  -- 두 사람이 동시에 순서를 바꿔도 충돌하지 않고, 재정렬할 때 다른 행을
  -- 건드리지 않는다. 동시 편집에서 가장 까다로운 부분이 이걸로 풀린다.
  sort_key text not null,

  kind text not null default 'place'
    check (kind in ('place', 'flight', 'train', 'bus', 'ferry')),
  title text not null check (char_length(title) between 1 and 120),

  place_name text,
  lat double precision,
  lng double precision,

  -- 구간 항목(기차·버스·배편)의 도착 터미널
  to_place_name text,
  to_lat double precision,
  to_lng double precision,

  -- 벽시계 시간 'HH:MM'. UTC로 바꾸지 않는다 — 도시를 옮기거나 날짜를
  -- 미뤘을 때 "오전 9시 조식"이 엉뚱한 시각으로 밀리면 안 된다.
  local_time time,
  duration_min integer check (duration_min is null or duration_min >= 0),
  description text,
  carrier_code text,

  -- 앞 항목에서 여기까지의 이동. 사용자가 직접 고친 값만 저장한다.
  -- 조회 결과는 캐시일 뿐이라 DB에 둘 이유가 없다.
  leg_mode text check (leg_mode is null or leg_mode in ('walk', 'transit', 'car')),
  leg_minutes integer check (leg_minutes is null or leg_minutes >= 0),
  leg_is_manual boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_trip_date_idx on public.items (trip_id, date, sort_key);

-- ── 체크리스트 ────────────────────────────────────────────────────
create table public.checklist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  checked boolean not null default false,
  assignee_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 멤버십 확인 — RLS 재귀를 끊는 지점
-- ═══════════════════════════════════════════════════════════════════

create function public.is_trip_member(trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = trip and m.user_id = auth.uid()
  );
$$;

create function public.is_trip_owner(trip uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t
    where t.id = trip and t.owner_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- RLS — 테이블마다 켜고, 정책을 붙인다
--
-- 정책 없이 RLS만 켜면 전부 차단된다. 반대로 RLS를 안 켜면 공개 키를 가진
-- 누구나 모든 여행을 읽고 고칠 수 있다.
-- ═══════════════════════════════════════════════════════════════════

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_days enable row level security;
alter table public.items enable row level security;
alter table public.checklist enable row level security;

-- ── trips ─────────────────────────────────────────────────────────
-- 비멤버는 여행의 존재조차 볼 수 없다. 초대 코드로 들어오는 길은
-- join_trip_by_code 함수 하나뿐이다.
create policy "멤버만 여행을 본다"
  on public.trips for select to authenticated
  using (public.is_trip_member(id));

create policy "자기를 소유자로 해서 만든다"
  on public.trips for insert to authenticated
  with check (owner_id = auth.uid());

create policy "멤버는 여행 정보를 고친다"
  on public.trips for update to authenticated
  using (public.is_trip_member(id))
  with check (public.is_trip_member(id));

-- 지우는 건 소유자만. 초대받아 들어온 사람이 남의 여행을 지우면 안 된다.
create policy "소유자만 여행을 지운다"
  on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- ── trip_members ──────────────────────────────────────────────────
create policy "같은 여행의 멤버 목록을 본다"
  on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

-- 직접 insert는 소유자만. 초대 코드로 들어오는 건 함수가 처리한다.
create policy "소유자만 멤버를 추가한다"
  on public.trip_members for insert to authenticated
  with check (public.is_trip_owner(trip_id));

-- 내보내기는 소유자, 나가기는 본인.
create policy "소유자가 내보내거나 본인이 나간다"
  on public.trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- ── trip_days · items · checklist ─────────────────────────────────
-- 셋 다 규칙이 같다: 그 여행의 멤버면 읽고 쓴다.
create policy "멤버가 날짜를 본다"
  on public.trip_days for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "멤버가 날짜를 넣는다"
  on public.trip_days for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "멤버가 날짜를 고친다"
  on public.trip_days for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
create policy "멤버가 날짜를 지운다"
  on public.trip_days for delete to authenticated
  using (public.is_trip_member(trip_id));

create policy "멤버가 항목을 본다"
  on public.items for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "멤버가 항목을 넣는다"
  on public.items for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "멤버가 항목을 고친다"
  on public.items for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
create policy "멤버가 항목을 지운다"
  on public.items for delete to authenticated
  using (public.is_trip_member(trip_id));

create policy "멤버가 체크리스트를 본다"
  on public.checklist for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "멤버가 체크리스트를 넣는다"
  on public.checklist for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "멤버가 체크리스트를 고친다"
  on public.checklist for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
create policy "멤버가 체크리스트를 지운다"
  on public.checklist for delete to authenticated
  using (public.is_trip_member(trip_id));

-- ═══════════════════════════════════════════════════════════════════
-- 트리거
-- ═══════════════════════════════════════════════════════════════════

-- 여행을 만들면 만든 사람을 소유자 멤버로 넣는다.
-- 이게 없으면 방금 만든 여행이 RLS에 막혀 자기 눈에도 안 보인다.
create function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute procedure public.handle_new_trip();

-- 항목이 바뀐 시각. 누가 먼저 고쳤는지 볼 때 쓴다.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_item_updated
  before update on public.items
  for each row execute procedure public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 초대 코드로 참가
--
-- 비멤버는 trips를 읽을 수 없으므로 코드로 여행을 찾는 것도 막힌다.
-- 그래서 security definer 함수로 그 한 걸음만 열어준다.
-- 함수는 "코드가 맞으면 나를 멤버로 넣는다"만 하고 다른 정보는 주지 않는다.
-- ═══════════════════════════════════════════════════════════════════

create function public.join_trip_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select t.id into target
  from public.trips t
  where t.invite_code = upper(btrim(code));

  if target is null then
    raise exception '초대 코드를 찾을 수 없습니다';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (target, auth.uid(), 'editor')
  on conflict (trip_id, user_id) do nothing;

  return target;
end;
$$;

-- 로그인한 사람만 부를 수 있게 한다
revoke execute on function public.join_trip_by_code(text) from public, anon;
grant execute on function public.join_trip_by_code(text) to authenticated;

-- API가 새 테이블을 알아보게 캐시를 새로고침한다
notify pgrst, 'reload schema';
