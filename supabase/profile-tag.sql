-- 닉네임 태그 — 같은 닉네임을 #1234로 구분한다
--
-- 이미 쓰던 DB에 덧붙이는 스크립트. 데이터를 지우지 않고, 여러 번 돌려도 안전하다.
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- ── 왜 중복을 막지 않고 태그를 붙이나 ─────────────────────────────
-- 닉네임을 유일하게 만들면 기본 닉네임 '여행자'부터 부딪히고, 흔한 이름은
-- 먼저 쓴 사람만 가진다. 태그 방식이면 이름은 자유롭게 짓고, 사람마다 붙는
-- 4자리 번호로 구분한다 (여행자#0421, 여행자#7730).
-- 같은 닉네임 안에서 번호가 겹치지 않게 트리거가 고른다.

-- ── 1. 컬럼 ──────────────────────────────────────────────────────
alter table public.profiles add column if not exists tag text;

-- ── 2. 태그 고르기 ───────────────────────────────────────────────
-- 닉네임을 바꿀 때 지금 번호가 새 닉네임에서도 비어 있으면 그대로 둔다.
-- (번호가 매번 바뀌면 친구가 "그 사람 맞나?" 하게 된다)
create or replace function public.assign_profile_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  tries int := 0;
begin
  if new.tag is not null and not exists (
    select 1 from public.profiles p
    where p.nickname = new.nickname and p.tag = new.tag and p.id <> new.id
  ) then
    return new;
  end if;

  loop
    candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles p
      where p.nickname = new.nickname and p.tag = candidate and p.id <> new.id
    );
    tries := tries + 1;
    -- 같은 닉네임이 수천 명이 되면 번호가 모자란다. 그땐 다른 이름을 쓰게 한다.
    if tries > 60 then
      raise exception '이 닉네임을 쓰는 사람이 너무 많습니다. 다른 닉네임을 써 주세요';
    end if;
  end loop;

  new.tag := candidate;
  return new;
end;
$$;

drop trigger if exists on_profile_tag on public.profiles;
create trigger on_profile_tag
  before insert or update of nickname, tag on public.profiles
  for each row execute procedure public.assign_profile_tag();

-- ── 3. 기존 계정에 번호 채우기 ───────────────────────────────────
-- tag를 건드리는 update라 위 트리거가 번호를 고른다.
update public.profiles set tag = null where tag is null;

-- ── 4. 제약 ──────────────────────────────────────────────────────
alter table public.profiles alter column tag set not null;

alter table public.profiles drop constraint if exists profiles_tag_format;
alter table public.profiles
  add constraint profiles_tag_format check (tag ~ '^[0-9]{4}$');

-- 트리거가 고르지만, 동시에 가입하는 경우까지 막는 건 이 인덱스다
create unique index if not exists profiles_nickname_tag_key
  on public.profiles (nickname, tag);

-- '#'이 이름에 들어가면 "여행자#12#0421"처럼 번호와 헷갈린다.
-- 이미 있는 계정은 검사하지 않고(not valid) 새로 짓는 이름부터 막는다.
alter table public.profiles drop constraint if exists profiles_nickname_no_hash;
alter table public.profiles
  add constraint profiles_nickname_no_hash check (position('#' in nickname) = 0) not valid;

-- ── 5. 사용자가 고칠 수 있는 칸 ──────────────────────────────────
-- 번호는 트리거가 정한다. 사용자는 닉네임만 고친다.
revoke update on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

notify pgrst, 'reload schema';

-- 확인: 모든 계정에 번호가 붙었는지
select nickname, tag from public.profiles order by nickname, tag;
