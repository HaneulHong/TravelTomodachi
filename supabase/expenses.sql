-- 공동 가계부 + 예약 번호
--
-- 이미 데이터가 있는 DB에 **덧붙이는** 스크립트다. 아무것도 지우지 않고,
-- 여러 번 실행해도 안전하다. (새 DB라면 schema.sql에 이미 들어 있다 — 돌려도 무해)
--
-- Supabase → SQL Editor → 통째로 붙여넣고 Run.
--
-- 앱은 이걸 실행하기 전에도 깨지지 않는다. 가계부 화면만 "DB 업데이트가
-- 필요합니다"라고 안내하고, 예약 번호 칸은 비어 있는 것으로 본다.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 가계부
--
-- 한 줄 = 한 번 낸 돈. 누가 냈고(paid_by), 누구끼리 나누는지(split_among).
-- 정산(누가 누구에게 얼마)은 저장하지 않고 앱이 그때그때 계산한다 —
-- 지출을 고치면 정산도 저절로 맞는다 (src/domain/settle.ts).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),
  -- ISO 4217 세 글자 (KRW, JPY, USD …)
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- 낸 사람. 계정이 지워져도 지출은 남긴다(정산에서 '나간 멤버'로 보인다)
  paid_by uuid references auth.users on delete set null,
  -- 나눠 낼 사람들. 여행을 나간 사람도 남아야 정산이 맞아서 외래키로 묶지 않는다.
  split_among uuid[] not null default '{}',
  -- 쓴 날(여행 날짜). 없어도 된다.
  spent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

create index if not exists expenses_trip_idx on public.expenses (trip_id, spent_on);

alter table public.expenses enable row level security;

-- 멤버만 보고 쓴다. 멤버 확인은 security definer 함수로(RLS 재귀 방지 — schema.sql 머리말)
drop policy if exists "멤버가 가계부를 본다" on public.expenses;
create policy "멤버가 가계부를 본다"
  on public.expenses for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "멤버가 가계부에 쓴다" on public.expenses;
create policy "멤버가 가계부에 쓴다"
  on public.expenses for insert to authenticated
  with check (public.is_trip_member(trip_id));

drop policy if exists "멤버가 가계부를 고친다" on public.expenses;
create policy "멤버가 가계부를 고친다"
  on public.expenses for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

drop policy if exists "멤버가 가계부를 지운다" on public.expenses;
create policy "멤버가 가계부를 지운다"
  on public.expenses for delete to authenticated
  using (public.is_trip_member(trip_id));

-- 누가 마지막으로 고쳤는지 — 일정 항목과 같은 트리거 함수를 쓴다(updated_by·updated_at)
drop trigger if exists on_expense_stamped on public.expenses;
create trigger on_expense_stamped
  before insert or update on public.expenses
  for each row execute procedure public.stamp_item_editor();

-- 실시간 동기화 — 친구가 적은 지출이 바로 보이게.
-- replica identity full은 켜지 않는다(realtime.sql 머리말: 지운 행이 남에게 샌다).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. 예약 번호
--
-- 항공권·숙소·투어의 예약(확인) 번호. 메모에 섞어 두면 체크인할 때 찾기 어렵다.
-- ═══════════════════════════════════════════════════════════════════

alter table public.items
  add column if not exists booking_ref text
    check (booking_ref is null or char_length(booking_ref) <= 60);

-- 확인
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'expenses') as expenses_table,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'booking_ref') as booking_ref_column;
