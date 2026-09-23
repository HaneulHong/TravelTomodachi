/**
 * 날짜의 도시·타임존 고치기.
 *
 * 여행을 만들 때는 모든 날짜에 타임존 하나를 붙인다. 방콕에서 도쿄로 넘어가는
 * 날처럼 도시를 옮기는 날은 여기서 그 날(과 뒤로 이어지는 날)만 고친다.
 *
 * ── 시간은 옮기지 않는다 ─────────────────────────────────────────
 * 항목은 벽시계 시간으로 저장된다. 타임존을 바꿔도 '09:00'은 '09:00'으로 남고,
 * 새 도시의 아침 9시가 된다. 여행 계획은 "현지 9시에 체크아웃"처럼 현지
 * 시각으로 세우기 때문에 이게 맞다. 대신 그렇다는 걸 화면에서 말해준다 —
 * 시간이 한국 기준으로 환산될 거라 생각하는 사람이 있다.
 */

import { useMemo, useState } from 'react';
import { MenuSheet } from '@/components/MenuSheet';
import { followingSameDays, formatDateLabel, tzShortLabel } from '@/domain/time';
import { zoneLabel, zoneOptions } from '@/domain/timezones';
import type { TripDay } from '@/domain/types';
import { useTripStore } from '@/store/tripStore';

interface Props {
  tripId: string;
  days: TripDay[];
  date: string;
  onClose(): void;
}

export function DayEditSheet({ tripId, days, date, onClose }: Props) {
  const updateDays = useTripStore((s) => s.updateDays);

  const dayIndex = days.findIndex((d) => d.date === date);
  const day = days[dayIndex];

  const [timezone, setTimezone] = useState(day?.timezone ?? 'Asia/Seoul');
  const [city, setCity] = useState(day?.cityLabel ?? '');
  const [withFollowing, setWithFollowing] = useState(false);

  const following = useMemo(() => followingSameDays(days, date), [days, date]);
  const zones = useMemo(() => zoneOptions(day?.timezone ?? ''), [day?.timezone]);

  if (!day) return null;

  const onZoneChange = (next: string): void => {
    /*
     * 도시 이름이 비었거나 타임존 기본 이름 그대로면 새 타임존에 맞춰 바꿔준다.
     * 사용자가 '제주'처럼 직접 적은 이름은 건드리지 않는다.
     */
    const trimmed = city.trim();
    if (trimmed === '' || trimmed === zoneLabel(timezone)) setCity(zoneLabel(next));
    setTimezone(next);
  };

  const cityLabel = city.trim() || zoneLabel(timezone);
  const changed = timezone !== day.timezone || cityLabel !== day.cityLabel;
  const lastFollowing = following[following.length - 1];

  const save = (): void => {
    if (!changed) {
      onClose();
      return;
    }
    const dates = withFollowing ? [date, ...following] : [date];
    updateDays(tripId, dates, { timezone, cityLabel });
    onClose();
  };

  return (
    <MenuSheet open onClose={onClose} label="날짜 설정">
      <div className="form dayedit">
        <div className="dayedit__title">
          {dayIndex + 1}일차 · {formatDateLabel(date)}
        </div>

        <label className="form__row">
          <span className="form__label">도시</span>
          <input
            className="form__input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={zoneLabel(timezone)}
            maxLength={30}
          />
        </label>

        <label className="form__row">
          <span className="form__label">타임존</span>
          <select
            className="form__input"
            value={timezone}
            onChange={(e) => onZoneChange(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label} ({tzShortLabel(z.id, date)})
              </option>
            ))}
          </select>
          {timezone !== day.timezone && (
            <p className="form__hint">
              일정 시간은 그대로 둡니다. 09:00 일정은 {cityLabel} 현지 09:00이 됩니다.
            </p>
          )}
        </label>

        {/*
          뒤로 이어지는 같은 도시 날짜가 있을 때만 묻는다. 기본은 꺼둔다 —
          "이 날만"이 예상과 다르면 한 번 더 고치면 되지만, 여러 날을 모르고
          덮어쓰면 뭐가 바뀌었는지 찾기 어렵다.
        */}
        {following.length > 0 && lastFollowing && (
          <label className="form__check">
            <input
              type="checkbox"
              checked={withFollowing}
              onChange={(e) => setWithFollowing(e.target.checked)}
            />
            <span>
              뒤로 이어지는 {following.length}일도 같이 바꾸기
              <span className="form__check-sub">
                {formatDateLabel(lastFollowing)}까지 · 지금 {day.cityLabel || zoneLabel(day.timezone)}
              </span>
            </span>
          </label>
        )}

        <div className="form__actions">
          <button className="btn btn--primary" onClick={save}>
            저장
          </button>
          <button className="btn" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </MenuSheet>
  );
}
