// Junta todas las piezas en C:/dev/tendencias/piezas.jsonl (una por línea) con el mismo formato, de tres orígenes:
//   1. el Spy de producción (C:/dev/tendencias/prod90.json, leído con un GET de sólo lectura a spy_piezas);
//   2. lo ya bajado en C:/dev/referentes-videos/<cuenta>/<id>/ (meta.json + video.info.json; las vistas, del volcado del Spy de
//      Content Machine, porque yt-dlp de Instagram NO trae vistas);
//   3. lo que baje el chat Spy en C:/dev/tendencias/<cuenta>/<id>.info.json (+ vistas.json de la lista del Chrome).
// Cada pieza lleva `medido` (cuándo se leyeron sus números): una pieza medida a los 2 días todavía no juntó sus comentarios.
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'C:/dev/tendencias';
const REF = JSON.parse(fs.readFileSync(`${DIR}/referentes.json`, 'utf8')).referentes;
const porIg = Object.fromEntries(REF.filter((r) => r.instagram).map((r) => [r.instagram.toLowerCase(), r]));
const out = [];
const vistos = new Set();
const fecha = (s) => (s || '').slice(0, 10);
const ymd = (s) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : fecha(s));
const ctaDe = (t) => {
  const m = (t || '').match(/coment(?:a|á|ame|ar|en)\s+(?:la palabra\s+)?[«"“']?([A-ZÁÉÍÓÚÑ0-9]{2,}(?:\s[A-ZÁÉÍÓÚÑ0-9]{2,})?)/) ||
    (t || '').match(/\bcomment\s+[«"“']?([A-Z0-9]{2,})/) || (t || '').match(/\b(?:escrib[ei]|envi[aá]me|m[aá]ndame)\s+(?:la palabra\s+)?[«"“']?([A-ZÁÉÍÓÚÑ0-9]{3,})/);
  return m ? m[1].trim() : null;
};
const meter = (p) => { const k = `${p.red}:${p.id}`; if (vistos.has(k)) return; vistos.add(k); out.push(p); };

// 1. Spy de producción. competidor_id → clave de la lista (los duplicados entre espacios caen en la misma clave).
const COMP = { 5: 'hormozi', 8: 'sofia', 13: 'denborg', 17: 'denborg', 14: 'vilma', 69: 'vilma', 18: 'victor', 23: 'victor', 19: 'leila', 20: 'cristofari',
  21: 'iero', 22: 'titto', 25: 'miner', 27: 'peer', 28: 'cole', 29: 'wendt' };
if (fs.existsSync(`${DIR}/prod90.json`)) {
  for (const p of JSON.parse(fs.readFileSync(`${DIR}/prod90.json`, 'utf8'))) {
    const clave = COMP[p.competidor_id]; if (!clave) continue;
    if (clave === 'sofia' && p.canal === 'instagram') continue; // ese IG es un homónimo (docs/tendencias/referentes.md)
    const texto = [p.titulo, p.texto].filter(Boolean).join('\n');
    meter({ clave, cuenta: clave, red: p.canal, id: p.ref, url: p.url, fecha: fecha(p.publicada_en), medido: fecha(p.metricas_leidas_en), tipo: p.tipo,
      texto, vistas: p.vistas ?? null, me_gusta: p.megusta ?? null, comentarios: p.comentarios ?? null, cta: ctaDe(texto), muestra: [], origen: 'spy-prod' });
  }
}

// 2. Lo ya bajado. Las vistas, del volcado del Spy de Content Machine (mismo id).
const DUMP = 'C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/0ee425c6-e397-47f3-945c-412b6db51178/scratchpad/angulos/spy-dump/spy';
const vistasDump = {};
if (fs.existsSync(DUMP)) for (const f of fs.readdirSync(DUMP)) {
  try { const o = JSON.parse(fs.readFileSync(path.join(DUMP, f), 'utf8')); const id = f.replace(/\.json$/, '').replace(/^[a-z]+-/, ''); if (o.vistas) vistasDump[id] = o.vistas; } catch {}
}
const BAJ = { ramiro: 'ramiro', carrizo: 'carrizo', doglio: 'doglio', collado: 'collado', herasmedia: 'victor', victor: 'victor', hormozi: 'hormozi', dakota: 'dakota' };
for (const [carpeta, clave] of Object.entries(BAJ)) {
  const base = `C:/dev/referentes-videos/${carpeta}`; if (!fs.existsSync(base)) continue;
  for (const id of fs.readdirSync(base)) {
    const fi = path.join(base, id, 'video.info.json'), fm = path.join(base, id, 'meta.json');
    if (!fs.existsSync(fi)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(fi, 'utf8')); } catch { continue; }
    const m = fs.existsSync(fm) ? JSON.parse(fs.readFileSync(fm, 'utf8')) : {};
    const texto = m.caption || j.description || j.title || '';
    meter({ clave, cuenta: carpeta, red: 'instagram', id, url: j.webpage_url || `https://www.instagram.com/p/${id}/`, fecha: ymd(j.upload_date),
      medido: j.epoch ? new Date(j.epoch * 1000).toISOString().slice(0, 10) : null, tipo: m.tipo || 'reel', texto,
      vistas: vistasDump[id] ?? m.vistas ?? null, me_gusta: j.like_count ?? null, comentarios: j.comment_count ?? null,
      cta: ctaDe(texto) || m.cta || null, muestra: (j.comments || []).map((c) => ({ texto: c.text, fecha: c.timestamp ? new Date(c.timestamp * 1000).toISOString().slice(0, 10) : null })),
      transcripcion: m.transcripcion ? String(m.transcripcion).slice(0, 1500) : undefined, origen: 'bajado' });
  }
}

// 3. Lo que baje el chat Spy: C:/dev/tendencias/<cuenta>/*.info.json (+ <cuenta>/vistas.json: {"<id>": vistas} de la lista del Chrome).
for (const carpeta of fs.readdirSync(DIR)) {
  const base = path.join(DIR, carpeta);
  if (!fs.statSync(base).isDirectory() || carpeta === 'herramientas') continue;
  const clave = porIg[carpeta.toLowerCase()]?.clave || REF.find((r) => r.clave === carpeta)?.clave; if (!clave) continue;
  const vistas = fs.existsSync(path.join(base, 'vistas.json')) ? JSON.parse(fs.readFileSync(path.join(base, 'vistas.json'), 'utf8')) : {};
  for (const f of fs.readdirSync(base).filter((x) => x.endsWith('.info.json'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(base, f), 'utf8')); } catch { continue; }
    if (!j || typeof j !== 'object') continue; // publicación restringida: yt-dlp devuelve null, no un error
    const red = /youtube/.test(j.extractor || '') ? 'youtube' : 'instagram';
    const texto = [j.title && red === 'youtube' ? j.title : null, j.description].filter(Boolean).join('\n');
    meter({ clave, cuenta: carpeta, red, id: j.id, url: j.webpage_url, fecha: ymd(j.upload_date), medido: j.epoch ? new Date(j.epoch * 1000).toISOString().slice(0, 10) : null,
      tipo: red === 'youtube' ? ((j.duration ?? 999) <= 180 ? 'short' : 'video') : (j._type === 'playlist' ? 'carrusel' : 'reel'),
      texto, vistas: j.view_count ?? vistas[j.id] ?? null, me_gusta: j.like_count ?? null, comentarios: j.comment_count ?? null, cta: ctaDe(texto),
      muestra: (j.comments || []).map((c) => ({ texto: c.text, fecha: c.timestamp ? new Date(c.timestamp * 1000).toISOString().slice(0, 10) : null })), origen: 'tendencias' });
  }
}
const nombre = Object.fromEntries(REF.map((r) => [r.clave, r.nombre]));
for (const p of out) p.referente = nombre[p.clave] || p.clave;
fs.writeFileSync(`${DIR}/piezas.jsonl`, out.map((p) => JSON.stringify(p)).join('\n'));
const r = {}; for (const p of out) { const k = `${p.clave}|${p.red}`; r[k] = (r[k] || 0) + 1; }
console.log(out.length, 'piezas'); console.log(r);
