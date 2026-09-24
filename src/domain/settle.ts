/**
 * 가계부 정산 — 누가 누구에게 얼마를 보내면 끝나는지.
 *
 * 순수 함수만 둔다(React·네트워크 무관). 환율은 호출부가 넘긴다.
 *
 * ── 통화 ───────────────────────────────────────────────────────────
 * 여행 경비는 여러 통화로 섞인다(엔으로 라멘, 원으로 항공권). 환율이 있으면
 * 한 통화(정산 통화)로 모아 한 번에 정산하고, 환율이 없으면(오프라인·API 실패)
 * **통화별로 따로** 정산한다. 틀린 환율로 한 번에 맞추는 것보다 통화마다
 * 정확한 게 낫다 — 현지에서는 그 통화로 주고받으면 된다.
 *
 * ── 금액 ───────────────────────────────────────────────────────────
 * 부동소수 오차가 쌓이지 않게 **최소 단위 정수**로 계산한다(원·엔은 1, 달러는 센트).
 * 나누어떨어지지 않는 몫은 앞사람부터 1씩 더 낸다 — 합이 원금과 정확히 같아야
 * 정산이 0으로 끝난다.
 */

export interface ExpenseLike {
  amount: number;
  currency: string;
  paidBy: string;
  /** 나눠 낼 사람들. 비어 있으면 아무도 부담하지 않은 것으로 본다(계산에서 빠진다). */
  splitAmong: readonly string[];
}

/** 1 USD = rates[통화] (open.er-api.com 모양) */
export type Rates = Readonly<Record<string, number>>;

export interface Transfer {
  from: string;
  to: string;
  /** 통화의 보통 단위(원, 달러). 최소 단위로 반올림돼 있다. */
  amount: number;
  currency: string;
}

/** 통화의 소수 자릿수. Intl이 안다(KRW·JPY 0, USD 2, 모르면 2). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyDigits(currency));
}

function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

/** from 통화 금액을 to 통화로. 환율이 없으면 null. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  const a = rates[from];
  const b = rates[to];
  if (!a || !b) return null;
  return (amount / a) * b;
}

/**
 * 사람별 잔액(최소 단위 정수). 양수면 받을 돈, 음수면 낼 돈.
 * 모든 지출이 같은 통화(currency)라고 가정한다 — 섞여 있으면 호출부가 먼저 바꾼다.
 */
export function balances(expenses: readonly ExpenseLike[], currency: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (who: string, v: number) => out.set(who, (out.get(who) ?? 0) + v);

  for (const e of expenses) {
    const people = [...new Set(e.splitAmong)];
    if (people.length === 0) continue;
    const total = toMinor(e.amount, currency);
    add(e.paidBy, total);
    const share = Math.floor(total / people.length);
    let remainder = total - share * people.length;
    for (const p of people) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      add(p, -(share + extra));
    }
  }
  return out;
}

/**
 * 잔액을 송금 목록으로. 가장 많이 낼 사람이 가장 많이 받을 사람에게 보내는 걸
 * 반복한다 — 송금 횟수가 (사람 수 − 1)을 넘지 않는다. 같은 입력이면 늘 같은
 * 결과가 나오게 금액이 같을 땐 id 순으로 고른다.
 */
export function transfers(bal: Map<string, number>, currency: string): Transfer[] {
  const creditors = [...bal].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = [...bal].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const order = (a: { id: string; v: number }, b: { id: string; v: number }) =>
    b.v - a.v || (a.id < b.id ? -1 : 1);

  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(order);
    debtors.sort(order);
    const c = creditors[0]!;
    const d = debtors[0]!;
    const pay = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount: fromMinor(pay, currency), currency });
    c.v -= pay;
    d.v -= pay;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return out;
}

export interface Settlement {
  /** 한 통화로 모았으면 true, 환율이 없어 통화별로 나눴으면 false */
  unified: boolean;
  /** 통화별 정산. unified면 정산 통화 하나. */
  groups: {
    currency: string;
    total: number;
    /** 사람별 부담액(보통 단위) — "나는 얼마 썼나" */
    shares: Map<string, number>;
    transfers: Transfer[];
  }[];
}

/**
 * 정산 전체. rates가 있고 모든 통화를 바꿀 수 있으면 base 하나로 모으고,
 * 아니면 통화별로 나눈다.
 */
export function settle(
  expenses: readonly ExpenseLike[],
  base: string,
  rates: Rates | null,
): Settlement {
  const counted = expenses.filter((e) => e.splitAmong.length > 0 && e.amount > 0);
  const converted = rates
    ? counted.map((e) => {
        const amount = convert(e.amount, e.currency, base, rates);
        return amount === null ? null : { ...e, amount, currency: base };
      })
    : null;
  const unified = converted !== null && converted.every((e) => e !== null);

  const byCurrency = new Map<string, ExpenseLike[]>();
  for (const e of unified ? (converted as ExpenseLike[]) : counted) {
    byCurrency.set(e.currency, [...(byCurrency.get(e.currency) ?? []), e]);
  }

  const groups = [...byCurrency].map(([currency, list]) => {
    const bal = balances(list, currency);
    // 부담액 = 낸 돈 − 잔액. 낸 돈을 따로 모아 계산한다.
    const paid = new Map<string, number>();
    for (const e of list) paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + toMinor(e.amount, currency));
    const shares = new Map<string, number>();
    for (const [who, v] of bal) shares.set(who, fromMinor((paid.get(who) ?? 0) - v, currency));
    const total = fromMinor(
      list.reduce((sum, e) => sum + toMinor(e.amount, currency), 0),
      currency,
    );
    return { currency, total, shares, transfers: transfers(bal, currency) };
  });

  return { unified, groups };
}
