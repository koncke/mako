// Las señales de cada SUB-ÁNGULO (sub/subangulos.json) sobre las piezas de la colección `spy` de Content Machine (spy-cm/spy):
// contagio, insistencia, interacción, rendimiento (nx), recencia, estado y puntaje. Escribe sub/ranking.json y el mapa del filtro
// sub/mapa-angulos.json ({ "<id de pieza>": [{id, nombre, padre}] }).
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const D = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const PERSONA = { victor: 'Víctor Heras', herasmedia: 'Víctor Heras', ramiro: 'Ramiro Cubría', doglio: 'Francisco Doglio', carrizo: 'Juan Carrizo',
  collado: 'Guille Collado', hormozi: 'Alex Hormozi', dakota: 'Dakota Hermes' };
const INGLES = new Set(['Alex Hormozi', 'Dakota Hermes']);
const pz = {};
for (const f of fs.readdirSync(`${DIR}/spy-cm/spy`)) { const j = JSON.parse(fs.readFileSync(`${DIR}/spy-cm/spy/${f}`, 'utf8')); pz[f.replace(/\.json$/, '')] = j.data || j; }
const SUB = JSON.parse(fs.readFileSync(`${DIR}/sub/subangulos.json`, 'utf8'));
const quien = (id) => PERSONA[pz[id]?.cuenta] || pz[id]?.cuenta;
// El corte de cada persona: su pieza más nueva. Las ventanas se cuentan desde ahí.
const corte = {};
for (const [id, p] of Object.entries(pz)) { const q = quien(id); if (p.fecha && (!corte[q] || p.fecha > corte[q])) corte[q] = p.fecha; }
// Comentarios relativos a la cuenta (comx): cada cuenta tiene su costumbre (las que siempre piden «comenta X» juntan más); la
// interacción del puntaje se mide contra la mediana de comentarios de la misma persona, no en absoluto.
const medCom = {}; { const L = {}; for (const [id, p] of Object.entries(pz)) (L[quien(id)] ||= []).push(p.comentarios || 0); for (const [q, a] of Object.entries(L)) medCom[q] = med(a) || 1; }
const conAngulo = new Set(SUB.flatMap((s) => s.piezas));
const total = {}, total90 = {}, totalAntes = {};
for (const id of conAngulo) { const q = quien(id), d = D(corte[q], pz[id]?.fecha || corte[q]); total[q] = (total[q] || 0) + 1; if (d <= 90) total90[q] = (total90[q] || 0) + 1; else totalAntes[q] = (totalAntes[q] || 0) + 1; }
const filas = [];
for (const s of SUB) {
  if (s.es_tema) continue;
  const P = s.piezas.filter((id) => pz[id]).map((id) => ({ id, ...pz[id], quien: quien(id), d: D(corte[quien(id)], pz[id].fecha) }));
  const ES = P.filter((p) => !INGLES.has(p.quien));
  const porQ = {}; for (const p of P) porQ[p.quien] = (porQ[p.quien] || 0) + 1;
  const ins = Object.entries(porQ).map(([q, n]) => [q, n, n / total[q]]).sort((a, b) => b[2] - a[2])[0];
  const ck = med(P.filter((p) => p.vistas >= 500).map((p) => (1000 * (p.comentarios || 0)) / p.vistas));
  const comx = med(P.map((p) => (p.comentarios || 0) / medCom[p.quien]));
  const rec = P.filter((p) => p.d <= 90), ant = P.filter((p) => p.d > 90);
  const quienesRec = [...new Set(rec.map((p) => p.quien))];
  const share = (L, T) => { const qs = [...new Set(P.map((p) => p.quien))]; const den = qs.reduce((a, q) => a + (T[q] || 0), 0); return den ? L.length / den : null; };
  const s90 = share(rec, total90), sAnt = share(ant, totalAntes);
  const primera = P.map((p) => p.fecha).filter(Boolean).sort()[0];
  const edad = Math.min(...P.map((p) => p.d));
  const primeraD = Math.max(...P.map((p) => p.d));
  let estado = null;
  if (P.length >= 2) {
    if (primeraD <= 60 && rec.length >= 2) estado = 'Nuevo';
    else if (rec.length >= 2 && (sAnt == null || sAnt === 0 || s90 >= 1.5 * sAnt)) estado = 'En crecimiento';
    else if (ant.length >= 3 && (rec.length === 0 || (sAnt && s90 <= 0.5 * sAnt))) estado = 'En baja';
    else estado = 'Saturado';
  }
  filas.push({
    id: s.id, nombre: s.nombre, afirmacion: s.afirmacion, padre: s.padre, estado,
    piezas: P.length, piezasEspanol: ES.length, contagio: new Set(ES.map((p) => p.quien)).size, quienes: Object.keys(porQ),
    insistencia: ins ? Math.round(100 * ins[2]) : 0, insisteQuien: ins?.[0] || null, insistePiezas: ins?.[1] || 0, insisteDe: ins ? total[ins[0]] : null,
    comentariosPorMil: r1(ck), comentariosContraSuCuenta: r1(comx), nxMediana: r1(med(P.map((p) => p.nx))), piezas90: rec.length, piezasAntes: ant.length, quienes90: quienesRec,
    primeraVez: primera, ultimaVez: P.map((p) => p.fecha).filter(Boolean).sort().at(-1), diasDesdeLaUltima: Number.isFinite(edad) ? edad : null,
    referencias: [...P].sort((a, b) => (b.nx || 0) - (a.nx || 0)).slice(0, 6).map((p) => ({ id: p.id, quien: p.quien, tipo: p.tipo, forma: p.forma, fecha: p.fecha,
      vistas: p.vistas, comentarios: p.comentarios, nx: p.nx, cta: p.cta, url: p.url, gancho: (p.gancho || '').slice(0, 160) })),
  });
}
// Puntaje (0-100), como en los ángulos: percentiles de contagio, interacción (comentarios contra su cuenta) e insistencia entre los sub-ángulos en español con
// 2 piezas o más, promediados.
const pct = (v, L) => { const b = L.filter((x) => x != null); if (v == null || b.length < 2) return null; return (b.filter((x) => x < v).length + (b.filter((x) => x === v).length - 1) / 2) / (b.length - 1); };
const base = filas.filter((f) => f.piezasEspanol >= 2);
for (const f of base) {
  const partes = [pct(f.contagio, base.map((x) => x.contagio)), pct(f.comentariosContraSuCuenta, base.map((x) => x.comentariosContraSuCuenta)), pct(f.insistencia, base.map((x) => x.insistencia))].filter((x) => x != null);
  f.puntaje = Math.round((100 * partes.reduce((a, b) => a + b, 0)) / partes.length);
}
filas.sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.piezas - a.piezas);
fs.writeFileSync(`${DIR}/sub/ranking.json`, JSON.stringify(filas, null, 1));
const mapa = {};
for (const s of SUB) for (const id of s.piezas) (mapa[id] ||= []).push({ id: s.id, nombre: s.nombre, padre: s.padre });
fs.writeFileSync(`${DIR}/sub/mapa-angulos.json`, JSON.stringify(mapa, null, 1));
console.log(filas.length, 'sub-ángulos;', base.length, 'con 2 piezas o más en español;', Object.keys(mapa).length, 'piezas con ángulo de', Object.keys(pz).length);
for (const f of filas.slice(0, 25)) console.log([f.puntaje, f.estado, f.nombre, `${f.piezas}p/${f.contagio}ref`, `ins ${f.insistencia}% ${f.insisteQuien}`, `comx ${f.comentariosContraSuCuenta}`, `nx ${f.nxMediana}`].join(' · '));
