import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose(): void;
  children: ReactNode;
  /** 화면 읽기 도구가 읽는 이름. 메뉴 말고 다른 시트에도 쓴다. */
  label?: string;
}

/** 스케치의 ≡ 메뉴. 체크리스트·공유 진입점이 여기 들어간다. */
export function MenuSheet({ open, onClose, children, label = '메뉴' }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet__handle" />
        {children}
      </div>
    </>
  );
}
