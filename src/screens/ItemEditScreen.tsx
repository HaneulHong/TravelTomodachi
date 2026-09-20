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
import {
  CARRIER_LABEL,
  CARRIER_PLACEHOLDER,
  ITEM_KIND_LABEL,
  isSegmentKind,
  type Coord,
  type ItemKind,
} from '@/domain/types';
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

  const isEdit = Boolean(itemId);
  // 추가일 때 어느 날짜에 넣을지는 쿼리로 받는다. 수정이면 항목이 이미 안다.
  const date = existing?.date ?? params.get('date') ?? trip?.startDate ?? '';

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
        <AppHeader title="일정" back />
        <main className="main main--no-tabs">
          <p className="empty">여행을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="app">
        <AppHeader title="일정 수정" back />
        <main className="main main--no-tabs">
          <p className="empty">항목을 찾을 수 없습니다.</p>
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
    navigate(`/trip/${trip.id}?date=${date}`, { replace: true });
  };

  return (
    <div className="app">
      <AppHeader
        title={isEdit ? '일정 수정' : '일정 추가'}
        back
        action={{ label: '저장', onClick: save, disabled: !canSave }}
      />

      <main className="main main--no-tabs">
        <div className="form">
          <div className="form__row">
            <span className="form__label">종류</span>
            <div className="seg">
              {KINDS.map((k) => (
                <button
                  key={k}
                  className={`seg__btn${k === kind ? ' seg__btn--on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {ITEM_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <label className="form__row">
            <span className="form__label">제목</span>
            <input
              className="form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 점심 · 분짜"
              autoFocus={!isEdit}
            />
          </label>

          <PlaceField
            label={isSegmentKind(kind) ? '출발 터미널' : '장소'}
            placeholder={
              isSegmentKind(kind) ? '예: 서울역, 동서울종합터미널' : '장소 검색 (예: 호안끼엠)'
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
              label="도착 터미널"
              placeholder="예: 부산역, 제주항 여객터미널"
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
              <span className="form__label">시각</span>
              <input
                className="form__input"
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
              />
            </label>

            <label className="form__row">
              <span className="form__label">머무는 시간</span>
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
                <span className="form__suffix">분</span>
              </span>
            </label>
          </div>

          {isSegmentKind(kind) && (
            <label className="form__row">
              <span className="form__label">{CARRIER_LABEL[kind]}</span>
              <input
                className="form__input"
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                placeholder={CARRIER_PLACEHOLDER[kind]}
              />
            </label>
          )}

          <label className="form__row">
            <span className="form__label">메모</span>
            <textarea
              className="form__input form__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="예약 번호, 준비물, 주의할 점…"
            />
          </label>

          <div className="form__actions">
            <button className="btn btn--primary" onClick={save} disabled={!canSave}>
              {isEdit ? '저장' : '추가'}
            </button>

            {isEdit && (
              <button className="btn btn--danger" onClick={destroy}>
                삭제
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
