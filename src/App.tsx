import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getAuthProvider } from '@/auth';
import { useAuthStore } from '@/store/authStore';
import { HomeScreen } from '@/screens/HomeScreen';
import { TripScreen } from '@/screens/TripScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import { ItemEditScreen } from '@/screens/ItemEditScreen';
import { MapScreen } from '@/screens/MapScreen';
import { ChecklistScreen } from '@/screens/ChecklistScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SignInScreen } from '@/screens/SignInScreen';

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

export function App() {
  const loading = useAuthStore((s) => s.loading);
  const account = useAuthStore((s) => s.account);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  /*
   * 세션 복구가 끝나기 전에는 아무것도 결정하지 않는다. 바로 로그인 화면을
   * 띄우면 이미 로그인한 사람에게도 한 번 깜빡이고 지나간다.
   */
  if (loading) {
    return (
      <div className="app">
        <main className="main main--no-tabs">
          <p className="empty">불러오는 중…</p>
        </main>
      </div>
    );
  }

  if (!account) {
    return <SignInScreen methods={getAuthProvider().methods} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip/:tripId" element={<TripScreen />} />
        {/* 'new'가 :itemId로 잡히지 않도록 상세보다 먼저 선언한다 */}
        <Route path="/trip/:tripId/item/new" element={<ItemEditRoute />} />
        <Route path="/trip/:tripId/item/:itemId/edit" element={<ItemEditRoute />} />
        <Route path="/trip/:tripId/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="/trip/:tripId/map" element={<MapScreen />} />
        <Route path="/trip/:tripId/checklist" element={<ChecklistScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
