/**
 * 후보 장소 — 날짜를 정하기 전에 "가고 싶은 곳"을 모으고 투표한다.
 *
 * 여럿이 같이 짜면 일정표에 바로 넣기 전에 "이거 어때?"가 먼저 오간다. 그걸
 * 단톡방 대신 여기서 하고, 표를 많이 받은 곳부터 일정에 넣는다. 일정에 넣으면
 * 후보에서는 빠진다(옮겨 간다).
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { MenuSheet } from '@/components/MenuSheet';
import { PlaceField } from '@/components/PlaceField';
import { PinIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { SHOW_DEV_HINTS } from '@/config';
import { rankPlaces } from '@/domain/ideas';
import { LIMITS } from '@/domain/limits';
import { formatDateLabel } from '@/domain/time';
import { defaultDateFor } from '@/domain/today';
import { memberLabel, type Coord, type Member, type Place } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { platform } from '@/platform';
import { useTripStore } from '@/store/tripStore';

export function IdeasScreen() {
  const { tripId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const me = useTripStore((s) => s.currentUserId);
  const available = useTripStore((s) => s.collabAvailable);
  const allPlaces = useTripStore((s) => s.places);
  const allVotes = useTripStore((s) => s.votes);
  const addPlace = useTripStore((s) => s.addPlace);
  const removePlace = useTripStore((s) => s.removePlace);
  const toggleVote = useTripStore((s) => s.toggleVote);
  const placeToItem = useTripStore((s) => s.placeToItem);

  const ranked = useMemo(
    () =>
      rankPlaces(
        allPlaces.filter((p) => p.tripId === tripId),
        allVotes.filter((v) => v.tripId === tripId),
      ),
    [allPlaces, allVotes, tripId],
  );

  const [adding, setAdding] = useState(false);
  const [toPlan, setToPlan] = useState<Place | null>(null);
  const [removing, setRemoving] = useState<Place | null>(null);

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title={t.ideas.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.tripNotFound}</p>
        </main>
      </div>
    );
  }

  const memberOf = (id: string | undefined): Member | undefined =>
    trip.members.find((m) => m.id === id);
  const nameOf = (id: string | undefined): string => {
    const m = memberOf(id);
    return m ? memberLabel(m, trip.members) : t.edited.leftMember;
  };

  return (
    <div className="app">
      <AppHeader title={t.ideas.title} back />

      <main className="main main--no-tabs">
        {!available ? (
          <div className="section">
            <p className="empty">{t.ideas.needsDb}</p>
            {SHOW_DEV_HINTS && (
              <p className="form__hint">supabase/collab.sql을 SQL Editor에서 실행하세요.</p>
            )}
          </div>
        ) : (
          <div className="section">
            {ranked.length === 0 && <p className="empty">{t.ideas.empty}</p>}

            <ol className="ideas">
              {ranked.map(({ place, voters }, i) => {
                const mine = voters.includes(me);
                return (
                  <li key={place.id} className="idea card">
                    <div className="idea__head">
                      <span className="idea__rank">{i + 1}</span>
                      <div className="idea__main">
                        <div className="idea__name">{place.name}</div>
                        {place.placeName && place.placeName !== place.name && (
                          <div className="idea__place">
                            <PinIcon size={12} /> {place.placeName}
                          </div>
                        )}
                        {place.note && <p className="idea__note">{place.note}</p>}
                        <div className="idea__by">{t.ideas.addedBy(nameOf(place.createdBy))}</div>
                      </div>
                      {/* 지우기는 위 오른쪽 — 아래 줄에 두면 좁은 폰에서 혼자 다음 줄로 떨어진다 */}
                      <button
                        className="idea__remove"
                        aria-label={t.common.delete}
                        onClick={() => setRemoving(place)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>

                    <div className="idea__actions">
                      <button
                        className={`vote${mine ? ' vote--on' : ''}`}
                        aria-pressed={mine}
                        onClick={() => {
                          toggleVote(place.id);
                          platform.vibrate(8);
                        }}
                      >
                        <span aria-hidden>👍</span>
                        {mine ? t.ideas.voted : t.ideas.vote}
                        <strong>{voters.length}</strong>
                      </button>
                      {/* 누가 표를 줬는지 — 셋까지 얼굴, 나머지는 숫자로 이미 보인다 */}
                      <span className="avatars idea__voters" aria-label={t.ideas.votes(voters.length)}>
                        {voters.slice(0, 3).map((id) => {
                          const m = memberOf(id);
                          return (
                            <span
                              key={id}
                              className="avatar avatar--sm"
                              style={{ background: m?.color ?? '#9a9488' }}
                              title={nameOf(id)}
                            >
                              {m?.initial ?? '?'}
                            </span>
                          );
                        })}
                      </span>
                      <button className="idea__plan" onClick={() => setToPlan(place)}>
                        {t.ideas.toPlan}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>

            <button className="tl-add" onClick={() => setAdding(true)}>
              <PlusIcon size={16} /> {t.ideas.add}
            </button>
          </div>
        )}
      </main>

      {adding && (
        <AddIdeaSheet
          near={ranked.flatMap(({ place }) => (place.coord ? [place.coord] : []))}
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            addPlace({ tripId: trip.id, ...draft });
            setAdding(false);
          }}
        />
      )}

      {toPlan && (
        <MenuSheet open onClose={() => setToPlan(null)} label={t.ideas.toPlanTitle}>
          <div className="form">
            <div className="dayedit__title">{t.ideas.toPlanTitle}</div>
            <p className="form__hint">{t.ideas.toPlanHint}</p>
            <div className="idea-days">
              {trip.days.map((d, i) => (
                <button
                  key={d.date}
                  className={`sheet__item${
                    d.date === (search.get('date') ?? defaultDateFor(trip)) ? ' sheet__item--current' : ''
                  }`}
                  onClick={() => {
                    const itemId = placeToItem(toPlan.id, d.date);
                    setToPlan(null);
                    // 넣은 일정을 바로 보여 준다 — 시각을 정하러 들어가게 된다
                    if (itemId) navigate(`/trip/${trip.id}/item/${itemId}`);
                  }}
                >
                  {t.common.dayWithDate(i + 1, formatDateLabel(d.date, locale))}
                  <span className="sheet__item-sub">{d.cityLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </MenuSheet>
      )}

      {removing && (
        <ConfirmSheet
          title={t.ideas.removeTitle(removing.name)}
          confirmLabel={t.common.delete}
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            removePlace(removing.id);
            setRemoving(null);
          }}
        >
          <p>{t.ideas.removeBody}</p>
        </ConfirmSheet>
      )}
    </div>
  );
}

/** 후보 올리기 — 장소 검색 + 한마디. 검색 결과를 안 골라도(좌표 없이) 올릴 수 있다. */
function AddIdeaSheet({
  near,
  onClose,
  onSave,
}: {
  /** 지도에서 고를 때 처음 보여 줄 곳 — 다른 후보들 */
  near: Coord[];
  onClose(): void;
  onSave(draft: { name: string; placeName?: string; coord?: Coord; note?: string }): void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [placeName, setPlaceName] = useState<string | undefined>();
  const [coord, setCoord] = useState<Coord | undefined>();
  const [note, setNote] = useState('');
  const canSave = name.trim().length > 0;

  return (
    <MenuSheet open onClose={onClose} label={t.ideas.addTitle}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onSave({
            name: name.trim(),
            placeName: coord ? placeName : undefined,
            coord,
            note: note.trim() || undefined,
          });
        }}
      >
        <div className="dayedit__title">{t.ideas.addTitle}</div>
        <PlaceField
          label={t.ideas.where}
          maxLength={LIMITS.ideaName}
          placeholder={t.ideas.wherePlaceholder}
          name={name}
          coord={coord}
          autoFocus
          onChange={(next, nextCoord) => {
            setName(next);
            setCoord(nextCoord);
          }}
          onPicked={(place) => setPlaceName(place.name)}
          near={near}
        />
        <label className="form__row">
          <span className="form__label">{t.ideas.note}</span>
          <textarea
            className="form__input form__textarea"
            rows={2}
            maxLength={LIMITS.ideaNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.ideas.notePlaceholder}
          />
        </label>
        <div className="form__actions">
          <button className="btn btn--primary" type="submit" disabled={!canSave}>
            {t.ideas.add}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            {t.common.cancel}
          </button>
        </div>
      </form>
    </MenuSheet>
  );
}
