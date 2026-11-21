// Mapa de tendencias: de las piezas clasificadas a una tabla por (sector, tema) con estado y señales.
// Entradas (en C:/dev/tendencias/):
//   piezas.jsonl   lo arma armar-piezas.mjs: {clave, referente, red, id, url, fecha, medido, tipo, texto, vistas, me_gusta,
//                  comentarios, cta, muestra:[{texto, fecha}]}
//   clasif/*.json  {"<red>:<id>": {s, t, s2?, t2?, cta?}}  (los lotes que clasifican los agentes)
//   alias.json     opcional: {"<sector>|<tema>": "<sector>|<tema canónico>"} para fundir los «nuevo:…» y los repetidos
//   historico.json opcional: {"<sector>|<tema>": "YYYY-MM-DD"} primera vez vista en piezas más viejas que la ventana
// Salida: tabla.json. Uso: node analizar.mjs
//
// ⚠️ LA TRAMPA DE LA MEDICIÓN (21/11/2026): el Spy de producción mide cada pieza UNA vez (del 4 al 19/11), y lo bajado con
// yt-dlp también. Una pieza medida a los 2 días todavía no juntó sus comentarios, y una cuenta medida el 4/11 no tiene piezas
// después. Por eso: (1) cada cuenta se corta en SU última medición, no en la fecha de hoy; (2) los comentarios sólo cuentan en
// piezas medidas con 7 días o más, y sus ventanas se corren 7 días (de 7 a 37 contra de 37 a 97). Lo que queda de sesgo (una pieza
// vieja sigue juntando comentarios) juega en CONTRA de «En crecimiento»: si un tema sale creciendo, crece de verdad.
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const D = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const r1 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 10) / 10);
const MADURA = 7;

const piezas = fs.readFileSync(`${DIR}/piezas.jsonl`, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const clas = {};
for (const f of fs.existsSync(`${DIR}/clasif`) ? fs.readdirSync(`${DIR}/clasif`) : []) Object.assign(clas, JSON.parse(fs.readFileSync(`${DIR}/clasif/${f}`, 'utf8')));
const alias = fs.existsSync(`${DIR}/alias.json`) ? JSON.parse(fs.readFileSync(`${DIR}/alias.json`, 'utf8')) : {};
const hist = fs.existsSync(`${DIR}/historico.json`) ? JSON.parse(fs.readFileSync(`${DIR}/historico.json`, 'utf8')) : {};
const canon = (s, t) => { const k = alias[`${s}|${t}`] || `${s}|${t}`; const i = k.indexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; };

// Comentario-palabra (la palabra del CTA, una o dos palabras en mayúsculas, sólo emojis): infla el conteo sin decir nada.
const esPalabra = (t, cta) => {
  const s = (t || '').replace(/@\S+/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!s) return true;
  if (cta && s.toLowerCase() === String(cta).toLowerCase()) return true;
  return s.split(/\s+/).length <= 2 && s === s.toUpperCase();
};

// El corte de cada cuenta (su última medición) y el múltiplo de cada pieza contra la mediana de su cuenta y red.
const corteDe = {};
for (const p of piezas) if (p.medido && (!corteDe[p.clave] || p.medido > corteDe[p.clave])) corteDe[p.clave] = p.medido;
const porCuenta = {};
for (const p of piezas) (porCuenta[`${p.clave}|${p.red}`] ||= []).push(p);
for (const L of Object.values(porCuenta)) {
  const mv = med(L.map((p) => p.vistas).filter(Boolean));
  for (const p of L) p.nx = mv && p.vistas ? p.vistas / mv : null;
}

const grupos = {};
for (const p of piezas) {
  const c = clas[`${p.red}:${p.id}`]; if (!c) continue;
  const corte = corteDe[p.clave]; if (!corte) continue;
  const d = D(corte, p.fecha);
  if (d < 0 || d > 97) continue;
  const madura = p.medido ? D(p.medido, p.fecha) >= MADURA : false;
  const ingles = /\(inglés\)/.test(p.referente);
  const cta = c.cta || p.cta || null;
  for (const [s0, t0] of [[c.s, c.t], [c.s2, c.t2]]) {
    if (!s0 || !t0 || s0 === 'fuera') continue;
    const [s, t] = canon(s0, t0);
    (grupos[`${s}|${t}`] ||= { sector: s, tema: t, piezas: [] }).piezas.push({ ...p, d, madura, ingles, cta });
  }
}

const ck = (p) => (p.vistas >= 500 && p.madura ? (1000 * (p.comentarios ?? 0)) / p.vistas : null);
const ckSector = {};
for (const g of Object.values(grupos)) (ckSector[g.sector] ||= []).push(...g.piezas.filter((p) => !p.ingles).map(ck));
for (const s of Object.keys(ckSector)) ckSector[s] = med(ckSector[s]);

const filas = [];
for (const g of Object.values(grupos)) {
  const ES = g.piezas.filter((p) => !p.ingles), EN = g.piezas.filter((p) => p.ingles);
  const P = ES.length ? ES : EN; // el estado se mide en español; un tema sólo en inglés se mide en inglés y se marca
  const rec = P.filter((p) => p.d <= 30), ant = P.filter((p) => p.d > 30 && p.d <= 90);
  const mRec = P.filter((p) => p.madura && p.d >= MADURA && p.d < 30 + MADURA), mAnt = P.filter((p) => p.madura && p.d >= 30 + MADURA && p.d <= 90 + MADURA);
  const suma = (L) => L.reduce((a, p) => a + (p.comentarios ?? 0), 0);
  const ritmo = (a, b) => (b ? (a / 30) / (b / 60) : (a ? Infinity : null));
  const ritmoPiezas = ritmo(rec.length, ant.length), ritmoCom = ritmo(suma(mRec), suma(mAnt));
  const muestra = P.flatMap((p) => (p.muestra || []).map((m) => ({ ...m, cta: p.cta, corte: corteDe[p.clave] })));
  const conv = muestra.length >= 10 ? muestra.filter((m) => !esPalabra(m.texto, m.cta)).length / muestra.length : null;
  const recientes = muestra.filter((m) => m.fecha).length >= 10 ? muestra.filter((m) => m.fecha && D(m.corte, m.fecha) <= 30).length / muestra.filter((m) => m.fecha).length : null;
  const refsES = [...new Set(ES.map((p) => p.referente))], refsEN = [...new Set(EN.map((p) => p.referente))];
  const primera = [hist[`${g.sector}|${g.tema}`], ...P.map((p) => p.fecha)].filter(Boolean).sort()[0];
  const hoy = Object.values(corteDe).sort().at(-1);
  const edad = D(hoy, primera);
  // El estado, en este orden (igual que en docs/tendencias/mapa.md → «Cómo se decide el estado»):
  let estado;
  if (!ES.length) estado = refsEN.length >= 2 ? 'Nuevo' : null; // todavía no llegó al español: «Nuevo» con llegaDelIngles
  else if (edad <= 60 && refsES.length <= 3) estado = 'Nuevo';
  else if (ritmoCom != null && ritmoCom >= 1.3 && (ritmoPiezas ?? 0) >= 1) estado = 'En crecimiento';
  else if ((ritmoPiezas != null && ritmoPiezas < 0.7) || (ritmoCom != null && ritmoCom < 0.7)) estado = 'En baja';
  else estado = 'Saturado';
  const ej = [...P].sort((a, b) => (b.comentarios ?? 0) - (a.comentarios ?? 0));
  const ejemplos = []; const usados = new Set();
  for (const p of ej) { if (ejemplos.length >= 3) break; if (usados.has(p.referente) && ej.length > 6) continue; usados.add(p.referente);
    ejemplos.push({ referente: p.referente, url: p.url, fecha: p.fecha, vistas: p.vistas, comentarios: p.comentarios, cta: p.cta, texto: (p.texto || '').replace(/\s+/g, ' ').slice(0, 220) }); }
  if (!estado) continue;
  filas.push({
    sector: g.sector, tema: g.tema, estado, llegaDelIngles: !ES.length,
    referentes: refsES.length, quienes: refsES, referentesIngles: refsEN.length, quienesIngles: refsEN,
    piezas: P.length, piezas30: rec.length, piezas60: ant.length, ritmoPiezas: r1(ritmoPiezas),
    comentarios30: suma(mRec), comentarios60: suma(mAnt), ritmoComentarios: r1(ritmoCom),
    comentariosPorMil: r1(med(P.map(ck))), comentariosPorMilSector: r1(ckSector[g.sector]),
    conversacion: conv == null ? null : Math.round(conv * 100), comentariosRecientes: recientes == null ? null : Math.round(recientes * 100),
    nxMediana: r1(med(P.map((p) => p.nx))), primeraVez: primera, edadDias: edad,
    ctas: Object.entries(P.reduce((a, p) => { if (p.cta) a[p.cta] = (a[p.cta] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
    ejemplos,
  });
}
filas.sort((a, b) => a.sector.localeCompare(b.sector) || b.referentes - a.referentes || b.piezas - a.piezas || a.tema.localeCompare(b.tema));
fs.writeFileSync(`${DIR}/tabla.json`, JSON.stringify({ cortes: corteDe, ckSector, filas }, null, 1));
for (const f of filas) console.log([f.sector, f.tema, f.estado, `${f.referentes}+${f.referentesIngles}en`, `p ${f.piezas30}/${f.piezas60} (${f.ritmoPiezas})`, `c ${f.comentarios30}/${f.comentarios60} (${f.ritmoComentarios})`, `c/k ${f.comentariosPorMil}`, `conv ${f.conversacion ?? '-'}%`].join(' · '));
