-- Supabase 흉내 — 로컬 PostgreSQL에서 우리 SQL과 RLS를 그대로 돌려 보기 위한 최소한.
--
-- 실제 Supabase에 있는 것 중 우리 SQL이 기대는 것만 만든다:
--   역할 anon · authenticated, auth 스키마, auth.users, auth.uid()
--   public 스키마의 기본 권한 (Supabase는 새 테이블에 anon·authenticated 권한을 준다)
--   supabase_realtime 발행(publication) — realtime.sql이 여기에 테이블을 더한다
--
-- auth.uid()는 Supabase처럼 요청의 JWT sub를 읽는다. 테스트에서는
--   set local role authenticated; set local request.jwt.claim.sub = '<사용자 id>';
-- 로 "그 사람으로 로그인한 요청"을 흉내 낸다.

create role anon nologin;
create role authenticated nologin;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create publication supabase_realtime;
