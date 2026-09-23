-- 실시간 동기화 켜기
--
-- Supabase는 새 테이블의 변경을 기본으로 내보내지 않는다. 이 publication에
-- 넣어야 postgres_changes 구독이 이벤트를 받는다.
--
-- 여러 번 실행해도 안전하다 — 이미 들어 있는 테이블은 건너뛴다.
--
-- ─────────────────────────────────────────────────────────────────────
-- replica identity full 을 켜지 **않는다**. 일부러다.
--
-- 켜면 DELETE 이벤트에 지워진 행 전체가 실린다. 그런데 Supabase 문서대로
-- RLS는 DELETE 이벤트에 적용되지 않는다 — 지워진 행에 누가 접근할 수 있었는지
-- Postgres가 확인할 방법이 없어서다. 그 둘이 겹치면 **남의 여행에서 지워진
-- 항목의 제목·장소·메모가 모든 구독자에게 간다.**
--
-- 기본값(기본키만)으로 두면 DELETE에는 id 하나만 실린다. 의미 없는 uuid라
-- 새어나가도 알 수 있는 게 없고, 받는 쪽은 자기가 가진 id일 때만 지운다.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['trips', 'trip_members', 'trip_days', 'items', 'checklist']
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

-- 무엇이 켜졌는지 확인
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
