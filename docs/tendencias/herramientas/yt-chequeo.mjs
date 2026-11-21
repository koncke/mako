// Chequeo liviano de canales de YouTube: existe, título, channelId y sus últimos 15 videos (RSS: fecha y vistas).
// Uso: node yt-chequeo.mjs salida.json @handle1 @handle2 ...   (sólo lectura; sin claves)
import fs from 'node:fs';
const [salida, ...handles] = process.argv.slice(2);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', 'Accept-Language': 'es-ES,es;q=0.9' };
const hoy = Date.now();
const out = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8')) : {};
for (const h0 of handles) {
  const h = h0.startsWith('@') || h0.startsWith('UC') ? h0 : '@' + h0;
  const url = h.startsWith('UC') ? `https://www.youtube.com/channel/${h}` : `https://www.youtube.com/${h}`;
  try {
    const r = await fetch(url, { headers: UA });
    if (r.status !== 200) { out[h] = { ok: false, status: r.status }; console.log(h, r.status); continue; }
    const html = await r.text();
    const cid = (html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/channel_id=(UC[\w-]{22})/) || [])[1];
    const titulo = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
    const subs = (html.match(/"metadataParts":\[\{"text":\{"content":"[^"]*"\}\},\{"text":\{"content":"([^"]*suscriptores[^"]*)"/) || html.match(/([\d.,]+\s*(?:mil|M)?\s*(?:de )?suscriptores)/) || [])[1];
    let ultimos = [];
    if (cid) {
      const x = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, { headers: UA })).text();
      for (const e of x.split('<entry>').slice(1)) {
        ultimos.push({
          id: (e.match(/<yt:videoId>([^<]+)/) || [])[1],
          fecha: ((e.match(/<published>([^<]+)/) || [])[1] || '').slice(0, 10),
          vistas: +((e.match(/views="(\d+)"/) || [])[1] || 0),
          titulo: (e.match(/<title>([^<]*)/) || [])[1],
        });
      }
    }
    const dias = (f) => (hoy - Date.parse(f)) / 864e5;
    out[h] = { ok: true, titulo, cid, subs, ultimo: ultimos[0]?.fecha, en90: ultimos.filter((u) => dias(u.fecha) <= 90).length, ultimos };
    console.log(h, titulo, subs || '', 'último', ultimos[0]?.fecha, 'en90(de15)', out[h].en90);
  } catch (e) { out[h] = { ok: false, error: String(e) }; console.log(h, 'ERROR', e.message); }
  await new Promise((r) => setTimeout(r, 700));
}
fs.writeFileSync(salida, JSON.stringify(out, null, 1));
