/**
 * 데이터 출처 표시.
 *
 * 장식이 아니라 **라이선스 의무**다.
 *   - OSM 데이터는 ODbL. 저작자 표시를 빼면 라이선스 위반이다.
 *   - Transitous는 각 교통기관 GTFS를 모은 것이라, 자기네 출처 페이지로
 *     링크할 것을 사용 조건에 걸어두었다.
 *   - Photon·Valhalla도 OSM 기반이라 같은 표시로 덮인다.
 *
 * 그래서 문구를 줄이더라도 링크는 남겨야 한다. 지도 위 attribution은 타일에
 * 대한 것이고, 검색·길찾기·대중교통은 여기서 밝힌다.
 */

import { useT } from '@/i18n';
import { platform } from '@/platform';

interface Credit {
  /** 어디에 쓰이는지 — 사용자가 "그래서 뭐가 이걸 쓰는데?"를 알 수 있게 */
  use: string;
  name: string;
  url: string;
}

export function DataCredits() {
  const t = useT();
  const credits: Credit[] = [
    {
      use: t.credits.searchUse,
      name: t.credits.osm,
      url: 'https://www.openstreetmap.org/copyright',
    },
    {
      use: t.credits.transitUse,
      name: t.credits.transitous,
      url: 'https://transitous.org/sources/',
    },
  ];

  return (
    <section className="credits">
      <h2 className="credits__title">{t.credits.title}</h2>
      <ul className="credits__list">
        {credits.map((credit) => (
          <li key={credit.url} className="credits__row">
            <span className="credits__use">{credit.use}</span>
            {/*
              a 태그 대신 버튼인 이유 — Capacitor 제약 #5.
              네이티브에서 외부 링크를 그냥 열면 앱 웹뷰 안에서 페이지가 바뀌어
              돌아올 길이 없어진다. platform 뒤로 보내 시스템 브라우저로 연다.
            */}
            <button className="credits__link" onClick={() => platform.openExternal(credit.url)}>
              {credit.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
