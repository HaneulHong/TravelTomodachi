-- 회원 탈퇴 — 내 계정과 개인정보를 지운다
--
-- 이미 쓰던 DB에 덧붙이는 스크립트. 여러 번 돌려도 안전하다.
-- 새 DB는 schema.sql에 같은 내용이 들어 있다 (돌려도 무해).
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- ── 왜 함수인가 ──────────────────────────────────────────────────
-- 로그인 계정(auth.users)은 앱이 직접 지울 수 없다 — 그러려면 service_role 키가
-- 필요한데, 그 키는 클라이언트에 두면 안 된다(RLS를 통째로 우회한다).
-- 그래서 "자기 자신만" 지우는 security definer 함수 하나로 그 한 걸음만 열어 준다.
--
-- ── 무엇이 어떻게 되나 ──────────────────────────────────────────
--   내가 만든 여행  다른 멤버가 있으면 가장 먼저 들어온 멤버에게 넘긴다.
--                   혼자인 여행은 지운다 (날짜·일정·가계부 등이 함께 지워진다).
--   내 계정         auth.users를 지우면 외래키로 따라간다:
--                   프로필·멤버십·투표 → 지워짐
--                   일정·지출·후보·댓글의 "누가" → 비워짐(여행에는 남고 '나간 멤버'로 보인다)
--   로그인 정보     Supabase가 들고 있던 이메일·Google 정보·세션도 auth.users와 함께 지워진다.

-- ── 먼저: "누가 고쳤는지" 트리거가 탈퇴를 막지 않게 ──────────────────
-- 계정을 지우면 DB가 일정·지출의 updated_by, 후보의 created_by를 연쇄로 비운다(set null).
-- 그것도 "수정"이라 기록 트리거가 다시 돌며 auth.uid() — 지워지는 바로 그 사람 — 를
-- 적는데, 그러면 외래키에 걸려 탈퇴 전체가 실패한다. 연쇄 수정(pg_trigger_depth > 1)은 건드리지 않는다.

create or replace function public.stamp_item_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 계정을 지울 때 DB가 이 칸을 연쇄로 비우는 수정(on delete set null)이면 손대지 않는다.
  -- 여기서 auth.uid()(= 지워지는 그 사람)를 다시 적으면 외래키에 걸려 탈퇴가 실패한다.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.stamp_place_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 계정을 지울 때 DB가 이 칸을 연쇄로 비우는 수정(on delete set null)이면 손대지 않는다.
  -- 여기서 auth.uid()(= 지워지는 그 사람)를 다시 적으면 외래키에 걸려 탈퇴가 실패한다.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owned record;
  successor uuid;
begin
  if me is null then
    raise exception '로그인이 필요합니다';
  end if;

  for owned in select id from public.trips where owner_id = me loop
    select m.user_id into successor
    from public.trip_members m
    where m.trip_id = owned.id and m.user_id <> me
    order by m.joined_at, m.user_id
    limit 1;

    if successor is null then
      delete from public.trips where id = owned.id;
    else
      update public.trips set owner_id = successor where id = owned.id;
      update public.trip_members set role = 'owner'
        where trip_id = owned.id and user_id = successor;
    end if;
  end loop;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
