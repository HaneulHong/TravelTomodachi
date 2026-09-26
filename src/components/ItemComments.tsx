/**
 * 일정 댓글 — 상세 화면 아래.
 *
 * "여기 예약 필요해?", "나 이날 늦게 합류" 같은 말을 일정 옆에 남긴다. 단톡방에
 * 흘러가 버리는 얘기를 그 일정에 붙여 두는 것. 고치기는 없고 자기 댓글만 지운다
 * (DB가 막는다 — collab.sql).
 */

import { useMemo, useState } from 'react';
import { LIMITS } from '@/domain/limits';
import { formatRelative } from '@/domain/time';
import { memberLabel, type Trip } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

const MAX = LIMITS.comment;

export function ItemComments({ trip, itemId }: { trip: Trip; itemId: string }) {
  const t = useT();
  const locale = useLocale();
  const me = useTripStore((s) => s.currentUserId);
  const all = useTripStore((s) => s.comments);
  const addComment = useTripStore((s) => s.addComment);
  const removeComment = useTripStore((s) => s.removeComment);
  const comments = useMemo(
    () =>
      all
        .filter((c) => c.itemId === itemId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [all, itemId],
  );
  const [draft, setDraft] = useState('');

  const send = (): void => {
    const body = draft.trim();
    if (!body) return;
    addComment(itemId, body.slice(0, MAX));
    setDraft('');
  };

  return (
    <section className="card field">
      <div className="field__label">
        {t.comments.title}
        {comments.length > 0 && ` · ${comments.length}`}
      </div>

      {comments.length === 0 ? (
        <p className="field__value field__value--muted" style={{ marginBottom: 10 }}>
          {t.comments.empty}
        </p>
      ) : (
        <ul className="comments">
          {comments.map((c) => {
            const author = trip.members.find((m) => m.id === c.authorId);
            return (
              <li key={c.id} className="comment">
                <span
                  className="avatar avatar--sm"
                  style={{ background: author?.color ?? '#9a9488' }}
                >
                  {author?.initial ?? '?'}
                </span>
                <div className="comment__body">
                  <div className="comment__meta">
                    <strong>
                      {author ? memberLabel(author, trip.members) : t.edited.leftMember}
                    </strong>
                    <span>{formatRelative(c.createdAt, Date.now(), locale)}</span>
                    {c.authorId === me && (
                      <button className="comment__delete" onClick={() => removeComment(c.id)}>
                        {t.comments.delete}
                      </button>
                    )}
                  </div>
                  <p className="comment__text">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="form__input"
          rows={1}
          maxLength={MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 데스크톱: Enter로 보내고 Shift+Enter로 줄바꿈. 한글 조합 중에는 보내지 않는다.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.comments.placeholder}
          aria-label={t.comments.title}
        />
        <button className="btn btn--primary btn--sm" type="submit" disabled={!draft.trim()}>
          {t.comments.send}
        </button>
      </form>
    </section>
  );
}
