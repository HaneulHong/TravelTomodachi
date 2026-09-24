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
import { PlaceField } from '@/components/PlaceField';
import { isSegmentKind, type Coord, type ItemKind } from '@/domain/types';
import { formatDateLabel } from '@/domain/time';
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
  const [localTime, setLocalTime] = useState(existing?.localTime ?? '');
  const [duration, setDuration] = useState(
    existing?.durationMin !== undefined ? String(existing.durationMin) : '',
  );
  const [carrierCode, setCarrierCode] = useState(existing?.carrierCode ?? '');
  const [toPlaceName, setToPlaceName] = useState(existing?.toPlaceName ?? '');
  const [toCoord, setToCoord] = useState<Coord | undefined>(existing?.toCoord);
  const [description, setDescription] = useState(existing?.description ?? '');

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
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.itemEdit.titlePlaceholder}
              autoFocus={!isEdit}
            />
          </label>

          <label className="form__row">
            <span className="form__label">{t.itemEdit.date}</span>
            <select className="form__input" value={date} onChange={(e) => setDate(e.target.value)}>
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

          {isSegmentKind(kind) && (
            <label className="form__row">
              <span className="form__label">{t.carrierLabel[kind]}</span>
              <input
                className="form__input"
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                placeholder={t.carrierPlaceholder[kind]}
              />
            </label>
          )}

          <label className="form__row">
            <span className="form__label">{t.itemEdit.memo}</span>
            <textarea
              className="form__input form__textarea"
              value={description}
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
              <button className="btn btn--danger" onClick={destroy}>
                {t.common.delete}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
