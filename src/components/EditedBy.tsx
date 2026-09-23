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
import type { Item, Member } from '@/domain/types';
import { useTripStore } from '@/store/tripStore';

interface Props {
  item: Item;
  members: Member[];
  variant: 'avatar' | 'line';
}

/** 나간 멤버는 목록에 없다. 이름은 모르지만 "누군가 고쳤다"는 건 남긴다. */
const LEFT_MEMBER: Omit<Member, 'id'> = { name: '나간 멤버', initial: '?', color: '#9a9488' };

export function EditedBy({ item, members, variant }: Props) {
  const me = useTripStore((s) => s.currentUserId);
  if (!item.updatedBy) return null;

  const member = members.find((m) => m.id === item.updatedBy) ?? {
    id: item.updatedBy,
    ...LEFT_MEMBER,
  };
  const isMe = member.id === me;
  const when = item.updatedAt ? formatRelative(item.updatedAt) : '';

  if (variant === 'avatar') {
    if (members.length < 2) return null;
    return (
      <span
        className="avatar avatar--sm edited__avatar"
        style={{ background: member.color }}
        title={`${isMe ? '내가' : `${member.name}님이`} 고침${when ? ` · ${when}` : ''}`}
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
        {isMe ? '내가' : `${member.name}님이`} 마지막으로 고침
        {when && <span className="edited__when"> · {when}</span>}
      </span>
    </div>
  );
}
