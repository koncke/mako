// =============================================================================
// probar-grafo — abre /second-brain de verdad, lo toca, y saca capturas
// =============================================================================
//   npm i -D playwright && npx playwright install chromium     (una sola vez)
//   node scripts/probar-grafo.mjs [ws] [carpeta-de-salida]
//
// Con el dev server levantado. Usa /api/auth/dev-login, que es solo-local.
//
// POR QUÉ EXISTE. `scripts/medir-grafo.mjs` mide el HTML renderizado y eso alcanza
// para la FORMA (topología, radialidad, color), pero es ciego a todo lo que pasa
// después del primer pintado. Tres bugs reales pasaron el HTML sin despeinarse y los
// cazó este script en la primera corrida:
//   · los nodos NO flotaban (0,03 px de recorrido) porque las dos animaciones estaban
//     en el mismo elemento y las dos animan `transform`: la segunda pisa a la primera;
//   · el arrastre NO movía nada (0 px) porque un `stopPropagation` en el nodo cortaba
//     la burbuja antes de que el <svg> registrara el puntero;
//   · al soltar, los nodos quedaban a 128 px de su casa y no volvían ni esperando 4 s.
//
// ⚠️ Y UNA TRAMPA DE MEDICIÓN, que costó un diagnóstico equivocado: la primera versión
// muestreaba UN nodo en DOS instantes para ver si flotaba, y dio 0,03 px con la
// animación andando — había caído justo en el punto de giro de la oscilación. Se
// muestrean todos los nodos en varios instantes y se toma el recorrido máximo.
// =============================================================================
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const WS = process.argv[2] ?? '11';
const OUT = process.argv[3] ?? '.';

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

const errores = [];
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
p.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));

await p.goto(`${BASE}/api/auth/dev-login?ws=${WS}&next=/second-brain`, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForSelector('.cbg svg', { timeout: 120000 });

const svg = p.locator('.cbg svg');
const caja = await svg.boundingBox();

// 1. La entrada, a mitad de la animación de pop.
await p.waitForTimeout(320);
await svg.screenshot({ path: `${OUT}/01-entrada.png` });

// 2. Ya asentado.
await p.waitForTimeout(1600);
await svg.screenshot({ path: `${OUT}/02-reposo.png` });

// ¿Flotan? Se muestrean TODOS los nodos en varios instantes y se toma el recorrido
// máximo. Con un solo nodo y un solo intervalo la medición miente: puede caer justo
// en el punto de giro de la oscilación y dar cero con la animación andando.
const foto = () => p.evaluate(() => [...document.querySelectorAll('.cbg .cbg-nodo')].map((g) => {
  const c = g.querySelector('circle:nth-of-type(2)');
  const r = c?.getBoundingClientRect();
  return r ? [+(r.x + r.width / 2).toFixed(2), +(r.y + r.height / 2).toFixed(2)] : null;
}));
const fotos = [];
for (let t = 0; t < 6; t++) { fotos.push(await foto()); await p.waitForTimeout(420); }
let flota = 0;
for (let n = 0; n < fotos[0].length; n++) {
  const xs = fotos.map((f) => f[n]).filter(Boolean);
  if (xs.length < 2) continue;
  const rx = Math.max(...xs.map((v) => v[0])) - Math.min(...xs.map((v) => v[0]));
  const ry = Math.max(...xs.map((v) => v[1])) - Math.min(...xs.map((v) => v[1]));
  flota = Math.max(flota, Math.hypot(rx, ry));
}

// 3. Hover sobre un nodo del medio.
const nodo = p.locator('.cbg .cbg-nodo').nth(8);
await nodo.hover({ force: true });
await p.waitForTimeout(400);
await svg.screenshot({ path: `${OUT}/03-hover.png` });
const atenuados = await p.evaluate(() => {
  const cs = [...document.querySelectorAll('.cbg .cbg-nodo circle:nth-of-type(2)')];
  return cs.filter((c) => Number(c.getAttribute('opacity')) <= 0.25).length;
});

// 3.b El CLIC tiene que FIJAR el nodo y dejar el detalle abierto.
await nodo.click({ force: true });
await p.waitForTimeout(350);
const fijadoTxt = await p.evaluate(() => document.querySelector('.cbg aside')?.textContent ?? '');
const hayAnillo = await p.evaluate(() => document.querySelectorAll('.cbg .cbg-sel').length);
// Se saca el cursor: si el clic FIJÓ, el detalle tiene que seguir ahí.
await p.mouse.move(10, 10);
await p.waitForTimeout(300);
const sigueFijado = await p.evaluate(() => document.querySelectorAll('.cbg .cbg-sel').length);
await svg.screenshot({ path: `${OUT}/03b-fijado.png` });

const colores = await p.evaluate(() => new Set([...document.querySelectorAll('.cbg .cbg-nodo circle:nth-of-type(2)')]
  .map((c) => getComputedStyle(c).fill)).size);

// 4. ARRASTRE: se agarra un nodo y se lo lleva 180 px. Se mide si los vecinos se corren.
const antes = await p.evaluate(() => [...document.querySelectorAll('.cbg .cbg-nodo')]
  .map((g) => g.getAttribute('transform')));
const bb = await nodo.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.mouse.down();
for (let i = 1; i <= 12; i++) {
  await p.mouse.move(bb.x + bb.width / 2 + i * 15, bb.y + bb.height / 2 + i * 8);
  await p.waitForTimeout(28);
}
await p.waitForTimeout(250);
await svg.screenshot({ path: `${OUT}/04-arrastrando.png` });
const durante = await p.evaluate(() => [...document.querySelectorAll('.cbg .cbg-nodo')]
  .map((g) => g.getAttribute('transform')));
await p.mouse.up();
await p.waitForTimeout(4000);
await svg.screenshot({ path: `${OUT}/05-tras-soltar.png` });
const despues = await p.evaluate(() => [...document.querySelectorAll('.cbg .cbg-nodo')]
  .map((g) => g.getAttribute('transform')));

const xy = (t) => { const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(t ?? ''); return m ? [+m[1], +m[2]] : null; };
const movidos = antes.map((t, i) => {
  const a = xy(t), b = xy(durante[i]);
  return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
});
const vueltos = antes.map((t, i) => {
  const a = xy(t), b = xy(despues[i]);
  return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
});
const seCorrieron = movidos.filter((d) => d > 3).length;

// 5. Paneo: arrastrar el FONDO tiene que mover el mapa, no seleccionar ni agarrar nada.
const vistaAntes = await p.evaluate(() => document.querySelector('.cbg svg > g')?.getAttribute('transform'));
await p.mouse.move(caja.x + 40, caja.y + 40);
await p.mouse.down();
for (let i = 1; i <= 8; i++) { await p.mouse.move(caja.x + 40 + i * 12, caja.y + 40 + i * 6); await p.waitForTimeout(25); }
await p.mouse.up();
await p.waitForTimeout(200);
const vistaDespues = await p.evaluate(() => document.querySelector('.cbg svg > g')?.getAttribute('transform'));

// 6. Zoom con la rueda.
await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
await p.mouse.wheel(0, -600);
await p.waitForTimeout(400);
await svg.screenshot({ path: `${OUT}/06-zoom.png` });
const zoomDespues = await p.evaluate(() => document.querySelector('.cbg svg > g')?.getAttribute('transform'));

console.log(JSON.stringify({
  flotacion_px: +flota.toFixed(2),
  colores_distintos: colores,
  clic_fija_el_nodo: hayAnillo > 0,
  sigue_fijado_al_sacar_el_cursor: sigueFijado > 0,
  detalle_no_vacio: fijadoTxt.length > 60,
  nodos_atenuados_en_hover: atenuados,
  arrastre_vecinos_movidos: seCorrieron,
  arrastre_desplazamiento_max: +Math.max(...movidos).toFixed(1),
  tras_soltar_desvio_max: +Math.max(...vueltos).toFixed(1),
  paneo_funciona: vistaAntes !== vistaDespues,
  zoom_funciona: vistaDespues !== zoomDespues,
  errores_de_consola: errores.slice(0, 5),
}, null, 1));

await navegador.close();
