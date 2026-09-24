import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getAuthProvider } from '@/auth';
import { shouldAskNickname } from '@/auth/onboarding';
import {
  inviteCodeFromAppUrl,
  inviteCodeFromHash,
  stashInvite,
  takeStashedInvite,
} from '@/auth/pendingInvite';
import { platform } from '@/platform';
import { APP_SCHEME } from '@/platform/native';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useTripStore } from '@/store/tripStore';
import { HomeScreen } from '@/screens/HomeScreen';
import { TripScreen } from '@/screens/TripScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import { ItemEditScreen } from '@/screens/ItemEditScreen';
import { MapScreen } from '@/screens/MapScreen';
import { MembersScreen } from '@/screens/MembersScreen';
import { ChecklistScreen } from '@/screens/ChecklistScreen';
import { ExpensesScreen } from '@/screens/ExpensesScreen';
import { InviteScreen } from '@/screens/InviteScreen';
import { NicknameSetupScreen } from '@/screens/NicknameSetupScreen';
import { OfflineBar } from '@/components/OfflineBar';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { UnavailableScreen } from '@/screens/UnavailableScreen';
import { hasBackend } from '@/supabase/client';
import { TripCreateScreen } from '@/screens/TripCreateScreen';

/**
 * HashRouter를 쓰는 이유 — Capacitor 전환 제약 #1·#2.
 *
 * 네이티브 웹뷰에서는 index.html이 로컬에서 로드되므로 서버가 모든 경로를
 * index.html로 되돌려주는 동작을 기대할 수 없다. BrowserRouter는 환경에 따라
 * 새로고침·딥링크에서 404가 되고, 해시 라우팅은 어디서든 동일하게 동작한다.
 * 웹에서 경로를 깔끔하게 만들고 싶어지면 그때 웹 전용으로 바꾸면 되지만,
 * 앱까지 하나로 가려면 해시가 안전하다.
 */
/**
 * 편집 화면을 항목마다 새로 만든다.
 *
 * 두 라우트가 같은 컴포넌트를 가리키기 때문에, 수정 화면에서 추가 화면으로
 * (또는 다른 항목 수정으로) 넘어가도 React가 같은 인스턴스를 재사용한다.
 * 입력값은 useState 초기값으로 한 번만 읽으므로, 그대로 두면 "일정 추가"를
 * 눌렀는데 직전에 고치던 항목의 내용이 남는다.
 *
 * key를 주면 항목이 바뀔 때 언마운트되고 초기값을 다시 읽는다.
 */
function ItemEditRoute() {
  const { itemId } = useParams();
  return <ItemEditScreen key={itemId ?? 'new'} />;
}

/**
 * 초대 화면을 코드마다 새로 만든다.
 *
 * 편집 화면과 같은 문제다(ItemEditRoute). 주소의 코드만 바뀌면 React가 같은
 * 인스턴스를 재사용해서, 입력칸에는 이전 코드가, 오류에는 이전 실패가 남는다.
 * "한 번만 자동 참가" 가드도 이미 켜진 채라 새 코드로는 시도조차 하지 않는다.
 * 두 번째 초대 링크를 연 사람이 그대로 겪는 상황이다.
 */
function InviteRoute() {
  const { code } = useParams();
  return <InviteScreen key={code ?? 'manual'} />;
}

export function App() {
  const loading = useAuthStore((s) => s.loading);
  const account = useAuthStore((s) => s.account);
  const restore = useAuthStore((s) => s.restore);
  const t = useT();

  const loadTrips = useTripStore((s) => s.load);

  /**
   * 첫 로그인 닉네임 화면을 이번 로그인에서 끝냈는지. 계정이 바뀌면 다시 판단한다.
   * 판단 자체는 auth/onboarding.ts — 여기는 화면을 넘기기만 한다.
   */
  const [nicknameDoneFor, setNicknameDoneFor] = useState<string | null>(null);

  useEffect(() => {
    void restore();
  }, [restore]);

  /*
   * 로그인한 뒤에 읽는다. 로그인 전에 부르면 RLS가 전부 막아 빈 목록이
   * 돌아오고, 그 결과가 "여행이 없습니다"로 화면에 굳는다.
   */
  const subscribeTrips = useTripStore((s) => s.subscribe);

  useEffect(() => {
    if (account) void loadTrips(account.id);
  }, [account, loadTrips]);

  /*
   * 연결이 돌아오면 새로 읽는다. 오프라인 동안은 사본을 보여줬으니(OfflineBar),
   * 친구들이 그사이 고친 것을 받아 와야 한다.
   */
  useEffect(() => {
    if (!account) return;
    const reload = () => void loadTrips(account.id);
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, [account, loadTrips]);

  /*
   * 다른 사람의 변경을 받는다. 로그인한 동안만 구독하고, 로그아웃하면 끊는다 —
   * 안 끊으면 다음 사람이 이 기기로 로그인했을 때 앞사람 몫의 이벤트가 섞인다.
   */
  useEffect(() => {
    if (!account) return;
    return subscribeTrips();
  }, [account, subscribeTrips]);

  /*
   * 초대 링크를 연 사람이 로그인하고 돌아왔으면 그 초대로 다시 보낸다.
   * (왜 필요한지는 auth/pendingInvite.ts)
   */
  useEffect(() => {
    if (!account) return;
    const code = takeStashedInvite();
    if (code) window.location.hash = `#/invite/${encodeURIComponent(code)}`;
  }, [account]);

  /*
   * 앱이 초대 딥링크로 열렸을 때. 로그인돼 있으면 바로 참가 화면으로,
   * 아니면 로그인하는 동안 보관했다가 위의 효과가 꺼내 쓴다.
   */
  useEffect(() => {
    if (!platform.onDeepLink) return;
    return platform.onDeepLink((url) => {
      const code = inviteCodeFromAppUrl(url, APP_SCHEME);
      if (!code) return;
      if (useAuthStore.getState().account) {
        window.location.hash = `#/invite/${encodeURIComponent(code)}`;
      } else {
        stashInvite(code);
      }
    });
  }, []);

  /*
   * 세션 복구가 끝나기 전에는 아무것도 결정하지 않는다. 바로 로그인 화면을
   * 띄우면 이미 로그인한 사람에게도 한 번 깜빡이고 지나간다.
   */
  if (loading) {
    return (
      <div className="app">
        <main className="main main--no-tabs">
          <p className="empty">{t.common.loading}</p>
        </main>
      </div>
    );
  }

  // 배포 빌드인데 백엔드 설정이 빠졌다 — 개발용 목으로 몰래 돌지 않는다
  if (!hasBackend && import.meta.env.PROD) return <UnavailableScreen />;

  if (!account) {
    // 초대 링크로 들어왔다면 로그인 동안 코드를 붙잡아 둔다
    const code = inviteCodeFromHash(window.location.hash);
    if (code) stashInvite(code);
    return <SignInScreen methods={getAuthProvider().methods} invited={Boolean(code)} />;
  }

  if (nicknameDoneFor !== account.id && shouldAskNickname(account)) {
    return (
      <NicknameSetupScreen
        userId={account.id}
        onDone={() => setNicknameDoneFor(account.id)}
      />
    );
  }

  return (
    <HashRouter>
      <OfflineBar />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        {/* 'new'가 :tripId로 잡히지 않도록 먼저 선언한다 */}
        <Route path="/trip/new" element={<TripCreateScreen />} />
        <Route path="/trip/:tripId" element={<TripScreen />} />
        {/* 'new'가 :itemId로 잡히지 않도록 상세보다 먼저 선언한다 */}
        <Route path="/trip/:tripId/item/new" element={<ItemEditRoute />} />
        <Route path="/trip/:tripId/item/:itemId/edit" element={<ItemEditRoute />} />
        <Route path="/trip/:tripId/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="/trip/:tripId/map" element={<MapScreen />} />
        <Route path="/trip/:tripId/checklist" element={<ChecklistScreen />} />
        <Route path="/trip/:tripId/expenses" element={<ExpensesScreen />} />
        <Route path="/trip/:tripId/members" element={<MembersScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/invite" element={<InviteRoute />} />
        <Route path="/invite/:code" element={<InviteRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
