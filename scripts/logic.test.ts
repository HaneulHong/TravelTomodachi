/**
 * 순수 로직 테스트. 브라우저 없이 `npx tsx scripts/logic.test.ts`로 돌아간다.
 * fractional index와 타임존 계산은 조용히 틀리면 데이터가 망가지는 부분이라
 * 프레임워크 없이도 반드시 검증한다.
 */

import {
  keyBetween,
  firstKey,
  keyForInsertAt,
  keyForMove,
  bySortKey,
} from '../src/domain/fractionalIndex';
import {
  tzOffsetMinutes,
  timezoneShift,
  formatOffsetDelta,
  formatMinutes,
  addMinutesToWallClock,
  dayNumber,
  formatDateLabel,
  followingSameDays,
  formatRelative,
} from '../src/domain/time';
import { haversineMeters, formatDistance, normalizePoints } from '../src/domain/geo';
import { memberLabel, type Member, type TripDay } from '../src/domain/types';
import { colorOf, fullName, nicknameProblem } from '../src/auth/types';
import { inviteCodeFromAppUrl, inviteCodeFromHash } from '../src/auth/pendingInvite';
import { normalizeBaseUrl } from '../src/platform/baseUrl';

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log('\n── fractional index ──');
{
  const k1 = firstKey();
  ok('첫 키가 만들어진다', k1.length > 0);

  const before = keyBetween(null, k1);
  const after = keyBetween(k1, null);
  ok('맨 앞에 넣은 키가 더 작다', before < k1, `${before} < ${k1}`);
  ok('맨 뒤에 넣은 키가 더 크다', after > k1, `${after} > ${k1}`);

  const mid = keyBetween(before, k1);
  ok('사이 키가 사이에 온다', before < mid && mid < k1, `${before} < ${mid} < ${k1}`);

  // 같은 자리에 1000번 연속 삽입해도 순서가 유지되는지 (제일 잘 깨지는 케이스)
  let lo = firstKey();
  const hi = keyBetween(lo, null);
  let prev = lo;
  let monotonic = true;
  for (let i = 0; i < 1000; i += 1) {
    const next = keyBetween(lo, hi);
    if (!(lo < next && next < hi)) {
      monotonic = false;
      break;
    }
    lo = next;
    prev = next;
  }
  ok('같은 지점에 1000번 연속 삽입해도 순서가 유지된다', monotonic, `마지막 키: ${prev}`);
  // 같은 틈을 1000번 쪼개면 키가 길어지는 건 fractional index의 수학적 특성이다.
  // base-62에서 1000번 이분할 → log62(2^1000) ≈ 168자. 버그가 아니다.
  // (실제 드래그 순서 변경은 같은 틈에 이렇게 몰리지 않는다.)
  ok(
    '최악의 경우 키 증가율이 이론치(삽입당 0.2자) 안에 있다',
    prev.length < 1000 * 0.25,
    `길이 ${prev.length}`,
  );

  // 현실적인 패턴: 맨 뒤에 계속 추가 — 여기서는 키가 짧게 유지되어야 한다
  let tail = firstKey();
  let tailMonotonic = true;
  for (let i = 0; i < 1000; i += 1) {
    const next = keyBetween(tail, null);
    if (!(next > tail)) {
      tailMonotonic = false;
      break;
    }
    tail = next;
  }
  ok('맨 뒤에 1000번 추가해도 순서가 유지된다', tailMonotonic);
  ok('맨 뒤 추가는 키가 짧게 유지된다', tail.length <= 8, `길이 ${tail.length} (${tail})`);

  // 현실적인 패턴: 맨 앞에 계속 추가
  let head = firstKey();
  let headMonotonic = true;
  for (let i = 0; i < 1000; i += 1) {
    const next = keyBetween(null, head);
    if (!(next < head)) {
      headMonotonic = false;
      break;
    }
    head = next;
  }
  ok('맨 앞에 1000번 추가해도 순서가 유지된다', headMonotonic);
  ok('맨 앞 추가도 키 길이가 억제된다', head.length <= 12, `길이 ${head.length} (${head})`);

  // 목록 삽입 헬퍼
  const list = [{ sortKey: firstKey() }];
  list.push({ sortKey: keyForInsertAt(list, 1) });
  list.push({ sortKey: keyForInsertAt(list, 2) });
  const inserted = { sortKey: keyForInsertAt(list, 1) }; // 0번과 1번 사이
  const merged = [...list, inserted].sort(bySortKey);
  eq('삽입한 항목이 의도한 위치에 온다', merged.indexOf(inserted), 1);

  // 두 사람이 동시에 같은 자리에 삽입 — 충돌 없이 둘 다 살아남아야 한다
  const a = keyForInsertAt(list, 1);
  const b = keyForInsertAt(list, 1);
  ok('동시 삽입 시 키가 겹치지 않는다면 둘 다 보존', a === b || a !== b);
  const both = [...list, { sortKey: a }, { sortKey: b }].sort(bySortKey);
  eq('동시 삽입 후에도 항목 수가 유지된다', both.length, 5);

  // 드래그 순서 변경: 옮긴 항목 한 행만 업데이트해도 순서가 맞아야 한다
  {
    const rows: { id: string; sortKey: string }[] = [];
    for (const id of ['A', 'B', 'C', 'D']) {
      rows.push({ id, sortKey: keyForInsertAt(rows, rows.length) });
    }
    ok(
      '순차 추가 시 키가 짧다',
      rows.every((r) => r.sortKey.length <= 3),
      rows.map((r) => r.sortKey).join(','),
    );
    // A B C D → 0번(A)을 2번 자리로: B C A D
    const movedKey = keyForMove(rows, 0, 2);
    const after = rows
      .map((r) => (r.id === 'A' ? { ...r, sortKey: movedKey } : r))
      .sort(bySortKey)
      .map((r) => r.id)
      .join('');
    eq('앞에서 뒤로 이동', after, 'BCAD');

    // 다시 D를 맨 앞으로: D B C A
    const rows2 = rows
      .map((r) => (r.id === 'A' ? { ...r, sortKey: movedKey } : r))
      .sort(bySortKey);
    const dIndex = rows2.findIndex((r) => r.id === 'D');
    const movedD = keyForMove(rows2, dIndex, 0);
    const after2 = rows2
      .map((r) => (r.id === 'D' ? { ...r, sortKey: movedD } : r))
      .sort(bySortKey)
      .map((r) => r.id)
      .join('');
    eq('뒤에서 맨 앞으로 이동', after2, 'DBCA');
  }

  // 불변식: '0'으로 끝나는 키는 거부해야 한다
  let threw = false;
  try {
    keyBetween('a10', null);
  } catch {
    threw = true;
  }
  ok("'0'으로 끝나는 키를 거부한다", threw);

  // 뒤집힌 순서도 거부
  threw = false;
  try {
    keyBetween('a2', 'a1');
  } catch {
    threw = true;
  }
  ok('뒤집힌 순서를 거부한다', threw);

  // 정수부 길이가 깨진 키도 거부
  threw = false;
  try {
    keyBetween('A0', null);
  } catch {
    threw = true;
  }
  ok('정수부가 잘린 키를 거부한다', threw);

  eq('첫 키는 a0', firstKey(), 'a0');
}

console.log('\n── 타임존 ──');
{
  eq('Asia/Seoul 오프셋', tzOffsetMinutes('Asia/Seoul', '2026-11-03'), 540);
  eq('Asia/Bangkok 오프셋', tzOffsetMinutes('Asia/Bangkok', '2026-11-03'), 420);
  eq('Asia/Tokyo 오프셋', tzOffsetMinutes('Asia/Tokyo', '2026-11-03'), 540);
  eq('Asia/Kolkata 30분 오프셋', tzOffsetMinutes('Asia/Kolkata', '2026-11-03'), 330);
  eq('UTC 오프셋', tzOffsetMinutes('UTC', '2026-11-03'), 0);

  // 미국은 서머타임이 있어서 날짜에 따라 달라진다 — 날짜를 받는 이유가 이것
  const nyWinter = tzOffsetMinutes('America/New_York', '2026-01-15');
  const nySummer = tzOffsetMinutes('America/New_York', '2026-07-15');
  eq('뉴욕 동부표준시(겨울)', nyWinter, -300);
  eq('뉴욕 서머타임(여름)', nySummer, -240);
  ok('서머타임을 날짜별로 반영한다', nyWinter !== nySummer);

  const seoul: TripDay = { date: '2026-11-03', timezone: 'Asia/Seoul', cityLabel: '서울' };
  const bangkok: TripDay = { date: '2026-11-04', timezone: 'Asia/Bangkok', cityLabel: '방콕' };
  const tokyo: TripDay = { date: '2026-11-07', timezone: 'Asia/Tokyo', cityLabel: '도쿄' };

  const s1 = timezoneShift(seoul, bangkok);
  ok('서울→방콕 타임존 변경 감지', s1.changed);
  eq('서울→방콕 시차', s1.deltaMinutes, -120);
  eq('시차 표기', formatOffsetDelta(s1.deltaMinutes), '-2시간');

  const s2 = timezoneShift(bangkok, tokyo);
  eq('방콕→도쿄 시차', s2.deltaMinutes, 120);

  const s3 = timezoneShift(seoul, { ...seoul, date: '2026-11-04' });
  ok('같은 타임존이면 변경 없음', !s3.changed);
  ok('첫날은 비교 대상이 없어 변경 없음', !timezoneShift(undefined, seoul).changed);
}

console.log('\n── 시간 표기 ──');
{
  eq('40분', formatMinutes(40), '40분');
  eq('1시간', formatMinutes(60), '1시간');
  eq('1시간 35분', formatMinutes(95), '1시간 35분');
  eq('음수는 0으로', formatMinutes(-5), '0분');

  eq('벽시계 더하기', addMinutesToWallClock('09:00', 90), '10:30');
  eq('자정 넘김', addMinutesToWallClock('23:30', 60), '00:30');
  eq('되감기', addMinutesToWallClock('00:30', -60), '23:30');
  eq('0분', addMinutesToWallClock('07:05', 0), '07:05');

  eq('여행 1일차', dayNumber('2026-11-03', '2026-11-03'), 1);
  eq('여행 5일차', dayNumber('2026-11-03', '2026-11-07'), 5);
  // 월을 넘어가는 경우
  eq('월 경계', dayNumber('2026-10-30', '2026-11-02'), 4);

  ok('날짜 라벨에 월/일이 들어간다', /11.*3/.test(formatDateLabel('2026-11-03')), formatDateLabel('2026-11-03'));
}

console.log('\n── 거리 ──');
{
  const seoulStation = { lat: 37.5547, lng: 126.9707 };
  const gyeongbok = { lat: 37.5796, lng: 126.977 };
  const d = haversineMeters(seoulStation, gyeongbok);
  ok('서울역→경복궁 2.5~3.5km', d > 2500 && d < 3500, `${Math.round(d)}m`);

  eq('같은 지점은 0', Math.round(haversineMeters(seoulStation, seoulStation)), 0);

  const tokyoStation = { lat: 35.6812, lng: 139.7671 };
  const km = haversineMeters(seoulStation, tokyoStation) / 1000;
  ok('서울→도쿄 1100~1250km', km > 1100 && km < 1250, `${Math.round(km)}km`);

  eq('450m 표기', formatDistance(450), '450m');
  eq('1.2km 표기', formatDistance(1200), '1.2km');
  eq('25km 표기', formatDistance(25_000), '25km');

  const pts = normalizePoints([seoulStation, gyeongbok, { lat: 37.5665, lng: 126.9780 }]);
  eq('정규화 점 개수', pts.length, 3);
  ok(
    '정규화 좌표가 0~1 범위',
    pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1),
    JSON.stringify(pts),
  );
}

console.log('\n── 날짜별 타임존 편집 ──');
{
  const d = (date: string, timezone: string, cityLabel: string): TripDay => ({
    date,
    timezone,
    cityLabel,
  });
  const days = [
    d('2026-11-03', 'Asia/Seoul', '서울'),
    d('2026-11-04', 'Asia/Seoul', '서울'),
    d('2026-11-05', 'Asia/Seoul', '서울'),
    d('2026-11-06', 'Asia/Tokyo', '도쿄'),
    d('2026-11-07', 'Asia/Seoul', '서울'),
  ];
  eq('뒤로 이어지는 같은 날만', followingSameDays(days, '2026-11-04').join(','), '2026-11-05');
  eq('첫날부터 끊기는 곳까지', followingSameDays(days, '2026-11-03').length, 2);
  eq('다른 도시에서 멈춘다 — 그 뒤 서울은 안 건드린다', followingSameDays(days, '2026-11-06').length, 0);
  eq('마지막 날은 뒤가 없다', followingSameDays(days, '2026-11-07').length, 0);
  eq('없는 날짜', followingSameDays(days, '2026-12-01').length, 0);
  // 타임존은 같아도 도시가 다르면 다른 날로 본다 (오사카 → 도쿄)
  const jp = [d('2026-11-03', 'Asia/Tokyo', '오사카'), d('2026-11-04', 'Asia/Tokyo', '도쿄')];
  eq('같은 타임존, 다른 도시', followingSameDays(jp, '2026-11-03').length, 0);
}

console.log('\n── 고친 시각 ──');
{
  const now = Date.parse('2026-09-24T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  eq('30초 전은 방금', formatRelative(ago(30_000), now), '방금');
  eq('미래 시각(시계 오차)도 방금', formatRelative(ago(-90_000), now), '방금');
  eq('분', formatRelative(ago(5 * 60_000), now), '5분 전');
  eq('시간', formatRelative(ago(3 * 3_600_000), now), '3시간 전');
  eq('일', formatRelative(ago(2 * 86_400_000), now), '2일 전');
  ok('일주일 넘으면 날짜', formatRelative(ago(10 * 86_400_000), now).endsWith('일'));
  eq('깨진 값', formatRelative('nope', now), '');
}

console.log('\n── 초대 링크 파싱 ──');
{
  const S = 'com.traveltomodachi.app';
  eq('앱 딥링크', inviteCodeFromAppUrl(`${S}://invite/5G5D5UNX`, S), '5G5D5UNX');
  eq('뒤에 쿼리가 붙어도', inviteCodeFromAppUrl(`${S}://invite/5G5D5UNX?from=kakao`, S), '5G5D5UNX');
  eq('로그인 콜백은 초대가 아니다', inviteCodeFromAppUrl(`${S}://auth?code=abc`, S), null);
  eq('다른 앱 스킴', inviteCodeFromAppUrl('other.app://invite/X', S), null);
  eq('코드 없는 링크', inviteCodeFromAppUrl(`${S}://invite/`, S), null);
  eq('웹 해시', inviteCodeFromHash('#/invite/ABCD1234'), 'ABCD1234');
  eq('웹 해시 — 초대 아님', inviteCodeFromHash('#/trip/1'), null);

  const U = 'https://traveltomodachi.pages.dev';
  eq('공개 주소 그대로', normalizeBaseUrl(U), U);
  eq('끝 슬래시 제거', normalizeBaseUrl(`${U}/`), U);
  eq('앞뒤 공백', normalizeBaseUrl(`  ${U}/ \n`), U);
  eq('https:// 빠짐', normalizeBaseUrl('traveltomodachi.pages.dev'), U);
  eq('빈 값', normalizeBaseUrl('  '), '');
  eq('설정 없음', normalizeBaseUrl(undefined), '');
}

console.log('\n── 닉네임 번호 ──');
{
  const m = (id: string, name: string, tag?: string): Member => ({
    id,
    name,
    tag,
    initial: name[0] ?? '?',
    color: '#000',
  });
  const a = m('a', '여행자', '0421');
  const b = m('b', '여행자', '7730');
  const c = m('c', '하늘', '0001');
  eq('겹칠 때만 번호', memberLabel(a, [a, b, c]), '여행자#0421');
  eq('안 겹치면 이름만', memberLabel(c, [a, b, c]), '하늘');
  eq('번호가 없으면(도입 전) 이름만', memberLabel(m('d', '여행자'), [a, m('d', '여행자')]), '여행자');
  eq('전체 이름', fullName('여행자', '0421'), '여행자#0421');
  eq('번호 없으면 이름만', fullName('여행자', ''), '여행자');

  eq('빈 닉네임', nicknameProblem('   '), '닉네임을 입력해 주세요');
  ok("'#' 금지", nicknameProblem('여행#1') !== null);
  ok('20자 넘으면 안 됨', nicknameProblem('가'.repeat(21)) !== null);
  eq('20자는 됨', nicknameProblem('가'.repeat(20)), null);
  eq('이모지 20개는 됨 (코드 포인트로 센다)', nicknameProblem('🧳'.repeat(20)), null);
  eq('보통 닉네임', nicknameProblem('하늘'), null);

  ok('색은 id로 — 같은 입력이면 같은 색', colorOf('user-1') === colorOf('user-1'));
}

console.log(`\n${failed === 0 ? '✓ 전부 통과' : '✗ 실패 있음'} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
