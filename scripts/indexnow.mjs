//IndexNow submission: pushes the sitemap's URL list to Bing, Yandex, Seznam and Naver
//in one call. Google does not participate; its path is the Search Console API.
//Usage: node scripts/indexnow.mjs [--dry]
const KEY = '097a20bce65e537184ab6b5e891aff85d4b81247bcf0c5d4f0b728b79ada18e8';
const HOST = 'ranklock.app';
const ORIGIN = `https://${HOST}`;

const sitemap = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error('sitemap returned no <loc> entries; refusing to submit');
  process.exit(1);
}

const keyLive = await fetch(`${ORIGIN}/${KEY}.txt`);
if (!keyLive.ok || (await keyLive.text()).trim() !== KEY) {
  console.error(`key file ${ORIGIN}/${KEY}.txt is not serving the key (HTTP ${keyLive.status}); deploy first`);
  process.exit(1);
}

console.log(`submitting ${urls.length} urls`);
if (process.argv.includes('--dry')) process.exit(0);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`IndexNow HTTP ${res.status} ${res.statusText}`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
