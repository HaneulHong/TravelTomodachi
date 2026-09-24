import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { DateStrip } from '@/components/DateStrip';
import { DataCredits } from '@/components/DataCredits';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { DayEditSheet } from '@/components/DayEditSheet';
import { EditedBy } from '@/components/EditedBy';
import { MenuSheet } from '@/components/MenuSheet';
import { TransportChip } from '@/components/TransportChip';
import {
  AlertIcon,
  BusIcon,
  ClockIcon,
  FerryIcon,
  GripIcon,
  LeaveIcon,
  ListIcon,
  PencilIcon,
  PinIcon,
  PlaneIcon,
  PlusIcon,
  ReorderIcon,
  ShareIcon,
  TrainIcon,
  TrashIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/icons';
import { useDayLegs, type LegInfo } from '@/hooks/useDayLegs';
import { useInviteShare } from '@/hooks/useInviteShare';
import { useReorderDrag } from '@/hooks/useReorderDrag';
import { timeConflicts, timeSortedOrder } from '@/domain/order';
import { useSwipe } from '@/hooks/useSwipe';
import {
  formatDateLabel,
  formatMinutes,
  formatOffsetDelta,
  timezoneShift,
  tzShortLabel,
} from '@/domain/time';
import { zoneLabel } from '@/domain/timezones';
import { isSegmentKind, type Item } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import { platform } from '@/platform';
import { defaultDateFor } from '@/domain/today';
import { useTripStore } from '@/store/tripStore';

/** 구간 종류별 칩 색. 수단이 다르면 한눈에 갈려야 한다. */
const KIND_TONE: Record<Item['kind'], string> = {
  place: '',
  flight: 'transit',
  train: 'accent',
  bus: 'car',
  ferry: 'walk',
};

function KindIcon({ kind }: { kind: Item['kind'] }) {
  if (kind === 'flight') return <PlaneIcon />;
  if (kind === 'train') return <TrainIcon />;
  if (kind === 'bus') return <BusIcon />;
  if (kind === 'ferry') return <FerryIcon />;
  return null;
}

/** 구간 한 줄. 상태별로 다르게 보여준다 — 특히 '모름'을 숨기지 않는다. */
function LegRow({ info }: { info?: LegInfo }) {
  const t = useT();
  return (
    <div className="tl-leg">
      <div className="tl-leg__rail">
        <div className="tl-leg__line" />
      </div>
      <div className="tl-leg__body">
        {!info && null}

        {info?.status === 'loading' && <span className="tl-leg__skel" />}

        {info?.status === 'manual' && info.recommended && (
          <TransportChip mode={info.recommended} manual />
        )}

        {info?.status === 'ready' && info.recommended && (
          <>
            <TransportChip
              mode={info.recommended}
              minutes={
                info.results[info.recommended]?.available
                  ? (info.results[info.recommended] as { minutes: number }).minutes
                  : undefined
              }
            />
            {info.transitMissing && (
              <span className="chip chip--warn">
                <AlertIcon size={11} />
                {t.leg.transitMissing}
              </span>
            )}
          </>
        )}

        {info?.status === 'cross_border' && (
          <span className="chip chip--warn">
            <AlertIcon size={11} />
            {t.leg.crossBorder}
          </span>
        )}

        {info?.status === 'unavailable' && (
          <span className="chip">{t.leg.unknownTap}</span>
        )}
      </div>
    </div>
  );
}

export function TripScreen() {
  const { tripId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  /** 순서 바꾸기 모드. 켜면 손잡이가 나오고 카드를 눌러도 상세로 가지 않는다. */
  const [reorder, setReorder] = useState(false);
  const moveItem = useTripStore((s) => s.moveItem);
  const setDayOrder = useTripStore((s) => s.setDayOrder);
  const [dayEditOpen, setDayEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const me = useTripStore((s) => s.currentUserId);
  const leaveTrip = useTripStore((s) => s.leaveTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const { share: shareInvite, toast } = useInviteShare();
  const t = useT();
  const locale = useLocale();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const allItems = useTripStore((s) => s.items);

  // 날짜가 주소에 없으면 여행 중엔 오늘, 아니면 첫날
  const activeDate = search.get('date') ?? (trip ? defaultDateFor(trip) : '');
  const dayIndex = trip?.days.findIndex((d) => d.date === activeDate) ?? -1;
  const day = dayIndex >= 0 ? trip?.days[dayIndex] : undefined;
  const prevDay = dayIndex > 0 ? trip?.days[dayIndex - 1] : undefined;

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.tripId === tripId && i.date === activeDate)
        .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)),
    [allItems, tripId, activeDate],
  );

  const legs = useDayLegs(items, day?.timezone);
  /** 앞 일정보다 이른 시각인 일정. 순서를 바꾸거나 다른 날에서 옮겨 오면 생긴다. */
  const conflicts = useMemo(() => timeConflicts(items.map((i) => i.localTime)), [items]);
  const hasConflict = conflicts.some(Boolean);

  function goToDay(offset: number) {
    if (!trip || dayIndex < 0) return;
    const next = trip.days[dayIndex + offset];
    if (!next) return;
    setSearch({ date: next.date }, { replace: true });
    platform.vibrate(8);
  }

  // 스케치의 "슬라이드 시 해당 일정의 날짜 변동"
  const swipe = useSwipe({
    onSwipeLeft: () => goToDay(1),
    onSwipeRight: () => goToDay(-1),
  });

  const reorderDrag = useReorderDrag((from, to) => {
    moveItem(tripId, activeDate, from, to);
    platform.vibrate(8);
  });

  async function onShare() {
    if (!trip) return;
    setMenuOpen(false);
    await shareInvite(trip);
  }

  if (!trip || !day) {
    return (
      <div className="app">
        <AppHeader title={t.trip.title} back />
        <main className="main">
          {/* 보고 있던 여행이 지워지거나 내보내졌을 때도 여기로 온다 */}
          <p className="empty">{t.trip.notFound}</p>
        </main>
        <BottomTabs />
      </div>
    );
  }

  const shift = timezoneShift(prevDay, day);
  const cityName = day.cityLabel || zoneLabel(day.timezone, locale);
  const isOwner = trip.ownerId === me;
  const others = trip.members.filter((m) => m.id !== me).length;

  return (
    <div className="app">
      {/* 순서 바꾸기 중에는 메뉴 대신 '완료' — 둘은 같은 자리를 쓴다 */}
      {reorder ? (
        <AppHeader
          title={trip.name}
          back
          action={{ label: t.trip.reorderDone, onClick: () => setReorder(false) }}
        />
      ) : (
        <AppHeader title={trip.name} back onMenu={() => setMenuOpen(true)} />
      )}

      <DateStrip
        days={trip.days}
        activeDate={activeDate}
        onSelect={(date) => setSearch({ date }, { replace: true })}
      />

      {/* 가로 스와이프로 날짜 전환. 세로 스크롤은 그대로 동작한다. */}
      {/* 순서 바꾸기 중에는 끌기와 헷갈리지 않게 날짜 스와이프를 끈다 */}
      <main className="main" {...(reorder ? {} : swipe)} style={{ touchAction: 'pan-y' }}>
        {/*
          도시·타임존은 머리를 눌러 고친다. 도시를 옮기는 날만 고치는 값이라
          화면에 따로 버튼을 두기보다 그 값이 보이는 자리를 누르게 한다.
        */}
        <button className="dayhead dayhead--edit" onClick={() => setDayEditOpen(true)}>
          <div className="dayhead__row">
            <span className="dayhead__city">{cityName}</span>
            <span className="chip">{tzShortLabel(day.timezone, day.date)}</span>
            <PencilIcon size={14} className="dayhead__pencil" />
          </div>
          <div className="dayhead__date">
            {t.common.dayWithDate(dayIndex + 1, formatDateLabel(day.date, locale))}
          </div>
        </button>

        {/* 타임존이 바뀌는 날 경고. 전세계 여행에서 제일 조용히 터지는 부분. */}
        {shift.changed && (
          <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
            <div className="banner">
              <AlertIcon className="banner__icon" />
              <div>
                <Rich
                  text={t.trip.tzBanner(formatOffsetDelta(shift.deltaMinutes, locale), cityName)}
                />
              </div>
            </div>
          </div>
        )}

        {reorder && (
          <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
            <div className="banner banner--info">
              <ReorderIcon className="banner__icon" />
              <div>{t.trip.reorderHint}</div>
            </div>
          </div>
        )}

        <div className={`timeline${reorder ? ' timeline--reorder' : ''}`}>
          {items.length === 0 && <p className="empty">{t.trip.emptyDay}</p>}

          {reorder &&
            items.map((item, i) => (
              <div
                key={item.id}
                ref={reorderDrag.rowRef(i)}
                style={reorderDrag.rowStyle(i)}
                className={`tl-row${reorderDrag.drag?.from === i ? ' tl-row--dragging' : ''}`}
              >
                <div className="tl-time">{item.localTime ?? '—'}</div>
                <div className="tl-item tl-item--reorder">
                  <div className="tl-item__head">
                    <span className="tl-item__title">{item.title}</span>
                    <button
                      className="tl-grip"
                      aria-label={t.trip.reorderHandle(item.title)}
                      {...reorderDrag.handleProps(i, items.length)}
                    >
                      <GripIcon />
                    </button>
                  </div>
                  {item.placeName && <div className="tl-item__place">{item.placeName}</div>}
                </div>
              </div>
            ))}

          {/*
            시각과 순서가 어긋난 날. 자정을 넘기는 일정일 수도 있어 고치라고 강요하지
            않는다 — 알려주고, 원하면 한 번에 정렬하게 한다.
          */}
          {!reorder && hasConflict && (
            <div className="banner timeline__notice">
              <AlertIcon className="banner__icon" />
              <div>
                {t.trip.timeConflict}
                <button
                  className="banner__action"
                  onClick={() => {
                    setDayOrder(trip.id, activeDate, timeSortedOrder(items));
                    platform.vibrate(8);
                  }}
                >
                  {t.trip.sortByTime}
                </button>
              </div>
            </div>
          )}

          {!reorder && items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <LegRow info={legs.get(item.id)} />}

              <div className="tl-row">
                <div
                  className={`tl-time${conflicts[i] ? ' tl-time--conflict' : ''}`}
                  title={conflicts[i] ? t.trip.timeConflictShort : undefined}
                >
                  {conflicts[i] && <AlertIcon size={11} className="tl-time__warn" />}
                  {item.localTime ?? '—'}
                  {item.durationMin !== undefined && (
                    <span className="tl-time__dur">{formatMinutes(item.durationMin, locale)}</span>
                  )}
                </div>

                <button
                  className="tl-item"
                  onClick={() => navigate(`/trip/${trip.id}/item/${item.id}`)}
                >
                  <div className="tl-item__head">
                    <span className="tl-item__title">{item.title}</span>
                    {isSegmentKind(item.kind) && (
                      <span className={`chip chip--${KIND_TONE[item.kind]}`}>
                        <KindIcon kind={item.kind} />
                        {item.carrierCode ?? t.kind[item.kind]}
                      </span>
                    )}
                    <EditedBy item={item} members={trip.members} variant="avatar" />
                  </div>

                  {item.placeName && (
                    <div className="tl-item__place">
                      {item.kind === 'place' ? <PinIcon /> : <ClockIcon />}
                      {item.placeName}
                    </div>
                  )}

                  {item.description && <div className="tl-item__desc">{item.description}</div>}
                </button>
              </div>
            </div>
          ))}

          {/*
            추가 버튼을 목록 끝에 둔다. 띄우는 버튼(FAB)은 마지막 항목을 가려서,
            일정이 꽉 찬 날일수록 방해가 된다.
          */}
          {!reorder && (
            <button
              className="tl-add"
              onClick={() => navigate(`/trip/${trip.id}/item/new?date=${activeDate}`)}
            >
              <PlusIcon size={16} /> {t.trip.addItem}
            </button>
          )}
        </div>
      </main>

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <button
          className="sheet__item"
          onClick={() => {
            setMenuOpen(false);
            navigate(`/trip/${trip.id}/checklist`);
          }}
        >
          <ListIcon />
          {t.trip.menuChecklist}
        </button>
        <button
          className="sheet__item"
          onClick={() => {
            setMenuOpen(false);
            navigate(`/trip/${trip.id}/expenses?date=${activeDate}`);
          }}
        >
          <WalletIcon />
          {t.trip.menuLedger}
        </button>
        {items.length > 1 && (
          <button
            className="sheet__item"
            onClick={() => {
              setMenuOpen(false);
              setReorder(true);
            }}
          >
            <ReorderIcon />
            {t.trip.menuReorder}
          </button>
        )}
        <button className="sheet__item" onClick={onShare}>
          <ShareIcon />
          {t.trip.menuShare}
        </button>
        <button
          className="sheet__item"
          onClick={() => {
            setMenuOpen(false);
            navigate(`/trip/${trip.id}/members`);
          }}
        >
          <UsersIcon />
          {t.trip.menuMembers}
        </button>

        <div className="sheet__sep" />
        {/*
          소유자는 나갈 수 없다(주인 없는 여행이 남는다). 대신 지운다.
          멤버는 지울 수 없다. 남이 만든 여행을 통째로 날리면 안 된다.
        */}
        {isOwner ? (
          <button
            className="sheet__item sheet__item--danger"
            onClick={() => {
              setMenuOpen(false);
              setConfirm('delete');
            }}
          >
            <TrashIcon />
            {t.trip.menuDelete}
          </button>
        ) : (
          <button
            className="sheet__item sheet__item--danger"
            onClick={() => {
              setMenuOpen(false);
              setConfirm('leave');
            }}
          >
            <LeaveIcon />
            {t.trip.menuLeave}
          </button>
        )}

        {/* 라이선스 의무라 메뉴에 상시 노출한다 — DataCredits 주석 참고 */}
        <DataCredits />
      </MenuSheet>

      {confirm === 'delete' && (
        <ConfirmSheet
          title={t.trip.deleteTitle}
          confirmLabel={t.trip.deleteConfirm}
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteTrip(trip.id);
            navigate('/', { replace: true });
          }}
        >
          <p>
            <Rich text={t.trip.deleteBody(trip.name)} />
          </p>
          {others > 0 && <p>{t.trip.deleteOthers(others)}</p>}
        </ConfirmSheet>
      )}

      {confirm === 'leave' && (
        <ConfirmSheet
          title={t.trip.leaveTitle}
          confirmLabel={t.trip.leaveConfirm}
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await leaveTrip(trip.id);
            navigate('/', { replace: true });
          }}
        >
          <p>
            <Rich text={t.trip.leaveBody(trip.name)} />
          </p>
          <p>{t.trip.leaveRejoin}</p>
        </ConfirmSheet>
      )}

      {/* 열 때마다 새로 만든다 — 지난번에 고치다 만 값이 남지 않게 */}
      {dayEditOpen && (
        <DayEditSheet
          key={activeDate}
          tripId={trip.id}
          days={trip.days}
          date={activeDate}
          onClose={() => setDayEditOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <BottomTabs tripId={trip.id} date={activeDate} />
    </div>
  );
}
