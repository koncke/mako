// Junta los candidatos de la ronda 2 (C:/dev/tendencias/candidatos-*.json) en referentes-extra.json, sin repetir a nadie de la lista
// (por Instagram o YouTube) y sin los de confianza baja que no tienen ni Instagram ni un YouTube activo. Después: node referentes.mjs
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const base = JSON.parse(fs.readFileSync(`${DIR}/referentes.json`, 'utf8')).referentes.filter((r) => r.fuente !== 'w' || !r.nota?.startsWith('ronda 2'));
const yt = fs.existsSync(`${DIR}/yt-candidatos.json`) ? JSON.parse(fs.readFileSync(`${DIR}/yt-candidatos.json`, 'utf8')) : {};
const norm = (s) => (s || '').toLowerCase().replace(/^@/, '').trim();
const ya = new Set(base.flatMap((r) => [norm(r.instagram), norm(r.youtube)]).filter(Boolean));
const SECTOR = (c) => {
  const s = (c.sector || '').toLowerCase(), sub = (c.subsector || '').toLowerCase();
  if (s.startsWith('ia') || sub) {
    if (/edici/.test(sub)) return 'IA · Edición con IA';
    if (/carrusel|diseñ/.test(sub)) return 'IA · Carruseles con IA';
    if (/avatar|video/.test(sub)) return 'IA · Avatares y video con IA';
    return 'IA · Agentes y setters con IA';
  }
  if (/anunc/.test(s)) return 'Anuncios';
  if (/closing|venta/.test(s)) return 'Closing y ventas';
  if (/high/.test(s)) return 'High ticket';
  if (/low/.test(s)) return 'Low ticket';
  if (/viral/.test(s)) return 'Orgánico viral';
  if (/nicho/.test(s)) return 'Orgánico de nicho';
  if (/youtube/.test(s)) return 'YouTube';
  if (/mental|coach/.test(s)) return 'Mentalidad y coaching';
  return null;
};
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
const extra = [], descartados = [];
for (const f of fs.readdirSync(DIR).filter((x) => /^candidatos-.*\.json$/.test(x))) {
  for (const c of JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'))) {
    const ig = norm(c.instagram), y = c.youtube && /^@/.test(c.youtube.trim()) ? c.youtube.trim() : null;
    const sector = SECTOR(c);
    const ytActivo = y && yt[y]?.ok && (yt[y].en90 || 0) > 0;
    const motivo = !sector ? 'sin sector' : (ig && ya.has(ig)) || (y && ya.has(norm(y))) ? 'ya está' : !ig && !ytActivo ? 'sin Instagram ni YouTube activo'
      : c.confianza === 'baja' && !ytActivo ? 'confianza baja' : null;
    if (motivo) { descartados.push(`${c.nombre} (${motivo})`); continue; }
    if (ig) ya.add(ig); if (y) ya.add(norm(y));
    extra.push({ clave: slug(c.nombre), nombre: c.nombre, instagram: ig || null, youtube: y, sectores: [sector], nota: `ronda 2: ${c.por_que || ''}`.slice(0, 140) });
  }
}
fs.writeFileSync(`${DIR}/referentes-extra.json`, JSON.stringify(extra, null, 1));
const por = {}; for (const x of extra) por[x.sectores[0]] = (por[x.sectores[0]] || 0) + 1;
console.log(extra.length, 'nuevos', por); console.log('descartados:', descartados.join('; '));
