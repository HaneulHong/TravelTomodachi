import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { DateStrip } from '@/components/DateStrip';
import { MapCanvas } from '@/components/MapCanvas';
import { TransportChip, MODE_ICON } from '@/components/TransportChip';
import { AlertIcon } from '@/components/icons';
import { useDayLegs } from '@/hooks/useDayLegs';
import { formatDistance } from '@/domain/geo';
import { formatMinutes } from '@/domain/time';
import { TRANSPORT_LABEL, type Coord, type TransportMode } from '@/domain/types';
import { getMapRenderer, resolveMapRegion, type MapStop } from '@/providers';
import { useTripStore } from '@/store/tripStore';

const MODES: TransportMode[] = ['walk', 'transit', 'car'];

export function MapScreen() {
  const { tripId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [openStop, setOpenStop] = useState<string | null>(null);

  const trip = useTripStore((s) => s.getTrip(tripId));
  const allItems = useTripStore((s) => s.items);

  const activeDate = search.get('date') ?? trip?.startDate ?? '';

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
  const path: Coord[] = useMemo(() => {
    const line: Coord[] = [];

    stops.forEach((stop, i) => {
      if (i === 0) {
        line.push(stop.coord);
        return;
      }

      const info = legs.get(stop.id);
      const mode = info?.recommended;
      const result = mode ? info?.results[mode] : undefined;
      const shape = result?.available ? result.polyline : undefined;

      if (shape && shape.length > 1) {
        // 폴리라인의 첫 점은 직전 지점과 거의 같다. 그대로 이어 붙이면
        // 점이 겹칠 뿐 선 모양은 달라지지 않으므로 그냥 잇는다.
        line.push(...shape);
        return;
      }

      line.push(stop.coord);
    });

    return line;
  }, [stops, legs]);

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
        <AppHeader title="지도" back />
        <main className="main">
          <p className="empty">여행을 찾을 수 없습니다.</p>
        </main>
        <BottomTabs />
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader title="지도" back />

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
            <p className="empty">이 날은 좌표가 있는 일정이 없습니다.</p>
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
                          <AlertIcon size={11} /> 국제 구간
                        </span>
                      )}
                      {info?.status === 'unavailable' && (
                        <span className="chip">이동 정보 없음</span>
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
                        {item.localTime ?? '시간 미정'}
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
                                <Icon /> {TRANSPORT_LABEL[mode]}
                              </div>
                              <div className="mode__val">
                                {r?.available ? formatMinutes(r.minutes) : '—'}
                              </div>
                              <div className="mode__sub">
                                {r?.available
                                  ? formatDistance(r.distanceM)
                                  : off
                                    ? '정보 없음'
                                    : '조회 중'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isOpen && i === 0 && (
                      <div className="stop__sub" style={{ marginTop: 8 }}>
                        이 날의 출발 지점입니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomTabs tripId={trip.id} date={activeDate} />
    </div>
  );
}
