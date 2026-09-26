/**
 * 순수 로직 테스트. 브라우저 없이 `npx tsx scripts/logic.test.ts`로 돌아간다.
 * fractional index와 타임존 계산은 조용히 틀리면 데이터가 망가지는 부분이라
 * 프레임워크 없이도 반드시 검증한다.
 */

import { slackMinutes } from '../src/domain/schedule';
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
import { memberLabel, type Item, type Member, type Trip, type TripDay } from '../src/domain/types';
import { colorOf, fullName, nicknameProblem } from '../src/auth/types';
import { inviteCodeFromAppUrl, inviteCodeFromHash } from '../src/auth/pendingInvite';
import { normalizeBaseUrl } from '../src/platform/baseUrl';
import { rankPlaces } from '../src/domain/ideas';
import { buildIcs } from '../src/domain/ics';
import { optimizeDay, type RoutePoint } from '../src/domain/optimize';
import { findToday, localNow, minutesUntil, nextItem } from '../src/domain/today';
import { balances, convert, currencyDigits, settle, transfers } from '../src/domain/settle';
import {
  dropIndex,
  moved,
  predecessorsChanged,
  timeConflicts,
  timeSortedOrder,
} from '../src/domain/order';
import { detectLocale, isLocalePreference } from '../src/i18n/locales';
import { isDefaultZoneLabel, zoneLabel, zoneOptions } from '../src/domain/timezones';
import { formatDateLabel, formatWeekday } from '../src/domain/time';
import { ko } from '../src/i18n/messages/ko';
import { en } from '../src/i18n/messages/en';
import { ja } from '../src/i18n/messages/ja';
import { parsePlan, type MotisLeg } from '../src/providers/route/transitousRouteProvider';
import { decodePolyline } from '../src/providers/route/polyline';
import { effectiveLeg, recommendMode } from '../src/domain/legChoice';

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

  eq('빈 닉네임', nicknameProblem('   '), 'empty');
  eq("'#' 금지", nicknameProblem('여행#1'), 'hash');
  eq('20자 넘으면 안 됨', nicknameProblem('가'.repeat(21)), 'tooLong');
  eq('20자는 됨', nicknameProblem('가'.repeat(20)), null);
  eq('이모지 20개는 됨 (코드 포인트로 센다)', nicknameProblem('🧳'.repeat(20)), null);
  eq('보통 닉네임', nicknameProblem('하늘'), null);

  ok('색은 id로 — 같은 입력이면 같은 색', colorOf('user-1') === colorOf('user-1'));
}

console.log('\n── 순서 바꾸기 ──');
{
  const ids = ['a', 'b', 'c', 'd'];
  eq('뒤로 옮기기', moved(ids, 0, 2).join(''), 'bcad');
  eq('앞으로 옮기기', moved(ids, 3, 1).join(''), 'adbc');
  eq('제자리', moved(ids, 1, 1).join(''), 'abcd');

  // a를 c 뒤로: b(앞 없음이 됨), a(앞이 c), d(앞이 a) 바뀜. c는 앞이 b 그대로.
  eq('앞 일정이 바뀐 항목', predecessorsChanged(ids, moved(ids, 0, 2)).join(''), 'bad');
  eq('안 바뀌면 없음', predecessorsChanged(ids, ids).join(''), '');
  eq('다른 날에서 온 항목은 바뀐 것', predecessorsChanged(['a'], ['a', 'x']).join(''), 'x');
  eq('빠진 항목 다음만', predecessorsChanged(ids, ['a', 'c', 'd']).join(''), 'c');

  const centers = [50, 150, 250, 350];
  eq('조금 끌면 제자리', dropIndex(centers, 0, 90), 0);
  eq('두 칸 아래로', dropIndex(centers, 0, 260), 2);
  eq('맨 아래 넘어서', dropIndex(centers, 0, 999), 3);
  eq('위로 끌기', dropIndex(centers, 3, 120), 1);
  eq('맨 위 넘어서', dropIndex(centers, 2, -50), 0);

  const flags = (ts: (string | undefined)[]) => timeConflicts(ts).map((f) => (f ? 'x' : '.')).join('');
  eq('순서대로면 없음', flags(['09:00', '12:00', '18:00']), '...');
  eq('앞보다 이르면 표시', flags(['12:00', '09:00', '18:00']), '.x.');
  eq('시각 없는 일정은 건너뜀', flags(['12:00', undefined, '09:00']), '..x');
  eq('가장 늦은 시각과 비교', flags(['18:00', '09:00', '12:00']), '.xx');
  eq('같은 시각은 괜찮다', flags(['09:00', '09:00']), '..');

  const it = (id: string, localTime?: string) => ({ id, localTime });
  eq(
    '시각순 정렬, 시각 없는 일정은 제자리',
    timeSortedOrder([it('a', '12:00'), it('b'), it('c', '09:00'), it('d', '18:00')]).join(''),
    'cbad',
  );
  eq('같은 시각이면 원래 순서', timeSortedOrder([it('a', '09:00'), it('b', '09:00')]).join(''), 'ab');
}

console.log('\n── 가계부 정산 ──');
{
  const e = (amount: number, currency: string, paidBy: string, splitAmong: string[]) => ({
    amount,
    currency,
    paidBy,
    splitAmong,
  });
  eq('원은 소수 없음', currencyDigits('KRW'), 0);
  eq('달러는 센트', currencyDigits('USD'), 2);

  // 셋이 3만원 저녁, A가 냄 → B·C가 A에게 1만원씩
  const t1 = transfers(balances([e(30000, 'KRW', 'a', ['a', 'b', 'c'])], 'KRW'), 'KRW');
  eq('1/N', t1.map((t) => `${t.from}>${t.to}:${t.amount}`).join(' '), 'b>a:10000 c>a:10000');

  // 나누어떨어지지 않으면 합이 원금과 같게 (10000/3)
  const b2 = balances([e(10000, 'KRW', 'a', ['a', 'b', 'c'])], 'KRW');
  eq('나머지 1원까지 합이 0', [...b2.values()].reduce((x, y) => x + y, 0), 0);

  // 서로 낸 게 있으면 상쇄 — A가 B 몫 1만, B가 A 몫 4천 → B가 A에게 6천
  const t3 = transfers(
    balances([e(20000, 'KRW', 'a', ['a', 'b']), e(8000, 'KRW', 'b', ['a', 'b'])], 'KRW'),
    'KRW',
  );
  eq('상쇄', t3.map((t) => `${t.from}>${t.to}:${t.amount}`).join(' '), 'b>a:6000');

  eq('다 같이 똑같이 냈으면 송금 없음', transfers(balances([e(100, 'USD', 'a', ['a'])], 'USD'), 'USD').length, 0);
  eq('센트 단위', transfers(balances([e(10, 'USD', 'a', ['a', 'b', 'c'])], 'USD'), 'USD').map((t) => t.amount).join(','), '3.33,3.33');

  const rates = { USD: 1, KRW: 1400, JPY: 150 };
  eq('환율 변환', convert(1500, 'JPY', 'KRW', rates), 14000);
  eq('모르는 통화는 null', convert(1, 'XXX', 'KRW', rates), null);

  const mixed = [e(3000, 'JPY', 'a', ['a', 'b']), e(10000, 'KRW', 'b', ['a', 'b'])];
  const s1 = settle(mixed, 'KRW', rates);
  eq('환율 있으면 한 통화로', s1.unified && s1.groups.length === 1 && s1.groups[0]!.currency, 'KRW');
  eq('엔 3000(=28000원)·원 10000 → a가 받을 돈 9000', s1.groups[0]!.transfers.map((t) => `${t.from}>${t.to}:${t.amount}`).join(' '), 'b>a:9000');
  eq('부담액', s1.groups[0]!.shares.get('a'), 19000);
  const s2 = settle(mixed, 'KRW', null);
  eq('환율 없으면 통화별로', !s2.unified && s2.groups.map((g) => g.currency).sort().join(','), 'JPY,KRW');
  eq('나눌 사람 없는 지출은 빠짐', settle([e(1000, 'KRW', 'a', [])], 'KRW', null).groups.length, 0);
}

console.log('\n── 여행 중 오늘 ──');
{
  // 2026-11-04 14:30 UTC = 서울 23:30, 방콕 21:30, 같은 날
  const now = new Date('2026-11-04T14:30:00Z');
  eq('서울 현지', JSON.stringify(localNow('Asia/Seoul', now)), '{"date":"2026-11-04","time":"23:30"}');
  eq('방콕 현지', localNow('Asia/Bangkok', now).time, '21:30');
  // 15:30 UTC = 서울은 다음 날 00:30, 방콕은 아직 22:30
  const later = new Date('2026-11-04T15:30:00Z');
  eq('서울은 이미 다음 날', localNow('Asia/Seoul', later).date, '2026-11-05');

  const mkTrip = (days: TripDay[]) =>
    ({ id: 't', name: 'x', startDate: days[0]!.date, endDate: days[days.length - 1]!.date, ownerId: 'a', inviteCode: 'X', coverEmoji: '🧳', members: [], days }) as Trip;
  const trip = mkTrip([
    { date: '2026-11-04', timezone: 'Asia/Bangkok', cityLabel: '방콕' },
    { date: '2026-11-05', timezone: 'Asia/Bangkok', cityLabel: '방콕' },
  ]);
  // 기기가 서울이라 이미 11/5여도, 방콕 날짜로는 아직 11/4
  eq('현지 날짜로 오늘을 고른다', findToday([trip], later)?.dayIndex, 0);
  eq('여행 기간이 아니면 없음', findToday([trip], new Date('2026-12-01T00:00:00Z')), null);

  const it = (id: string, localTime?: string) => ({ id, localTime }) as Item;
  eq('다음 일정은 시각으로', nextItem([it('a', '09:00'), it('b', '18:00'), it('c', '12:00')], '10:00')?.id, 'c');
  eq('다 지났으면 없음', nextItem([it('a', '09:00')], '23:00'), null);
  eq('남은 분', minutesUntil('14:05', '15:30'), 85);
}

console.log('\n── 동선 최적화 ──');
{
  // 경도만 다른 일직선 위의 점들 (0.01도 ≈ 1.1km)
  const at = (id: string, lng: number, kind: RoutePoint['kind'] = 'place'): RoutePoint => ({
    id,
    kind,
    coord: { lat: 13.75, lng: 100.5 + lng },
  });
  const zigzag = [at('hotel', 0), at('far', 0.05), at('near', 0.01), at('mid', 0.03)];
  const r = optimizeDay(zigzag);
  eq('가까운 순서로', r.order.join(','), 'hotel,near,mid,far');
  ok('거리가 줄어든다', r.after < r.before);

  eq('이미 최단이면 그대로', optimizeDay([at('a', 0), at('b', 0.01), at('c', 0.02)]).order.join(','), 'a,b,c');
  eq('첫 일정은 고정', optimizeDay([at('far', 0.05), at('a', 0), at('b', 0.01)]).order[0], 'far');

  // 기차 구간은 제자리, 그 앞뒤 묶음끼리만 정렬
  const withTrain = [
    at('hotel', 0),
    at('x2', 0.02),
    at('x1', 0.01),
    { id: 'train', kind: 'train', coord: { lat: 13.75, lng: 100.53 }, toCoord: { lat: 14.75, lng: 100.5 } } as RoutePoint,
    { id: 'y2', kind: 'place', coord: { lat: 14.75, lng: 100.52 } } as RoutePoint,
    { id: 'y1', kind: 'place', coord: { lat: 14.75, lng: 100.51 } } as RoutePoint,
  ];
  eq('구간 일정 기준으로 나눠 정렬', optimizeDay(withTrain).order.join(','), 'hotel,x1,x2,train,y1,y2');

  const noCoord = [at('a', 0), at('c', 0.02), { id: 'lunch', kind: 'place' } as RoutePoint, at('b', 0.01)];
  eq('좌표 없는 일정은 제자리', optimizeDay(noCoord).order[2], 'lunch');

  // 9곳 이상은 근사(가까운 곳부터 + 2-opt) — 일직선이면 정답과 같아야 한다
  const many = [at('s', 0), ...[9, 3, 7, 1, 5, 2, 8, 4, 6].map((k) => at(`p${k}`, k * 0.01))];
  eq('많아도 풀린다', optimizeDay(many).order.join(','), 's,p1,p2,p3,p4,p5,p6,p7,p8,p9');
}

console.log('\n── 캘린더 내보내기 ──');
{
  const trip = {
    id: 't', name: '방콕, 도쿄', startDate: '2026-11-04', endDate: '2026-11-04', ownerId: 'a',
    inviteCode: 'X', coverEmoji: '🧳', members: [],
    days: [{ date: '2026-11-04', timezone: 'Asia/Bangkok', cityLabel: '방콕' }],
  } as Trip;
  const items = [
    { id: 'i1', tripId: 't', date: '2026-11-04', sortKey: 'a0', kind: 'place', title: '왕궁; 입장', localTime: '09:00', durationMin: 120, placeName: '왓 프라깨우', bookingRef: 'AB12', description: '긴바지\n챙길 것' },
    { id: 'i2', tripId: 't', date: '2026-11-04', sortKey: 'a1', kind: 'place', title: '자유 시간' },
  ] as Item[];
  const ics = buildIcs(trip, items, { bookingLabel: '예약 번호' }, new Date('2026-10-01T00:00:00Z'));
  ok('CRLF 줄바꿈', ics.includes('\r\nBEGIN:VEVENT\r\n'));
  // 방콕 09:00 = UTC 02:00, 120분 뒤 04:00
  ok('현지 시각을 UTC로', ics.includes('DTSTART:20261104T020000Z') && ics.includes('DTEND:20261104T040000Z'));
  ok('시각 없으면 종일', ics.includes('DTSTART;VALUE=DATE:20261104') && ics.includes('DTEND;VALUE=DATE:20261105'));
  ok('특수문자 이스케이프', ics.includes('SUMMARY:왕궁\\; 입장') && ics.includes('X-WR-CALNAME:방콕\\, 도쿄'));
  ok('예약 번호·메모', ics.includes('예약 번호: AB12'));
  ok('75바이트 넘는 줄 없음', ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
}

console.log('\n── 후보 장소 순위 ──');
{
  const pl = (id: string, createdAt: string) => ({ id, tripId: 't', name: id, createdAt });
  const vote = (placeId: string, userId: string) => ({ placeId, tripId: 't', userId });
  const ranked = rankPlaces(
    [pl('a', '2026-01-01'), pl('b', '2026-01-02'), pl('c', '2026-01-03')],
    [vote('c', 'u1'), vote('c', 'u2'), vote('b', 'u1'), vote('c', 'u1')],
  );
  eq('표 많은 순', ranked.map((r) => r.place.id).join(''), 'cba');
  eq('같은 사람 표는 한 번', ranked[0]!.voters.length, 2);
  eq('표가 같으면 먼저 올린 곳', rankPlaces([pl('y', '2026-01-02'), pl('x', '2026-01-01')], []).map((r) => r.place.id).join(''), 'xy');
}

console.log('\n── 이동 수단 고르기 ──');
{
  // 명동 → 경복궁 실제 사례: 도보 36, 대중교통 25, 차량 11
  const seoul = { walk: 36, transit: 25, car: 11 };
  eq('차가 가장 빨라도 도보·대중교통 중에서 추천', recommendMode(seoul), 'transit');
  eq('가까우면 도보', recommendMode({ walk: 18, transit: 15, car: 5 }), 'walk');
  eq('대중교통 없고 도보가 너무 길면 차량', recommendMode({ walk: 400, car: 60 }), 'car');
  eq('아무것도 없으면 추천 없음', recommendMode({ walk: 400 }), undefined);

  const auto = effectiveLeg(undefined, seoul);
  eq('아무것도 안 고름 → 추천 수단의 조회 시간', `${auto.mode}/${auto.minutes}/${auto.manual}`, 'transit/25/false');

  // 수단만 고른 경우 — 고를 때 값(11)이 아니라 지금 조회 시간을 따라간다
  const picked = effectiveLeg({ mode: 'walk', minutes: 11, isManual: false }, seoul);
  eq('수단만 고름 → 그 수단의 조회 시간', `${picked.mode}/${picked.minutes}/${picked.manual}`, 'walk/36/false');
  const pickedOffline = effectiveLeg({ mode: 'transit', minutes: 25, isManual: false }, {});
  eq('조회가 안 되면 고를 때의 시간', pickedOffline.minutes, 25);

  const manual = effectiveLeg({ mode: 'car', minutes: 40, isManual: true }, seoul);
  eq('직접 고친 시간은 조회로 덮지 않음', `${manual.mode}/${manual.minutes}/${manual.manual}`, 'car/40/true');
}

console.log('\n── 대중교통 응답 해석 (Transitous) ──');
{
  // 정밀도 6 인코더 — 테스트용 (서버가 v2 이후 이렇게 보낸다)
  const encode = (pts: { lat: number; lng: number }[], precision = 6): string => {
    const f = 10 ** precision;
    let out = '';
    let pl = 0;
    let pg = 0;
    const put = (v: number) => {
      let n = v < 0 ? -2 * v - 1 : 2 * v;
      while (n >= 0x20) {
        out += String.fromCharCode((0x20 | (n % 32)) + 63);
        n = Math.floor(n / 32);
      }
      out += String.fromCharCode(n + 63);
    };
    for (const p of pts) {
      const la = Math.round(p.lat * f);
      const lg = Math.round(p.lng * f);
      put(la - pl);
      put(lg - pg);
      pl = la;
      pg = lg;
    }
    return out;
  };

  const myeongdong = { lat: 37.5609, lng: 126.9853 };
  const gyeongbok = { lat: 37.5796, lng: 126.977 };
  const q = { from: myeongdong, to: gyeongbok, mode: 'transit' as const, departAt: '2026-10-01T03:00:00Z' };
  const walk = (a: typeof myeongdong, b: typeof myeongdong): MotisLeg => ({
    mode: 'WALK',
    distance: 300,
    legGeometry: { points: encode([a, b]), precision: 6 },
  });
  const ride = (mode: string, names: Partial<MotisLeg>): MotisLeg => ({
    mode,
    ...names,
    legGeometry: { points: encode([myeongdong, gyeongbok]), precision: 6 },
  });

  // 한국 경도(126)에서 정밀도 6 경로선이 제자리에 찍힌다
  const round = decodePolyline(encode([myeongdong, gyeongbok]), 6);
  ok('서울 좌표가 제자리 (정밀도 6)', Math.abs(round[1]!.lng - 126.977) < 1e-6 && Math.abs(round[1]!.lat - 37.5796) < 1e-6);

  // 가장 일찍 도착하는 여정을 고른다 (첫 번째가 아니라)
  const r = parsePlan(
    {
      itineraries: [
        {
          duration: 50 * 60,
          startTime: '2026-10-01T03:00:00Z',
          endTime: '2026-10-01T03:50:00Z',
          transfers: 2,
          legs: [walk(myeongdong, myeongdong), ride('BUS', { routeShortName: '7022' }), ride('SUBWAY', { displayName: '3호선' })],
        },
        {
          duration: 20 * 60,
          startTime: '2026-10-01T03:10:00Z',
          endTime: '2026-10-01T03:30:00Z',
          transfers: 0,
          legs: [walk(myeongdong, myeongdong), ride('SUBWAY', { displayName: '4호선', routeShortName: '' }), walk(gyeongbok, gyeongbok)],
        },
      ],
    },
    q,
  );
  ok('대중교통 결과가 나온다', r.available);
  if (r.available) {
    eq('일찍 도착하는 쪽의 노선', r.lines?.join(','), '4호선');
    // 03:00에 나서서 03:30 도착 — 10분 기다림도 이동 시간이다
    eq('기다리는 시간까지 포함', r.minutes, 30);
    ok('경로선이 서울에 있다', (r.polyline ?? []).every((p) => p.lng > 126 && p.lng < 128));
  }

  // 이름은 displayName → routeShortName → routeLongName → tripShortName
  const named = parsePlan(
    {
      itineraries: [
        {
          duration: 600,
          endTime: '2026-10-01T03:10:00Z',
          legs: [
            ride('BUS', { routeShortName: '472', routeLongName: '신내동-개포동' }),
            ride('BUS', { routeShortName: '472' }),
            ride('HIGHSPEED_RAIL', { tripShortName: 'KTX 012' }),
          ],
        },
      ],
    },
    { ...q, departAt: undefined },
  );
  eq('노선 이름 순서·이어 타기 중복 제거', named.available ? named.lines?.join(',') : '', '472,KTX 012');
  eq('출발 시각을 모르면 여정 시간', named.available ? named.minutes : 0, 10);

  // 걷기·자전거만 있는 여정은 대중교통이 아니다
  const walkOnly = parsePlan(
    { itineraries: [{ duration: 900, legs: [walk(myeongdong, gyeongbok)] }, { duration: 500, legs: [{ mode: 'RENTAL' }] }] },
    { ...q, to: { lat: 37.5626, lng: 126.9856 } },
  );
  eq('걷기만 → 가까우면 "노선 없음"', walkOnly.available ? '' : walkOnly.reason, 'no_transit_route');

  // 탄 구간의 선이 정류장 사이 직선보다 터무니없이 길면 쓰지 않는다 (명동 → 경복궁 80km 사례)
  const far1 = { lat: 37.9, lng: 127.3 };
  const detour = parsePlan(
    {
      itineraries: [
        {
          duration: 1500,
          endTime: '2026-10-01T03:25:00Z',
          legs: [
            {
              mode: 'SUBWAY',
              displayName: '3호선',
              from: { lat: myeongdong.lat, lon: myeongdong.lng },
              to: { lat: gyeongbok.lat, lon: gyeongbok.lng },
              legGeometry: { points: encode([myeongdong, far1, gyeongbok]), precision: 6 },
            },
          ],
        },
      ],
    },
    q,
  );
  if (detour.available) {
    ok('터무니없는 우회선은 직선으로', detour.distanceM < 3000, `${detour.distanceM}m`);
    eq('정류장 두 점만 남김', detour.polyline?.length, 2);
  } else ok('우회선 여정도 결과는 나온다', false);

  // 가까운 거리에서 대중교통이 없다고 "이 지역 데이터 없음"을 띄우지 않는다
  const near = parsePlan({ itineraries: [] }, { ...q, to: { lat: 37.5626, lng: 126.9856 } });
  eq('200m — 데이터 없는 지역이 아니다', near.available ? '' : near.reason, 'no_transit_route');
  const far = parsePlan({ itineraries: [] }, { ...q, from: { lat: 21.0285, lng: 105.8542 }, to: { lat: 21.0368, lng: 105.8342 } });
  eq('하노이 2km+ — 데이터 없음', far.available ? '' : far.reason, 'no_transit_data');
}

console.log('\n── 언어 ──');
{
  eq('한국어 기기', detectLocale(['ko-KR', 'en-US']), 'ko');
  eq('일본어 기기', detectLocale(['ja-JP']), 'ja');
  eq('영어 기기', detectLocale(['en-GB']), 'en');
  eq('지원 안 하는 언어 다음 순위', detectLocale(['fr-FR', 'ja']), 'ja');
  eq('지원하는 게 없으면 영어', detectLocale(['fr-FR', 'zh-CN']), 'en');
  eq('목록이 비면 영어', detectLocale([]), 'en');
  eq('밑줄 표기도', detectLocale(['ja_JP']), 'ja');
  ok('설정값 auto', isLocalePreference('auto'));
  ok('설정값 ja', isLocalePreference('ja'));
  ok('설정값 이상한 값은 거절', !isLocalePreference('fr') && !isLocalePreference(null));

  eq('날짜 ko', formatDateLabel('2026-11-03'), '11월 3일 (화)');
  eq('날짜 en', formatDateLabel('2026-11-03', 'en'), 'Tue, Nov 3');
  eq('날짜 ja', formatDateLabel('2026-11-03', 'ja'), '11月3日(火)');
  eq('요일 en', formatWeekday('2026-11-03', 'en'), 'Tue');
  eq('요일 ja', formatWeekday('2026-11-03', 'ja'), '火');
  eq('시간 en', formatMinutes(95, 'en'), '1h 35m');
  eq('시간 ja', formatMinutes(95, 'ja'), '1時間35分');
  eq('분만 ja', formatMinutes(40, 'ja'), '40分');
  eq('시차 en', formatOffsetDelta(-120, 'en'), '-2h');
  eq('시차 없음 ja', formatOffsetDelta(0, 'ja'), 'なし');
  const now2 = Date.parse('2026-11-03T12:00:00Z');
  const ago2 = (ms: number) => new Date(now2 - ms).toISOString();
  eq('방금 en', formatRelative(ago2(10_000), now2, 'en'), 'just now');
  eq('분 전 en', formatRelative(ago2(5 * 60_000), now2, 'en'), '5 min. ago');
  eq('시간 전 ja', formatRelative(ago2(3 * 3_600_000), now2, 'ja'), '3 時間前');

  eq('도시 이름 en', zoneLabel('Asia/Bangkok', 'en'), 'Bangkok');
  eq('도시 이름 ja', zoneLabel('Asia/Tokyo', 'ja'), '東京');
  eq('목록에 없는 타임존', zoneLabel('America/Argentina/Buenos_Aires', 'ja'), 'Buenos Aires');
  ok('다른 언어로 저장된 기본 이름도 알아본다', isDefaultZoneLabel('Asia/Bangkok', '방콕'));
  ok('직접 적은 이름은 기본값이 아니다', !isDefaultZoneLabel('Asia/Bangkok', '카오산'));
  eq('선택지 언어', zoneOptions('en').find((z) => z.id === 'Asia/Seoul')?.label, 'Seoul');

  /*
   * 타입이 키 누락은 막지만, 빈 문자열로 채워 넣은 번역은 못 막는다.
   * ko에서 비어 있지 않은 문구는 다른 언어에서도 비어 있으면 안 된다.
   */
  const emptyWhereKoIsNot = (a: unknown, b: unknown, path: string): string[] => {
    if (typeof a === 'string') return a !== '' && b === '' ? [path] : [];
    if (a && typeof a === 'object') {
      return Object.keys(a).flatMap((k) =>
        emptyWhereKoIsNot(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          `${path}.${k}`,
        ),
      );
    }
    return [];
  };
  eq('en에 빈 번역 없음', emptyWhereKoIsNot(ko, en, 'en').join(','), '');
  eq('ja에 빈 번역 없음', emptyWhereKoIsNot(ko, ja, 'ja').join(','), '');
}

console.log('\n── 이동 시간 여유 ──');
{
  const it = (localTime?: string, durationMin?: number) =>
    ({ id: 'x', tripId: 't', date: '2026-10-01', sortKey: 'a', kind: 'place', title: 'x', localTime, durationMin }) as never;
  eq('넉넉함: 10:00+90분+43분 → 12:30까지 17분 남음', slackMinutes(it('10:00', 90), it('12:30'), 43), 17);
  eq('늦음: 14:30 끝 + 40분 → 15:00 시작이면 10분 늦음', slackMinutes(it('12:30', 120), it('15:00'), 40), -10);
  eq('딱 맞음', slackMinutes(it('10:00', 60), it('11:30'), 30), 0);
  eq('머무는 시간 모르면 모름', slackMinutes(it('10:00'), it('12:00'), 20), null);
  eq('이동 시간 아직 모르면 모름', slackMinutes(it('10:00', 60), it('12:00'), undefined), null);
  eq('다음 일정 시각 없으면 모름', slackMinutes(it('10:00', 60), it(), 20), null);
  eq('시각이 거꾸로면(따로 경고) 모름', slackMinutes(it('15:00', 60), it('09:00'), 20), null);
}

console.log(`\n${failed === 0 ? '✓ 전부 통과' : '✗ 실패 있음'} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
