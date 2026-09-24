import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { DataCredits } from '@/components/DataCredits';
import { DateStrip } from '@/components/DateStrip';
import { MapCanvas } from '@/components/MapCanvas';
import { TransportChip, MODE_ICON } from '@/components/TransportChip';
import { AlertIcon } from '@/components/icons';
import { useDayLegs } from '@/hooks/useDayLegs';
import { useSegmentRoutes } from '@/hooks/useSegmentRoutes';
import { formatDistance } from '@/domain/geo';
import { formatMinutes } from '@/domain/time';
import type { Coord, TransportMode } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { getMapRenderer, resolveMapRegion, type MapStop, type PathSegment } from '@/providers';
import { defaultDateFor } from '@/domain/today';
import { useTripStore } from '@/store/tripStore';

const MODES: TransportMode[] = ['walk', 'transit', 'car'];

export function MapScreen() {
  const { tripId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [openStop, setOpenStop] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const allItems = useTripStore((s) => s.items);

  // 날짜가 주소에 없으면 여행 중엔 오늘, 아니면 첫날
  const activeDate = search.get('date') ?? (trip ? defaultDateFor(trip) : '');

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.tripId === tripId && i.date === activeDate)
        .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)),
    [allItems, tripId, activeDate],
  );

  // 대중교통 조회에 출발 시각이 필요하고, 벽시계 시각은 이 날의 타임존으로만
  // 실제 순간이 된다.
  const day = trip?.days.find((d) => d.date === activeDate);
  const legs = useDayLegs(items, day?.timezone);
  /** 터미널 구간 자체의 경로선 (기차·버스·배편). 없으면 직선으로 잇는다. */
  const segmentShapes = useSegmentRoutes(items, day?.timezone);

  /**
   * 지도에 올릴 지점. 좌표가 없는 항목(항공편 등)은 제외한다.
   * useMemo가 필요한 이유: 이 배열이 MapCanvas의 effect 의존성이라
   * 매 렌더마다 새 배열이면 마커를 계속 다시 만든다.
   */
  const stops: MapStop[] = useMemo(
    () =>
      items
        .filter((i) => i.coord)
        .map((item, i) => ({
          id: item.id,
          coord: item.coord!,
          label: String(i + 1),
          title: item.placeName ?? item.title,
          caption: item.localTime,
        })),
    [items],
  );

  /**
   * 지도에 그릴 선.
   *
   * 구간마다 추천 수단의 실제 경로 폴리라인이 있으면 그걸 잇고, 없으면
   * 두 지점을 직선으로 잇는다. 직선은 "아직 모른다"는 표시에 가깝다 —
   * 실제 길은 강을 건너고 돌아가는데 직선으로 그려두면 거리가 짧아 보여서
   * 일정을 빡빡하게 짜게 된다.
   *
   * 조회가 끝나면 legs가 바뀌고 이 배열도 다시 만들어진다. MapCanvas는
   * path가 바뀌면 선만 다시 그리므로(remount 아님) 깜빡이지 않는다.
   */
  /**
   * 지도에 그릴 선.
   *
   * 토막마다 성격이 다르다.
   *   실선 — 길찾기가 돌려준 실제 경로
   *   점선 — 어떻게 가는지 모르는 구간 (이동수단 미선택·조회 실패·터미널 이동)
   *
   * 둘을 같은 모양으로 그리면 직선 구간이 실제보다 가까워 보여서 일정을
   * 빡빡하게 짜게 된다. 그래서 "모른다"는 점선으로 드러낸다.
   */
  const path: PathSegment[] = useMemo(() => {
    const segments: PathSegment[] = [];
    /** 직전 항목이 우리를 내려준 곳. 구간 항목이면 도착 터미널이다. */
    let cursor: Coord | undefined;

    for (const item of items) {
      if (!item.coord) continue;

      // 앞 지점에서 이 항목까지 — 조회된 경로가 있으면 실선, 없으면 점선
      if (cursor) {
        const info = legs.get(item.id);
        const mode = info?.recommended;
        const result = mode ? info?.results[mode] : undefined;
        const shape = result?.available ? result.polyline : undefined;

        segments.push(
          shape && shape.length > 1
            ? { coords: shape }
            : { coords: [cursor, item.coord], dashed: true },
        );
      }

      cursor = item.coord;

      /*
       * 구간 항목(기차·버스·배편·항공)은 그 자체가 한 토막이다.
       * 실제 노선을 구했으면 실선으로, 못 구했으면 터미널끼리 직선 점선으로.
       * (항공은 조회 대상이 아니다 — useSegmentRoutes 주석 참고)
       */
      if (item.toCoord) {
        const drawn = segmentShapes.get(item.id);
        segments.push(
          drawn && drawn.shape.length > 1
            ? { coords: drawn.shape }
            : { coords: [item.coord, item.toCoord], dashed: true },
        );
        cursor = item.toCoord;
      }
    }

    return segments;
  }, [items, legs, segmentShapes]);

  /**
   * 지역 판정에는 지점 좌표만 쓴다. 경로 폴리라인까지 넣으면 점이 수백 개라
   * 매번 전부 검사하게 되고, 판정 결과는 어차피 같다.
   */
  const stopCoords: Coord[] = useMemo(() => stops.map((s) => s.coord), [stops]);

  // 지도 지역 판정은 길찾기와 규칙이 다르다 — 하나라도 해외면 Google.
  // (1일차 "서울 → 방콕" 같은 날 때문. providers/maps/index.ts 주석 참고)
  const mapRegion = useMemo(() => resolveMapRegion(stopCoords), [stopCoords]);
  const renderer = getMapRenderer(mapRegion);

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title={t.map.title} back />
        <main className="main">
          <p className="empty">{t.common.tripNotFound}</p>
        </main>
        <BottomTabs />
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader title={t.map.title} back />

      <DateStrip
        days={trip.days}
        activeDate={activeDate}
        onSelect={(date) => {
          setSearch({ date }, { replace: true });
          setOpenStop(null);
        }}
      />

      <main className="main">
        {stops.length === 0 ? (
          <div className="mapstage">
            <p className="empty">{t.map.noCoords}</p>
          </div>
        ) : (
          <MapCanvas
            renderer={renderer}
            stops={stops}
            path={path}
            onStopClick={(id) => setOpenStop((cur) => (cur === id ? null : id))}
          />
        )}

        <div className="stop-list">
          {items.map((item, i) => {
            const info = legs.get(item.id);
            const stopNumber = stops.findIndex((s) => s.id === item.id);
            const isOpen = openStop === item.id;

            return (
              <div key={item.id}>
                {i > 0 && (
                  <div className="stop-gap">
                    <div className="stop-gap__rail">
                      <div className="stop-gap__line" />
                    </div>
                    <div className="stop-gap__body">
                      {info?.status === 'loading' && <span className="tl-leg__skel" />}
                      {info?.status === 'manual' && info.recommended && (
                        <TransportChip mode={info.recommended} manual />
                      )}
                      {info?.status === 'ready' && info.recommended && (
                        <TransportChip
                          mode={info.recommended}
                          minutes={
                            info.results[info.recommended]?.available
                              ? (info.results[info.recommended] as { minutes: number }).minutes
                              : undefined
                          }
                        />
                      )}
                      {info?.status === 'cross_border' && (
                        <span className="chip chip--warn">
                          <AlertIcon size={11} /> {t.leg.crossBorderShort}
                        </span>
                      )}
                      {info?.status === 'unavailable' && (
                        <span className="chip">{t.leg.unknown}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="stop">
                  <span
                    className={`stop__dot${stopNumber < 0 ? ' stop__dot--plain' : ''}`}
                    aria-hidden
                  >
                    {stopNumber >= 0 ? stopNumber + 1 : '·'}
                  </span>
                  <div className="stop__body">
                    {/* 스케치의 "체크 포인트 클릭 시 도보/대중교통/차량 별 동선 안내" */}
                    <button
                      onClick={() => setOpenStop(isOpen ? null : item.id)}
                      style={{ textAlign: 'left', width: '100%' }}
                      aria-expanded={isOpen}
                    >
                      <div className="stop__name">{item.title}</div>
                      <div className="stop__sub">
                        {item.localTime ?? t.map.noTime}
                        {item.placeName ? ` · ${item.placeName}` : ''}
                      </div>
                    </button>

                    {isOpen && i > 0 && (
                      <div className="modes" style={{ marginTop: 10, marginBottom: 6 }}>
                        {MODES.map((mode) => {
                          const Icon = MODE_ICON[mode];
                          const r = info?.results[mode];
                          const off = r !== undefined && !r.available;
                          return (
                            <div
                              key={mode}
                              className={`mode${info?.recommended === mode ? ' mode--active' : ''}${
                                off ? ' mode--off' : ''
                              }`}
                            >
                              <div className="mode__name">
                                <Icon /> {t.transport[mode]}
                              </div>
                              <div className="mode__val">
                                {r?.available ? formatMinutes(r.minutes, locale) : '—'}
                              </div>
                              <div className="mode__sub">
                                {r?.available
                                  ? formatDistance(r.distanceM)
                                  : off
                                    ? t.common.noInfo
                                    : t.common.querying}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isOpen && i === 0 && (
                      <div className="stop__sub" style={{ marginTop: 8 }}>
                        {t.map.startPoint}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/*
          지도 위 attribution은 타일에 대한 것이다. 이 화면에 그려진 선은
          별도 서비스(길찾기·대중교통)에서 왔으므로 따로 밝힌다.
        */}
        <DataCredits />
      </main>

      <BottomTabs tripId={trip.id} date={activeDate} />
    </div>
  );
}
