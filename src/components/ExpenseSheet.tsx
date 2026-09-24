/**
 * 지출 한 줄 적기 · 고치기.
 *
 * 여행지에서 계산대 앞에 서서 적는 화면이라 칸을 최소로 둔다.
 * 기본값을 잘 채워 두면 금액만 치고 끝난다:
 *   통화 — 그 날 도시의 현지 통화 (방콕이면 THB)
 *   낸 사람 — 나
 *   나눠 낼 사람 — 모두
 *   날짜 — 보고 있던 날(여행 중이면 오늘)
 */

import { useState } from 'react';
import { MenuSheet } from '@/components/MenuSheet';
import { CURRENCIES, currencyName, formatMoney } from '@/domain/currency';
import { formatDateLabel } from '@/domain/time';
import { memberLabel, type Expense, type Trip } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

interface Props {
  trip: Trip;
  /** 고칠 지출. 없으면 새로 적는다. */
  expense?: Expense;
  defaults: { currency: string; spentOn?: string };
  onClose(): void;
}

/** 금액 칸 — 쉼표·공백을 허용하고 숫자로 바꾼다. 0 이하·숫자 아님은 null. */
function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ExpenseSheet({ trip, expense, defaults, onClose }: Props) {
  const t = useT();
  const locale = useLocale();
  const me = useTripStore((s) => s.currentUserId);
  const addExpense = useTripStore((s) => s.addExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);

  const memberIds = trip.members.map((m) => m.id);
  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? defaults.currency);
  // 개발용 계정처럼 멤버 목록에 내가 없으면 첫 멤버로
  const [paidBy, setPaidBy] = useState(
    expense?.paidBy ?? (memberIds.includes(me) ? me : memberIds[0] ?? ''),
  );
  const [split, setSplit] = useState<string[]>(expense?.splitAmong ?? memberIds);
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? defaults.spentOn ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const value = parseAmount(amount);
  const canSave = title.trim().length > 0 && value !== null && split.length > 0 && paidBy !== '';
  // 통화 목록에 없는 값(예전에 적은 것)도 선택지에 남긴다
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [currency, ...CURRENCIES];

  const toggle = (id: string): void =>
    setSplit((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = (): void => {
    if (!canSave || value === null) return;
    const fields = {
      title: title.trim(),
      amount: value,
      currency,
      paidBy,
      splitAmong: split,
      spentOn: spentOn || undefined,
    };
    if (expense) updateExpense(expense.id, fields);
    else addExpense({ tripId: trip.id, ...fields });
    onClose();
  };

  return (
    <MenuSheet open onClose={onClose} label={expense ? t.ledger.editTitle : t.ledger.addTitle}>
      <form
        className="form expense-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="dayedit__title">{expense ? t.ledger.editTitle : t.ledger.addTitle}</div>

        <div className="form__pair expense-form__money">
          <label className="form__row">
            <span className="form__label">{t.ledger.amount}</span>
            <input
              className="form__input expense-form__amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus={!expense}
            />
          </label>
          <label className="form__row">
            <span className="form__label">{t.ledger.currency}</span>
            <select
              className="form__input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c} · {currencyName(c, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form__row">
          <span className="form__label">{t.ledger.what}</span>
          <input
            className="form__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.ledger.whatPlaceholder}
            maxLength={60}
          />
        </label>

        <label className="form__row">
          <span className="form__label">{t.ledger.paidBy}</span>
          <select className="form__input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {trip.members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m, trip.members)}
                {m.id === me ? t.members.me : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="form__row">
          <span className="form__label">{t.ledger.splitAmong}</span>
          <div className="expense-form__people">
            {trip.members.map((m) => {
              const on = split.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`person-chip${on ? ' person-chip--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(m.id)}
                >
                  <span className="avatar avatar--sm" style={{ background: m.color }}>
                    {m.initial}
                  </span>
                  {memberLabel(m, trip.members)}
                </button>
              );
            })}
          </div>
          <p className={`form__hint${split.length === 0 ? ' form__hint--error' : ''}`}>
            {split.length === 0
              ? t.ledger.splitNone
              : value !== null
                ? t.ledger.splitEach(split.length, formatMoney(value / split.length, currency, locale))
                : ' '}
          </p>
        </div>

        <label className="form__row">
          <span className="form__label">{t.ledger.date}</span>
          <select className="form__input" value={spentOn} onChange={(e) => setSpentOn(e.target.value)}>
            <option value="">{t.ledger.noDate}</option>
            {trip.days.map((d, i) => (
              <option key={d.date} value={d.date}>
                {t.common.dayWithDate(i + 1, formatDateLabel(d.date, locale))}
              </option>
            ))}
          </select>
        </label>

        <div className="form__actions">
          <button className="btn btn--primary" type="submit" disabled={!canSave}>
            {expense ? t.common.save : t.common.add}
          </button>
          {expense &&
            (confirmDelete ? (
              <button
                className="btn btn--danger"
                type="button"
                onClick={() => {
                  removeExpense(expense.id);
                  onClose();
                }}
              >
                {t.ledger.deleteTitle}
              </button>
            ) : (
              // 한 번 더 누르게 한다 — 시트 안에서 또 시트를 띄우지 않으려고
              <button className="btn" type="button" onClick={() => setConfirmDelete(true)}>
                {t.common.delete}
              </button>
            ))}
        </div>
      </form>
    </MenuSheet>
  );
}
