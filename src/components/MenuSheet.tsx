import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose(): void;
  children: ReactNode;
}

/** 스케치의 ≡ 메뉴. 체크리스트·공유 진입점이 여기 들어간다. */
export function MenuSheet({ open, onClose, children }: Props) {
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label="메뉴">
        <div className="sheet__handle" />
        {children}
      </div>
    </>
  );
}
