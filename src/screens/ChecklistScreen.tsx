import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CheckIcon, PlusIcon } from '@/components/icons';
import { LIMITS } from '@/domain/limits';
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
    </div>
  );
}
