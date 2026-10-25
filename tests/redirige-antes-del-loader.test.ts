// =============================================================================
// Una página con loader que REDIRIGE lo hace en su layout, antes del loader (23/10/2026, ticket #7)
// =============================================================================
// Un `redirect()` adentro de una página con `loading.tsx` va adentro del stream (200 + meta refresh, no 307). En /general
// la carrera con la hidratación tiró «Minified React error #310» en el router de Next (errores_app id 5; /general dejó el
// loader). /plan y /second-brain redirigen al super admin y se quedan con el loader (Martín lo pidió): la redirección va en
// su LAYOUT, que queda afuera del loading.tsx y devuelve el 307. El layout no recibe la query ni sabe la ruta: las dos las
// pone el proxy en headers que pisa (lib/pedido-actual.ts).
// ROTURAS (23/10/2026, una por vez y restaurada; base 5 / 0): el proxy sin HEADER_QUERY → 4 / 1; el layout de /plan sin el
// chequeo de la ruta exacta (redirigiría también /plan/agencia: un bucle) → 4 / 1; el de /second-brain sin `quienOpera` →
// 4 / 1; `queryComoSearchParams` que pierde los repetidos → 4 / 1.
// LOS DASHBOARDS (25/10/2026; base 9 / 0): el layout de /dashboard sin su redirect → 7 / 2; el de /m/dashboard sin el suyo
// → 7 / 2; `paginaDelPedido` sin la tabla del proxy (`rutaMovil`) → 8 / 1; `sinSuHoja` al revés → 8 / 1; la página de la
// hoja sin `tableroDelPedido` → 8 / 1; /dashboard otra vez en la lista de conocidas → 8 / 1.
// Correr: node --import tsx --test tests/redirige-antes-del-loader.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryComoSearchParams } from '../lib/pedido-actual-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la query llega al layout como la recibe una página: un valor, o la lista si se repite', () => {
  assert.deepEqual(queryComoSearchParams('?tarea=abc&cliente=7'), { tarea: 'abc', cliente: '7' });
  assert.deepEqual(queryComoSearchParams('?chat=1&chat=2&chat=3'), { chat: ['1', '2', '3'] });
  assert.deepEqual(queryComoSearchParams(''), {});
});

test('el proxy pone la ruta Y la query, pisando las que mande el cliente', () => {
  const proxy = sinComentarios(leer('proxy.ts'));
  assert.match(proxy, /headers\.set\(HEADER_RUTA, req\.nextUrl\.pathname\);\n\s*headers\.set\(HEADER_QUERY, req\.nextUrl\.search\);/);
  assert.match(leer('lib/api-tab.ts'), /export const HEADER_QUERY = 'x-mako-query';/);
});

test('/plan: el layout manda al super admin a /plan/agencia SÓLO en la ruta exacta, con la misma decisión que la página', () => {
  const lay = sinComentarios(leer('app/plan/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/plan'\) \{/, 'sin la ruta exacta redirigiría también /plan/agencia: un bucle');
  const pag = sinComentarios(leer('app/plan/page.tsx'));
  // La condición y el destino, iguales en los dos.
  for (const pedazo of ["if (sesion?.rol === 'admin' && !(await estaImpersonando())) {", 'redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : \'\'}`));', "else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);"]) {
    assert.ok(lay.includes(pedazo), `el layout no tiene «${pedazo}»`);
    assert.ok(pag.includes(pedazo), `la página no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  assert.match(lay, /return children;\n\}/);
});

test('/second-brain: el layout manda a quien opera al Ops Center SÓLO en la ruta exacta, con la decisión de la página', () => {
  const lay = sinComentarios(leer('app/second-brain/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/second-brain' && \(await quienOpera\(\)\)\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(query\)\)\);/);
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /if \(opera\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(q\)\)\);/);
});

test('las páginas con loader que redirigen al super admin tienen su layout que redirige antes', () => {
  for (const seg of ['plan', 'second-brain']) {
    assert.ok(leer(`app/${seg}/loading.tsx`).length > 0, `${seg} sin loader: este test ya no hace falta para él`);
    assert.match(leer(`app/${seg}/layout.tsx`), /redirect\(/, `${seg} tiene loader y redirige sólo adentro: el redirect va al stream`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticket #9 (25/10/2026): el mismo #310 en /web-generator, que redirigía desde la página con loader desde el 24/10.
// ─────────────────────────────────────────────────────────────────────────────

test('/web-generator: el layout redirige ANTES del loader en las tres rutas que redirigen, con la regla de las páginas', async () => {
  const { redireccionDelLayout, esPanelPelado } = await import('../app/web-generator/panel-reglas');
  assert.equal(redireccionDelLayout('/web-generator', {}), 'ultima');
  assert.equal(redireccionDelLayout('/web-generator', { ws: '10' }), 'ultima');
  assert.equal(redireccionDelLayout('/web-generator', { panel: '1' }), null, '?panel=1 es el Panel: no salta');
  assert.equal(redireccionDelLayout('/web-generator', { diagnostico: '3' }), null);
  assert.equal(redireccionDelLayout('/web-generator/analizar', { url: 'https://x.test' }), 'analizar');
  assert.equal(redireccionDelLayout('/web-generator/crear', {}), 'crear');
  assert.equal(redireccionDelLayout('/web-generator/32', {}), null, 'el editor de una landing no redirige');
  assert.equal(redireccionDelLayout(null, {}), null, 'sin el header del proxy no se adivina');
  assert.equal(esPanelPelado({ ws: '3' }), true);
  const lay = sinComentarios(leer('app/web-generator/layout.tsx'));
  assert.match(lay, /const cual = redireccionDelLayout\(ruta, query\);/);
  assert.match(lay, /await requireRolWs\(\[\], \{ nav: 'landing-writer' \}\);/, 'el layout calcula el destino sin la puerta de la tab');
  assert.match(lay, /if \(cual === 'analizar'\) redirect\(await rutaConWs\(destinoAnalizar\(query\)\)\);/);
  assert.match(lay, /if \(cual === 'crear'\) redirect\(await rutaConWs\(destinoCrear\(query\)\)\);/);
  assert.match(lay, /if \(ultima\) redirect\(await rutaConWs\(`\/web-generator\/\$\{ultima\.id\}`\)\);/);
  assert.match(lay, /return children;\n\}/);
  // La página usa LA MISMA regla de «pelada».
  assert.match(sinComentarios(leer('app/web-generator/page.tsx')), /if \(!errorLista && esPanelPelado\(sp\)\) \{/);
});

/**
 * LO QUE YA ESTABA ASÍ el 25/10/2026, de otras tabs: páginas que redirigen debajo de un loader sin el layout que redirige
 * antes. Cada una tiene el mismo riesgo del #310 (en una carga directa, la redirección va en el stream). No se tocaron en
 * el ticket #9 (son de otros chats); se anotaron en docs/hallazgos-infra.md. Una página NUEVA así hace fallar este test.
 */
const CONOCIDAS_SIN_LAYOUT = new Set([
  'app/admin/operaciones/page.tsx', 'app/crm/revisar/page.tsx', 'app/crm/revisar/[id]/page.tsx', 'app/crm/[id]/resumen/page.tsx',
  'app/m/chats/page.tsx', 'app/m/second-brain/page.tsx',
]);

test('ninguna página NUEVA redirige debajo de un loader sin que el layout de afuera del loader lo haga antes', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const conocidasArregladas: string[] = [];
  const paginas: string[] = [];
  const recorrer = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') recorrer(`${rel}/${e.name}`); }
      else if (e.name === 'page.tsx') paginas.push(`${rel}/page.tsx`);
    }
  };
  recorrer('app');
  const mal: string[] = [];
  for (const p of paginas) {
    if (!/\bredirect\(/.test(sinComentarios(leer(p)))) continue;
    // El loader de más AFUERA: todo lo de adentro queda en su Suspense; el layout de esa carpeta queda afuera.
    let dir = p.slice(0, p.lastIndexOf('/'));
    let afuera: string | null = null;
    while (dir.startsWith('app')) {
      if (existsSync(join(RAIZ, dir, 'loading.tsx'))) afuera = dir;
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    }
    if (!afuera) continue;
    const lay = `${afuera}/layout.tsx`;
    const ok = existsSync(join(RAIZ, lay)) && /\bredirect\(/.test(sinComentarios(leer(lay)));
    if (!ok && !CONOCIDAS_SIN_LAYOUT.has(p)) mal.push(`${p} (loader: ${afuera}/loading.tsx)`);
    if (ok && CONOCIDAS_SIN_LAYOUT.has(p)) conocidasArregladas.push(p);
  }
  assert.deepEqual(mal, [], 'estas páginas redirigen adentro de un loader: React #310 en una carga directa (redirigí en el layout de esa carpeta)');
  // Una conocida que ya tiene su layout sale de la lista: si no, una regresión suya pasaría callada.
  assert.deepEqual(conocidasArregladas, [], 'estas ya redirigen en su layout: sacalas de CONOCIDAS_SIN_LAYOUT');
});

// ─────────────────────────────────────────────────────────────────────────────
// Los dashboards (25/10/2026): /dashboard, /m/dashboard y /m/dashboard/[hoja] salieron de la lista de conocidas.
// ─────────────────────────────────────────────────────────────────────────────

test('/dashboard: el layout redirige al rol sin la capa de su hoja ANTES del loader, con la decisión de la página', async () => {
  const { sinSuHoja } = await import('../app/dashboard/redireccion');
  const { CAPAS_LISTA, tabEnCapa } = await import('../lib/capas');
  for (const { id } of CAPAS_LISTA) {
    assert.equal(sinSuHoja('admin', id), false, 'el admin no tiene hoja única');
    assert.equal(sinSuHoja('closer', id), !tabEnCapa('closing', id), `el closer en ${id}`);
    assert.equal(sinSuHoja('setter', id), !tabEnCapa('whatsapp', id), `el setter en ${id}`);
  }
  // Medido el 25/10/2026: «pm» no incluye ni Closing ni WhatsApp. Es el caso que redirige.
  assert.equal(sinSuHoja('closer', 'pm'), true);
  const lay = sinComentarios(leer('app/dashboard/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/dashboard'\) \{/);
  assert.match(lay, /if \(sinSuHoja\(rol, capa\)\) \{\s*await requireRolWs\(\['closer', 'setter'\], \{ nav: 'graphics' \}\);\s*redirect\(await rutaConWs\(homeDeCapa\(capa\)\)\);/,
    'el layout no redirige, o calcula el destino sin la puerta de la tab');
  assert.match(lay, /return children;\n\}/);
  assert.match(sinComentarios(leer('app/dashboard/page.tsx')), /if \(sinSuHoja\(rol, capa\)\) redirect\(await rutaConWs\(homeDeCapa\(capa\)\)\);/,
    'la página decide otra cosa que el layout');
});

test('/m/dashboard y su hoja: el layout sabe qué página es con la URL de escritorio, y redirige ANTES del loader', async () => {
  const { paginaDelPedido } = await import('../app/m/dashboard/redireccion');
  const { decidirDesvio } = await import('../lib/movil-desvio');
  // En el teléfono la URL es la de ESCRITORIO: el proxy la reescribe. Lo que decide el layout es lo que reescribe el proxy.
  const casos: Array<[string, Record<string, string | string[]>, unknown]> = [
    ['/dashboard', {}, { pagina: 'dashboard' }],
    ['/dashboard', { ws: '3', hoja: 'comercial' }, { pagina: 'dashboard' }],
    ['/marketing', {}, { pagina: 'dashboard' }],
    ['/comercial', {}, { pagina: 'dashboard' }],
    ['/dashboard', { hoja: 'h_ventas 2' }, { pagina: 'hoja', id: 'h_ventas 2' }],
    ['/graficos', { hoja: 'closing' }, { pagina: 'hoja', id: 'closing' }],
    ['/dashboard', { hoja: 'focus' }, null],
  ];
  for (const [ruta, query, esperado] of casos) {
    assert.deepEqual(paginaDelPedido(ruta, query), esperado, `${ruta} ${JSON.stringify(query)}`);
    const d = decidirDesvio(ruta, new URLSearchParams(query as Record<string, string>).toString());
    const delProxy = d.tipo === 'movil' ? d.destino.split('?')[0] : null;
    const delLayout = esperado == null ? null : (esperado as { pagina: string; id?: string }).pagina === 'dashboard' ? '/m/dashboard' : `/m/dashboard/${encodeURIComponent((esperado as { id: string }).id)}`;
    if (delLayout) assert.equal(delProxy, delLayout, `el proxy reescribe ${ruta} a otra página`);
  }
  assert.deepEqual(paginaDelPedido('/dashboard', { hoja: ['h1', 'h2'] }), { pagina: 'hoja', id: 'h1' }, 'como el proxy: la primera');
  assert.deepEqual(paginaDelPedido('/m/dashboard/h%20x', {}), { pagina: 'hoja', id: 'h x' });
  assert.equal(paginaDelPedido('/crm', {}), null);
  assert.equal(paginaDelPedido(null, {}), null, 'sin el header del proxy no se adivina');

  const lay = sinComentarios(leer('app/m/dashboard/layout.tsx'));
  assert.match(lay, /const cual = paginaDelPedido\(ruta, query\);/);
  assert.match(lay, /if \(sinSuHoja\(ctx\.rol, ctx\.capa\)\) destino = HOME_MOVIL;/);
  assert.match(lay, /\} else if \(hojaDeRol\(ctx\.rol\)\) \{\s*destino = VOLVER_AL_DASHBOARD;/);
  assert.match(lay, /puedeVerKey\('graphics', ctx\.rol, ctx\.capa\) && !hojaPropiaDe\(\(await tableroDelPedido\(\)\)\.tablero, cual\.id\)/,
    'el informe se lee para quien no tiene la tab, o la hoja se decide con otra cuenta');
  assert.match(lay, /await requireMovil\(\{ navKey: 'graphics' \}\);\s*redirect\(await rutaConWs\(destino\)\);/, 'el layout redirige sin la puerta de la tab');
  assert.match(lay, /return children;\n\}/);
  // Las páginas, con la MISMA decisión (por si se llega navegando), y la hoja con el informe que ya leyó el layout.
  assert.match(sinComentarios(leer('app/m/dashboard/page.tsx')), /if \(sinSuHoja\(ctx\.rol, ctx\.capa\)\) redirect\(await rutaConWs\(HOME_MOVIL\)\);/);
  const hoja = sinComentarios(leer('app/m/dashboard/[hoja]/page.tsx'));
  assert.match(hoja, /if \(hojaDeRol\(ctx\.rol\)\) redirect\(await rutaConWs\(VOLVER_AL_DASHBOARD\)\);/);
  assert.match(hoja, /const h = hojaPropiaDe\(lectura\.tablero, id\);\s*if \(!h\) redirect\(await rutaConWs\(VOLVER_AL_DASHBOARD\)\);/);
  assert.match(hoja, /tableroDelPedido\(\)\]\);/, 'la página vuelve a leer el informe en vez de reusar el del layout');
  assert.match(sinComentarios(leer('app/m/dashboard/datos.ts')), /export const tableroDelPedido = cache\(leerTablero\);/);
});
