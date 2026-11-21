// Lotes del corpus histórico (12 meses antes de la ventana, sólo español) para medir la antigüedad de cada tema y su peso de hace
// un año. Fuente: el corpus de los ángulos (10.567 piezas con fecha). Salida: lotes/hist-NN.json → clasif/hist-NN.json.
import fs from 'node:fs';
const CORPUS = 'C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/0ee425c6-e397-47f3-945c-412b6db51178/scratchpad/afirm/corpus.json';
const DIR = 'C:/dev/tendencias';
const NOMBRE = { carrizo: 'Juan Carrizo', collado: 'Guille Collado', herasmedia: 'Víctor Heras / Heras Media', 'herasmedia-prod': 'Víctor Heras / Heras Media',
  'herasmedia-rv': 'Víctor Heras / Heras Media', victor: 'Víctor Heras / Heras Media', doglio: 'Francisco Doglio', ramiro: 'Ramiro Cubría', sofiacontreras: 'Sofía Contreras',
  vilmanunez: 'Vilma Núñez', denborg: 'Den Borg', fedecristofari: 'Federico Cristofari', tittogalvez: 'Titto Gálvez', julioiero: 'Julio Iero' };
const a = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
const vistos = new Set();
const P = a.filter((p) => NOMBRE[p.cuenta] && p.fecha >= '2025-08-15' && p.fecha < '2026-08-15' && p.canal !== 'landing' && p.canal !== 'anuncios')
  .filter((p) => { const k = `${p.cuenta.replace(/-(prod|rv)$/, '')}:${p.id}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
const limpio = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const filas = P.map((p) => ({ k: `hist:${p.id}`, quien: NOMBRE[p.cuenta], fecha: p.fecha, red: p.canal || 'instagram', tipo: p.tipo, texto: limpio(p.texto || p.gancho, 420) }));
fs.writeFileSync(`${DIR}/historico-piezas.json`, JSON.stringify(filas));
let n = 0;
for (let i = 0; i < filas.length; i += 200) fs.writeFileSync(`${DIR}/lotes/hist-${String(++n).padStart(2, '0')}.json`, JSON.stringify(filas.slice(i, i + 200)));
console.log(filas.length, 'piezas históricas en', n, 'lotes');
