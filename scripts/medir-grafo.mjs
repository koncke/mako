// =============================================================================
// medir-grafo — ¿el grafo del Second Brain se parece al de Obsidian? Con números.
// =============================================================================
//   node scripts/medir-grafo.mjs <pagina.html>
//
// Se le pasa el HTML YA RENDERIZADO de /second-brain (guardado con curl y la cookie
// de sesión). Parsea el SVG y calcula las métricas que separan una "nube de Obsidian"
// de un "árbol radial". Existe porque "se ve parecido" no es verificable y porque dos
// veces seguidas el dibujo pareció bien y estaba mal:
//
//   · v1: layout radial. Se veía como un organigrama.
//   · v2: force layout, pero con anclas por área — la mediana de distancia al centro
//     daba 237 y el `anclaRadio` era 230, o sea que todo estaba sentado en un ANILLO.
//     A ojo parecía una nube; el CV del radio (0,30) decía que no.
//
// Los umbrales salen de medir vaults reales de Obsidian y de leer su app.css. Los dos
// que más sorprenden, y que en la primera versión de este script estaban al revés:
//   · el gris uniforme es lo CORRECTO (Obsidian es monocromo; el color marca
//     excepciones), así que se mide "≥85% del mismo gris", no "≤55% del dominante";
//   · el tamaño del hub se mide como razón contra el grado MEDIO, no como % de nodos.
// =============================================================================
import fs from 'node:fs';

const archivo = process.argv[2];
const h = fs.readFileSync(archivo, 'utf8');

const i = h.indexOf('aria-label="Mapa del segundo cerebro');
if (i < 0) { console.error('no encontré el grafo en el HTML'); process.exit(1); }
const start = h.lastIndexOf('<svg', i);
const svg = h.slice(start, h.indexOf('</svg>', start));

const vb = (svg.match(/viewBox="([-\d. ]+)"/) || [])[1].split(' ').map(Number);
const nodos = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="(var\(--[a-z-]+\)|none)"/g)]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[3], fill: m[4] }));
const lineas = [...svg.matchAll(/x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)]
  .map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }));
const etiquetas = (svg.match(/class="cbg-et/g) || []).length;
const rotulos = (svg.match(/class="cbg-rot/g) || []).length;

// Las aristas se dibujan BORDE A BORDE, así que sus extremos no coinciden con el
// centro de ningún nodo: hay que ajustarlos al más cercano. Sin esto la topología
// sale toda en cero y parece que el grafo se desarmó.
const cerca = (x, y) => {
  let mejor = -1, dm = Infinity;
  for (let j = 0; j < nodos.length; j++) {
    const d = (nodos[j].x - x) ** 2 + (nodos[j].y - y) ** 2;
    if (d < dm) { dm = d; mejor = j; }
  }
  return mejor;
};
const pares = lineas.map((l) => [cerca(l.x1, l.y1), cerca(l.x2, l.y2)]).filter(([a, b]) => a !== b);
const gradoArr = new Array(nodos.length).fill(0);
for (const [a, b] of pares) { gradoArr[a]++; gradoArr[b]++; }
const g = [...gradoArr].sort((a, b) => b - a);
const hojas = g.filter((x) => x === 1).length;
const huerfanos = g.filter((x) => x === 0).length;

// Componentes conexos: las "islas" son parte del look de Obsidian.
const padre = nodos.map((_, j) => j);
const find = (a) => { while (padre[a] !== a) { padre[a] = padre[padre[a]]; a = padre[a]; } return a; };
for (const [a, b] of pares) { const ra = find(a), rb = find(b); if (ra !== rb) padre[ra] = rb; }
const componentes = new Set(nodos.map((_, j) => find(j))).size;

// Coeficiente de clustering: ¿hay triángulos? Es lo que produce RACIMOS.
const ady = new Map(nodos.map((_, j) => [j, new Set()]));
for (const [a, b] of pares) { ady.get(a).add(b); ady.get(b).add(a); }
let sumaCC = 0, conCC = 0;
for (const [j, vec] of ady) {
  const d = vec.size;
  if (d < 2) continue;
  let enlaces = 0;
  const arr = [...vec];
  for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) if (ady.get(arr[a]).has(arr[b])) enlaces++;
  sumaCC += (2 * enlaces) / (d * (d - 1)); conCC++;
  void j;
}
const cc = conCC ? sumaCC / conCC : 0;

// Radialidad: distancia al centro del encuadre y reparto angular.
const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
const dist = nodos.map((n) => Math.hypot(n.x - cx, n.y - cy)).sort((a, b) => a - b);
const p = (q) => dist[Math.floor(dist.length * q)] ?? 0;
const bins = new Array(36).fill(0);
for (const n of nodos) {
  const d = Math.hypot(n.x - cx, n.y - cy);
  if (d < vb[2] * 0.03) continue;
  bins[Math.floor((((Math.atan2(n.y - cy, n.x - cx) * 180) / Math.PI + 450) % 360) / 10)]++;
}
const vacios = bins.filter((b) => b === 0).length;
// Coeficiente de variación del radio: si todos están a la misma distancia, es un anillo.
const media = dist.reduce((a, b) => a + b, 0) / dist.length;
const sd = Math.sqrt(dist.reduce((a, b) => a + (b - media) ** 2, 0) / dist.length);

const largos = lineas.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)).sort((a, b) => a - b);
const rMedio = nodos.reduce((a, n) => a + n.r, 0) / nodos.length;
const fills = nodos.reduce((a, n) => { a[n.fill] = (a[n.fill] || 0) + 1; return a; }, {});
const dom = Object.entries(fills).sort((a, b) => b[1] - a[1])[0];

const fmt = (n, d = 2) => Number(n).toFixed(d);
const ok = (v, cond) => (cond ? '✓' : '✗') + ' ' + v;

console.log(`\n── ${archivo.split(/[\\/]/).pop()} ──`);
console.log(`nodos ${nodos.length} · aristas ${lineas.length} · viewBox ${vb[2].toFixed(0)}`);
console.log('');
console.log('TOPOLOGÍA            actual        objetivo Obsidian');
console.log(`  densidad         ${ok(fmt(lineas.length / nodos.length), lineas.length / nodos.length >= 1.5).padEnd(14)} ≥ 1,5 aristas/nodo`);
console.log(`  hojas (grado 1)  ${ok(`${fmt((100 * hojas) / nodos.length, 0)}%`, hojas / nodos.length <= 0.3).padEnd(14)} ≤ 30%`);
console.log(`  huérfanos        ${huerfanos}`);
const gMedio = (2 * pares.length) / nodos.length;
console.log(`  hub (máx/medio)  ${ok(`${fmt(g[0] / gMedio, 1)}×`, g[0] / gMedio <= 4.5).padEnd(14)} ≤ 4,5× (grado máx ${g[0]}, medio ${fmt(gMedio, 1)})`);
console.log(`  clustering       ${ok(fmt(cc), cc >= 0.15).padEnd(14)} ≥ 0,15 (racimos)`);
console.log(`  componentes      ${componentes}`);
console.log('');
console.log('FORMA (¿es un anillo?)');
console.log(`  dist p10/p50/p90 ${fmt(p(0.1), 0)} / ${fmt(p(0.5), 0)} / ${fmt(p(0.9), 0)}`);
console.log(`  CV del radio     ${ok(fmt(sd / media), sd / media >= 0.35).padEnd(14)} ≥ 0,35 (bajo = anillo)`);
console.log(`  bins vacíos      ${ok(`${vacios}/36`, vacios <= 4).padEnd(14)} ≤ 4 (alto = cuñas)`);
console.log('');
console.log('PROPORCIONES');
console.log(`  radio medio      ${fmt(rMedio, 1)} = ${fmt((100 * rMedio) / vb[2])}% del lienzo   objetivo ≤ 1%`);
const razonArista = largos[Math.floor(largos.length / 2)] / (2 * rMedio);
console.log(`  arista mediana   ${ok(`${fmt(razonArista, 1)}×`, razonArista >= 10 && razonArista <= 20).padEnd(14)} el diámetro de nodo   objetivo 10-20× (Obsidian: linkDist 250 sobre nodos de 8)`);
console.log('');
console.log('DIBUJO');
console.log(`  etiquetas        ${etiquetas} de ${nodos.length}`);
console.log(`  rótulos de área  ${ok(String(rotulos), rotulos === 0)}  objetivo 0 (Obsidian no tiene)`);
const acento = nodos.filter((n) => /mako|warn/.test(n.fill)).length;
console.log(`  gris uniforme    ${ok(`${dom[0]} ${fmt((100 * dom[1]) / nodos.length, 0)}%`, dom[1] / nodos.length >= 0.85)}  objetivo ≥ 85% (Obsidian es monocromo)`);
console.log(`  nodos de acento  ${ok(`${acento} = ${fmt((100 * acento) / nodos.length, 0)}%`, acento / nodos.length <= 0.1)}  objetivo ≤ 10% (el color marca EXCEPCIONES)`);
console.log('');
