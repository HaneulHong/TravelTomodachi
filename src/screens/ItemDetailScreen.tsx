import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { SHOW_DEV_HINTS } from '@/config';
import { EditedBy } from '@/components/EditedBy';
import { ItemComments } from '@/components/ItemComments';
import { MODE_ICON } from '@/components/TransportChip';
import { AlertIcon, PencilIcon, PinIcon } from '@/components/icons';
import { useDayLegs } from '@/hooks/useDayLegs';
import { useSegmentRoutes } from '@/hooks/useSegmentRoutes';
import { formatDistance } from '@/domain/geo';
import { formatMinutes, tzShortLabel } from '@/domain/time';
import { isSegmentKind, type Coord, type TransportMode } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import {
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
  const setLegMode = useTripStore((s) => s.setLegMode);
  const clearManualLeg = useTripStore((s) => s.clearManualLeg);
  const collabAvailable = useTripStore((s) => s.collabAvailable);
  const t = useT();
  const locale = useLocale();

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
  /** 이 항목이 터미널 구간이라면, 지도에 그려진 선이 어디서 왔는지. */
  const segmentRoute = useSegmentRoutes(
    dayItems,
    trip?.days.find((d) => d.date === item?.date)?.timezone,
  ).get(itemId);

  const [draftMinutes, setDraftMinutes] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  if (!trip || !item) {
    return (
      <div className="app">
        <AppHeader title={t.trip.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.itemNotFound}</p>
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

  const activeMode = legInfo?.mode ?? item.leg?.mode;
  // 대중교통으로 가는 경우에만 탈 노선을 보여준다 — 도보를 골랐는데 노선이 뜨면 헷갈린다
  const transitResult = legInfo?.results.transit;
  const transitLines =
    activeMode === 'transit' && transitResult?.available ? transitResult.lines : undefined;
  const shownMinutes = draftMinutes ?? legInfo?.minutes ?? item.leg?.minutes ?? 0;

  /** −/+로 고친 시간 — 이제부터는 조회로 덮어쓰지 않는다 */
  function commitMinutes(mode: TransportMode, minutes: number) {
    setLegManually(item!.id, mode, minutes);
    setDraftMinutes(null);
  }

  /**
   * 수단 고르기. 조회된 시간이 있으면 수단만 정하고 시간은 조회를 따라간다.
   * 조회가 안 된 수단이면 지금 보이는 시간에서 직접 맞추도록 입력 상태로.
   */
  function pickMode(mode: TransportMode) {
    const result = legInfo?.results[mode];
    setDraftMinutes(null);
    if (result?.available) setLegMode(item!.id, mode, result.minutes);
    else commitMinutes(mode, shownMinutes || 15);
  }

  return (
    <div className="app">
      <AppHeader title={item.title} back />

      <main className="main main--no-tabs main--fab">
        <div className="detail">
          {/* 일정 명세 */}
          <section className="card detail__hero">
            <span className="chip">{t.kind[item.kind]}</span>
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
                <span className="chip">{t.itemDetail.stay(formatMinutes(item.durationMin, locale))}</span>
              )}
              {item.carrierCode && <span className="chip">{item.carrierCode}</span>}
            </div>
            {/*
              예약 번호는 체크인 카운터 앞에서 찾는다 — 눌러서 바로 복사되게.
              클립보드를 못 쓰는 환경이면 글자를 길게 눌러 복사하면 된다(select-all).
            */}
            {item.bookingRef && (
              <button
                className="booking-ref"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(item.bookingRef!)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    })
                    .catch(() => {});
                }}
              >
                <span className="booking-ref__label">{t.itemEdit.bookingRef}</span>
                <span className="booking-ref__value">{item.bookingRef}</span>
                <span className="booking-ref__copy">{copied ? t.itemDetail.copied : t.itemDetail.copy}</span>
              </button>
            )}
            {trip && <EditedBy item={item} members={trip.members} variant="line" />}
          </section>

          {/* 이동 방법 · 이동 시간 */}
          <section className="card field">
            <div className="field__label">{t.itemDetail.howToMove}</div>

            {!prev && (
              <div className="field__value field__value--muted">{t.itemDetail.firstOfDay}</div>
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
                        aria-pressed={active}
                        onClick={() => pickMode(mode)}
                      >
                        <div className="mode__name">
                          <Icon /> {t.transport[mode]}
                        </div>
                        <div className="mode__val">
                          {result?.available ? formatMinutes(result.minutes, locale) : '—'}
                        </div>
                        <div className="mode__sub">
                          {result?.available
                            ? formatDistance(result.distanceM)
                            : unavailable
                              ? result.reason === 'no_transit_route'
                                ? t.leg.transitNoRoute
                                : t.common.noInfo
                              : t.common.querying}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 어떤 노선을 타는 걸로 계산했는지 — 안 보이면 맞게 찾았는지 알 수 없다 */}
                {transitLines && transitLines.length > 0 && (
                  <div className="routesrc__lines" aria-label={t.transport.transit}>
                    {transitLines.map((line, i) => (
                      <span key={`${line}-${i}`} className="chip chip--transit">
                        {line}
                      </span>
                    ))}
                  </div>
                )}

                {/* 폴백 정책: 추정값을 만들어 보여주지 않고, 모른다고 말하고 입력을 받는다 */}
                {legInfo?.transitMissing && (
                  <div className="banner" style={{ marginTop: 12 }}>
                    <AlertIcon className="banner__icon" />
                    <div>{t.itemDetail.transitMissing}</div>
                  </div>
                )}

                {legInfo?.status === 'cross_border' && (
                  <div className="banner" style={{ marginTop: 12 }}>
                    <AlertIcon className="banner__icon" />
                    <div>{t.itemDetail.crossBorder}</div>
                  </div>
                )}

                <div className="field__label" style={{ marginTop: 18 }}>
                  {t.itemDetail.moveTime}
                </div>
                <div className="stepper">
                  <button
                    className="stepper__btn"
                    onClick={() =>
                      setDraftMinutes(Math.max(0, (draftMinutes ?? shownMinutes) - 5))
                    }
                    aria-label={t.itemDetail.minus5}
                  >
                    −
                  </button>
                  <div className="stepper__val">{formatMinutes(shownMinutes, locale)}</div>
                  <button
                    className="stepper__btn"
                    onClick={() => setDraftMinutes((draftMinutes ?? shownMinutes) + 5)}
                    aria-label={t.itemDetail.plus5}
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
                    {t.itemDetail.saveManual}
                  </button>
                )}

                {/* 수단만 고른 경우도 되돌릴 수 있게 — 자동 추천으로 */}
                {item.leg && draftMinutes === null && (
                  <>
                    {item.leg.isManual && (
                      <div
                        className="field__value field__value--muted"
                        style={{ marginTop: 10, fontSize: 12.5 }}
                      >
                        {t.itemDetail.manualNote}
                      </div>
                    )}
                    <button
                      className="btn btn--ghost"
                      style={{ marginTop: 6 }}
                      onClick={() => clearManualLeg(item.id)}
                    >
                      {t.itemDetail.revertAuto}
                    </button>
                  </>
                )}
              </>
            )}
          </section>

          {/* 디스크립션 */}
          <section className="card field">
            <div className="field__label">{t.itemDetail.memo}</div>
            <div className={`field__value${item.description ? '' : ' field__value--muted'}`}>
              {item.description ?? t.itemDetail.noMemo}
            </div>
          </section>

          {/* collab.sql 이전 DB면 댓글 테이블이 없다 — 칸을 숨긴다 */}
          {collabAvailable && <ItemComments trip={trip} itemId={item.id} />}

          {/*
            터미널 구간이면 지도에 그려진 선의 출처를 밝힌다.

            길찾기는 좌표만 보고 경로를 찾는다. 위에 적어둔 편명("퀸메리호")은
            표시용일 뿐 조회에 들어가지 않으므로, 다른 노선이 그려질 수 있다.
            실제로 "제주 → 목포 퀸메리호"라고 적은 구간에 여객터미널까지 가는
            426번 버스가 딸려 나온다. 무엇이 그려졌는지 보여주지 않으면 그
            차이를 알 방법이 없다.
          */}
          {isSegmentKind(item.kind) && item.toCoord && (
            <section className="card field">
              <div className="field__label">{t.itemDetail.drawnLine}</div>

              {segmentRoute?.via === 'transit' && (
                <div className="field__value">
                  {t.itemDetail.viaTransit}
                  {segmentRoute.lines && segmentRoute.lines.length > 0 && (
                    <div className="routesrc__lines">
                      {segmentRoute.lines.map((line, i) => (
                        <span key={`${line}-${i}`} className="chip chip--transit">
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {segmentRoute?.via === 'car' && (
                <div className="field__value">{t.itemDetail.viaCar}</div>
              )}

              {!segmentRoute && (
                <div className="field__value field__value--muted">{t.itemDetail.straight}</div>
              )}

              <div className="routesrc__note">
                {t.itemDetail.coordNote}
                {item.carrierCode ? t.itemDetail.carrierDiffers(item.carrierCode) : ''}
              </div>
            </section>
          )}

          {/* 지역 분기가 제대로 도는지 눈으로 확인하는 패널.
              개발 중에는 이게 있어야 한국/해외에서 다른 서비스가 붙는지
              바로 보인다. 사용자에게는 의미 없는 정보라 배포에서는 숨긴다. */}
          {SHOW_DEV_HINTS && (
            <section className="card field">
              <div className="field__label">이 구간에 쓰인 서비스</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <span className="chip chip--accent">{t.region[region]}</span>
                  <span className="chip">{provider.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  지도: {renderer.label}
                  {renderer.configured ? '' : ` (${renderer.setupHint} 미설정 — 개략도로 표시)`}
                </div>
              </div>
            </section>
          )}
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
          <PencilIcon size={16} /> {t.itemDetail.edit}
        </button>
      </div>
    </div>
  );
}
