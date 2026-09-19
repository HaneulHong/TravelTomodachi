/**
 * Fractional index — 실시간 공동 편집에서 순서를 다루는 방법.
 *
 * 순서를 정수(0,1,2...)로 두면 항목 하나를 옮길 때마다 뒤의 모든 행을
 * 업데이트해야 하고, 두 사람이 동시에 옮기면 같은 인덱스를 놓고 충돌한다.
 * 대신 순서를 문자열로 두고 사전순 비교를 순서로 쓴다. 두 키 사이에는
 * 언제나 새 키를 만들 수 있으므로 항목을 옮길 때 그 한 행만 쓰면 된다.
 *
 *   A와 B 사이에 넣기  →  keyBetween(A, B)
 *   맨 앞에 넣기       →  keyBetween(null, first)
 *   맨 뒤에 넣기       →  keyBetween(last, null)
 *
 * ── 왜 단순 midpoint로는 안 되는가 ──────────────────────────────────
 * "두 문자열의 중간값"만으로 구현하면 맨 뒤에 계속 추가할 때
 * 'V' → 'l' → 'u' → ... → 'zzzzzz...' 로 키가 무한히 길어진다.
 * 그런데 일정 맨 뒤에 항목 추가는 이 앱에서 가장 흔한 동작이다.
 *
 * 그래서 키를 [정수부][소수부]로 나눈다. 정수부의 머리글자가 자기 길이를
 * 인코딩하므로, 뒤에 추가할 때는 정수부만 1 증가시키면 된다 — 키 길이가
 * 거의 늘지 않는다. 소수부는 "이미 붙어 있는 두 키 사이"에 끼울 때만 쓴다.
 *
 *   맨 뒤 추가:  a0 → a1 → a2 → ... → az → b00 → b01 → ...
 *   사이 삽입:   a1 과 a2 사이 → a1V
 *
 * 머리글자 규칙: 'a'는 뒤에 1자리, 'b'는 2자리, ... 'z'는 26자리.
 * 음수 방향은 'Z'가 1자리, 'Y'가 2자리, ... 'A'가 26자리.
 *
 * (rocicorp/fractional-indexing과 같은 인코딩이라 서버·다른 클라이언트
 *  구현과 키를 섞어 써도 호환된다.)
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = '0';
const TOP_DIGIT = DIGITS[DIGITS.length - 1]!; // 'z'
/** 더 이상 앞으로 갈 수 없는 정수부 */
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

/** 머리글자가 인코딩하는 정수부 전체 길이 */
function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new Error(`fractionalIndex: 머리글자가 잘못됐습니다 — ${JSON.stringify(head)}`);
}

function integerPart(key: string): string {
  const head = key[0];
  if (head === undefined) throw new Error('fractionalIndex: 빈 정렬 키');
  const len = integerLength(head);
  if (len > key.length) {
    throw new Error(`fractionalIndex: 정수부가 잘렸습니다 — ${JSON.stringify(key)}`);
  }
  return key.slice(0, len);
}

function validateInteger(int: string): void {
  const head = int[0];
  if (head === undefined || int.length !== integerLength(head)) {
    throw new Error(`fractionalIndex: 정수부 길이가 안 맞습니다 — ${JSON.stringify(int)}`);
  }
}

function validateKey(key: string): void {
  if (key === SMALLEST_INTEGER) {
    throw new Error(`fractionalIndex: 최소 키는 쓸 수 없습니다 — ${JSON.stringify(key)}`);
  }
  const int = integerPart(key);
  const frac = key.slice(int.length);
  // 소수부가 '0'으로 끝나면 그 아래로 키를 만들 여지가 없어져 알고리즘이 깨진다.
  if (frac.endsWith(ZERO)) {
    throw new Error(`fractionalIndex: 키가 '0'으로 끝날 수 없습니다 — ${JSON.stringify(key)}`);
  }
}

/** 정수부 +1. 더 늘릴 수 없으면 null. */
function incrementInteger(int: string): string | null {
  validateInteger(int);
  const head = int[0]!;
  const digs = int.slice(1).split('');

  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i -= 1) {
    const next = DIGITS.indexOf(digs[i]!) + 1;
    if (next === DIGITS.length) {
      digs[i] = ZERO; // 자리 넘침 → 위 자리로 올림
    } else {
      digs[i] = DIGITS[next]!;
      carry = false;
    }
  }

  if (!carry) return head + digs.join('');

  // 자릿수를 다 썼다 → 머리글자를 한 칸 옮겨 자리수를 늘린다
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digs.push(ZERO);
  else digs.pop();
  return nextHead + digs.join('');
}

/** 정수부 -1. 더 줄일 수 없으면 null. */
function decrementInteger(int: string): string | null {
  validateInteger(int);
  const head = int[0]!;
  const digs = int.slice(1).split('');

  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i -= 1) {
    const next = DIGITS.indexOf(digs[i]!) - 1;
    if (next === -1) {
      digs[i] = TOP_DIGIT;
    } else {
      digs[i] = DIGITS[next]!;
      borrow = false;
    }
  }

  if (!borrow) return head + digs.join('');

  if (head === 'a') return `Z${TOP_DIGIT}`;
  if (head === 'A') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (nextHead < 'Z') digs.push(TOP_DIGIT);
  else digs.pop();
  return nextHead + digs.join('');
}

/**
 * 소수부 a와 b의 중간값. a는 ''(=0), b는 null(=1)로 볼 수 있다.
 * 전제: a < b, 둘 다 '0'으로 끝나지 않음.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new Error(`fractionalIndex: 소수부 순서가 뒤집혔습니다 (${a}, ${b})`);
  }
  if (a.endsWith(ZERO) || (b !== null && b.endsWith(ZERO))) {
    throw new Error(`fractionalIndex: 소수부가 '0'으로 끝날 수 없습니다 (${a}, ${b})`);
  }

  // 공통 접두사는 떼어내고 나머지에서 재귀
  if (b !== null) {
    let n = 0;
    while (n < b.length && (a[n] ?? ZERO) === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }

  const da = a.length === 0 ? 0 : DIGITS.indexOf(a[0]!);
  const db = b === null ? DIGITS.length : DIGITS.indexOf(b[0]!);

  if (db - da > 1) {
    return DIGITS[Math.round((da + db) / 2)]!;
  }
  if (b !== null && b.length > 1) {
    return b.slice(0, 1);
  }
  return DIGITS[da]! + midpoint(a.slice(1), null);
}

/**
 * a와 b 사이의 새 정렬 키.
 * 양쪽 모두 null이면 첫 키를 만든다.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) validateKey(a);
  if (b !== null) validateKey(b);
  if (a !== null && b !== null && a >= b) {
    throw new Error(`fractionalIndex: 순서가 뒤집혔습니다 (a=${a}, b=${b})`);
  }

  // 맨 앞에 삽입
  if (a === null) {
    if (b === null) return `a${ZERO}`; // 첫 키: 'a0'
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb);
    if (ib < b) return ib; // b가 소수부를 가지면 정수부만으로 앞에 낄 수 있다
    const dec = decrementInteger(ib);
    if (dec === null) throw new Error('fractionalIndex: 더 앞에 키를 만들 수 없습니다');
    return dec;
  }

  // 맨 뒤에 추가 — 정수부만 +1 하면 되므로 키가 거의 안 늘어난다
  if (b === null) {
    const ia = integerPart(a);
    const fa = a.slice(ia.length);
    const inc = incrementInteger(ia);
    return inc === null ? ia + midpoint(fa, null) : inc;
  }

  // 두 키 사이에 삽입
  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);

  const inc = incrementInteger(ia);
  if (inc === null) throw new Error('fractionalIndex: 더 뒤에 키를 만들 수 없습니다');
  if (inc < b) return inc;
  return ia + midpoint(fa, null);
}

/** 빈 목록에 첫 항목을 넣을 때 쓰는 키 */
export function firstKey(): string {
  return keyBetween(null, null);
}

/** 정렬 키 기준 오름차순 비교자 */
export function bySortKey<T extends { sortKey: string }>(x: T, y: T): number {
  return x.sortKey < y.sortKey ? -1 : x.sortKey > y.sortKey ? 1 : 0;
}

/**
 * 이미 정렬된 목록에서 index 위치에 삽입할 키를 만든다.
 * index 0이면 맨 앞, index === sorted.length면 맨 뒤.
 */
export function keyForInsertAt(sorted: { sortKey: string }[], index: number): string {
  const clamped = Math.max(0, Math.min(index, sorted.length));
  const before = clamped > 0 ? (sorted[clamped - 1]?.sortKey ?? null) : null;
  const after = clamped < sorted.length ? (sorted[clamped]?.sortKey ?? null) : null;
  return keyBetween(before, after);
}

/**
 * 정렬된 목록에서 from 위치의 항목을 to 위치로 옮길 때 쓸 새 키.
 * 드래그 앤 드롭 순서 변경용 — 옮기는 항목 한 행만 업데이트하면 된다.
 *
 * `to`는 **이동이 끝난 뒤의 최종 인덱스**다. (Array.prototype.splice와 같은 규약:
 * 항목을 빼낸 배열에 to 위치로 끼워 넣는다.) 즉 [A,B,C,D]에서 keyForMove(rows,0,2)는
 * B C A D 가 된다. DnD 라이브러리가 원본 기준 인덱스를 준다면 호출부에서 변환할 것.
 */
export function keyForMove(
  sorted: { sortKey: string }[],
  from: number,
  to: number,
): string {
  const without = sorted.filter((_, i) => i !== from);
  return keyForInsertAt(without, to);
}
