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
 * El 25/10 salieron /admin/operaciones, /m/chats y /m/second-brain (chat «Ops Center»: el último test de este archivo).
 */
const CONOCIDAS_SIN_LAYOUT = new Set([
  'app/crm/revisar/page.tsx', 'app/crm/revisar/[id]/page.tsx', 'app/crm/[id]/resumen/page.tsx',
  'app/dashboard/page.tsx', 'app/m/dashboard/page.tsx', 'app/m/dashboard/[hoja]/page.tsx',
]);

test('ninguna página NUEVA redirige debajo de un loader sin que el layout de afuera del loader lo haga antes', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
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
  }
  assert.deepEqual(mal, [], 'estas páginas redirigen adentro de un loader: React #310 en una carga directa (redirigí en el layout de esa carpeta)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 25/10/2026 (chat «Ops Center», claude5): /admin/operaciones, /m/chats y /m/second-brain redirigen en su layout.
// PROBADO ROMPIÉNDOLO (base 9/0): `pedidoInterno` sin traducir la URL de escritorio → 1 rojo (la regla); el layout de /m/chats
// mirando la ruta del navegador en vez de la de su página → 1 rojo (los layouts); el de /m/second-brain con otra condición que la
// página → 1 rojo (los layouts); sin el layout de /admin/operaciones → 2 rojos (los layouts y el barrido).
// ─────────────────────────────────────────────────────────────────────────────

test('/m: el layout decide con la ruta y la query que recibe SU página (el proxy sirve la URL de escritorio con /m)', async () => {
  const { pedidoInterno } = await import('../lib/movil-desvio');
  assert.deepEqual(pedidoInterno('/chats', '?linea=2&chat=549@s.whatsapp.net&ws=3'), { ruta: '/m/chats', search: 'linea=2&chat=549%40s.whatsapp.net&ws=3' });
  assert.deepEqual(pedidoInterno('/chats', '?c=ig:5'), { ruta: '/m/chats/ig%3A5', search: 'c=ig%3A5' }, 'un `?c=` es el chat, no la lista');
  assert.deepEqual(pedidoInterno('/whatsapp', ''), { ruta: '/m/chats', search: '' });
  assert.deepEqual(pedidoInterno('/second-brain', '?area=ventas&ws=3'), { ruta: '/m/second-brain', search: 'area=ventas&ws=3' });
  assert.equal(pedidoInterno('/second-brain', '?panel=mapa')?.ruta, '/m/second-brain/mapa', 'el Mapa es su propia página');
  assert.deepEqual(pedidoInterno('/m/second-brain', '?ws=3'), { ruta: '/m/second-brain', search: 'ws=3' }, 'una URL que ya es /m');
  assert.equal(pedidoInterno('/login', ''), null);
  assert.equal(pedidoInterno(null, ''), null, 'sin el header del proxy no se adivina');
});

test('/admin/operaciones, /m/chats y /m/second-brain: el layout redirige antes del loader, con la decisión de la página', () => {
  const ops = sinComentarios(leer('app/admin/operaciones/layout.tsx'));
  const opsPag = sinComentarios(leer('app/admin/operaciones/page.tsx'));
  for (const pedazo of ["if (!admin) redirect('/inicio');", 'redirect(await rutaConWs(RUTA_OPS_CENTER_NEGOCIO));']) {
    assert.ok(ops.includes(pedazo), `el layout de /admin/operaciones no tiene «${pedazo}»`);
    assert.ok(opsPag.includes(pedazo), `la página de /admin/operaciones no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  assert.match(ops, /if \(puedeOperar\(admin, propio\)\) \{/, 'a quien no opera la página le muestra el cartel: el layout no lo manda a ningún lado');

  const chats = sinComentarios(leer('app/m/chats/layout.tsx'));
  const chatsPag = sinComentarios(leer('app/m/chats/page.tsx'));
  assert.match(chats, /if \(pedido\?\.ruta === RUTA_CHATS\) \{/, 'sólo la LISTA: el layout envuelve también a cada chat');
  for (const pedazo of ['if (directo) redirect(await rutaConWs(directo));', 'if (chat) redirect(await rutaConWs(rutaHiloM(chat.clave)));']) {
    assert.ok(chats.includes(pedazo), `el layout de /m/chats no tiene «${pedazo}»`);
    assert.ok(chatsPag.includes(pedazo), `la página de /m/chats no tiene «${pedazo}»`);
  }

  const sb = sinComentarios(leer('app/m/second-brain/layout.tsx'));
  const sbPag = sinComentarios(leer('app/m/second-brain/page.tsx'));
  assert.match(sb, /if \(pedido\?\.ruta === RUTA_OPS_CENTER_M\) \{/, 'sólo el chat: el layout envuelve también al Mapa');
  for (const pedazo of [
    "if (veMapa && (uno(sp.panel) === 'mapa' || uno(sp.area))) {",
    "for (const k of ['area', 'vista'] as const) { const v = uno(sp[k]); if (v) q.set(k, v); }",
    "redirect(await rutaConWs(`/m/second-brain/mapa${q.size ? `?${q}` : ''}`));",
    "if (ctx.sesion.rol === 'admin' && !ctx.impersonando) redirect(await rutaConWs(RUTA_CENTRO_M));",
  ]) {
    assert.ok(sb.includes(pedazo), `el layout de /m/second-brain no tiene «${pedazo}»`);
    assert.ok(sbPag.includes(pedazo), `la página de /m/second-brain no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  for (const lay of [chats, sb]) assert.match(lay, /const pedido = await pedidoMovilActual\(\);/, 'un layout de /m mira la ruta de SU página, no la del navegador');
});
