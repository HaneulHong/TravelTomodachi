/**
 * 되돌릴 수 없는 동작 앞에서 한 번 더 묻는다.
 *
 * window.confirm을 쓰지 않는 이유: 무엇이 사라지는지 적을 자리가 없고,
 * 앱(웹뷰)에서는 주소가 제목으로 찍혀 나온다.
 *
 * 확인을 누르면 끝날 때까지 기다린다. 실패하면 시트를 닫지 않고 이유를
 * 보여준다 — 닫아버리면 된 줄 안다.
 */

import { useState, type ReactNode } from 'react';
import { MenuSheet } from '@/components/MenuSheet';
import { useT } from '@/i18n';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** 지우기·나가기처럼 되돌릴 수 없으면 빨간 버튼 */
  danger?: boolean;
  onConfirm(): Promise<void>;
  onClose(): void;
}

export function ConfirmSheet({
  title,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.failed);
      setBusy(false);
    }
  };

  return (
    // 도는 중에는 바깥을 눌러도 닫지 않는다 — 결과를 못 보고 지나간다
    <MenuSheet open onClose={busy ? () => {} : onClose} label={title}>
      <div className="form confirm">
        <div className="confirm__title">{title}</div>
        <div className="confirm__body">{children}</div>

        {error && <p className="form__hint form__hint--error">{error}</p>}

        <div className="form__actions">
          <button
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? t.common.processing : confirmLabel}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </button>
        </div>
      </div>
    </MenuSheet>
  );
}
