-- 공유 기능 보강 — 누가 고쳤는지 · 나가기/삭제 · 멤버 관리 · 권한 구멍 막기
--
-- 이미 데이터가 있는 DB에 **덧붙이는** 스크립트다. 아무것도 지우지 않고,
-- 여러 번 실행해도 안전하다. (schema.sql은 새로 만드는 스크립트라 다시
-- 돌리면 데이터가 날아간다. 새 DB라면 schema.sql에 이미 들어 있다.)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 누가 마지막으로 고쳤는지
--
-- 앱이 보내는 값을 믿지 않고 트리거가 auth.uid()로 채운다. 클라이언트가
-- 정하게 두면 남의 이름으로 고친 척할 수 있다.
-- ═══════════════════════════════════════════════════════════════════

alter table public.items
  add column if not exists updated_by uuid references auth.users on delete set null;

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
  -- SQL Editor처럼 로그인 없이 고친 경우엔 원래 값을 둔다
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- 수정 시각만 찍던 트리거를 이걸로 바꾼다 (하는 일을 포함한다)
drop trigger if exists on_item_updated on public.items;
drop trigger if exists on_item_stamped on public.items;
create trigger on_item_stamped
  before insert or update on public.items
  for each row execute procedure public.stamp_item_editor();

-- ═══════════════════════════════════════════════════════════════════
-- 2. 여행 정보에서 멤버가 고칠 수 있는 칸을 좁힌다
--
-- 지금까지는 멤버가 trips의 **모든 칸**을 고칠 수 있었다. 초대받은 사람이
-- owner_id를 자기로 바꾸면 여행을 빼앗은 뒤 지울 수 있었다.
-- RLS는 "어느 행"을 거르지 "어느 칸"은 못 거른다. 칸은 권한(grant)으로 막는다.
--   이름·기간·이모지 → 멤버 누구나
--   소유자·초대 코드  → 아래 함수로만 (소유자만)
-- ═══════════════════════════════════════════════════════════════════

revoke update on public.trips from anon, authenticated;
grant update (name, start_date, end_date, cover_emoji) on public.trips to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3. 초대 코드 다시 만들기 (소유자만)
--
-- 링크가 엉뚱한 곳에 퍼졌을 때 쓴다. 코드를 바꾸면 옛 링크는 더 이상
-- 아무도 들여보내지 않는다. 이미 들어온 멤버는 그대로다.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.regenerate_invite_code(trip uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_trip_owner(trip) then
    raise exception '여행을 만든 사람만 초대 코드를 바꿀 수 있습니다';
  end if;

  -- 8자 31종이면 겹칠 일이 거의 없지만, 겹치면 unique에 걸리니 몇 번 다시 뽑는다
  for attempt in 1..5 loop
    begin
      update public.trips
        set invite_code = public.new_invite_code()
        where id = trip
        returning invite_code into code;
      return code;
    exception when unique_violation then
      -- 다음 시도
    end;
  end loop;

  raise exception '초대 코드를 만들지 못했습니다. 다시 시도해 주세요';
end;
$$;

revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 4. 나가기 · 내보내기
--
-- 기존 규칙은 "소유자가 내보내거나 본인이 나간다"였는데, 소유자가 자기
-- 자신을 지우는 것도 통과했다. 그러면 주인은 있는데 멤버가 아닌 여행이
-- 남는다. 소유자는 나가는 대신 여행을 지운다.
--   소유자 → 다른 멤버를 내보낸다 (자기 자신은 안 됨)
--   멤버   → 자기만 나간다
-- 여행을 지울 때 멤버 행이 함께 지워지는 건(cascade) RLS를 거치지 않는다.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "소유자가 내보내거나 본인이 나간다" on public.trip_members;
create policy "소유자가 내보내거나 본인이 나간다"
  on public.trip_members for delete to authenticated
  using (
    (public.is_trip_owner(trip_id) and user_id <> auth.uid())
    or (user_id = auth.uid() and not public.is_trip_owner(trip_id))
  );

-- API가 새 컬럼·함수를 알아보게 캐시를 새로고침한다
notify pgrst, 'reload schema';
