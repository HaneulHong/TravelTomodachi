/**
 * 가계부 — 누가 얼마 냈고, 누가 누구에게 얼마 보내면 끝나는지.
 *
 * 정산은 저장하지 않고 매번 계산한다(domain/settle.ts). 지출을 고치면 정산도
 * 저절로 맞고, 두 사람이 동시에 적어도 충돌할 게 없다.
 *
 * 정산 통화는 사람마다 다르게 본다(기기에 기억) — 일본 친구는 엔으로, 나는 원으로.
 * 환율을 못 받으면(오프라인 첫 실행 등) 통화별로 따로 정산해 보여준다.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ExpenseSheet } from '@/components/ExpenseSheet';
import { PlusIcon } from '@/components/icons';
import { SHOW_DEV_HINTS } from '@/config';
import {
  CURRENCIES,
  currencyForTimezone,
  currencyName,
  formatMoney,
  homeCurrency,
} from '@/domain/currency';
import { convert, settle } from '@/domain/settle';
import { formatDateLabel } from '@/domain/time';
import { memberLabel, type Expense, type Member } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { platform } from '@/platform';
import { getRates, RATES_ATTRIBUTION, type RatesResult } from '@/providers/rates';
import { useTripStore } from '@/store/tripStore';

const SETTLE_KEY = (tripId: string) => `tt.settle-currency.${tripId}`;

function readSettleCurrency(tripId: string): string | null {
  try {
    return localStorage.getItem(SETTLE_KEY(tripId));
  } catch {
    return null;
  }
}

function writeSettleCurrency(tripId: string, currency: string): void {
  try {
    localStorage.setItem(SETTLE_KEY(tripId), currency);
  } catch {
    // 이번 화면 동안만 기억한다
  }
}

/** 'YYYY-MM-DD' 오늘 (기기 기준) */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExpensesScreen() {
  const { tripId = '' } = useParams();
  const [search] = useSearchParams();
  const t = useT();
  const locale = useLocale();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const me = useTripStore((s) => s.currentUserId);
  const available = useTripStore((s) => s.expensesAvailable);
  const allExpenses = useTripStore((s) => s.expenses);
  const expenses = useMemo(
    () => allExpenses.filter((e) => e.tripId === tripId),
    [allExpenses, tripId],
  );

  const [base, setBase] = useState(() => readSettleCurrency(tripId) ?? homeCurrency(locale));
  const [rates, setRates] = useState<RatesResult | null>(null);
  const [sheet, setSheet] = useState<{ expense?: Expense } | null>(null);

  useEffect(() => {
    let alive = true;
    void getRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, []);

  const settlement = useMemo(
    () =>
      settle(
        expenses.map((e) => ({ ...e, paidBy: e.paidBy ?? '?' })),
        base,
        rates?.rates ?? null,
      ),
    [expenses, base, rates],
  );

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title={t.ledger.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.tripNotFound}</p>
        </main>
      </div>
    );
  }

  const nameOf = (id: string | undefined): string => {
    const m: Member | undefined = trip.members.find((x) => x.id === id);
    return m ? memberLabel(m, trip.members) : t.edited.leftMember;
  };
  const money = (amount: number, currency: string) => formatMoney(amount, currency, locale);

  /*
   * 새 지출의 기본값. 날짜는 보고 있던 날(?date=) → 여행 중이면 오늘 → 없음.
   * 통화는 그 날 도시의 현지 통화 → 여행 첫날 도시 → 정산 통화.
   */
  const now = today();
  const defaultDate =
    search.get('date') ?? (trip.days.some((d) => d.date === now) ? now : undefined);
  const dayOf = trip.days.find((d) => d.date === defaultDate) ?? trip.days[0];
  const defaultCurrency = currencyForTimezone(dayOf?.timezone) ?? base;

  // 날짜별로 묶는다. 최근 날짜가 위로, 날짜 없는 지출은 맨 아래.
  const groups = new Map<string, Expense[]>();
  for (const e of [...expenses].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))) {
    const key = e.spentOn ?? '';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)));

  const baseOptions = CURRENCIES.includes(base as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [base, ...CURRENCIES];

  return (
    <div className="app">
      <AppHeader title={t.ledger.title} back />

      <main className="main main--no-tabs">
        {!available ? (
          <div className="section">
            <p className="empty">{t.ledger.needsDb}</p>
            {SHOW_DEV_HINTS && (
              <p className="form__hint">supabase/expenses.sql을 SQL Editor에서 실행하세요.</p>
            )}
          </div>
        ) : (
          <>
            {/* 요약 + 정산 */}
            <div className="section">
              <section className="card ledger-summary">
                <label className="ledger-summary__base">
                  <span>{t.ledger.settleIn}</span>
                  <select
                    value={base}
                    onChange={(e) => {
                      setBase(e.target.value);
                      writeSettleCurrency(tripId, e.target.value);
                    }}
                  >
                    {baseOptions.map((c) => (
                      <option key={c} value={c}>
                        {c} · {currencyName(c, locale)}
                      </option>
                    ))}
                  </select>
                </label>

                {settlement.groups.length === 0 && (
                  <p className="ledger-summary__empty">{t.ledger.empty}</p>
                )}

                {settlement.groups.map((g) => (
                  <div key={g.currency} className="ledger-summary__group">
                    <div className="ledger-summary__row">
                      <span>{t.ledger.total}</span>
                      <strong>{money(g.total, g.currency)}</strong>
                    </div>
                    <div className="ledger-summary__row ledger-summary__row--sub">
                      <span>{t.ledger.myShare}</span>
                      <span>{money(g.shares.get(me) ?? 0, g.currency)}</span>
                    </div>

                    <div className="ledger-settle">
                      <div className="ledger-settle__title">{t.ledger.settleTitle}</div>
                      {g.transfers.length === 0 ? (
                        <p className="ledger-settle__done">{t.ledger.allSettled}</p>
                      ) : (
                        <ul className="ledger-settle__list">
                          {g.transfers.map((tr) => (
                            <li
                              key={`${tr.from}-${tr.to}`}
                              className={`ledger-settle__item${
                                tr.from === me || tr.to === me ? ' ledger-settle__item--me' : ''
                              }`}
                            >
                              <span className="ledger-settle__who">
                                {nameOf(tr.from)} <span aria-hidden>→</span>{' '}
                                <span className="sr-only">{t.ledger.receives}</span>
                                {nameOf(tr.to)}
                              </span>
                              <strong>{money(tr.amount, tr.currency)}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}

                {settlement.groups.length > 0 && (
                  <p className="ledger-summary__note">
                    {settlement.unified
                      ? rates && t.ledger.ratesAsOf(formatDateLabel(rates.asOf.slice(0, 10), locale))
                      : t.ledger.byCurrency}{' '}
                    {/* 무료 환율 API의 사용 조건 — 출처 링크를 남긴다 */}
                    {rates && (
                      <button
                        className="credits__link"
                        onClick={() => platform.openExternal(RATES_ATTRIBUTION.url)}
                      >
                        {RATES_ATTRIBUTION.name}
                      </button>
                    )}
                  </p>
                )}
              </section>
            </div>

            {/* 지출 목록 */}
            <div className="section">
              {groupKeys.map((key) => (
                <div key={key || 'none'} className="ledger-day">
                  <h2 className="section__title">
                    {key ? formatDateLabel(key, locale) : t.ledger.noDate}
                  </h2>
                  <ul className="ledger-list">
                    {groups.get(key)!.map((e) => {
                      const inBase =
                        rates && e.currency !== base ? convert(e.amount, e.currency, base, rates.rates) : null;
                      return (
                        <li key={e.id}>
                          <button className="ledger-item" onClick={() => setSheet({ expense: e })}>
                            <span className="ledger-item__main">
                              <span className="ledger-item__title">{e.title}</span>
                              <span className="ledger-item__sub">
                                {t.ledger.paidLine(nameOf(e.paidBy), e.splitAmong.length)}
                              </span>
                            </span>
                            <span className="ledger-item__money">
                              <strong>{money(e.amount, e.currency)}</strong>
                              {inBase !== null && (
                                <span className="ledger-item__sub">
                                  {t.ledger.approx(money(inBase, base))}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <button className="tl-add" onClick={() => setSheet({})}>
                <PlusIcon size={16} /> {t.ledger.add}
              </button>
            </div>
          </>
        )}
      </main>

      {sheet && (
        <ExpenseSheet
          // 열 때마다 새로 — 지난번에 적다 만 값이 남지 않게
          key={sheet.expense?.id ?? 'new'}
          trip={trip}
          expense={sheet.expense}
          defaults={{ currency: defaultCurrency, spentOn: defaultDate }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
