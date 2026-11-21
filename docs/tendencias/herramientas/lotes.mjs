// Arma los lotes para clasificar: C:/dev/tendencias/lotes/lote-NN.json, sólo las piezas de la ventana que todavía no tienen
// clasificación (clasif/*.json). Uso: node lotes.mjs [desde=2026-08-15] [tamaño=200]
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const desde = process.argv[2] || '2026-08-15', tam = +(process.argv[3] || 200);
const hechas = new Set();
if (fs.existsSync(`${DIR}/clasif`)) for (const f of fs.readdirSync(`${DIR}/clasif`)) for (const k of Object.keys(JSON.parse(fs.readFileSync(`${DIR}/clasif/${f}`, 'utf8')))) hechas.add(k);
const P = fs.readFileSync(`${DIR}/piezas.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((p) => p.fecha >= desde && !hechas.has(`${p.red}:${p.id}`));
const limpio = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
fs.mkdirSync(`${DIR}/lotes`, { recursive: true });
const previos = fs.readdirSync(`${DIR}/lotes`).length;
let n = 0;
for (let i = 0; i < P.length; i += tam) {
  const lote = P.slice(i, i + tam).map((p) => ({ k: `${p.red}:${p.id}`, quien: p.referente, red: p.red, tipo: p.tipo, texto: limpio(p.texto, 420), voz: p.transcripcion ? limpio(p.transcripcion, 220) : undefined }));
  fs.writeFileSync(`${DIR}/lotes/lote-${String(previos + ++n).padStart(2, '0')}.json`, JSON.stringify(lote));
}
console.log(P.length, 'piezas en', n, 'lotes nuevos');
