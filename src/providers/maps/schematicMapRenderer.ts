/**
 * 개략도 렌더러 — API 키가 없을 때의 폴백.
 *
 * 실제 지도 렌더러와 같은 인터페이스를 구현하는 게 핵심이다. 그래야
 * 화면 코드에 "키 있으면 지도, 없으면 SVG" 같은 분기가 생기지 않는다.
 * MapCanvas는 한 가지 경로만 안다: 렌더러를 mount하고 지점을 넣는다.
 *
 * 지도가 없어도 확인할 수 있는 것: 좌표가 서로 맞는지, 동선 순서가
 * 말이 되는지, 하루 안에서 지점들이 얼마나 퍼져 있는지.
 */

import { normalizePoints } from '@/domain/geo';
import type { MapHandle, MapRenderer, MapStop, MountOptions, PathSegment } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** 0~1 정규화 좌표를 100단위 뷰박스로 옮길 때의 여백 */
const PAD = 12;
/**
 * 아래쪽만 여백을 더 준다. 개략도가 뜨는 상황에서는 그 위에 안내 문구가
 * 가로로 깔리는데(키 없음 / SDK 실패), 기본 여백만으로는 가장 남쪽 지점이
 * 문구 뒤에 숨는다. 서울 → 방콕처럼 남북으로 긴 날에 바로 드러난다.
 */
const PAD_BOTTOM = 26;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function createSchematicMapRenderer(intended: MapRenderer): MapRenderer {
  return {
    id: `schematic:${intended.id}`,
    label: intended.label,
    attribution: '간략 지도',
    configured: false,
    setupHint: intended.setupHint,

    mount(container: HTMLElement, options?: MountOptions): Promise<MapHandle> {
      const svg = el('svg', {
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'xMidYMid meet',
        class: 'mapstage__svg',
      });
      container.appendChild(svg);

      let stops: MapStop[] = [];
      let path: PathSegment[] = [];

      function draw(): void {
        svg.replaceChildren();

        // 배경 격자 — 좌표가 없어도 화면이 비어 보이지 않게
        const defs = el('defs', {});
        const pattern = el('pattern', {
          id: 'schematic-grid',
          width: '8',
          height: '8',
          patternUnits: 'userSpaceOnUse',
        });
        pattern.appendChild(
          el('path', {
            d: 'M8 0H0V8',
            fill: 'none',
            stroke: 'var(--border)',
            'stroke-width': '0.4',
          }),
        );
        defs.appendChild(pattern);
        svg.appendChild(defs);
        svg.appendChild(
          el('rect', { width: '100', height: '100', fill: 'url(#schematic-grid)' }),
        );

        if (stops.length === 0) return;

        // 경로선과 지점을 같은 좌표계로 정규화해야 서로 어긋나지 않는다
        const lineCoords = path.flatMap((segment) => segment.coords);
        const all = [...stops.map((s) => s.coord), ...lineCoords];
        const normalized = normalizePoints(all);
        const spanX = 100 - PAD * 2;
        const spanY = 100 - PAD - PAD_BOTTOM;
        const toXY = (i: number) => ({
          x: PAD + (normalized[i]?.x ?? 0.5) * spanX,
          y: PAD + (normalized[i]?.y ?? 0.5) * spanY,
        });

        /*
         * 개략도는 원래 전체가 점선이었다. 이제 실제 경로가 오는 구간이
         * 생겼으므로 둘을 나눠 그린다 — 실선은 조회된 경로, 점선은 모름.
         */
        let cursor = stops.length;
        for (const segment of path) {
          const points = segment.coords.map((_, i) => toXY(cursor + i));
          cursor += segment.coords.length;
          if (points.length < 2) continue;
          svg.appendChild(
            el('path', {
              d: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
              fill: 'none',
              stroke: 'var(--accent)',
              'stroke-width': '1.4',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              ...(segment.dashed ? { 'stroke-dasharray': '3 2.2' } : {}),
            }),
          );
        }

        stops.forEach((stop, i) => {
          const p = toXY(i);
          const group = el('g', { class: 'schematic-stop' });
          const circle = el('circle', {
            cx: String(p.x),
            cy: String(p.y),
            r: '3.1',
            fill: 'var(--accent)',
          });
          const text = el('text', {
            x: String(p.x),
            y: String(p.y + 1.05),
            'font-size': '3',
            'font-weight': '700',
            'text-anchor': 'middle',
            fill: 'var(--accent-text)',
          });
          text.textContent = stop.label;
          group.appendChild(circle);
          group.appendChild(text);

          const onClick = options?.onStopClick;
          if (onClick) {
            group.style.cursor = 'pointer';
            group.addEventListener('click', () => onClick(stop.id));
          }

          const title = el('title', {});
          title.textContent = stop.title;
          group.appendChild(title);

          svg.appendChild(group);
        });
      }

      draw();

      return Promise.resolve({
        setStops(next: MapStop[]): void {
          stops = next;
          draw();
        },
        setPath(segments: PathSegment[]): void {
          path = segments;
          draw();
        },
        fit(): void {
          // 개략도는 항상 전체를 보여주므로 할 일이 없다
        },
        destroy(): void {
          svg.remove();
          stops = [];
          path = [];
        },
      });
    },
  };
}
