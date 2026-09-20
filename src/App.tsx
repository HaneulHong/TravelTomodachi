import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomeScreen } from '@/screens/HomeScreen';
import { TripScreen } from '@/screens/TripScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import { ItemEditScreen } from '@/screens/ItemEditScreen';
import { MapScreen } from '@/screens/MapScreen';
import { ChecklistScreen } from '@/screens/ChecklistScreen';

/**
 * HashRouter를 쓰는 이유 — Capacitor 전환 제약 #1·#2.
 *
 * 네이티브 웹뷰에서는 index.html이 로컬에서 로드되므로 서버가 모든 경로를
 * index.html로 되돌려주는 동작을 기대할 수 없다. BrowserRouter는 환경에 따라
 * 새로고침·딥링크에서 404가 되고, 해시 라우팅은 어디서든 동일하게 동작한다.
 * 웹에서 경로를 깔끔하게 만들고 싶어지면 그때 웹 전용으로 바꾸면 되지만,
 * 앱까지 하나로 가려면 해시가 안전하다.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip/:tripId" element={<TripScreen />} />
        {/* 'new'가 :itemId로 잡히지 않도록 상세보다 먼저 선언한다 */}
        <Route path="/trip/:tripId/item/new" element={<ItemEditScreen />} />
        <Route path="/trip/:tripId/item/:itemId/edit" element={<ItemEditScreen />} />
        <Route path="/trip/:tripId/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="/trip/:tripId/map" element={<MapScreen />} />
        <Route path="/trip/:tripId/checklist" element={<ChecklistScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
