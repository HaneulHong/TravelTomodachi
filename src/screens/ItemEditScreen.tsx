/**
 * 일정 추가 · 수정.
 *
 * 한 화면이 두 가지를 다 맡는다. 만들 때와 고칠 때 입력 항목이 같은데
 * 화면을 나누면 폼이 두 벌이 되고, 한쪽만 고치는 실수가 반드시 생긴다.
 * 구분은 URL이 한다 — itemId가 없으면 추가, 있으면 수정.
 */

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { PlaceField } from '@/components/PlaceField';
import { LIMITS } from '@/domain/limits';
import { isSegmentKind, type Coord, type ItemKind } from '@/domain/types';
import { formatDateLabel } from '@/domain/time';
import { endTimeOf } from '@/domain/today';
import { useLocale, useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

const KINDS: ItemKind[] = ['place', 'flight', 'train', 'bus', 'ferry'];

export function ItemEditScreen() {
  const { tripId = '', itemId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const existing = useTripStore((s) => (itemId ? s.getItem(itemId) : undefined));
  const addItem = useTripStore((s) => s.addItem);
  const updateItem = useTripStore((s) => s.updateItem);
  const removeItem = useTripStore((s) => s.removeItem);
  const getDayItems = useTripStore((s) => s.getDayItems);
  const moveItemToDate = useTripStore((s) => s.moveItemToDate);
  const t = useT();
  const locale = useLocale();

  const isEdit = Boolean(itemId);
  // 추가일 때 어느 날짜에 넣을지는 쿼리로 받는다. 수정이면 항목이 이미 안다.
  const originalDate = existing?.date ?? params.get('date') ?? trip?.startDate ?? '';

  // 다른 날로 옮길 수 있다. 옮기면 그 날의 맨 뒤에 붙고 시간은 그대로다.
  const [date, setDate] = useState(originalDate);
  const [kind, setKind] = useState<ItemKind>(existing?.kind ?? 'place');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [placeName, setPlaceName] = useState(existing?.placeName ?? '');
  const [coord, setCoord] = useState<Coord | undefined>(existing?.coord);
  /*
   * 새 일정의 시각은 그 날 마지막 일정이 끝나는 시각으로 채워 둔다. 대개 그 뒤에 이어서
   * 가니 빈칸보다 빠르다. 날짜를 바꾸면 그 날 기준으로 다시 채우되, 사람이 고친 시각은 그대로 둔다.
   */
  const suggestFor = (d: string): { time: string; after: string } | null => {
    if (!trip) return null;
    // 시각이 없는 일정(예: "서울역")은 건너뛰고, 시각이 있는 마지막 일정이 끝나는 때.
    // 그 일정에 머무는 시간이 없으면 끝을 몰라 채우지 않는다.
    const last = [...getDayItems(trip.id, d)].reverse().find((it) => it.localTime);
    const end = last ? endTimeOf(last) : null;
    return last && end ? { time: end, after: last.title } : null;
  };
  const [suggested, setSuggested] = useState(() => (isEdit ? null : suggestFor(originalDate)));
  const [localTime, setLocalTime] = useState(existing?.localTime ?? suggested?.time ?? '');
  const [duration, setDuration] = useState(
    existing?.durationMin !== undefined ? String(existing.durationMin) : '',
  );
  const [carrierCode, setCarrierCode] = useState(existing?.carrierCode ?? '');
  const [toPlaceName, setToPlaceName] = useState(existing?.toPlaceName ?? '');
  const [toCoord, setToCoord] = useState<Coord | undefined>(existing?.toCoord);
  const [description, setDescription] = useState(existing?.description ?? '');
  // 지우기 전에 한 번 묻는다 — 친구들과 같이 쓰는 일정이라 잘못 누르면 모두의 화면에서 사라진다
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bookingRef, setBookingRef] = useState(existing?.bookingRef ?? '');

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title={t.trip.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.tripNotFound}</p>
        </main>
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="app">
        <AppHeader title={t.itemEdit.titleEdit} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.itemNotFound}</p>
        </main>
      </div>
    );
  }

  const canSave = title.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;

    const minutes = duration.trim() === '' ? undefined : Number(duration);
    const patch = {
      kind,
      title: title.trim(),
      placeName: placeName.trim() || undefined,
      coord,
      localTime: localTime || undefined,
      durationMin: Number.isFinite(minutes) ? minutes : undefined,
      description: description.trim() || undefined,
      // 편명과 도착 터미널은 구간 항목일 때만 의미가 있다. 종류를 방문으로
      // 되돌렸는데 값이 남아 있으면 지도에 없는 선이 그려지고 배지도 뜬다.
      carrierCode: isSegmentKind(kind) ? carrierCode.trim() || undefined : undefined,
      toPlaceName: isSegmentKind(kind) ? toPlaceName.trim() || undefined : undefined,
      toCoord: isSegmentKind(kind) ? toCoord : undefined,
      /*
       * 예약 번호는 적었거나 원래 있던 때만 보낸다. expenses.sql을 돌리기 전 DB에는
       * 칸이 없어서, 늘 보내면 그 DB에서는 일정 저장 자체가 실패한다.
       */
      ...(bookingRef.trim() || existing?.bookingRef
        ? { bookingRef: bookingRef.trim() || undefined }
        : {}),
    };

    if (isEdit && itemId) {
      if (date !== originalDate) moveItemToDate(itemId, date);
      updateItem(itemId, patch);
      navigate(-1);
      return;
    }

    const id = addItem(trip.id, date, patch);
    // 추가 직후에는 방금 만든 항목을 보여준다. 목록으로 되돌리면 어디에
    // 들어갔는지 확인하러 다시 들어가야 한다.
    navigate(`/trip/${trip.id}/item/${id}`, { replace: true });
  };

  const destroy = (): void => {
    if (!itemId) return;
    removeItem(itemId);
    // 상세 화면은 이미 사라진 항목을 가리키므로 목록까지 되돌린다.
    navigate(`/trip/${trip.id}?date=${originalDate}`, { replace: true });
  };

  return (
    <div className="app">
      <AppHeader
        title={isEdit ? t.itemEdit.titleEdit : t.itemEdit.titleNew}
        back
        action={{ label: t.common.save, onClick: save, disabled: !canSave }}
      />

      <main className="main main--no-tabs">
        <div className="form">
          <div className="form__row">
            <span className="form__label">{t.itemEdit.kind}</span>
            <div className="seg">
              {KINDS.map((k) => (
                <button
                  key={k}
                  className={`seg__btn${k === kind ? ' seg__btn--on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {t.kind[k]}
                </button>
              ))}
            </div>
          </div>

          <label className="form__row">
            <span className="form__label">{t.itemEdit.title}</span>
            <input
              className="form__input"
              value={title}
              maxLength={LIMITS.itemTitle}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.itemEdit.titlePlaceholder}
              autoFocus={!isEdit}
            />
          </label>

          <label className="form__row">
            <span className="form__label">{t.itemEdit.date}</span>
            <select
              className="form__input"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                // 사람이 아직 안 고쳤으면(제안값 그대로거나 비었으면) 새 날짜 기준으로 다시 채운다
                if (!isEdit && (localTime === '' || localTime === suggested?.time)) {
                  const s = suggestFor(next);
                  setSuggested(s);
                  setLocalTime(s?.time ?? '');
                }
              }}
            >
              {trip.days.map((d, i) => (
                <option key={d.date} value={d.date}>
                  {t.common.dayWithDate(i + 1, formatDateLabel(d.date, locale))}
                </option>
              ))}
            </select>
            {isEdit && date !== originalDate && (
              <p className="form__hint">{t.itemEdit.dateMoveHint}</p>
            )}
          </label>

          <PlaceField
            label={isSegmentKind(kind) ? t.itemEdit.depart : t.itemEdit.place}
            placeholder={
              isSegmentKind(kind) ? t.itemEdit.departPlaceholder : t.itemEdit.placePlaceholder
            }
            name={placeName}
            coord={coord}
            onChange={(next, nextCoord) => {
              setPlaceName(next);
              setCoord(nextCoord);
            }}
            onPicked={(place) => {
              // 제목이 비어 있을 때만 장소 이름으로 채운다. 이미 적어둔 제목
              // ("점심 · 분짜" 같은)을 장소 이름으로 덮으면 안 된다.
              if (title.trim().length === 0) setTitle(place.name);
            }}
          />

          {/*
            구간 항목만 도착 터미널을 받는다. 이게 있어야 지도에 선이 그려진다 —
            없으면 출발 터미널만 점으로 찍히고 어디로 갔는지가 사라진다.
          */}
          {isSegmentKind(kind) && (
            <PlaceField
              label={t.itemEdit.arrive}
              placeholder={t.itemEdit.arrivePlaceholder}
              name={toPlaceName}
              coord={toCoord}
              onChange={(next, nextCoord) => {
                setToPlaceName(next);
                setToCoord(nextCoord);
              }}
            />
          )}

          <div className="form__pair">
            <label className="form__row">
              <span className="form__label">{t.itemEdit.time}</span>
              <input
                className="form__input"
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
              />
            </label>

            <label className="form__row">
              <span className="form__label">{t.itemEdit.stay}</span>
              <span className="form__suffixed">
                <input
                  className="form__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
                <span className="form__suffix">{t.itemEdit.minutesSuffix}</span>
              </span>
            </label>
          </div>

          {suggested && localTime === suggested.time && (
            <p className="form__hint">{t.itemEdit.timeSuggested(suggested.after)}</p>
          )}

          {isSegmentKind(kind) && (
            <label className="form__row">
              <span className="form__label">{t.carrierLabel[kind]}</span>
              <input
                className="form__input"
                value={carrierCode}
                maxLength={LIMITS.carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                placeholder={t.carrierPlaceholder[kind]}
              />
            </label>
          )}

          <label className="form__row">
            <span className="form__label">{t.itemEdit.bookingRef}</span>
            <input
              className="form__input"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              placeholder={t.itemEdit.bookingRefPlaceholder}
              maxLength={LIMITS.bookingRef}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <label className="form__row">
            <span className="form__label">{t.itemEdit.memo}</span>
            <textarea
              className="form__input form__textarea"
              value={description}
              maxLength={LIMITS.itemMemo}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t.itemEdit.memoPlaceholder}
            />
          </label>

          <div className="form__actions">
            <button className="btn btn--primary" onClick={save} disabled={!canSave}>
              {isEdit ? t.common.save : t.common.add}
            </button>

            {isEdit && (
              <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
                {t.common.delete}
              </button>
            )}
          </div>
        </div>
      </main>

      {confirmDelete && (
        <ConfirmSheet
          title={t.itemEdit.deleteTitle}
          confirmLabel={t.common.delete}
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => destroy()}
        >
          {t.itemEdit.deleteBody.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </ConfirmSheet>
      )}
    </div>
  );
}
