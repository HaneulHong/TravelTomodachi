/**
 * 로그인.
 *
 * 친구를 초대해 같이 고치려면 "누가 고쳤는지"가 있어야 하고, 그러려면 계정이
 * 필요하다. 그 이상은 받지 않는다 — 닉네임 하나로 쓸 수 있게 한다.
 */

import { hasBackend, type SignInMethod } from '@/auth';
import { AppleIcon, GoogleIcon } from '@/components/icons';
import { versionLabel } from '@/config';
import { Rich } from '@/i18n/Rich';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

function MethodIcon({ method }: { method: SignInMethod }) {
  if (method === 'google') return <GoogleIcon />;
  if (method === 'apple') return <AppleIcon />;
  return null;
}

interface Props {
  methods: readonly SignInMethod[];
  /** 초대 링크로 들어왔는지. 로그인하면 바로 그 여행에 들어간다고 알려준다. */
  invited?: boolean;
}

export function SignInScreen({ methods, invited = false }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const error = useAuthStore((s) => s.error);
  const t = useT();

  return (
    <div className="app">
      <main className="main main--no-tabs signin">
        <div className="signin__brand">
          <span className="signin__mark">🧳</span>
          <h1 className="signin__title">TravelTomodachi</h1>
          <p className="signin__sub">{t.signIn.tagline}</p>
        </div>

        {/*
          초대받아 온 사람은 이 앱을 처음 본다. 왜 로그인해야 하는지 모르면
          그냥 닫는다. 로그인하면 바로 그 여행에 들어간다는 걸 먼저 말해준다.
        */}
        {invited && (
          <p className="signin__invited">{t.signIn.invited}</p>
        )}

        <div className="signin__methods">
          {methods.map((method) => (
            <button
              key={method}
              className={`btn${method === 'dev' ? '' : ' btn--primary'}`}
              onClick={() => void signIn(method)}
            >
              <MethodIcon method={method} />
              {t.signIn.method[method]}
            </button>
          ))}
        </div>

        {error && <p className="signin__error">{error}</p>}

        {/*
          이게 진짜 로그인이 아니라는 걸 숨기지 않는다. 진짜처럼 보이면
          친구를 초대했는데 아무 일도 안 일어나는 이유를 못 찾게 된다.
          (개발 서버에서만 온다 — 배포 빌드는 백엔드가 없으면 UnavailableScreen)
        */}
        {!hasBackend && (
          <p className="signin__note">
            <Rich text={t.signIn.devNote} />
          </p>
        )}

        <p className="signin__privacy">{t.signIn.privacy}</p>

        <p className="signin__version">{versionLabel(t.common.beta)}</p>
      </main>
    </div>
  );
}
