// Arma C:/dev/tendencias/uso/<sector>.json: por tendencia, lo que hace falta para escribir «cómo usarla» (forma del gancho y palabra
// del CTA) y «lo que pide la gente»: las piezas con más comentarios y las que más comentan cada 1.000 vistas, su CTA, la
// transcripción si hay, y los comentarios de conversación (sin los que sólo repiten la palabra). Uso: node uso.mjs [sector]
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const T = JSON.parse(fs.readFileSync(`${DIR}/tabla.json`, 'utf8'));
const NOM = JSON.parse(fs.readFileSync(`${DIR}/nombres.json`, 'utf8'));
const alias = JSON.parse(fs.readFileSync(`${DIR}/alias.json`, 'utf8'));
const clas = {}; for (const f of fs.readdirSync(`${DIR}/clasif`)) Object.assign(clas, JSON.parse(fs.readFileSync(`${DIR}/clasif/${f}`, 'utf8')));
const piezas = fs.readFileSync(`${DIR}/piezas.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const canon = (s, t) => alias[`${s}|${t}`] || `${s}|${t}`;
const esPalabra = (t, cta) => { const s = (t || '').replace(/@\S+/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim(); if (!s) return true; if (cta && s.toLowerCase() === String(cta).toLowerCase()) return true; return s.split(/\s+/).length <= 2; };
const porTema = {};
for (const p of piezas) {
  const c = clas[`${p.red}:${p.id}`]; if (!c || c.s === 'fuera') continue;
  for (const [s, t] of [[c.s, c.t], [c.s2, c.t2]]) if (s && t) (porTema[canon(s, t)] ||= []).push({ ...p, cta: c.cta || p.cta });
}
const solo = process.argv[2];
fs.mkdirSync(`${DIR}/uso`, { recursive: true });
const sectores = [...new Set(T.filas.map((f) => f.sector))].filter((s) => !solo || s === solo);
for (const s of sectores) {
  const out = [];
  for (const f of T.filas.filter((x) => x.sector === s)) {
    const id = `${f.sector}|${f.tema}`;
    const P = (porTema[id] || []).filter((p) => !/\(inglés\)/.test(p.referente) || !f.referentes);
    const ck = (p) => (p.vistas >= 1000 ? (p.comentarios ?? 0) / p.vistas : 0);
    const top = [...new Map([...[...P].sort((a, b) => (b.comentarios ?? 0) - (a.comentarios ?? 0)).slice(0, 4), ...[...P].sort((a, b) => ck(b) - ck(a)).slice(0, 3)].map((p) => [p.id, p])).values()];
    out.push({
      id, nombre: NOM[id] || f.tema, estado: f.estado, anual: f.anual, referentes: f.quienes, ctas: f.ctas,
      senales: { piezas30: f.piezas30, piezas60: f.piezas60, ritmoComentarios: f.ritmoComentarios, comentariosPorMil: f.comentariosPorMil, conversacion: f.conversacion },
      piezas: top.map((p) => ({ referente: p.referente, url: p.url, fecha: p.fecha, vistas: p.vistas, comentarios: p.comentarios, cta: p.cta,
        texto: (p.texto || '').replace(/\s+/g, ' ').slice(0, 700), voz: p.transcripcion ? String(p.transcripcion).replace(/\s+/g, ' ').slice(0, 700) : undefined,
        comentariosDeLaGente: (p.muestra || []).filter((m) => !esPalabra(m.texto, p.cta)).slice(0, 12).map((m) => `${m.fecha || ''} ${(m.texto || '').slice(0, 200)}`) })),
    });
  }
  fs.writeFileSync(`${DIR}/uso/${s.replace(/[^\p{L}\p{N}]+/gu, '-')}.json`, JSON.stringify(out, null, 1));
  console.log(s, out.length, 'tendencias');
}
