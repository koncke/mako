// Junta las afirmaciones (sub/salida/*.json) con los datos de cada pieza de Spy y escribe sub/afirmaciones.md agrupado por ángulo
// padre, para el agente que consolida los sub-ángulos.
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const alias = JSON.parse(fs.readFileSync(`${DIR}/alias.json`, 'utf8'));
const meta = {};
for (const f of fs.readdirSync(`${DIR}/sub/lotes`)) for (const p of JSON.parse(fs.readFileSync(`${DIR}/sub/lotes/${f}`, 'utf8'))) meta[p.id] = p;
const af = {};
for (const f of fs.readdirSync(`${DIR}/sub/salida`)) Object.assign(af, JSON.parse(fs.readFileSync(`${DIR}/sub/salida/${f}`, 'utf8')));
const por = {}; let no = 0;
for (const [id, a] of Object.entries(af)) {
  if (!a.es_angulo || !a.padre) { no++; continue; }
  const padre = alias[a.padre] || a.padre;
  (por[padre] ||= []).push({ id, ...a, cuenta: meta[id]?.cuenta, fecha: meta[id]?.fecha });
}
let md = '# Afirmaciones de las piezas de Spy, por ángulo padre\n';
for (const [p, L] of Object.entries(por).sort((a, b) => b[1].length - a[1].length)) {
  md += `\n### ${p} (${L.length})\n`;
  for (const x of L.sort((a, b) => a.sub.localeCompare(b.sub))) md += `- [${x.id}] (${x.cuenta}, ${x.fecha}) ${x.sub} — ${x.afirmacion}\n`;
}
fs.writeFileSync(`${DIR}/sub/afirmaciones.md`, md);
console.log(Object.keys(af).length, 'piezas;', no, 'sin ángulo;', Object.keys(por).length, 'padres');
