// =============================================================================
// probar-solape — ¿se puede solapar un nodo con otro arrastrándolo?
// =============================================================================
//   node scripts/probar-solape.mjs [ws]        (con el dev server levantado)
//
// El dueño reportó: «al arrastrar un nodo incluso puedo solaparlo con otro, eso no
// debería pasar». La causa NO era la fuerza de colisión: era que `forceCollide` cachea
// los radios en su `initialize()`, que corre una sola vez al registrar la fuerza, con
// `agarrado === null`. O sea que el radio de arrastre de 380 NUNCA se aplicaba y el
// nodo agarrado empujaba con radio 8. Ver el comentario en app/second-brain/fisica.ts.
//
// Esta prueba arrastra un nodo cruzando el mapa y mide, EN CADA PASO, la distancia
// entre el nodo agarrado y el más cercano. Si en algún frame esa distancia es menor
// que la suma de los dos radios dibujados, hay solape visual.
// =============================================================================
import { chromium } from 'playwright';

const WS = process.argv[2] ?? '11';
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`http://localhost:3000/api/auth/dev-login?ws=${WS}&next=/second-brain`, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForSelector('.cbg svg g[data-nodo]', { timeout: 120000 });
// La animación de entrada tiene retardos escalonados de hasta 700 ms. Leer la posición
// «inicial» antes de que termine mide un fotograma de la entrada, no la casa del nodo, y
// después toda esa diferencia aparece como «deriva al soltar» que en realidad no existe.
await p.waitForTimeout(2500);

// Los círculos en coordenadas de PANTALLA, que es donde el solape se ve.
// El PRIMER <circle> de `.cbg-cuerpo` es el área de toque transparente y es más grande
// que el nodo: medir con ese da un solape que no se ve. El que se dibuja es el segundo.
const leer = () => p.evaluate(() => [...document.querySelectorAll('.cbg svg g[data-nodo]')].map((g) => {
  const c = g.querySelectorAll('.cbg-cuerpo circle')[1];
  if (!c) return null;
  const b = c.getBoundingClientRect();
  return { id: g.dataset.nodo, x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 };
}).filter(Boolean));

const inicial = await leer();
if (!inicial.length) { console.log('sin nodos'); await nav.close(); process.exit(1); }

// Se arrastra el nodo más CONECTADO (el más grande), que es el que más vecinos tiene
// cerca y por lo tanto el peor caso.
const victima = inicial.reduce((a, b) => (b.r > a.r ? b : a));
const destino = inicial.reduce((a, b) => (Math.hypot(b.x - victima.x, b.y - victima.y) > Math.hypot(a.x - victima.x, a.y - victima.y) ? b : a));

await p.mouse.move(victima.x, victima.y);
await p.mouse.down();

// `hueco` = distancia entre bordes. Negativo = se pisan. Se guarda SIEMPRE el mínimo,
// no solo cuando hay solape: sin eso, un «sin solape» no distingue entre «los separa
// bien» y «nunca hubo un nodo cerca», que es la trampa clásica de esta medición.
let peor = { hueco: Infinity, contra: '', paso: -1 };
const PASOS = 40;
for (let i = 1; i <= PASOS; i++) {
  const t = i / PASOS;
  await p.mouse.move(victima.x + (destino.x - victima.x) * t, victima.y + (destino.y - victima.y) * t);
  await p.waitForTimeout(30);
  const ahora = await leer();
  const yo = ahora.find((n) => n.id === victima.id);
  if (!yo) continue;
  for (const o of ahora) {
    if (o.id === yo.id) continue;
    const hueco = Math.hypot(o.x - yo.x, o.y - yo.y) - yo.r - o.r;
    if (hueco < peor.hueco) peor = { hueco: +hueco.toFixed(1), contra: o.id, paso: i };
  }
}
await p.mouse.up();
await p.waitForTimeout(3000);

// Y que todo haya vuelto a su casa. ⚠️ Este número NUNCA da cero y no tiene que dar
// cero: los nodos FLOTAN con 16 unidades de amplitud, que a la escala del encuadre son
// ~10 px. Un valor de ~14 es el flote; lo que habría que mirar es un valor de 100+.
const final = await leer();
const deriva = Math.max(...final.map((f) => { const i0 = inicial.find((x) => x.id === f.id); return i0 ? Math.hypot(f.x - i0.x, f.y - i0.y) : 0; }));

console.log(JSON.stringify({
  nodos: inicial.length,
  arrastrado: victima.id,
  huecoMinimo: peor.hueco,          // px entre BORDES en el peor frame; <0 = solape
  vecinoMasCercano: peor.contra,
  enElPaso: `${peor.paso}/${PASOS}`,
  derivaAlSoltar: +deriva.toFixed(1),   // ~14 es el flote, no un fallo (ver arriba)
  veredicto: peor.hueco < 0 ? 'SE SOLAPA' : 'sin solape',
}, null, 2));
await nav.close();
