/**
 * 로그인.
 *
 * 친구를 초대해 같이 고치려면 "누가 고쳤는지"가 있어야 하고, 그러려면 계정이
 * 필요하다. 그 이상은 받지 않는다 — 닉네임 하나로 쓸 수 있게 한다.
 */

import { hasBackend, type SignInMethod } from '@/auth';
import { AppleIcon, GoogleIcon } from '@/components/icons';
import { useAuthStore } from '@/store/authStore';

const METHOD_LABEL: Record<SignInMethod, string> = {
  google: 'Google로 계속하기',
  apple: 'Apple로 계속하기',
  dev: '개발용 계정으로 둘러보기',
};

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

  return (
    <div className="app">
      <main className="main main--no-tabs signin">
        <div className="signin__brand">
          <span className="signin__mark">🧳</span>
          <h1 className="signin__title">TravelTomodachi</h1>
          <p className="signin__sub">친구들과 함께 만드는 여행 일정</p>
        </div>

        {/*
          초대받아 온 사람은 이 앱을 처음 본다. 왜 로그인해야 하는지 모르면
          그냥 닫는다. 로그인하면 바로 그 여행에 들어간다는 걸 먼저 말해준다.
        */}
        {invited && (
          <p className="signin__invited">
            여행에 초대받았습니다. 로그인하면 바로 그 일정으로 들어갑니다.
          </p>
        )}

        <div className="signin__methods">
          {methods.map((method) => (
            <button
              key={method}
              className={`btn${method === 'dev' ? '' : ' btn--primary'}`}
              onClick={() => void signIn(method)}
            >
              <MethodIcon method={method} />
              {METHOD_LABEL[method]}
            </button>
          ))}
        </div>

        {error && <p className="signin__error">{error}</p>}

        {/*
          이게 진짜 로그인이 아니라는 걸 숨기지 않는다. 진짜처럼 보이면
          친구를 초대했는데 아무 일도 안 일어나는 이유를 못 찾게 된다.
        */}
        {!hasBackend && (
          <p className="signin__note">
            아직 백엔드가 연결되지 않아 <strong>이 브라우저에만</strong> 세션이 남습니다.
            친구 초대와 공동 편집은 Supabase를 연결한 뒤에 동작합니다.
          </p>
        )}

        <p className="signin__privacy">
          닉네임 외에는 아무것도 저장하지 않습니다. 이메일과 실명은 받지 않습니다.
        </p>
      </main>
    </div>
  );
}
