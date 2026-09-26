-- RLS·권한 시나리오 테스트 — scripts/security/run-rls-test.sh가 돌린다.
--
-- 등장인물
--   A  여행을 만든 사람(소유자)
--   B  초대 코드로 들어온 멤버
--   C  아무 관계 없는 로그인 사용자
--   익명  로그인 안 한 요청(공개 키만)
--
-- 기준은 "이래야 안전하다"이다. 지금 코드가 그렇지 않으면 실패로 나온다.
--
-- 방식: t.probe(sql)가 그 요청을 **현재 역할로** 실행해 결과(몇 행/첫 값/오류)를
-- 돌려주고, 부작용은 항상 되돌린다(예외로 하위 트랜잭션을 버린다). 그래서 테스트끼리
-- 서로 영향을 주지 않는다.

\set ON_ERROR_STOP on
\set QUIET on

-- ── 도우미 ─────────────────────────────────────────────────────────
create schema t;
grant usage on schema t to anon, authenticated;
-- 실패 수. 시퀀스는 트랜잭션을 되돌려도 줄지 않는다.
create sequence t.fails;
create sequence t.passes;
grant usage on sequence t.fails, t.passes to anon, authenticated;

-- 결과: 'ok:<행 수>:<첫 값>' 또는 'err:<SQLSTATE>'
create function t.probe(q text) returns text
language plpgsql as $$
declare
  n bigint;
  v text;
begin
  begin
    -- 결과를 돌려주는 문장만 INTO로 받는다 (RETURNING 없는 UPDATE에 INTO를 쓰면 오류)
    if q ~* '^\s*(select|with)\s' or q ~* '\sreturning\s' then
      execute q into v;
    else
      execute q;
    end if;
    get diagnostics n = row_count;
    raise exception using errcode = 'T0001', message = format('ok:%s:%s', n, coalesce(v, ''));
  exception
    when sqlstate 'T0001' then return sqlerrm;
    when others then return 'err:' || sqlstate;
  end;
end;
$$;

create function t.check(label text, passed boolean, detail text default '') returns void
language plpgsql as $$
begin
  if passed then
    perform nextval('t.passes');
    raise notice '  ✓ %', label;
  else
    perform nextval('t.fails');
    raise notice '  ✗ %  (%)', label, detail;
  end if;
end;
$$;

-- 막혀야 한다: 오류가 나거나, 한 행도 건드리지 못하거나
create function t.denied(label text, q text) returns void
language plpgsql as $$
declare r text := t.probe(q);
begin
  perform t.check(label, r like 'err:%' or r like 'ok:0:%', r);
end;
$$;

-- 돼야 한다: 오류 없이 한 행 이상
create function t.allowed(label text, q text) returns void
language plpgsql as $$
declare r text := t.probe(q);
begin
  perform t.check(label, r like 'ok:%' and r not like 'ok:0:%', r);
end;
$$;

-- 보여야 하는 행 수
create function t.sees(label text, q text, expected bigint) returns void
language plpgsql as $$
declare c bigint;
begin
  execute format('select count(*) from (%s) s', q) into c;
  perform t.check(label, c = expected, format('%s행 보임, 기대 %s', c, expected));
end;
$$;

-- 첫 값이 기대와 같아야 한다 (예: 사칭한 이름이 실제 이름으로 바뀌었는지)
create function t.value_is(label text, q text, expected text) returns void
language plpgsql as $$
declare r text := t.probe(q);
begin
  perform t.check(label, r like 'ok:%:' || expected, r);
end;
$$;

grant execute on all functions in schema t to anon, authenticated;

-- ── 등장인물과 데이터 (관리자 권한으로) ──────────────────────────────
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''
\set T '''77777777-0000-0000-0000-000000000007'''
\set I '''11111111-0000-0000-0000-000000000011'''
\set P '''22222222-0000-0000-0000-000000000022'''

insert into auth.users (id) values (:A), (:B), (:C);  -- 가입 트리거가 프로필을 만든다

-- A가 여행을 만든다 (A로 로그인한 요청으로)
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :A, true);
insert into public.trips (id, name, start_date, end_date, owner_id)
  values (:T, 'A의 여행', '2026-10-01', '2026-10-02', :A);
insert into public.trip_days (trip_id, date, timezone, city_label)
  values (:T, '2026-10-01', 'Asia/Seoul', '서울');
insert into public.items (id, trip_id, date, sort_key, title, description)
  values (:I, :T, '2026-10-01', 'a0', '비밀 일정', '숙소 비밀번호 1234');
insert into public.checklist (trip_id, title) values (:T, '여권');
insert into public.expenses (trip_id, title, amount, currency, paid_by, split_among)
  values (:T, '저녁', 50000, 'KRW', :A, array[:A]::uuid[]);
insert into public.places (id, trip_id, name) values (:P, :T, '가고 싶은 곳');
insert into public.place_votes (place_id, trip_id) values (:P, :T);
insert into public.comments (trip_id, item_id, body) values (:T, :I, 'A의 댓글');
commit;

-- B가 초대 코드로 들어온다
select invite_code as code from public.trips where id = :T \gset
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :B, true);
select public.join_trip_by_code(:'code');
commit;

\set QUIET off
\echo
\echo '── 익명 (로그인 안 함) ─────────────────────────────'
begin;
set local role anon;
select t.sees('익명: 여행 안 보임', 'select * from public.trips', 0);
select t.sees('익명: 일정 안 보임', 'select * from public.items', 0);
select t.sees('익명: 프로필 안 보임', 'select * from public.profiles', 0);
select t.denied('익명: 초대 코드로 참가 못 함', format('select public.join_trip_by_code(%L)', :'code'));
select t.denied('익명: 여행 만들기 못 함',
  format('insert into public.trips (name, start_date, end_date, owner_id) values (''x'', ''2026-01-01'', ''2026-01-01'', %L)', :A));
select t.denied('익명: 멤버 확인 함수 호출 못 함', format('select public.is_trip_member(%L)', :T));
select t.denied('익명: 초대 코드 생성 함수 호출 못 함', 'select public.new_invite_code()');
rollback;

\echo
\echo '── C: 관계없는 로그인 사용자 — 남의 여행은 없는 것과 같아야 한다 ──'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :C, true);
select t.sees('C: 여행 안 보임', 'select * from public.trips', 0);
select t.sees('C: 멤버 목록 안 보임', 'select * from public.trip_members', 0);
select t.sees('C: 날짜 안 보임', 'select * from public.trip_days', 0);
select t.sees('C: 일정 안 보임', 'select * from public.items', 0);
select t.sees('C: 체크리스트 안 보임', 'select * from public.checklist', 0);
select t.sees('C: 가계부 안 보임', 'select * from public.expenses', 0);
select t.sees('C: 후보 장소 안 보임', 'select * from public.places', 0);
select t.sees('C: 투표 안 보임', 'select * from public.place_votes', 0);
select t.sees('C: 댓글 안 보임', 'select * from public.comments', 0);
select t.sees('C: 모르는 사람 프로필(A·B) 안 보임', format('select * from public.profiles where id in (%L, %L)', :A, :B), 0);
select t.sees('C: 자기 프로필은 보임', format('select * from public.profiles where id = %L', :C), 1);

select t.denied('C: 남의 여행에 일정 넣기', format('insert into public.items (trip_id, date, sort_key, title) values (%L, ''2026-10-01'', ''b'', ''x'')', :T));
select t.denied('C: 남의 일정 고치기', format('update public.items set title = ''해킹'' where id = %L', :I));
select t.denied('C: 남의 일정 지우기', format('delete from public.items where id = %L', :I));
select t.denied('C: 남의 여행 이름 바꾸기', format('update public.trips set name = ''해킹'' where id = %L', :T));
select t.denied('C: 남의 여행 지우기', format('delete from public.trips where id = %L', :T));
select t.denied('C: 남의 여행에 자기를 멤버로 넣기', format('insert into public.trip_members (trip_id, user_id) values (%L, %L)', :T, :C));
select t.denied('C: 남의 멤버 내보내기', format('delete from public.trip_members where trip_id = %L', :T));
select t.denied('C: 남의 여행에 지출 넣기', format('insert into public.expenses (trip_id, title, amount, currency) values (%L, ''x'', 1, ''KRW'')', :T));
select t.denied('C: 남의 일정에 댓글', format('insert into public.comments (trip_id, item_id, body) values (%L, %L, ''x'')', :T, :I));
select t.denied('C: 남의 후보에 투표', format('insert into public.place_votes (place_id, trip_id) values (%L, %L)', :P, :T));
select t.denied('C: 남의 여행 초대 코드 바꾸기', format('select public.regenerate_invite_code(%L)', :T));
select t.denied('C: 틀린 초대 코드로 참가', 'select public.join_trip_by_code(''ZZZZZZZZ'')');
select t.denied('C: 남의 닉네임 바꾸기', format('update public.profiles set nickname = ''해킹'' where id = %L', :A));
select t.denied('C: 남의 이름으로 프로필 만들기', format('insert into public.profiles (id, nickname) values (%L, ''가짜'')', gen_random_uuid()));
rollback;

\echo
\echo '── B: 초대받은 멤버 — 같이 고치되, 여행의 주인은 될 수 없다 ──'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :B, true);
select t.sees('B: 여행 보임', 'select * from public.trips', 1);
select t.sees('B: 일정 보임', 'select * from public.items', 1);
select t.sees('B: A의 프로필 보임(같은 여행)', format('select * from public.profiles where id = %L', :A), 1);
select t.allowed('B: 일정 추가', format('insert into public.items (trip_id, date, sort_key, title) values (%L, ''2026-10-01'', ''b'', ''B 일정'')', :T));
select t.allowed('B: 일정 고치기', format('update public.items set title = ''고침'' where id = %L', :I));
select t.allowed('B: 여행 이름 바꾸기', format('update public.trips set name = ''바뀐 이름'' where id = %L', :T));

select t.denied('B: 소유자를 자기로 바꾸기', format('update public.trips set owner_id = %L where id = %L', :B, :T));
select t.denied('B: 초대 코드 직접 바꾸기', format('update public.trips set invite_code = ''AAAAAAAA'' where id = %L', :T));
select t.denied('B: 초대 코드 다시 만들기(소유자 전용)', format('select public.regenerate_invite_code(%L)', :T));
select t.denied('B: 여행 지우기', format('delete from public.trips where id = %L', :T));
select t.denied('B: 소유자 내보내기', format('delete from public.trip_members where trip_id = %L and user_id = %L', :T, :A));
select t.denied('B: 자기 역할을 owner로', format('update public.trip_members set role = ''owner'' where trip_id = %L and user_id = %L', :T, :B));
select t.denied('B: 다른 사람(C)을 멤버로 넣기', format('insert into public.trip_members (trip_id, user_id) values (%L, %L)', :T, :C));
select t.denied('B: 일정을 모르는 여행으로 옮기기', format('update public.items set trip_id = gen_random_uuid() where id = %L', :I));

select t.denied('B: A 이름으로 댓글', format('insert into public.comments (trip_id, item_id, body, author_id) values (%L, %L, ''x'', %L)', :T, :I, :A));
select t.denied('B: A 이름으로 투표', format('insert into public.place_votes (place_id, trip_id, user_id) values (%L, %L, %L)', :P, :T, :A));
select t.denied('B: A의 댓글 지우기', format('delete from public.comments where author_id = %L', :A));
select t.denied('B: A의 표 빼기', format('delete from public.place_votes where user_id = %L', :A));
select t.value_is('B: 일정 "고친 사람"을 A로 속여도 B로 기록',
  format('update public.items set title = ''x'', updated_by = %L where id = %L returning updated_by', :A, :I), :B);
select t.value_is('B: 지출 "고친 사람"을 A로 속여도 B로 기록',
  format('insert into public.expenses (trip_id, title, amount, currency, updated_by) values (%L, ''x'', 1, ''KRW'', %L) returning updated_by', :T, :A), :B);
select t.value_is('B: 후보 장소 "올린 사람"을 A로 속여도 B로 기록',
  format('insert into public.places (trip_id, name, created_by) values (%L, ''x'', %L) returning created_by', :T, :A), :B);
select t.value_is('B: 남이 올린 후보의 "올린 사람"을 자기로 바꿔도 그대로',
  format('update public.places set created_by = %L where id = %L returning created_by', :B, :P), :A);
select t.denied('B: 자기 번호(tag) 직접 고르기', format('update public.profiles set tag = ''0000'' where id = %L', :B));

select t.allowed('B: 스스로 나가기', format('delete from public.trip_members where trip_id = %L and user_id = %L', :T, :B));
rollback;

\echo
\echo '── A: 소유자 ─────────────────────────────────────────'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :A, true);
select t.allowed('A: B 내보내기', format('delete from public.trip_members where trip_id = %L and user_id = %L', :T, :B));
select t.denied('A: 자기 자신 내보내기(주인 없는 여행 방지)', format('delete from public.trip_members where trip_id = %L and user_id = %L', :T, :A));
select t.allowed('A: 초대 코드 다시 만들기', format('select public.regenerate_invite_code(%L)', :T));
select t.denied('A: 동의 없이 C를 멤버로 넣기', format('insert into public.trip_members (trip_id, user_id) values (%L, %L)', :T, :C));
select t.denied('A: 소유자를 C로 넘기기(직접 수정)', format('update public.trips set owner_id = %L where id = %L', :C, :T));
select t.allowed('A: 여행 지우기', format('delete from public.trips where id = %L', :T));
rollback;

\echo
\echo '── 초대 코드 ─────────────────────────────────────────'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :A, true);
select public.regenerate_invite_code(:T) as newcode \gset
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :C, true);
select t.denied('C: 바뀌기 전 옛 코드로 참가', format('select public.join_trip_by_code(%L)', :'code'));
select t.allowed('C: 새 코드로 참가(소문자·공백도)', format('select public.join_trip_by_code(%L)', '  ' || lower(:'newcode') || ' '));
rollback;

\echo
\echo '── 글자 수·개수 상한 (supabase/limits.sql) ──────────────'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :B, true);
select t.allowed('B: 메모 2000자는 됨',
  format('update public.items set description = repeat(''가'', 2000) where id = %L', :I));
select t.denied('B: 메모 2001자는 막힘',
  format('update public.items set description = repeat(''가'', 2001) where id = %L', :I));
select t.denied('B: 장소 이름 201자는 막힘',
  format('update public.items set place_name = repeat(''a'', 201) where id = %L', :I));
select t.denied('B: 도시 이름 31자는 막힘',
  format('update public.trip_days set city_label = repeat(''a'', 31) where trip_id = %L', :T));
select t.denied('B: 나눠 낼 사람 101명은 막힘',
  format('insert into public.expenses (trip_id, title, amount, currency, split_among) select %L, ''x'', 1, ''KRW'', array_agg(gen_random_uuid()) from generate_series(1, 101)', :T));
rollback;

-- 체크리스트 500개가 찬 여행에 하나 더
begin;
insert into public.checklist (trip_id, title) select :T, 'x' || g from generate_series(1, 499) g;  -- A가 넣은 1개 + 499
set local role authenticated;
select set_config('request.jwt.claim.sub', :B, true);
select t.denied('B: 체크리스트 501번째는 막힘', format('insert into public.checklist (trip_id, title) values (%L, ''하나 더'')', :T));
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :B, true);
select t.allowed('B: 상한 전에는 체크리스트 추가됨', format('insert into public.checklist (trip_id, title) values (%L, ''하나 더'')', :T));
\echo '── 회원 탈퇴 ─────────────────────────────────────────'
begin;
set local role anon;
select t.denied('익명: 탈퇴 함수 호출 못 함', 'select public.delete_my_account()');
rollback;

-- A(소유자, B와 같이 쓰는 여행) 탈퇴 → 여행은 B에게 넘어가고 A의 흔적은 비워진다
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :A, true);
select public.delete_my_account();
reset role;
select t.check('A 탈퇴: 로그인 계정 지워짐', not exists (select 1 from auth.users where id = :A));
select t.check('A 탈퇴: 프로필 지워짐', not exists (select 1 from public.profiles where id = :A));
select t.check('A 탈퇴: 여행은 남고 B가 소유자', (select owner_id from public.trips where id = :T) = :B);
select t.check('A 탈퇴: B의 역할이 owner', (select role from public.trip_members where trip_id = :T and user_id = :B) = 'owner');
select t.check('A 탈퇴: 일정은 남음', exists (select 1 from public.items where id = :I));
select t.check('A 탈퇴: A가 쓴 댓글은 남고 작성자는 비워짐',
  exists (select 1 from public.comments where item_id = :I and author_id is null));
select t.check('A 탈퇴: A의 투표는 지워짐', not exists (select 1 from public.place_votes where user_id = :A));
select t.check('A 탈퇴: B·C 계정은 그대로', (select count(*) from auth.users where id in (:B, :C)) = 2);
rollback;

-- 혼자인 여행의 소유자가 탈퇴하면 그 여행은 지워진다
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :C, true);
insert into public.trips (id, name, start_date, end_date, owner_id)
  values ('99999999-0000-0000-0000-000000000009', 'C 혼자', '2026-10-01', '2026-10-01', :C);
select public.delete_my_account();
reset role;
select t.check('C 탈퇴: 혼자인 여행은 지워짐', not exists (select 1 from public.trips where id = '99999999-0000-0000-0000-000000000009'));
select t.check('C 탈퇴: 남의 여행(A·B)은 그대로', exists (select 1 from public.trips where id = :T));
rollback;

\set QUIET on
select currval('t.passes') as passes \gset
select coalesce((select last_value from t.fails where is_called), 0) as fails \gset
\echo
\echo '결과:' :passes '통과,' :fails '실패'
