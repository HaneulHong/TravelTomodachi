/**
 * 멤버 · 초대 코드.
 *
 * 누가 들어와 있는지 보고, 친구를 더 부르고, 필요하면 정리한다.
 *
 *   모두     — 멤버 목록, 초대 코드, 링크 공유
 *   소유자만 — 멤버 내보내기, 초대 코드 바꾸기
 *
 * 초대 코드를 바꾸는 이유: 단톡방에 올린 링크가 엉뚱한 데로 퍼지면 누구나
 * 들어올 수 있다. 코드를 바꾸면 옛 링크는 막히고, 이미 들어온 사람은 그대로다.
 * 소유자만 보이게 하는 건 화면의 편의일 뿐이고, 실제로 막는 건 DB다
 * (supabase/sharing.sql).
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { ShareIcon } from '@/components/icons';
import { memberLabel, type Member } from '@/domain/types';
import { useInviteShare } from '@/hooks/useInviteShare';
import { useTripStore } from '@/store/tripStore';

type Pending = { kind: 'kick'; member: Member } | { kind: 'regenerate' } | null;

export function MembersScreen() {
  const { tripId = '' } = useParams();
  const trip = useTripStore((s) => s.getTrip(tripId));
  const me = useTripStore((s) => s.currentUserId);
  const removeMember = useTripStore((s) => s.removeMember);
  const regenerateInviteCode = useTripStore((s) => s.regenerateInviteCode);
  const { share, toast } = useInviteShare();

  const [pending, setPending] = useState<Pending>(null);

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title="멤버" back />
        <main className="main main--no-tabs">
          <p className="empty">여행을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  const isOwner = trip.ownerId === me;

  // 만든 사람을 맨 위에, 그다음 나, 나머지는 이름순
  const members = [...trip.members].sort((a, b) => {
    const rank = (m: Member) => (m.id === trip.ownerId ? 0 : m.id === me ? 1 : 2);
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko');
  });

  return (
    <div className="app">
      <AppHeader title="멤버 · 초대" back />

      <main className="main main--no-tabs">
        <div className="section">
          <section className="card invitecard">
            <div className="invitecard__label">초대 코드</div>
            {/* 전화로 불러줄 수 있게 크게. 헷갈리는 글자(0/O, 1/I/L)는 애초에 안 쓴다. */}
            <div className="invitecard__code" aria-label={`초대 코드 ${trip.inviteCode.split('').join(' ')}`}>
              {trip.inviteCode}
            </div>
            <button className="btn btn--primary" onClick={() => void share(trip)}>
              <ShareIcon size={17} /> 초대 링크 보내기
            </button>
            {isOwner && (
              <button className="invitecard__reset" onClick={() => setPending({ kind: 'regenerate' })}>
                초대 코드 바꾸기
              </button>
            )}
          </section>
        </div>

        <div className="section">
          <div className="members__head">함께하는 사람 {members.length}명</div>
          <ul className="members">
            {members.map((m) => {
              const owner = m.id === trip.ownerId;
              const self = m.id === me;
              return (
                <li key={m.id} className="member">
                  <span className="avatar" style={{ background: m.color }}>
                    {m.initial}
                  </span>
                  <span className="member__name">
                    {m.name}
                    {/* 멤버 화면에서는 늘 번호를 보인다 — 누가 누군지 확인하는 곳이다 */}
                    {m.tag && <span className="member__tag">#{m.tag}</span>}
                    {self && <span className="member__me"> (나)</span>}
                  </span>
                  {owner && <span className="chip chip--accent">만든 사람</span>}
                  {isOwner && !owner && (
                    <button
                      className="member__kick"
                      onClick={() => setPending({ kind: 'kick', member: m })}
                    >
                      내보내기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {members.length === 1 && (
            <p className="form__hint members__alone">
              아직 혼자입니다. 초대 링크를 보내면 친구가 바로 들어와 같이 고칠 수 있습니다.
            </p>
          )}
        </div>
      </main>

      {pending?.kind === 'kick' && (
        <ConfirmSheet
          title={`${memberLabel(pending.member, trip.members)}님을 내보낼까요?`}
          confirmLabel="내보내기"
          danger
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await removeMember(trip.id, pending.member.id);
            setPending(null);
          }}
        >
          <p>이 여행을 더 이상 볼 수 없게 됩니다. 이미 고친 일정은 그대로 남습니다.</p>
          <p>
            초대 링크를 아직 갖고 있으면 다시 들어올 수 있습니다. 막으려면 초대 코드도
            바꾸세요.
          </p>
        </ConfirmSheet>
      )}

      {pending?.kind === 'regenerate' && (
        <ConfirmSheet
          title="초대 코드를 바꿀까요?"
          confirmLabel="새 코드 만들기"
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await regenerateInviteCode(trip.id);
            setPending(null);
          }}
        >
          <p>
            지금까지 보낸 링크와 코드 <strong>{trip.inviteCode}</strong>로는 더 이상 들어올 수
            없습니다.
          </p>
          <p>이미 들어온 멤버는 그대로입니다.</p>
        </ConfirmSheet>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
