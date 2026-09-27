-- 변경 기록 — "누가 무엇을 바꿨는지"
--
-- 이미 데이터가 있는 DB에 **덧붙이는** 스크립트다. 아무것도 지우지 않고,
-- 여러 번 실행해도 안전하다. (새 DB라면 schema.sql에 이미 들어 있다 — 돌려도 무해)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 앱은 이걸 실행하기 전에도 깨지지 않는다. "변경 기록" 화면만 "아직 쓸 수
-- 없습니다"라고 안내한다.
--
-- 일정의 updated_by는 "마지막으로 고친 사람" 하나뿐이고, 지운 일정은 흔적이 없다.
-- 같이 짜다 보면 "이거 누가 바꿨어?", "점심 일정 어디 갔어?"가 나온다. 그래서
-- 일정·가계부·후보의 추가·수정·삭제를 한 줄씩 남긴다.
--
-- 앱이 쓰지 않는다 — DB 트리거가 쓴다. 앱이 쓰게 두면 남의 이름으로 기록을 꾸밀 수
-- 있다. 멤버는 읽기만 한다.

create table if not exists public.trip_activity (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips on delete cascade,
  -- 한 사람. 탈퇴하면 비운다(기록은 남는다)
  actor_id uuid references auth.users on delete set null,
  action text not null check (action in ('add', 'update', 'delete')),
  target text not null check (target in ('item', 'expense', 'place')),
  target_id uuid,
  -- 그때의 제목. 지운 일정은 행이 없으니 여기 남겨야 "무엇을" 지웠는지 안다
  title text check (title is null or char_length(title) <= 200),
  -- 일정이면 그 날짜(몇 일차인지 보여 준다), 지출이면 쓴 날
  item_date date,
  created_at timestamptz not null default now()
);

create index if not exists trip_activity_trip_idx on public.trip_activity (trip_id, id desc);
create index if not exists trip_activity_target_idx on public.trip_activity (target_id, id desc);

alter table public.trip_activity enable row level security;

drop policy if exists "멤버가 변경 기록을 본다" on public.trip_activity;
create policy "멤버가 변경 기록을 본다"
  on public.trip_activity for select to authenticated
  using (public.is_trip_member(trip_id));

-- 쓰기 정책이 없으니 막히지만, 권한으로도 한 번 더 막는다
revoke insert, update, delete on public.trip_activity from anon, authenticated;

-- ── 기록 남기기 ────────────────────────────────────────────────────
create or replace function public.log_trip_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  kind text;
  act text;
  o jsonb;
  n jsonb;
  r jsonb;
  watched text[];
  label text;
  day date;
  recent_id bigint;
  recent_action text;
  keep_from bigint;
begin
  -- DB가 연쇄로 지우거나 비우는 경우(여행 삭제, 회원 탈퇴)는 적지 않는다.
  -- 지워지는 여행을 가리키는 기록을 넣으면 외래키에 걸려 삭제 자체가 실패한다.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  -- 로그인 없이(SQL Editor) 고친 건 적지 않는다 — 누가 했는지 모른다.
  -- 회원 탈퇴 중(그 사람 계정이 이미 지워짐)에 DB가 "낸 사람" 같은 칸을 비우는 것도 —
  -- 없는 사람 이름으로 적으면 외래키에 걸려 탈퇴가 실패한다.
  if actor is null or not exists (select 1 from auth.users u where u.id = actor) then
    return null;
  end if;

  kind := case tg_table_name when 'items' then 'item' when 'expenses' then 'expense' else 'place' end;
  act := case tg_op when 'INSERT' then 'add' when 'UPDATE' then 'update' else 'delete' end;
  -- 칸 이름이 표마다 달라(title/name) jsonb로 읽는다
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  r := coalesce(n, o);

  -- 여행을 지우면 딸린 일정·지출도 같이 지워지며 여기로 온다. 그 여행은 이미 없어서
  -- 기록을 넣으면 외래키에 걸려 여행 삭제가 실패한다(위 깊이 검사로는 안 걸러졌다).
  if not exists (select 1 from public.trips t where t.id = (r ->> 'trip_id')::uuid) then
    return null;
  end if;

  -- 후보는 올린 것만. 지우는 건 대개 "일정에 넣기"라 지웠다고 적으면 오해한다
  if kind = 'place' and act <> 'add' then
    return null;
  end if;

  -- 보이는 내용이 바뀐 수정만. 순서 바꾸기(sort_key)·이동 수단·"고친 사람" 칸은 적지 않는다
  if act = 'update' then
    watched := case kind
      when 'item' then array['title', 'place_name', 'lat', 'lng', 'local_time', 'duration_min',
        'description', 'kind', 'carrier_code', 'booking_ref', 'to_place_name', 'to_lat', 'to_lng', 'date']
      else array['title', 'amount', 'currency', 'paid_by', 'split_among', 'spent_on']
    end;
    if not exists (select 1 from unnest(watched) k where (o -> k) is distinct from (n -> k)) then
      return null;
    end if;
  end if;

  label := left(coalesce(r ->> 'title', r ->> 'name'), 200);
  day := case kind
    when 'item' then (r ->> 'date')::date
    when 'expense' then (r ->> 'spent_on')::date
  end;

  -- 같은 사람이 10분 안에 같은 걸 또 고치면 한 줄로 — 저장할 때마다 줄이 늘면 읽을 수 없다
  select a.id, a.action into recent_id, recent_action
  from public.trip_activity a
  where a.target_id = (r ->> 'id')::uuid
    and a.actor_id = actor
    and a.created_at > now() - interval '10 minutes'
  order by a.id desc
  limit 1;

  if recent_id is not null and act = 'update' and recent_action in ('add', 'update') then
    update public.trip_activity
      set title = label, item_date = day, created_at = now()
      where id = recent_id;
    return null;
  end if;
  -- 방금 넣었다가 바로 지웠으면 둘 다 없던 일로
  if recent_id is not null and act = 'delete' and recent_action = 'add' then
    delete from public.trip_activity where id = recent_id;
    return null;
  end if;

  insert into public.trip_activity (trip_id, actor_id, action, target, target_id, title, item_date)
  values ((r ->> 'trip_id')::uuid, actor, act, kind, (r ->> 'id')::uuid, label, day);

  -- 여행마다 최근 300줄만 둔다 — 오래된 기록은 쓸모가 적고 표만 커진다
  select a.id into keep_from
  from public.trip_activity a
  where a.trip_id = (r ->> 'trip_id')::uuid
  order by a.id desc
  offset 300 limit 1;
  if keep_from is not null then
    delete from public.trip_activity
      where trip_id = (r ->> 'trip_id')::uuid and id <= keep_from;
  end if;

  return null;
end;
$$;

revoke execute on function public.log_trip_activity() from public, anon, authenticated;

drop trigger if exists on_item_logged on public.items;
create trigger on_item_logged
  after insert or update or delete on public.items
  for each row execute procedure public.log_trip_activity();

drop trigger if exists on_expense_logged on public.expenses;
create trigger on_expense_logged
  after insert or update or delete on public.expenses
  for each row execute procedure public.log_trip_activity();

-- 후보 장소 표가 없는 DB(collab.sql 이전)에서도 이 파일이 돌게
do $$
begin
  if to_regclass('public.places') is not null then
    drop trigger if exists on_place_logged on public.places;
    create trigger on_place_logged
      after insert on public.places
      for each row execute procedure public.log_trip_activity();
  end if;
end;
$$;

-- API가 새 테이블을 알아보게 캐시를 새로고침한다
notify pgrst, 'reload schema';
