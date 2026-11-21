// Mapa de tendencias: de las piezas clasificadas a una tabla por (sector, tema) con estado y señales.
// Entradas (en C:/dev/tendencias/):
//   piezas.jsonl         una pieza por línea: {cuenta, referente, red, id, url, fecha:'YYYY-MM-DD', tipo, texto, vistas, me_gusta,
//                        comentarios, cta, muestra:[{texto, fecha}]}
//   clasificacion.json   {"<red>:<id>": {sector, tema, sector2?, tema2?}}  (lo arma la clasificación por lotes)
//   historico.json       opcional: {"<sector>|<tema>": "YYYY-MM-DD"} primera vez vista en piezas más viejas que la ventana
// Salida: tabla.json y un resumen por consola. Uso: node analizar.mjs [fecha_corte=hoy]
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const corte = process.argv[2] || new Date().toISOString().slice(0, 10);
const dia = (f) => Math.floor((Date.parse(corte) - Date.parse(f)) / 864e5);
const med = (a) => { const b = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

const piezas = fs.readFileSync(`${DIR}/piezas.jsonl`, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const clas = JSON.parse(fs.readFileSync(`${DIR}/clasificacion.json`, 'utf8'));
const hist = fs.existsSync(`${DIR}/historico.json`) ? JSON.parse(fs.readFileSync(`${DIR}/historico.json`, 'utf8')) : {};

// ¿El comentario es la palabra del CTA? (una o dos palabras, en mayúsculas o igual al CTA). Esos inflan el conteo sin decir nada.
const esPalabra = (t, cta) => {
  const s = (t || '').trim().replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!s) return true; // sólo emojis o vacío: tampoco es conversación
  if (cta && s.toLowerCase() === String(cta).toLowerCase()) return true;
  return s.split(/\s+/).length <= 2 && s === s.toUpperCase();
};

// La «edad» de cada pieza y su múltiplo contra su propia cuenta (vistas sobre la mediana de la cuenta en la ventana).
const porCuenta = {};
for (const p of piezas) (porCuenta[`${p.cuenta}|${p.red}`] ||= []).push(p);
for (const L of Object.values(porCuenta)) {
  const mv = med(L.map((p) => p.vistas).filter(Boolean));
  const mc = med(L.map((p) => p.comentarios).filter((x) => x != null));
  for (const p of L) { p.nx = mv && p.vistas ? p.vistas / mv : null; p.comx = mc ? (p.comentarios ?? 0) / mc : null; }
}

const grupos = {};
for (const p of piezas) {
  const c = clas[`${p.red}:${p.id}`];
  if (!c || !c.sector || c.sector === 'fuera') continue;
  const d = dia(p.fecha);
  if (d < 0 || d > 90) continue;
  for (const [s, t] of [[c.sector, c.tema], [c.sector2, c.tema2]]) {
    if (!s || !t) continue;
    (grupos[`${s}|${t}`] ||= { sector: s, tema: t, piezas: [] }).piezas.push({ ...p, d });
  }
}

// Mediana de comentarios cada 1.000 vistas por sector (contra eso se dice si un tema «engancha»).
const ckSector = {};
for (const g of Object.values(grupos)) (ckSector[g.sector] ||= []).push(...g.piezas.filter((p) => p.vistas >= 500).map((p) => (1000 * (p.comentarios ?? 0)) / p.vistas));
for (const s of Object.keys(ckSector)) ckSector[s] = med(ckSector[s]);

const filas = [];
for (const g of Object.values(grupos)) {
  const P = g.piezas;
  const rec = P.filter((p) => p.d <= 30), ant = P.filter((p) => p.d > 30);
  const suma = (L) => L.reduce((a, p) => a + (p.comentarios ?? 0), 0);
  const ritmoPiezas = ant.length ? (rec.length / 30) / (ant.length / 60) : (rec.length ? Infinity : 0);
  const ritmoCom = suma(ant) ? (suma(rec) / 30) / (suma(ant) / 60) : (suma(rec) ? Infinity : 0);
  const ck = med(P.filter((p) => p.vistas >= 500).map((p) => (1000 * (p.comentarios ?? 0)) / p.vistas));
  const muestra = P.flatMap((p) => (p.muestra || []).map((m) => ({ ...m, cta: p.cta })));
  const conv = muestra.length ? muestra.filter((m) => !esPalabra(m.texto, m.cta)).length / muestra.length : null;
  const refs = [...new Set(P.map((p) => p.referente))];
  const primera = [hist[`${g.sector}|${g.tema}`], ...P.map((p) => p.fecha)].filter(Boolean).sort()[0];
  const edad = dia(primera);
  // Estado, en este orden (se escribe igual en docs/tendencias/mapa.md → «Cómo se decide el estado»):
  let estado;
  if (edad <= 60 && refs.length <= 3) estado = 'Nuevo';
  else if (ritmoCom >= 1.3 && ritmoPiezas >= 1) estado = 'En crecimiento';
  else if (ritmoPiezas < 0.7 || ritmoCom < 0.7) estado = 'En baja';
  else estado = 'Saturado';
  const top = [...P].sort((a, b) => (b.comentarios ?? 0) - (a.comentarios ?? 0)).slice(0, 3)
    .map((p) => ({ referente: p.referente, url: p.url, fecha: p.fecha, vistas: p.vistas, comentarios: p.comentarios, cta: p.cta, texto: (p.texto || '').slice(0, 140) }));
  filas.push({
    sector: g.sector, tema: g.tema, estado,
    referentes: refs.length, quienes: refs, piezas: P.length, piezas30: rec.length, piezas60: ant.length,
    ritmoPiezas: r1(ritmoPiezas), comentarios30: suma(rec), comentarios60: suma(ant), ritmoComentarios: r1(ritmoCom),
    comentariosPorMil: r1(ck), comentariosPorMilSector: r1(ckSector[g.sector]), conversacion: conv == null ? null : Math.round(conv * 100),
    nxMediana: r1(med(P.map((p) => p.nx))), primeraVez: primera, edadDias: edad,
    ctas: Object.entries(P.reduce((a, p) => { if (p.cta) a[p.cta] = (a[p.cta] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5),
    ejemplos: top,
  });
}
filas.sort((a, b) => a.sector.localeCompare(b.sector) || b.referentes - a.referentes || b.piezas - a.piezas || a.tema.localeCompare(b.tema));
fs.writeFileSync(`${DIR}/tabla.json`, JSON.stringify({ corte, ckSector, filas }, null, 1));
for (const f of filas) console.log([f.sector, f.tema, f.estado, `${f.referentes} ref`, `${f.piezas30}/${f.piezas60}`, `ritmo ${f.ritmoPiezas}`, `com ${f.ritmoComentarios}`, `c/k ${f.comentariosPorMil}`, `conv ${f.conversacion}%`].join(' · '));
