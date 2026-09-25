-- 보안 보강 — 2026-09-25 보안 테스트(npm run test:rls)에서 나온 것
--
-- 이미 쓰던 DB에 덧붙이는 스크립트. 데이터를 지우지 않고, 여러 번 돌려도 안전하다.
-- 새 DB는 schema.sql·collab.sql에 같은 내용이 들어 있다 (돌려도 무해).
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 프로필은 자기 것과 같은 여행 멤버 것만 보인다
--
-- 전에는 로그인한 누구나 **모든 사용자**의 id·닉네임·번호를 볼 수 있었다.
-- 여행을 같이 짜는 데 필요한 건 같은 여행 멤버의 이름뿐이다. 그리고 모든 id가
-- 보이면 아래 2번 같은 구멍과 겹쳐 모르는 사람을 겨냥할 수 있다.
-- 멤버십 확인은 security definer 함수로 — 정책 안에서 trip_members를 직접 읽으면
-- RLS 재귀가 난다(schema.sql 머리말).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.shares_trip_with(other uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

revoke execute on function public.shares_trip_with(uuid) from public, anon;
grant execute on function public.shares_trip_with(uuid) to authenticated;

drop policy if exists "프로필은 로그인한 사람이 읽는다" on public.profiles;
drop policy if exists "자기와 같은 여행 멤버의 프로필만 본다" on public.profiles;
create policy "자기와 같은 여행 멤버의 프로필만 본다"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));

-- ═══════════════════════════════════════════════════════════════════
-- 2. 멤버는 초대 코드로만 들어온다 — 소유자도 직접 넣지 못한다
--
-- 전에는 소유자가 아무 사용자 id나 자기 여행 멤버로 넣을 수 있었다. 당사자는
-- 동의한 적 없는 여행이 목록에 생긴다(스팸). 앱은 이 경로를 쓰지 않는다 —
-- 참가는 join_trip_by_code, 소유자 자신은 handle_new_trip 트리거가 넣는다
-- (둘 다 security definer라 이 정책과 상관없이 동작한다).
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "소유자만 멤버를 추가한다" on public.trip_members;

-- ═══════════════════════════════════════════════════════════════════
-- 3. 후보 장소의 "올린 사람"은 DB가 정한다
--
-- 전에는 기본값(auth.uid())만 있어서, 앱이 다른 사람 id를 보내면 그 사람이
-- 올린 것처럼 기록됐다. 고칠 때도 바꿀 수 있었다.
-- 일정·가계부의 "고친 사람"과 같은 방식: 넣을 때 로그인한 사람, 고칠 때 그대로.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.stamp_place_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- SQL Editor처럼 로그인 없이 넣은 경우엔 보낸 값을 둔다
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists on_place_stamped on public.places;
create trigger on_place_stamped
  before insert or update on public.places
  for each row execute procedure public.stamp_place_creator();

-- ═══════════════════════════════════════════════════════════════════
-- 4. 로그인 안 한 요청은 내부 함수를 부르지 못한다
--
-- Supabase는 public 스키마 함수에 anon 실행 권한을 기본으로 준다. 새는 정보는
-- 없었지만(자기 멤버십 여부, 무작위 코드) 쓸 일이 없는 문은 닫는다.
-- 로그인한 사람은 계속 필요하다 — RLS 정책과 초대 코드 기본값이 이 함수들을 부른다.
-- ═══════════════════════════════════════════════════════════════════

revoke execute on function public.is_trip_member(uuid) from public, anon;
revoke execute on function public.is_trip_owner(uuid) from public, anon;
revoke execute on function public.new_invite_code() from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.new_invite_code() to authenticated;

notify pgrst, 'reload schema';
