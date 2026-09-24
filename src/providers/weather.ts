/**
 * 오늘 날씨 — Open-Meteo.
 *
 * 무료, 키 없음(비상업 사용, 하루 1만 번까지). 조건은 출처 표시(CC BY 4.0):
 * "Weather data by Open-Meteo.com". 데이터 출처 칸과 오늘 카드에 밝힌다.
 *
 * 같은 곳을 30분 안에 다시 묻지 않는다(기기에 저장). 오프라인이면 저장본,
 * 그것도 없으면 날씨 칸을 비운다 — 날씨가 없어도 오늘 카드는 떠야 한다.
 */

import type { Coord } from '@/domain/types';

export const WEATHER_ATTRIBUTION = {
  name: 'Weather data by Open-Meteo.com',
  url: 'https://open-meteo.com/',
};

export interface TodayWeather {
  /** 지금 기온(℃) */
  temp: number;
  /** WMO 날씨 코드 — weatherKind()로 묶는다 */
  code: number;
  max: number;
  min: number;
  /** 오늘 강수 확률 최대(%) */
  rainChance?: number;
}

export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

/** WMO 코드를 화면에 쓸 여섯 가지로 */
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain'; // 51–67 이슬비·비, 80–82 소나기
}

export const WEATHER_EMOJI: Record<WeatherKind, string> = {
  clear: '☀️',
  cloudy: '⛅',
  fog: '🌫️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
};

const FRESH_MS = 30 * 60 * 1000;
/** 약 1km 격자로 묶는다 — 같은 동네 일정마다 따로 묻지 않게 */
const keyOf = (c: Coord) => `tt.weather.${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;

export async function getTodayWeather(coord: Coord): Promise<TodayWeather | null> {
  const key = keyOf(coord);
  interface Stored {
    at: number;
    data: TodayWeather;
  }
  const stored: Stored | null = (() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      return null;
    }
  })();
  if (stored && Date.now() - stored.at < FRESH_MS) return stored.data;

  try {
    const params = new URLSearchParams({
      latitude: String(coord.lat),
      longitude: String(coord.lng),
      current: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '1',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
      };
    };
    const c = body.current;
    const d = body.daily;
    if (c?.temperature_2m === undefined || c.weather_code === undefined) throw new Error('bad');
    const data: TodayWeather = {
      temp: c.temperature_2m,
      code: c.weather_code,
      max: d?.temperature_2m_max?.[0] ?? c.temperature_2m,
      min: d?.temperature_2m_min?.[0] ?? c.temperature_2m,
      rainChance: d?.precipitation_probability_max?.[0] ?? undefined,
    };
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch {
      // 저장 못 해도 이번엔 쓴다
    }
    return data;
  } catch {
    return stored?.data ?? null;
  }
}
