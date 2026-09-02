//Hero-art backdrop island — the baked `data-atmos="hero"` parameter from the
//Claude design (ranklock-app: app.jsx backdrop + data.jsx heroBg). Renders the
//fixed `.atmos` layer of Deadlock hero splash art and rotates it through the
//roster every ROTATE_SECS, crossfading via the `.atmos-bg` `bgfade` animation in
//styles/base.css (changing the React key remounts the layer → the fade replays).
//
//SSR renders the first hero, so pre-hydration / no-JS visitors still get a static
//backdrop and there is no flash. The client preloads the roster, then starts the
//interval on mount. Under prefers-reduced-motion the layer stays on the first hero
//and never cycles (the fade is also disabled in CSS). Mounted once in BaseLayout;
//hidden by CSS when `data-atmos="off"`. A `hero` prop pins that one plate (hero
//pages): no rotation, no roster preload.
import { useEffect, useState, type CSSProperties } from 'react';
import { BACKDROP_HEROES, BACKDROP_SMALL_MQ, heroBackdropArt, ROTATE_SECS } from '../../lib/heroBackdrop';

interface Props {
  hero?: string;
}

export default function HeroBackdrop({ hero: pinned }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (pinned || BACKDROP_HEROES.length < 2) return;
    //honor reduced-motion: keep the first hero, don't cycle.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    //preload the roster so rotations never flash (one-time, decode in bg);
    //the plate preloaded is the one the .atmos-bg media query will paint.
    const narrow = window.matchMedia?.(BACKDROP_SMALL_MQ).matches;
    for (const h of BACKDROP_HEROES) {
      const art = heroBackdropArt(h);
      const img = new Image();
      img.src = (narrow && art.smallUrl) || art.url;
    }

    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % BACKDROP_HEROES.length),
      ROTATE_SECS * 1000,
    );
    return () => window.clearInterval(id);
  }, [pinned]);

  const hero = pinned ?? BACKDROP_HEROES[idx % BACKDROP_HEROES.length] ?? BACKDROP_HEROES[0];
  const art = heroBackdropArt(hero);
  //--atmos-bg always paints; --atmos-bg-sm (our base only) feeds the narrow
  //media query in base.css — background-image only, zero layout change.
  const style = {
    '--atmos-bg': `url(${art.url})`,
    ...(art.smallUrl ? { '--atmos-bg-sm': `url(${art.smallUrl})` } : {}),
  } as CSSProperties;
  return (
    <div className="atmos" aria-hidden="true">
      <div key={hero} className="atmos-bg" style={style} />
    </div>
  );
}
