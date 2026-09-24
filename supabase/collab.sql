-- 후보 장소 투표 + 일정 댓글
--
-- 이미 데이터가 있는 DB에 **덧붙이는** 스크립트다. 아무것도 지우지 않고,
-- 여러 번 실행해도 안전하다. (새 DB라면 schema.sql에 이미 들어 있다 — 돌려도 무해)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 앱은 이걸 실행하기 전에도 깨지지 않는다. 후보 장소 화면만 "아직 쓸 수
-- 없습니다"라고 안내하고, 일정 상세에는 댓글 칸이 나오지 않는다.

-- ═══════════════════════════════════════════════════════════════════
-- 0. 짝 맞추기용 유일 조건
--
-- 표·댓글은 trip_id를 같이 들고 있다(RLS가 멤버 확인에 쓴다). 그 trip_id가
-- 가리키는 장소·일정의 여행과 다르면 남의 여행 항목에 끼어들 수 있으므로,
-- (id, trip_id) 짝으로 외래키를 건다. 그러려면 그 짝이 유일해야 한다.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_id_trip_key') then
    alter table public.items add constraint items_id_trip_key unique (id, trip_id);
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 1. 후보 장소 — 아직 날짜를 안 정한 "가고 싶은 곳"
--
-- 일정에 넣으면 앱이 이 행을 지운다(일정 항목으로 옮겨 간다).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  place_name text,
  lat double precision,
  lng double precision,
  note text check (note is null or char_length(note) <= 500),
  -- 올린 사람. SQL Editor에서 넣으면 비어 있다.
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, trip_id)
);

create index if not exists places_trip_idx on public.places (trip_id);

alter table public.places enable row level security;

drop policy if exists "멤버가 후보 장소를 본다" on public.places;
create policy "멤버가 후보 장소를 본다"
  on public.places for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "멤버가 후보 장소를 올린다" on public.places;
create policy "멤버가 후보 장소를 올린다"
  on public.places for insert to authenticated
  with check (public.is_trip_member(trip_id));

drop policy if exists "멤버가 후보 장소를 고친다" on public.places;
create policy "멤버가 후보 장소를 고친다"
  on public.places for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

-- 일정에 넣으면 누가 올린 것이든 목록에서 빠져야 해서 멤버 누구나 지운다
drop policy if exists "멤버가 후보 장소를 지운다" on public.places;
create policy "멤버가 후보 장소를 지운다"
  on public.places for delete to authenticated
  using (public.is_trip_member(trip_id));

-- ── 표 ────────────────────────────────────────────────────────────
-- 한 사람이 한 장소에 한 표(기본키). 자기 표만 넣고 뺄 수 있다.
create table if not exists public.place_votes (
  place_id uuid not null,
  trip_id uuid not null,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete cascade
);

alter table public.place_votes enable row level security;

drop policy if exists "멤버가 표를 본다" on public.place_votes;
create policy "멤버가 표를 본다"
  on public.place_votes for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "자기 표를 넣는다" on public.place_votes;
create policy "자기 표를 넣는다"
  on public.place_votes for insert to authenticated
  with check (public.is_trip_member(trip_id) and user_id = auth.uid());

drop policy if exists "자기 표를 뺀다" on public.place_votes;
create policy "자기 표를 뺀다"
  on public.place_votes for delete to authenticated
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- 2. 일정 댓글
--
-- "여기 예약 필요해?", "나 이날 늦게 합류" 같은 말을 일정 옆에 남긴다.
-- 고치기는 없다 — 지우고 다시 쓴다. 남의 댓글은 못 지운다.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  item_id uuid not null,
  author_id uuid references auth.users on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  -- 일정을 지우면 댓글도 함께
  foreign key (item_id, trip_id) references public.items (id, trip_id) on delete cascade
);

create index if not exists comments_item_idx on public.comments (item_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "멤버가 댓글을 본다" on public.comments;
create policy "멤버가 댓글을 본다"
  on public.comments for select to authenticated
  using (public.is_trip_member(trip_id));

-- 남의 이름으로 쓰지 못하게
drop policy if exists "멤버가 자기 이름으로 댓글을 단다" on public.comments;
create policy "멤버가 자기 이름으로 댓글을 단다"
  on public.comments for insert to authenticated
  with check (public.is_trip_member(trip_id) and author_id = auth.uid());

drop policy if exists "자기 댓글을 지운다" on public.comments;
create policy "자기 댓글을 지운다"
  on public.comments for delete to authenticated
  using (author_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- 3. 실시간 — 친구가 올린 후보·표·댓글이 바로 보이게
-- replica identity full은 켜지 않는다(realtime.sql 머리말: 지운 행이 남에게 샌다).
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['places', 'place_votes', 'comments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- 확인 (셋 다 1이면 성공)
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'places') as places,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'place_votes') as place_votes,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'comments') as comments;
