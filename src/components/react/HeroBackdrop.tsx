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
//hidden by CSS when `data-atmos="off"`.
import { useEffect, useState } from 'react';
import { BACKDROP_HEROES, heroBackdropUrl, ROTATE_SECS } from '../../lib/heroBackdrop';

export default function HeroBackdrop() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (BACKDROP_HEROES.length < 2) return;
    //honor reduced-motion: keep the first hero, don't cycle.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    //preload the roster so each rotation is seamless (one-time, decode in bg).
    for (const h of BACKDROP_HEROES) {
      const img = new Image();
      img.src = heroBackdropUrl(h);
    }

    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % BACKDROP_HEROES.length),
      ROTATE_SECS * 1000,
    );
    return () => window.clearInterval(id);
  }, []);

  const hero = BACKDROP_HEROES[idx % BACKDROP_HEROES.length] ?? BACKDROP_HEROES[0];
  return (
    <div className="atmos" aria-hidden="true">
      <div key={hero} className="atmos-bg" style={{ backgroundImage: `url(${heroBackdropUrl(hero)})` }} />
    </div>
  );
}
