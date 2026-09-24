/**
 * 여행 중 "오늘" 카드 — 홈 맨 위.
 *
 * 여행지에서 앱을 여는 이유는 대개 "오늘 다음에 어디 가지?"다. 여행 목록을 지나
 * 날짜를 넘기지 않아도 한눈에 보이게 모은다: 몇째 날·도시·현지 시각, 다음 일정까지
 * 남은 시간, 날씨, 환율. 누르면 그 여행의 오늘 일정으로 간다.
 *
 * 여행 기간이 아니면 그리지 않는다. 날씨·환율은 못 받아도 카드는 뜬다.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { convert } from '@/domain/settle';
import { currencyForTimezone, formatMoney, homeCurrency } from '@/domain/currency';
import { formatMinutes } from '@/domain/time';
import { findToday, minutesUntil, nextItem } from '@/domain/today';
import { zoneLabel } from '@/domain/timezones';
import { bySortKey } from '@/domain/fractionalIndex';
import { useLocale, useT } from '@/i18n';
import { getRates, type RatesResult } from '@/providers/rates';
import {
  getTodayWeather,
  WEATHER_EMOJI,
  weatherKind,
  type TodayWeather,
} from '@/providers/weather';
import { useTripStore } from '@/store/tripStore';

/** 1분마다 다시 그린다 — "다음 일정까지 N분"과 현지 시각이 흘러가야 한다 */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TodayCard() {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const allItems = useTripStore((s) => s.items);
  const now = useMinuteTick();

  const today = useMemo(() => findToday(trips, now), [trips, now]);
  const items = useMemo(
    () =>
      today
        ? allItems
            .filter((i) => i.tripId === today.trip.id && i.date === today.day.date)
            .sort(bySortKey)
        : [],
    [allItems, today],
  );
  // 날씨는 그 날 첫 좌표로. 좌표가 하나도 없으면 날씨 칸을 비운다.
  const coord = items.find((i) => i.coord)?.coord;

  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const [rates, setRates] = useState<RatesResult | null>(null);
  const lat = coord?.lat;
  const lng = coord?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let alive = true;
    void getTodayWeather({ lat, lng }).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  const localCurrency = currencyForTimezone(today?.day.timezone);
  const home = homeCurrency(locale);
  useEffect(() => {
    if (!localCurrency || localCurrency === home) return;
    let alive = true;
    void getRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, [localCurrency, home]);

  if (!today) return null;

  const { trip, day, dayIndex, localTime } = today;
  const next = nextItem(items, localTime);
  const city = day.cityLabel || zoneLabel(day.timezone, locale);
  const rate =
    rates && localCurrency && localCurrency !== home
      ? convert(1, localCurrency, home, rates.rates)
      : null;

  return (
    <button
      className="today-card"
      onClick={() => navigate(`/trip/${trip.id}?date=${day.date}`)}
    >
      <div className="today-card__top">
        <span className="today-card__label">{t.today.label}</span>
        <span className="today-card__trip">
          {trip.coverEmoji} {trip.name}
        </span>
      </div>

      <div className="today-card__head">
        <span className="today-card__city">{t.today.dayCity(dayIndex + 1, city)}</span>
        <span className="today-card__clock">{t.today.localTime(localTime)}</span>
      </div>

      <div className="today-card__next">
        {items.length === 0 ? (
          <span className="today-card__muted">{t.today.empty}</span>
        ) : next ? (
          <>
            <span className="today-card__muted">
              {t.today.next} · {t.today.inTime(formatMinutes(minutesUntil(localTime, next.localTime!), locale))}
            </span>
            <span className="today-card__nextline">
              <strong>{next.localTime}</strong> {next.title}
            </span>
          </>
        ) : (
          <span className="today-card__muted">{t.today.allDone}</span>
        )}
      </div>

      {(weather || rate !== null) && (
        <div className="today-card__chips">
          {weather && (
            <span className="chip">
              {WEATHER_EMOJI[weatherKind(weather.code)]} {t.today.weather[weatherKind(weather.code)]}{' '}
              {Math.round(weather.temp)}° · {Math.round(weather.min)}°/{Math.round(weather.max)}°
              {weather.rainChance !== undefined && weather.rainChance > 0
                ? ` · ${t.today.rainChance(weather.rainChance)}`
                : ''}
            </span>
          )}
          {rate !== null && localCurrency && (
            <span className="chip">
              {/*
                1밧 = 40원은 읽히지만 1밧 = $0.03은 안 읽힌다. 한 단위 값이 너무 작으면
                뒤집어서 보여준다 (1달러 = 35밧).
              */}
              {rate >= 0.1
                ? t.today.rate(localCurrency, formatMoney(rate, home, locale))
                : t.today.rate(home, formatMoney(1 / rate, localCurrency, locale))}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
