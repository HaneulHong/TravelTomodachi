import { useEffect, useRef } from 'react';
import { formatDateShort, formatWeekday } from '@/domain/time';
import type { TripDay } from '@/domain/types';
import { useLocale, useT } from '@/i18n';

interface Props {
  days: TripDay[];
  activeDate: string;
  onSelect(date: string): void;
}

/** 스케치의 "슬라이드 시 해당 일정의 날짜 변동"을 칩으로도 직접 고를 수 있게 */
export function DateStrip({ days, activeDate, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const locale = useLocale();

  // 선택된 날짜가 바뀌면 화면 안으로 스크롤한다 (스와이프로 넘겼을 때 필요)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeDate]);

  return (
    <div className="datestrip" ref={ref} role="tablist" aria-label={t.common.tripDates}>
      {days.map((day, i) => {
        const active = day.date === activeDate;
        return (
          <button
            key={day.date}
            role="tab"
            aria-selected={active}
            data-active={active}
            className={`daychip${active ? ' daychip--active' : ''}`}
            onClick={() => onSelect(day.date)}
          >
            <span className="daychip__n">{t.common.dayN(i + 1)}</span>
            <span className="daychip__d">{formatDateShort(day.date)}</span>
            <span className="daychip__w">{formatWeekday(day.date, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}
