import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { MODE_ICON } from '@/components/TransportChip';
import { AlertIcon, PencilIcon, PinIcon } from '@/components/icons';
import { useDayLegs } from '@/hooks/useDayLegs';
import { formatDistance } from '@/domain/geo';
import { formatMinutes, tzShortLabel } from '@/domain/time';
import { ITEM_KIND_LABEL, TRANSPORT_LABEL, type Coord, type TransportMode } from '@/domain/types';
import {
  REGION_LABEL,
  getMapRenderer,
  getRouteProviderFor,
  resolveMapRegion,
  resolveRegion,
} from '@/providers';
import { useTripStore } from '@/store/tripStore';

const MODES: TransportMode[] = ['walk', 'transit', 'car'];

export function ItemDetailScreen() {
  const { tripId = '', itemId = '' } = useParams();
  const navigate = useNavigate();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const allItems = useTripStore((s) => s.items);
  const setLegManually = useTripStore((s) => s.setLegManually);
  const clearManualLeg = useTripStore((s) => s.clearManualLeg);

  const item = allItems.find((i) => i.id === itemId);

  const dayItems = useMemo(
    () =>
      allItems
        .filter((i) => i.tripId === tripId && i.date === item?.date)
        .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)),
    [allItems, tripId, item?.date],
  );

  const index = dayItems.findIndex((i) => i.id === itemId);
  const prev = index > 0 ? dayItems[index - 1] : undefined;
  // day는 아래에서 다시 쓰지만, 훅은 조건부 return보다 앞에 있어야 하므로
  // 타임존만 여기서 먼저 꺼낸다.
  const legs = useDayLegs(
    dayItems,
    trip?.days.find((d) => d.date === item?.date)?.timezone,
  );
  const legInfo = legs.get(itemId);

  const [draftMinutes, setDraftMinutes] = useState<number | null>(null);

  if (!trip || !item) {
    return (
      <div className="app">
        <AppHeader title="일정" back />
        <main className="main main--no-tabs">
          <p className="empty">항목을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  const day = trip.days.find((d) => d.date === item.date);
  const region = resolveRegion(item.coord);
  const provider = getRouteProviderFor(item.coord);

  // 지도 지역은 구간 양 끝을 함께 본다 — 한쪽이라도 해외면 Google.
  const legCoords = [prev?.coord, item.coord].filter((c): c is Coord => Boolean(c));
  const renderer = getMapRenderer(resolveMapRegion(legCoords));

  const activeMode = item.leg?.mode ?? legInfo?.recommended;
  const shownMinutes =
    draftMinutes ??
    item.leg?.minutes ??
    (activeMode && legInfo?.results[activeMode]?.available
      ? (legInfo.results[activeMode] as { minutes: number }).minutes
      : 0);

  function commitMinutes(mode: TransportMode, minutes: number) {
    setLegManually(item!.id, mode, minutes);
    setDraftMinutes(null);
  }

  return (
    <div className="app">
      <AppHeader title={item.title} back />

      <main className="main main--no-tabs main--fab">
        <div className="detail">
          {/* 일정 명세 */}
          <section className="card detail__hero">
            <span className="chip">{ITEM_KIND_LABEL[item.kind]}</span>
            <h2 className="detail__title">{item.title}</h2>
            {item.placeName && (
              <div className="detail__place">
                <PinIcon /> {item.placeName}
              </div>
            )}
            <div className="detail__meta">
              {item.localTime && (
                <span className="chip chip--accent">
                  {item.localTime}
                  {day && ` · ${tzShortLabel(day.timezone, day.date)}`}
                </span>
              )}
              {item.durationMin !== undefined && (
                <span className="chip">체류 {formatMinutes(item.durationMin)}</span>
              )}
              {item.carrierCode && <span className="chip">{item.carrierCode}</span>}
            </div>
          </section>

          {/* 이동 방법 · 이동 시간 */}
          <section className="card field">
            <div className="field__label">이동 방법</div>

            {!prev && (
              <div className="field__value field__value--muted">
                이 날의 첫 일정입니다. 이전 구간이 없습니다.
              </div>
            )}

            {prev && (
              <>
                <div className="field__value field__value--muted" style={{ marginBottom: 10 }}>
                  {prev.placeName ?? prev.title} → {item.placeName ?? item.title}
                </div>

                <div className="modes">
                  {MODES.map((mode) => {
                    const Icon = MODE_ICON[mode];
                    const result = legInfo?.results[mode];
                    const unavailable = result !== undefined && !result.available;
                    const active = activeMode === mode;

                    return (
                      <button
                        key={mode}
                        className={`mode${active ? ' mode--active' : ''}${
                          unavailable ? ' mode--off' : ''
                        }`}
                        onClick={() => {
                          const mins = result?.available
                            ? result.minutes
                            : (item.leg?.minutes ?? 15);
                          commitMinutes(mode, mins);
                        }}
                      >
                        <div className="mode__name">
                          <Icon /> {TRANSPORT_LABEL[mode]}
                        </div>
                        <div className="mode__val">
                          {result?.available ? formatMinutes(result.minutes) : '—'}
                        </div>
                        <div className="mode__sub">
                          {result?.available
                            ? formatDistance(result.distanceM)
                            : unavailable
                              ? '정보 없음'
                              : '조회 중'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 폴백 정책: 추정값을 만들어 보여주지 않고, 모른다고 말하고 입력을 받는다 */}
                {legInfo?.transitMissing && (
                  <div className="banner" style={{ marginTop: 12 }}>
                    <AlertIcon className="banner__icon" />
                    <div>
                      이 지역은 대중교통 데이터가 제공되지 않습니다. 도보·차량만 계산했습니다.
                      실제로 그랩·툭툭 같은 현지 수단을 쓴다면 아래에서 직접 적어두세요.
                    </div>
                  </div>
                )}

                {legInfo?.status === 'cross_border' && (
                  <div className="banner" style={{ marginTop: 12 }}>
                    <AlertIcon className="banner__icon" />
                    <div>
                      국경을 넘는 구간입니다. 길찾기로는 계산되지 않으니 항공편·기차 정보를
                      직접 입력해 주세요.
                    </div>
                  </div>
                )}

                <div className="field__label" style={{ marginTop: 18 }}>
                  이동 시간
                </div>
                <div className="stepper">
                  <button
                    className="stepper__btn"
                    onClick={() =>
                      setDraftMinutes(Math.max(0, (draftMinutes ?? shownMinutes) - 5))
                    }
                    aria-label="5분 줄이기"
                  >
                    −
                  </button>
                  <div className="stepper__val">{formatMinutes(shownMinutes)}</div>
                  <button
                    className="stepper__btn"
                    onClick={() => setDraftMinutes((draftMinutes ?? shownMinutes) + 5)}
                    aria-label="5분 늘리기"
                  >
                    +
                  </button>
                </div>

                {draftMinutes !== null && (
                  <button
                    className="btn btn--primary"
                    style={{ marginTop: 10 }}
                    onClick={() => commitMinutes(activeMode ?? 'walk', draftMinutes)}
                  >
                    직접 입력한 시간으로 저장
                  </button>
                )}

                {item.leg?.isManual && draftMinutes === null && (
                  <>
                    <div
                      className="field__value field__value--muted"
                      style={{ marginTop: 10, fontSize: 12.5 }}
                    >
                      직접 입력한 값입니다. 길찾기 결과로 덮어쓰지 않습니다.
                    </div>
                    <button
                      className="btn btn--ghost"
                      style={{ marginTop: 6 }}
                      onClick={() => clearManualLeg(item.id)}
                    >
                      자동 계산으로 되돌리기
                    </button>
                  </>
                )}
              </>
            )}
          </section>

          {/* 디스크립션 */}
          <section className="card field">
            <div className="field__label">메모</div>
            <div className={`field__value${item.description ? '' : ' field__value--muted'}`}>
              {item.description ?? '아직 메모가 없습니다.'}
            </div>
          </section>

          {/* 지역 분기가 제대로 도는지 눈으로 확인하는 패널.
              실제 배포에서는 지워도 되지만, 개발 중에는 이게 있어야
              한국/해외에서 다른 서비스가 붙는지 바로 보인다. */}
          <section className="card field">
            <div className="field__label">이 구간에 쓰인 서비스</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <span className="chip chip--accent">{REGION_LABEL[region]}</span>
                <span className="chip">{provider.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                지도: {renderer.label}
                {renderer.configured ? '' : ` (${renderer.setupHint} 미설정 — 개략도로 표시)`}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/*
        수정 버튼은 헤더가 아니라 화면 아래 오른쪽에 둔다. 상세를 끝까지
        읽고 나서 고치게 되는데, 헤더에 있으면 그때마다 맨 위로 올라가야 한다.
        감싸는 막대는 클릭을 통과시켜(pointer-events: none) 버튼만 받는다.
      */}
      <div className="fab-bar">
        <button
          className="fab"
          onClick={() => navigate(`/trip/${tripId}/item/${itemId}/edit`)}
        >
          <PencilIcon size={16} /> 수정
        </button>
      </div>
    </div>
  );
}
