import type { APIRoute } from 'astro';
import { adsenseClient, adsenseConfigured } from '../lib/ads';

//ads.txt (C9). Emits the AdSense authorization line when a publisher id was
//injected at build time; otherwise a single inert comment line so the route
//stops 404ing without authorizing any account. Generated at BUILD (prerender).
export const prerender = true;

export const GET: APIRoute = () => {
  const body = adsenseConfigured()
    ? `google.com, ${adsenseClient()}, DIRECT, f08c47fec0942fa0\n`
    : '# ads.txt inactive: PUBLIC_ADSENSE_CLIENT not set at build time\n';
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
