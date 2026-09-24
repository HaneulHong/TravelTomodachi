/** 인라인 아이콘. 외부 아이콘 패키지를 안 쓰면 번들이 작고 색상 제어가 쉽다. */

interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export const ChevronLeft = ({ size = 22, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const Menu = ({ size = 21, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const HomeIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" />
  </svg>
);

export const CalendarIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const MapIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </svg>
);

export const PinIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const CheckIcon = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)} strokeWidth={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const PlusIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const WalkIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="13" cy="4.5" r="2" />
    <path d="M11 21l1.5-6-3-2 1-5 3 3 3 1M12.5 15l3 6" />
  </svg>
);

export const TransitIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="5.5" y="3.5" width="13" height="13" rx="2.5" />
    <path d="M5.5 10h13M9 20l1.5-3.5M15 20l-1.5-3.5" />
    <circle cx="9.5" cy="13.5" r="0.6" fill="currentColor" />
    <circle cx="14.5" cy="13.5" r="0.6" fill="currentColor" />
  </svg>
);

export const CarIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 15v-2.2a2 2 0 01.3-1L6.5 8A2 2 0 018.2 7h7.6a2 2 0 011.7 1l2.2 3.8c.2.3.3.7.3 1V15a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
    <path d="M4.5 12h15" />
    <circle cx="8" cy="16.5" r="1.3" />
    <circle cx="16" cy="16.5" r="1.3" />
  </svg>
);

export const PlaneIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 13l18-6-5.5 12-3-5.5L3 13z" />
  </svg>
);

export const TrainIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="6" y="3.5" width="12" height="12" rx="3" />
    <path d="M6 9.5h12M8 19l1.5-3M16 19l-1.5-3" />
  </svg>
);

export const AlertIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 4.5L21 19.5H3L12 4.5z" />
    <path d="M12 10v4M12 16.8v.2" />
  </svg>
);

export const ClockIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const ShareIcon = ({ size = 19, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3.5v11M12 3.5L8 7.5M12 3.5l4 4" />
    <path d="M5 13v6.5a1 1 0 001 1h12a1 1 0 001-1V13" />
  </svg>
);

export const ListIcon = ({ size = 19, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.2M4.5 12h.2M4.5 17.5h.2" />
  </svg>
);

export const GlobeIcon = ({ size = 19, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14 0 17M12 3.5c-2.5 2.5-2.5 14 0 17" />
  </svg>
);

export const PencilIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
);

export const BusIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 17V6a2 2 0 012-2h12a2 2 0 012 2v11" />
    <path d="M4 11h16" />
    <path d="M6 17v2M18 17v2" />
    <circle cx="7.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="14.5" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

export const FerryIcon = ({ size = 13, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 18c1.5 0 1.5 1.5 3 1.5s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5" />
    <path d="M5 15l1.5-5h11L19 15" />
    <path d="M12 10V6" />
    <path d="M9 6h6" />
  </svg>
);

/*
 * 브랜드 아이콘은 면으로 그린다 — 선 아이콘 규칙(base)을 따르지 않는다.
 * Google G는 네 가지 색이 곧 식별 표시라 단색으로 바꾸면 안 된다.
 */
export const GoogleIcon = ({ size = 17, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden={true}>
    <path
      fill="#4285F4"
      d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 01-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.35z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0012 22z"
    />
    <path
      fill="#FBBC05"
      d="M6.41 13.92a6 6 0 010-3.83V7.5H3.06a10 10 0 000 9l3.35-2.58z"
    />
    <path
      fill="#EA4335"
      d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 00-8.94 5.5l3.35 2.59C7.2 7.72 9.4 5.95 12 5.95z"
    />
  </svg>
);

export const AppleIcon = ({ size = 17, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden={true}>
    <path
      fill="currentColor"
      d="M16.36 12.7c.02 2.5 2.2 3.33 2.22 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.4 2.03-2.53 2.05-1.11.02-1.47-.65-2.74-.65-1.27 0-1.67.63-2.72.67-1.09.04-1.92-1.1-2.62-2.11-1.42-2.07-2.51-5.85-1.05-8.4A4.07 4.07 0 019.2 7.9c1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.64-.08.05-1.81 1.06-1.79 3.2z"
    />
    <path
      fill="currentColor"
      d="M14.3 6.5c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.54.62-1.01 1.61-.88 2.56.93.07 1.88-.47 2.46-1.16z"
    />
  </svg>
);

export const UserIcon = ({ size = 19, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </svg>
);

export const UsersIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="8.5" r="3.1" />
    <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
    <path d="M15.5 5.6a3 3 0 010 5.8M17.5 14.7c2 .6 3.5 2.2 3.5 4.8" />
  </svg>
);

export const LeaveIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </svg>
);

export const TrashIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M9.5 7V4.5h5V7" />
    <path d="M6 7l1 12.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5L18 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

/** 순서 바꾸기 — 위아래 화살표 */
export const ReorderIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 4v16M8 4L4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" />
  </svg>
);

/** 끌기 손잡이 — 점 여섯 개 */
export const GripIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
