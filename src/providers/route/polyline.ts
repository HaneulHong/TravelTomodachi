/**
 * encoded polyline 해독.
 *
 * ── 비트 연산을 쓰지 않는다 ──────────────────────────────────────
 * 흔히 보이는 구현은 `result |= (byte & 0x1f) << shift`로 누적하는데,
 * 자바스크립트의 비트 연산은 **32비트 정수**로 잘린다. 정밀도 7이면
 * 경도 126.5가 1,265,000,000이 되고 지그재그로 한 번 더 2배가 되어
 * 2,530,000,000 — 2^31(2,147,483,647)을 넘는다. 그 순간 부호 비트를
 * 침범해서 경도가 음수로 뒤집힌다.
 *
 * 실제로 제주(126.5)가 미국(-88.5)으로 찍혔다. 위도(33)는 값이 절반이라
 * 넘지 않아 멀쩡했고, 그래서 "위도만 맞는" 이상한 증상이 나왔다.
 * 그 좌표가 지도 범위 계산에 들어가면서 지도가 통째로 하얗게 죽었다.
 *
 * 정밀도 6(Valhalla)은 최대 180e6 × 2 = 3.6억이라 여유가 있어 비트 연산으로도
 * 돌아간다. 그래도 같은 함수를 쓴다 — 정밀도가 바뀌는 순간 다시 걸릴 함정을
 * 프로바이더마다 따로 들고 있을 이유가 없다.
 */

import type { Coord } from '@/domain/types';

export function decodePolyline(encoded: string, precision: number): Coord[] {
  const factor = 10 ** precision;
  const points: Coord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  function readDelta(): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      // << 대신 곱셈 — 32비트로 잘리지 않는다
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20);

    // 지그재그 해제도 산술로 (result & 1, result >> 1은 다시 32비트가 된다)
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  }

  while (index < encoded.length) {
    lat += readDelta();
    lng += readDelta();
    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}
