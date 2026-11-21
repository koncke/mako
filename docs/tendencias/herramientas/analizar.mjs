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

// El HISTÓRICO (12 meses antes de la ventana, 12 cuentas en español; lotes hist-NN): desde cuándo existe cada tema y cuánto pesaba
// hace un año. El peso se compara SÓLO entre las mismas cuentas (las del histórico), porque las cuentas nuevas no tienen pasado.
const histP = fs.existsSync(`${DIR}/historico-piezas.json`) ? Object.fromEntries(JSON.parse(fs.readFileSync(`${DIR}/historico-piezas.json`, 'utf8')).map((p) => [p.k, p])) : {};
const histTema = {}; let histTotal = 0; const cuentasHist = new Set();
for (const [k, c] of Object.entries(clas)) {
  if (!k.startsWith('hist:') || !histP[k]) continue;
  cuentasHist.add(histP[k].quien);
  if (!c.s || c.s === 'fuera') continue;
  histTotal++;
  for (const [s0, t0] of [[c.s, c.t], [c.s2, c.t2]]) {
    if (!s0 || !t0 || s0 === 'fuera') continue;
    const key = canon(s0, t0).join('|');
    const h = (histTema[key] ||= { n: 0, primera: '9999', quienes: new Set() });
    h.n++; h.quienes.add(histP[k].quien); if (histP[k].fecha < h.primera) h.primera = histP[k].fecha;
  }
}

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
  const mc = med(L.map((p) => p.comentarios).filter((x) => x != null));
  for (const p of L) {
    p.nx = mv && p.vistas ? p.vistas / mv : null;
    // Un solo reel de regalo con 15.000 comentarios no puede decidir el estado de un tema: cada pieza aporta como mucho 5 veces la
    // mediana de comentarios de su cuenta (los ejemplos muestran el número real).
    p.comTope = p.comentarios == null ? null : Math.min(p.comentarios, Math.max(5 * (mc || 0), 20));
  }
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

// Cuántas piezas clasificadas (no «fuera») publicaron en la ventana las cuentas del histórico: el denominador de pesoAhora.
let ventanaHist = 0;
for (const p of piezas) {
  const c = clas[`${p.red}:${p.id}`]; if (!c || c.s === 'fuera' || !corteDe[p.clave]) continue;
  const d = D(corteDe[p.clave], p.fecha); if (d < 0 || d > 90) continue;
  if (cuentasHist.has(p.referente)) ventanaHist++;
}
const filas = [], pocasSenales = [];
for (const g of Object.values(grupos)) {
  const ES = g.piezas.filter((p) => !p.ingles), EN = g.piezas.filter((p) => p.ingles);
  const P = ES.length ? ES : EN; // el estado se mide en español; un tema sólo en inglés se mide en inglés y se marca
  const rec = P.filter((p) => p.d <= 30), ant = P.filter((p) => p.d > 30 && p.d <= 90);
  const mRec = P.filter((p) => p.madura && p.d >= MADURA && p.d < 30 + MADURA), mAnt = P.filter((p) => p.madura && p.d >= 30 + MADURA && p.d <= 90 + MADURA);
  const suma = (L) => L.reduce((a, p) => a + (p.comTope ?? 0), 0);
  const ritmo = (a, b) => (b ? (a / 30) / (b / 60) : (a ? Infinity : null));
  // Sin al menos 2 piezas maduras en cada ventana, el ritmo de comentarios es «no se sabe» (null), nunca 0: una ventana reciente
  // sin piezas maduras daba «En baja» a temas que sí tenían comentarios (reels de prueba, 21/11).
  const ritmoPiezas = ritmo(rec.length, ant.length), ritmoCom = mRec.length >= 2 && mAnt.length >= 2 ? ritmo(suma(mRec), suma(mAnt)) : null;
  const muestra = P.flatMap((p) => (p.muestra || []).map((m) => ({ ...m, cta: p.cta, corte: corteDe[p.clave] })));
  const conv = muestra.length >= 10 ? muestra.filter((m) => !esPalabra(m.texto, m.cta)).length / muestra.length : null;
  const recientes = muestra.filter((m) => m.fecha).length >= 10 ? muestra.filter((m) => m.fecha && D(m.corte, m.fecha) <= 30).length / muestra.filter((m) => m.fecha).length : null;
  const refsES = [...new Set(ES.map((p) => p.referente))], refsEN = [...new Set(EN.map((p) => p.referente))];
  const hT = histTema[`${g.sector}|${g.tema}`];
  const primera = [hist[`${g.sector}|${g.tema}`], hT?.primera, ...P.map((p) => p.fecha)].filter((x) => x && x !== '9999').sort()[0];
  // Peso hace un año contra peso hoy, en las mismas cuentas (las del histórico).
  const pesoAntes = histTotal ? (hT?.n || 0) / histTotal : null;
  const pesoAhora = ventanaHist ? ES.filter((p) => cuentasHist.has(p.referente) && p.d <= 90).length / ventanaHist : null;
  const hoy = Object.values(corteDe).sort().at(-1);
  const edad = D(hoy, primera);
  // El estado, en este orden (igual que en docs/tendencias/mapa.md → «Cómo se decide el estado»):
  // Con menos de 6 piezas o un solo referente no hay tendencia que medir: queda en `pocasSenales` (salvo que sea Nuevo).
  let estado;
  const pocas = P.length < 6 || refsES.length < 2;
  if (!ES.length) estado = refsEN.length >= 2 && EN.length >= 4 ? 'Nuevo' : null; // todavía no llegó al español: «Nuevo» con llegaDelIngles
  else if (edad <= 60 && rec.length >= 2) estado = 'Nuevo';
  else if (pocas) estado = null;
  else if (ritmoCom != null && ritmoCom >= 1.3 && (ritmoPiezas ?? 0) >= 1) estado = 'En crecimiento';
  else if ((ritmoPiezas != null && ritmoPiezas < 0.7) || (ritmoCom != null && ritmoCom < 0.7)) estado = 'En baja';
  else estado = 'Saturado';
  const ej = [...P].sort((a, b) => (b.comentarios ?? 0) - (a.comentarios ?? 0));
  const ejemplos = []; const usados = new Set();
  for (const p of ej) { if (ejemplos.length >= 3) break; if (usados.has(p.referente) && ej.length > 6) continue; usados.add(p.referente);
    ejemplos.push({ referente: p.referente, url: p.url, fecha: p.fecha, vistas: p.vistas, comentarios: p.comentarios, cta: p.cta, texto: (p.texto || '').replace(/\s+/g, ' ').slice(0, 220) }); }
  if (!estado) { pocasSenales.push({ sector: g.sector, tema: g.tema, piezas: P.length, referentes: refsES.length, referentesIngles: refsEN.length }); continue; }
  filas.push({
    sector: g.sector, tema: g.tema, estado, llegaDelIngles: !ES.length,
    referentes: refsES.length, quienes: refsES, referentesIngles: refsEN.length, quienesIngles: refsEN,
    piezas: P.length, piezas30: rec.length, piezas60: ant.length, ritmoPiezas: r1(ritmoPiezas),
    comentarios30: suma(mRec), comentarios60: suma(mAnt), ritmoComentarios: r1(ritmoCom),
    comentariosPorMil: r1(med(P.map(ck))), comentariosPorMilSector: r1(ckSector[g.sector]),
    conversacion: conv == null ? null : Math.round(conv * 100), comentariosRecientes: recientes == null ? null : Math.round(recientes * 100),
    nxMediana: r1(med(P.map((p) => p.nx))), primeraVez: primera, edadDias: edad,
    pesoHaceUnAno: pesoAntes == null ? null : r1(100 * pesoAntes), pesoHoy: pesoAhora == null ? null : r1(100 * pesoAhora),
    referentesHaceUnAno: hT ? hT.quienes.size : 0,
    ctas: Object.entries(P.reduce((a, p) => { if (p.cta) a[p.cta] = (a[p.cta] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
    ejemplos,
  });
}
filas.sort((a, b) => a.sector.localeCompare(b.sector) || b.referentes - a.referentes || b.piezas - a.piezas || a.tema.localeCompare(b.tema));
fs.writeFileSync(`${DIR}/tabla.json`, JSON.stringify({ cortes: corteDe, ckSector, filas, pocasSenales }, null, 1));
console.log(`${filas.length} tendencias · ${pocasSenales.length} temas con pocas señales`);
for (const f of filas) console.log([f.sector, f.tema, f.estado, `${f.referentes}+${f.referentesIngles}en`, `p ${f.piezas30}/${f.piezas60} (${f.ritmoPiezas})`, `c ${f.comentarios30}/${f.comentarios60} (${f.ritmoComentarios})`, `c/k ${f.comentariosPorMil}`, `conv ${f.conversacion ?? '-'}%`].join(' · '));
