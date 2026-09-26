import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { MenuSheet } from '@/components/MenuSheet';
import { CheckIcon, ListIcon, PlusIcon } from '@/components/icons';
import { LIMITS } from '@/domain/limits';
import { isAbroad, missingItems, packingKey } from '@/domain/packing';
import type { TripDay } from '@/domain/types';
import { platform } from '@/platform';
import { useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

export function ChecklistScreen() {
  const { tripId = '' } = useParams();
  const [draft, setDraft] = useState('');
  const t = useT();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const checklist = useTripStore((s) => s.checklist).filter((c) => c.tripId === tripId);
  const toggle = useTripStore((s) => s.toggleChecklistItem);
  const add = useTripStore((s) => s.addChecklistItem);
  const [templateOpen, setTemplateOpen] = useState(false);

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title={t.checklist.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.common.tripNotFound}</p>
        </main>
      </div>
    );
  }

  const done = checklist.filter((c) => c.checked).length;
  const pct = checklist.length === 0 ? 0 : Math.round((done / checklist.length) * 100);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    add(tripId, title);
    setDraft('');
  }

  return (
    <div className="app">
      <AppHeader title={t.checklist.title} back />

      <main className="main main--no-tabs">
        <div className="section" style={{ paddingBottom: 0 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <strong>{trip.name}</strong>
              <span style={{ color: 'var(--text-2)' }}>
                {done} / {checklist.length}
              </span>
            </div>
            <div className="progress">
              <div className="progress__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="checklist">
          {checklist.length === 0 && <p className="empty">{t.checklist.empty}</p>}

          {/* 여행마다 똑같이 치는 것들 — 비었을 때는 크게, 아니면 작게 */}
          <button
            type="button"
            className={`btn ${checklist.length === 0 ? 'btn--primary' : 'btn--ghost'} checklist__template`}
            onClick={() => setTemplateOpen(true)}
          >
            <ListIcon size={16} /> {t.checklist.fromTemplate}
          </button>

          {checklist.map((c) => {
            const assignee = trip.members.find((m) => m.id === c.assigneeId);
            return (
              <button
                key={c.id}
                className="check"
                onClick={() => {
                  toggle(c.id);
                  platform.vibrate(8);
                }}
                aria-pressed={c.checked}
              >
                <span className={`check__box${c.checked ? ' check__box--on' : ''}`}>
                  <CheckIcon />
                </span>
                <span className={`check__title${c.checked ? ' check__title--done' : ''}`}>
                  {c.title}
                </span>
                {assignee && (
                  <span
                    className="avatar avatar--sm"
                    style={{ background: assignee.color }}
                    title={assignee.name}
                  >
                    {assignee.initial}
                  </span>
                )}
              </button>
            );
          })}

          <div className="checkadd">
            <input
              className="checkadd__input"
              value={draft}
              maxLength={LIMITS.checklistTitle}
              placeholder={t.checklist.addPlaceholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
            <button className="btn btn--primary btn--sm" onClick={submit} aria-label={t.common.add}>
              <PlusIcon />
            </button>
          </div>
        </div>
      </main>

      {templateOpen && (
        <TemplateSheet
          days={trip.days}
          existing={checklist.map((c) => c.title)}
          onAdd={(titles) => {
            for (const title of titles) add(tripId, title);
            setTemplateOpen(false);
          }}
          onClose={() => setTemplateOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * 기본 준비물에서 골라 넣기. 이미 있는 건 "이미 있음"으로 막고, 해외여행이면 해외 항목도
 * 미리 골라 둔다(날짜 중 하나라도 서울과 다른 시간대면 — domain/packing.ts).
 */
function TemplateSheet({
  days,
  existing,
  onAdd,
  onClose,
}: {
  days: TripDay[];
  existing: string[];
  onAdd(titles: string[]): void;
  onClose(): void;
}) {
  const t = useT();
  const abroad = isAbroad(days);
  const groups = [
    { key: 'common', label: t.checklist.groupCommon, items: t.checklist.templates.common, preset: true },
    { key: 'abroad', label: t.checklist.groupAbroad, items: t.checklist.templates.abroad, preset: abroad },
  ];
  const have = useMemo(() => new Set(existing.map(packingKey)), [existing]);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.preset).flatMap((g) => missingItems(existing, g.items))),
  );
  const toAdd = missingItems(existing, [...picked]);

  return (
    <MenuSheet open onClose={onClose} label={t.checklist.templateTitle}>
      <div className="form template">
        <div className="dayedit__title">{t.checklist.templateTitle}</div>
        {groups.map((g) => (
          <fieldset key={g.key} className="template__group">
            <legend className="form__label">{g.label}</legend>
            {g.items.map((title) => {
              const already = have.has(packingKey(title));
              return (
                <label key={title} className={`form__check${already ? ' template__row--have' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={already}
                    checked={already || picked.has(title)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(title);
                      else next.delete(title);
                      setPicked(next);
                    }}
                  />
                  <span>
                    {title}
                    {already && <span className="form__check-sub">{t.checklist.already}</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
        <div className="form__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={toAdd.length === 0}
            onClick={() => onAdd(toAdd)}
          >
            {t.checklist.addSome(toAdd.length)}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </MenuSheet>
  );
}
