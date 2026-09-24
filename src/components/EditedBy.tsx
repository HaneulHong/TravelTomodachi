/**
 * 누가 마지막으로 고쳤는지.
 *
 * 같이 짜는 일정에서 제일 자주 나오는 질문이 "이거 누가 바꿨어?"다.
 * 타임라인에는 아바타 하나만, 상세 화면에는 이름과 시각까지 보여준다.
 *
 * 혼자 쓰는 여행에서는 타임라인에 띄우지 않는다. 전부 내 얼굴이면 정보가
 * 아니라 소음이다.
 */

import { formatRelative } from '@/domain/time';
import { memberLabel, type Item, type Member } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

interface Props {
  item: Item;
  members: Member[];
  variant: 'avatar' | 'line';
}

export function EditedBy({ item, members, variant }: Props) {
  const me = useTripStore((s) => s.currentUserId);
  const t = useT();
  const locale = useLocale();
  if (!item.updatedBy) return null;

  // 나간 멤버는 목록에 없다. 이름은 모르지만 "누군가 고쳤다"는 건 남긴다.
  const member: Member = members.find((m) => m.id === item.updatedBy) ?? {
    id: item.updatedBy,
    name: t.edited.leftMember,
    initial: '?',
    color: '#9a9488',
  };
  const isMe = member.id === me;
  const name = memberLabel(member, members);
  const when = item.updatedAt ? formatRelative(item.updatedAt, Date.now(), locale) : '';
  const who = isMe ? null : name;

  if (variant === 'avatar') {
    if (members.length < 2) return null;
    return (
      <span
        className="avatar avatar--sm edited__avatar"
        style={{ background: member.color }}
        title={t.edited.title(who, when)}
      >
        {member.initial}
      </span>
    );
  }

  return (
    <div className="edited">
      <span className="avatar avatar--sm" style={{ background: member.color }}>
        {member.initial}
      </span>
      <span>
        {t.edited.line(who)}
        {when && <span className="edited__when"> · {when}</span>}
      </span>
    </div>
  );
}
