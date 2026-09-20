/**
 * 지도 렌더러 추상화.
 *
 * Google과 카카오는 API 모양이 꽤 다르다 (좌표 리터럴 vs LatLng 인스턴스,
 * zoom vs level, Marker vs CustomOverlay). 화면 코드가 그 차이를 알 필요는
 * 없으므로, 명령형 핸들 하나로 덮는다.
 *
 * 리액트 컴포넌트가 아니라 명령형 핸들인 이유: 지도 SDK는 자기 DOM을
 * 직접 관리한다. 리액트 렌더링 주기에 태우면 마커가 매 렌더마다 재생성되고
 * 지도가 깜빡인다. mount 한 번, 이후 setStops/setPath로 갱신한다.
 */

import type { Coord } from '@/domain/types';

export interface MapStop {
  id: string;
  coord: Coord;
  /** 마커에 표시할 순번 */
  label: string;
  title: string;
  /** 마커 옆에 붙일 짧은 부가 정보 (보통 시각). 없으면 제목만 붙는다. */
  caption?: string;
}

/**
 * 지도에 그릴 선 한 토막.
 *
 * 실선과 점선을 나누는 이유: 둘은 성격이 다른 정보다. 실선은 "길찾기가
 * 돌려준 실제 경로"이고, 점선은 "어떻게 가는지 아직 모른다"는 뜻이다.
 * 같은 모양으로 그리면 직선 구간의 거리가 실제보다 짧아 보여서 일정을
 * 빡빡하게 짜게 된다.
 */
export interface PathSegment {
  coords: Coord[];
  /** true면 점선 — 실제 경로가 아니라 두 점을 이은 직선이다. */
  dashed?: boolean;
}

export interface MapHandle {
  setStops(stops: MapStop[]): void;
  /** 구간 경로선. 실제 경로가 없는 토막은 dashed로 온다. */
  setPath(segments: PathSegment[]): void;
  /** 모든 지점이 보이도록 뷰포트 맞춤 */
  fit(): void;
  destroy(): void;
}

export interface MountOptions {
  onStopClick?(stopId: string): void;
  dark?: boolean;
  /**
   * mount가 끝난 뒤에 SDK가 실패를 알려올 때 호출된다.
   *
   * mount의 Promise rejection만으로는 부족하다. Google은 키가 거부돼도
   * 지도 객체 생성 자체는 성공시키고, 한참 뒤 비동기로 인증 실패를 통보하면서
   * 컨테이너 안에 자기 에러 화면을 그린다. 그래서 화면 쪽에서는 "성공했는데
   * 아무것도 안 보이는" 상태가 된다. 이 콜백이 그 구멍을 메운다.
   */
  onFailure?(err: unknown): void;
}

export interface MapRenderer {
  readonly id: string;
  readonly label: string;
  readonly attribution: string;
  /** API 키가 설정돼 있는지. false면 화면은 개략도로 폴백한다. */
  readonly configured: boolean;
  /** 설정이 빠졌을 때 사용자에게 보여줄 안내 (환경변수 이름 등) */
  readonly setupHint?: string;
  /**
   * 지도는 뜨지만 뭔가 반쪽으로 동작할 때의 경고.
   *
   * configured와 다르다. configured=false는 "지도 자체가 없다"이고,
   * warning은 "지도는 보이는데 일부가 조용히 빠진다"이다. 후자가 더 위험하다 —
   * 화면에 단서가 없으면 콘솔을 열기 전까지 원인을 알 수 없기 때문이다.
   */
  readonly warning?: string;
  mount(container: HTMLElement, options?: MountOptions): Promise<MapHandle>;
}

/**
 * 두 렌더러가 같은 모양의 번호 마커를 쓰도록 공용 DOM 생성.
 *
 * `anchor`가 필요한 이유: 두 SDK가 content를 다른 기준으로 배치한다.
 *   Google AdvancedMarkerElement — content의 **아래쪽 중앙**을 좌표에 맞춘다
 *   카카오 CustomOverlay        — xAnchor/yAnchor로 중앙 정렬을 지정할 수 있다
 * 그래서 Google 쪽만 CSS로 절반 내려줘야 원이 좌표 위에 정확히 앉는다.
 */
export function createPinElement(
  label: string,
  title: string,
  anchor: 'center' | 'bottom' = 'center',
  caption?: string,
): HTMLElement {
  const el = document.createElement('div');
  el.className = anchor === 'bottom' ? 'mappin mappin--anchor-bottom' : 'mappin';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${label}번 지점: ${caption ? `${caption} ` : ''}${title}`);

  const dot = document.createElement('span');
  dot.className = 'mappin__dot';
  dot.textContent = label;
  el.appendChild(dot);

  /*
   * 라벨은 절대배치로 원 밖에 띄운다. 일반 흐름에 넣으면 엘리먼트의 크기가
   * 원보다 커지는데, 두 SDK 모두 **엘리먼트 상자 기준**으로 좌표를 맞추기
   * 때문에(카카오는 xAnchor/yAnchor 비율, Google은 아래쪽 중앙) 원이 실제
   * 좌표에서 밀려난다. 상자는 원 크기 그대로 두는 게 핵심이다.
   */
  const text = document.createElement('span');
  text.className = 'mappin__label';
  if (caption) {
    const time = document.createElement('b');
    time.className = 'mappin__time';
    time.textContent = caption;
    text.appendChild(time);
  }
  text.appendChild(document.createTextNode(title));
  el.appendChild(text);

  return el;
}

/**
 * 경로선 색. 지도 SDK는 CSS 변수를 이해하지 못하므로, 그릴 때마다 현재
 * 테마의 --accent를 계산해서 넘긴다. 색을 파일에 박아두면 테마를 바꿔도
 * 선만 옛날 색으로 남는다.
 */
export function accentColor(): string {
  const fallback = '#b2563a';
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  return value || fallback;
}

/** 지점이 하나뿐이면 fitBounds가 과도하게 확대되므로 이 줌으로 고정 */
export const SINGLE_STOP_ZOOM = 15;
export const FIT_PADDING_PX = 52;
