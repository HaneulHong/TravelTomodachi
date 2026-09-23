/**
 * 여행 만들기.
 *
 * 받는 건 네 가지뿐이다 — 이름, 이모지, 기간, 타임존.
 * 날짜별 항목은 만든 뒤에 채운다. 처음부터 다 물어보면 여행을 시작하기가
 * 부담스러워지고, 어차피 계획은 만들면서 바뀐다.
 *
 * ── 타임존을 처음에 묻는 이유 ────────────────────────────────────
 * 이 앱은 시간을 벽시계로 저장하고 타임존을 날짜에 붙인다(ARCHITECTURE.md).
 * 그래서 날짜가 만들어질 때 타임존이 함께 정해져야 한다. 나중에 채우게 두면
 * "09:00"이 어느 나라 9시인지 모르는 항목이 쌓인다.
 * 여기서는 여행 전체에 하나를 적용하고, 도시를 옮기는 날은 그 날만 고친다.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { formatDateLabel, tzShortLabel } from '@/domain/time';
import { deviceTimezone, zoneLabel, zoneOptions } from '@/domain/timezones';
import type { TripDay } from '@/domain/types';
import { useTripStore } from '@/store/tripStore';

const EMOJIS = ['🧳', '🏝️', '🍊', '🗼', '🏔️', '🚄', '⛴️', '🎒'];

/** 'YYYY-MM-DD' 오늘 (기기 기준) */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 시작~끝 사이의 모든 날짜. 끝이 시작보다 빠르면 빈 배열. */
function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= last; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    // 실수로 끝없이 도는 걸 막는다 (1년이면 충분히 길다)
    if (out.length > 366) break;
  }
  return out;
}

export function TripCreateScreen() {
  const navigate = useNavigate();
  const createTrip = useTripStore((s) => s.createTrip);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 2));
  const [timezone, setTimezone] = useState(deviceTimezone());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => zoneOptions(deviceTimezone()), []);

  const dates = useMemo(() => datesBetween(startDate, endDate), [startDate, endDate]);
  const canSave = name.trim().length > 0 && dates.length > 0 && !saving;

  const save = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // 도시 이름은 타임존의 대표 도시로 채워 둔다. 비워 두면 일정 화면 머리에
      // 아무것도 안 떠서, 어디를 눌러 고치는지조차 안 보인다.
      const cityLabel = zoneLabel(timezone);
      const days: TripDay[] = dates.map((date) => ({ date, timezone, cityLabel }));
      const tripId = await createTrip({
        name: name.trim(),
        startDate,
        endDate,
        coverEmoji: emoji,
        days,
      });
      navigate(`/trip/${tripId}?date=${startDate}`, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '여행을 만들지 못했습니다');
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <AppHeader
        title="새 여행"
        back
        action={{ label: saving ? '만드는 중…' : '만들기', onClick: () => void save(), disabled: !canSave }}
      />

      <main className="main main--no-tabs">
        <div className="form">
          <div className="form__row">
            <span className="form__label">표지</span>
            <div className="emoji-pick">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className={`emoji-pick__btn${e === emoji ? ' emoji-pick__btn--on' : ''}`}
                  onClick={() => setEmoji(e)}
                  aria-label={`표지 ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="form__row">
            <span className="form__label">여행 이름</span>
            <input
              className="form__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 동남아 + 도쿄 6일"
              maxLength={60}
              autoFocus
            />
          </label>

          <div className="form__pair">
            <label className="form__row">
              <span className="form__label">시작</span>
              <input
                className="form__input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // 끝이 시작보다 빨라지면 같이 민다. 사용자가 고치게 두면
                  // "만들기"가 비활성인 이유를 한참 찾는다.
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </label>

            <label className="form__row">
              <span className="form__label">종료</span>
              <input
                className="form__input"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <label className="form__row">
            <span className="form__label">기본 타임존</span>
            <select
              className="form__input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} ({tzShortLabel(z.id, startDate)})
                </option>
              ))}
            </select>
            <p className="form__hint">
              모든 날짜에 이 타임존이 붙습니다. 도시를 옮기는 날은 일정 화면에서 도시
              이름을 눌러 그 날부터 고치면 됩니다.
            </p>
          </label>

          {dates.length > 0 && (
            <div className="form__row">
              <span className="form__label">만들어질 날짜 {dates.length}일</span>
              <p className="form__hint">
                {formatDateLabel(dates[0]!)}
                {dates.length > 1 && ` — ${formatDateLabel(dates[dates.length - 1]!)}`}
              </p>
            </div>
          )}

          {error && <p className="form__hint form__hint--error">{error}</p>}

          <div className="form__actions">
            <button className="btn btn--primary" onClick={() => void save()} disabled={!canSave}>
              {saving ? '만드는 중…' : '여행 만들기'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
