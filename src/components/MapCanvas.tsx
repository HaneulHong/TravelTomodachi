import { useEffect, useMemo, useRef, useState } from 'react';
import { SHOW_DEV_HINTS } from '@/config';
import { useT } from '@/i18n';
import { createSchematicMapRenderer } from '@/providers';
import type { MapHandle, MapRenderer, MapStop, PathSegment } from '@/providers';

interface Props {
  renderer: MapRenderer;
  stops: MapStop[];
  path: PathSegment[];
  onStopClick?(stopId: string): void;
}

type Status = 'loading' | 'ready' | 'error';

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 지도 렌더러를 React 생애주기에 붙인다.
 *
 * SDK는 자기 DOM을 직접 관리하므로, 마운트는 딱 한 번만 하고 이후에는
 * 명령형 핸들로 갱신한다. 지점 목록을 의존성에 넣고 매번 remount 하면
 * 날짜를 넘길 때마다 지도가 하얗게 깜빡인다.
 *
 * StrictMode는 개발 중 effect를 두 번 실행한다. cancelled 플래그와
 * destroy()가 그 이중 실행을 흡수한다 — SDK 스크립트 자체는
 * 렌더러 쪽에서 모듈 레벨로 캐시되므로 두 번 내려받지 않는다.
 */
export function MapCanvas({ renderer, stops, path, onStopClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const t = useT();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  /**
   * 실제 SDK가 실패한 기록. 렌더러 id를 같이 들고 있는 이유는, 지역이 바뀌어
   * 렌더러가 교체되면 그 실패는 더 이상 유효하지 않기 때문이다. 별도의 리셋
   * effect를 두면 새 렌더러를 한 번 마운트했다가 되돌리는 깜빡임이 생긴다.
   */
  const [failure, setFailure] = useState<{ rendererId: string; reason: string } | null>(null);
  const fallbackReason = failure?.rendererId === renderer.id ? failure.reason : null;

  /**
   * 실제로 화면에 띄울 렌더러. SDK가 실패했으면 개략도로 한 단계 내려간다.
   * useMemo가 필요한 이유는 아래 mount effect의 의존성이라서다 — 매 렌더마다
   * 새 객체가 나오면 지도를 계속 다시 마운트한다.
   */
  const active = useMemo(
    () => (fallbackReason ? createSchematicMapRenderer(renderer) : renderer),
    [renderer, fallbackReason],
  );

  // 콜백이 매 렌더마다 새로 만들어져도 지도를 다시 만들지 않도록 ref에 담는다
  const clickRef = useRef(onStopClick);
  clickRef.current = onStopClick;

  /**
   * SDK 실패 처리. 실제 렌더러였다면 개략도로 떨어뜨리고, 개략도마저
   * 실패한 경우에만 에러 화면을 보여준다.
   */
  const failRef = useRef<(err: unknown) => void>(() => {});
  failRef.current = (err: unknown) => {
    const message = err instanceof Error ? err.message : '지도를 불러오지 못했습니다';
    if (!fallbackReason && renderer.configured) {
      setFailure({ rendererId: renderer.id, reason: message });
      return;
    }
    setError(message);
    setStatus('error');
  };

  /**
   * 지도에 현재 지점·경로를 밀어넣는다.
   *
   * 최신 값을 ref로 읽는 이유: 이 함수를 mount 직후에도 호출해야 하는데,
   * 그 시점의 클로저에 잡힌 값이 아니라 지금 화면에 해당하는 값을 써야 한다.
   */
  const dataRef = useRef({ stops, path });
  dataRef.current = { stops, path };

  const applyRef = useRef<(handle: MapHandle) => void>(() => {});
  applyRef.current = (handle: MapHandle) => {
    try {
      handle.setStops(dataRef.current.stops);
      handle.setPath(dataRef.current.path);
      handle.fit();
    } catch (err: unknown) {
      // SDK가 mount는 통과했는데 내부 초기화에 실패한 경우가 있다.
      // 예: Google에서 Maps JavaScript API가 비활성이면 지도 객체는 만들어지지만
      // AdvancedMarkerElement 생성이 여기서 던진다.
      // effect에서 그대로 터뜨리면 React가 트리를 통째로 언마운트해서
      // 지도뿐 아니라 앱 전체가 하얗게 죽는다.
      failRef.current(err);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus('loading');
    setError(null);

    /**
     * 마운트마다 표면(div)을 새로 만들어 붙인다. 컨테이너를 그대로 재사용하면
     * 안 되는 이유는 카카오 SDK에 지도를 파기하는 API가 없기 때문이다. destroy()로
     * 마커와 선은 치울 수 있어도 kakao.maps.Map 인스턴스 자체는 살아남아서,
     * 자기가 물고 있는 엘리먼트에 계속 타일을 다시 그린다. 게다가 컨테이너의
     * 인라인 style에 배경 타일 이미지까지 심어두기 때문에 자식만 지워서는
     * 흔적이 남는다. 컨테이너를 공유하면 그 죽은 지도가 다음에 올라온 Google
     * 지도 위에 타일을 덮어버린다 (attribution은 © Google인데 화면에는
     * kakaomap 워터마크가 찍히는 증상).
     * 표면을 통째로 떼어내면 그 노드가 문서에서 빠지므로 덮어쓸 수 없다.
     */
    const surface = document.createElement('div');
    surface.className = 'mapstage__surface';
    container.appendChild(surface);

    active
      .mount(surface, {
        dark: prefersDark(),
        onStopClick: (id) => clickRef.current?.(id),
        // mount 이후에 비동기로 날아오는 실패 (예: Google 인증 거부)
        onFailure: (err) => {
          if (cancelled) return;
          failRef.current(err);
        },
      })
      .then((handle) => {
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        // 갓 올라온 지도를 여기서 바로 채운다. 아래 갱신 effect에만 맡기면
        // 렌더러가 교체돼도 stops/path 참조가 그대로인 경우(지역만 바뀐 게
        // 아니라 실패해서 개략도로 내려온 경우가 그렇다) 의존성이 변하지
        // 않아 effect가 다시 돌지 않고, 새 지도가 빈 채로 남는다.
        applyRef.current(handle);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        failRef.current(err);
      });

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
      // 표면을 통째로 떼어낸다. 이 안에 SDK가 만든 DOM이 전부 들어 있으므로
      // StrictMode 이중 마운트에서 지도가 두 겹으로 쌓이지도 않는다.
      surface.remove();
    };
  }, [active]);

  // 지점·경로 갱신은 remount 없이
  useEffect(() => {
    if (status !== 'ready') return;
    const handle = handleRef.current;
    if (!handle) return;
    applyRef.current(handle);
  }, [status, stops, path]);

  return (
    <div className="mapstage">
      <div className="mapstage__canvas" ref={containerRef} />

      {status === 'loading' && active.configured && (
        <div className="mapstage__overlay">{t.map.loading}</div>
      )}

      {status === 'error' && (
        <div className="mapstage__overlay mapstage__overlay--error">
          <strong>{t.map.failed}</strong>
          {/* 원인 문구에는 키·리퍼러 같은 설정 얘기가 들어 있어 개발 중에만 */}
          {SHOW_DEV_HINTS && <span>{error}</span>}
        </div>
      )}

      {/*
        배포된 서비스에서는 설정법 대신 "간략 지도로 보여준다"만 말한다.
        사용자가 할 수 있는 일이 없는데 환경변수 이름을 보여줘 봐야 불안만 준다.
      */}
      {!SHOW_DEV_HINTS && (fallbackReason || !renderer.configured) && (
        <div className="mapstage__note">{t.map.fallback}</div>
      )}

      {/* SDK가 실패해서 내려온 경우: 키는 있으니 환경변수 안내는 맞지 않는다 */}
      {SHOW_DEV_HINTS && fallbackReason && (
        <div className="mapstage__note">
          개략도입니다. <strong>{renderer.label}</strong> 타일을 불러오지 못했습니다 —{' '}
          {fallbackReason} 동선과 순서는 아래에서 그대로 확인할 수 있습니다. 설정 확인은{' '}
          <code>docs/MAP_SETUP.md</code>를 보세요.
        </div>
      )}

      {/* 키가 없을 때: 개략도가 그려진 위에 무엇을 설정해야 하는지 알려준다 */}
      {SHOW_DEV_HINTS && !fallbackReason && !renderer.configured && (
        <div className="mapstage__note">
          개략도입니다. 실제 지도는 <strong>{renderer.label}</strong>으로 렌더링됩니다 —{' '}
          {renderer.setupHint && <code>{renderer.setupHint}</code>} 환경변수를 설정하세요.
          발급 방법은 <code>docs/MAP_SETUP.md</code>에 있습니다.
        </div>
      )}

      {/* 지도는 떴지만 일부가 조용히 빠진 경우 (예: Map ID 누락 → 마커 없음) */}
      {SHOW_DEV_HINTS && !fallbackReason && active.configured && status === 'ready' && renderer.warning && (
        <div className="mapstage__note mapstage__note--warn">⚠ {renderer.warning}</div>
      )}

      {active.configured && status === 'ready' && (
        <div className="mapstage__attr">
          {/* 간략 지도의 표시는 출처가 아니라 설명이라 화면 언어로 */}
          {active.id.startsWith('schematic') ? t.map.schematic : active.attribution}
        </div>
      )}
    </div>
  );
}
