// =============================================================================
// Closing, Ads y Landing Analyst se retiraron: nadie las vuelve a ENLAZAR, y cada link aterriza
// =============================================================================
// Decisiones 4, 5 y 6 de Martín (11/10/2026): lo de Ads Analyst se muda a Ads Writer, lo de Landing
// Analyst a Landing Generator, y Closing Analyst va COMPLETO al Dashboard; las tres tabs se ELIMINAN y
// sus rutas redirigen. Lo que este archivo persigue es lo que un retiro rompe SIN avisar (AGENTS.md,
// «Retirar una RUTA es enumerar sus links…» y «Una ruta que apunta a la nada no rompe nada»):
//   · un link del producto que sigue apuntando a la ruta vieja: no rompe, rebota, y cada rebote es un
//     salto más y una pantalla que ya no es la que el link prometía;
//   · un link a una HOJA del Dashboard que no existe en el informe: caía en la primera sin avisar;
//   · lo que nombra una tab que ya no está en la sidebar (la capacidad del Perro, el «Ver en …» de la
//     Retro, el área de la API, la tarjeta del link en WhatsApp).
//
// ⚠️ Los barridos leen `git ls-files` (el ÍNDICE): un archivo nuevo sin `git add` no lo ve nadie. Es el
// mismo trato que el resto de los guards de rutas del repo.
// ⚠️ LAS APIs NO SE RENOMBRAN: `/api/closing/*`, `/api/ads-analyst/*`, `/api/landing-analyst/*` y la ruta
// REST `/closing/...` del área closing (lib/api-mako/rest.ts, relativa a /api/v1) siguen. Tampoco
// `/vsl/closing`, que es otra cosa. El patrón exige que la ruta ARRANQUE la cadena (o siga a un
// `${APP_URL}`), así que ninguna de ésas calza.
//
// TANDA v5 (12/10/2026, punto 22): VSL, CS y Chat Analyst también se retiraron —eran «pronto» en el desplegable
// «Analysts», que salió entero de la sidebar— y sus rutas redirigen a su hoja del Dashboard (`?hoja=vsl-analyst`,
// `cs-analyst`, `chat-analyst`). Y el texto de Equipo dice qué ve un SETTER (la hoja Chat Analyst).
//
// Correr: npx tsx --test tests/tabs-retiradas.test.ts
//
// PROBADO ROMPIÉNDOLO: los números están al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TODOS_LOS_ITEMS } from '../app/_components/nav';
import { CAPACIDADES, capacidad } from '../lib/mako-capacidades';
import { TOOL_HREF, TOOL_LABEL } from '../lib/retro-reporte';
import { previewDeDestino } from '../lib/preview-links';
import { AREA_INFO } from '../lib/api-mako/tipos';
import { hojaDestino, tableroInicial } from '../lib/graficos-plantillas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas PRIMERO y los bloques después: un `/*` dentro de un `//` se comería el código. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const RETIRADAS = ['/closing', '/ads-analyst', '/landing-analyst', '/vsl-analyst', '/cs-analyst', '/chat-analyst'] as const;

function archivosDeProducto(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 300, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/** El camino de un href (sin query ni ancla). */
const camino = (href: string) => href.split('#')[0].split('?')[0];
/** El ítem de la barra que se enciende en ese camino. */
const itemDe = (href: string) => TODOS_LOS_ITEMS.find((i) => i.match(camino(href)));

/** Lo que se saltea el barrido, cada cosa con su motivo. */
const NO_SON_LINKS: ReadonlyArray<{ re: RegExp; por: string }> = [
  // Los redirects: nombrarse es su trabajo.
  { re: /^app\/(closing|ads-analyst|landing-analyst|vsl-analyst|cs-analyst|chat-analyst)\/(.*\/)?page\.tsx$/, por: 'es el redirect de la ruta retirada' },
  // El registro de /admin/dev y el catálogo de /admin/docs cuentan en prosa, dentro de cadenas, qué
  // rutas se retiraron: es documentación, no un destino (el mismo criterio que tests/analisis-mudada.test.ts).
  { re: /^app\/admin\/dev\/.*bitacora\.ts$/, por: 'documentación' },
  { re: /^app\/admin\/dev\/areas\.ts$/, por: 'documentación' },
  { re: /^app\/admin\/dev\/_historial\.generado\.ts$/, por: 'historial generado de git' },
  { re: /^app\/admin\/docs\/catalogo\.ts$/, por: 'documentación' },
  // Las rutas REST de la API de MaKo, relativas a /api/v1: `/closing/closers` es el área closing, no
  // la pantalla. Las APIs no se renombran con la tab.
  { re: /^lib\/api-mako\/rest\.ts$/, por: 'rutas REST de /api/v1' },
];

/**
 * Los links vivos que se toleran HOY, uno por uno, FECHADOS y con su dueño. No es un comodín por
 * archivo: la línea tiene que contener ESE fragmento.
 */
const TOLERADOS: ReadonlyArray<{ archivo: string; fragmento: string; desde: string; por: string }> = [
];

/** Dónde está enlazada una ruta retirada (archivo:línea), salteando lo de arriba. */
function linksVivos(ruta: string): string[] {
  const esc = ruta.replace(/[-/]/g, '\\$&');
  // Una CADENA que arranca con la ruta, o la ruta pegada a una interpolación (`${APP_URL}/closing`, el
  // prompt de MaKo en WhatsApp). Termina en lo que no sigue un nombre: `?`, `/`, comilla, punto, espacio.
  const re = new RegExp(`(?:['"\`]|\\$\\{[^}]*\\})${esc}(?![\\w-])`);
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (NO_SON_LINKS.some((x) => x.re.test(f))) continue;
    if (!existsSync(join(RAIZ, f))) continue; // en el índice y borrado del disco: otra sesión trabajando
    leer(f).split('\n').forEach((linea, i) => {
      // Una línea de comentario no tiene links, y la casa nombra rutas entre backticks en la prosa.
      if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
      // `starts('/closing')` en un matcher del nav marca la tab al llegar por un link viejo: se quiere.
      const sinMatchers = linea.replace(/starts\(\s*['"`][^'"`]+['"`]\s*\)/g, '');
      if (!re.test(sinMatchers)) return;
      if (TOLERADOS.some((t) => t.archivo === f && linea.includes(t.fragmento))) return;
      malos.push(`${f}:${i + 1}`);
    });
  }
  return malos;
}

test('nadie del producto enlaza /closing, /ads-analyst, /landing-analyst ni las de v5 (sólo sus redirects)', () => {
  const malos = RETIRADAS.flatMap((r) => linksVivos(r).map((x) => `${r} ← ${x}`));
  assert.deepEqual(malos, [], 'hay links vivos a una tab retirada: van a su hoja del Dashboard o a la tab que se quedó con la tarea');
});

test('las rutas viejas REDIRIGEN (con el ?ws=) y no montan la pantalla vieja', () => {
  const paginas: Array<[string, RegExp]> = [
    ['app/closing/page.tsx', /redirect\(await rutaConWs\(destinoDeClosing\(await searchParams\)\)\)/],
    ['app/ads-analyst/page.tsx', /redirect\(await rutaConWs\('\/dashboard\?hoja=ads-analyst'\)\)/],
    ['app/ads-analyst/guiones/page.tsx', /redirect\(await rutaConWs\('\/dashboard\?hoja=ads-analyst'\)\)/],
    ['app/landing-analyst/page.tsx', /redirect\(await rutaConWs\(/],
    // v5: las tres que quedaban en el desplegable «Analysts».
    ['app/vsl-analyst/page.tsx', /redirect\(await rutaConWs\('\/dashboard\?hoja=vsl-analyst'\)\)/],
    ['app/cs-analyst/page.tsx', /redirect\(await rutaConWs\('\/dashboard\?hoja=cs-analyst'\)\)/],
    ['app/chat-analyst/page.tsx', /redirect\(await rutaConWs\('\/dashboard\?hoja=chat-analyst'\)\)/],
  ];
  for (const [f, re] of paginas) {
    const src = sinComentarios(leer(f));
    assert.match(src, re, `${f}: no redirige con rutaConWs (perdería el ?ws= del cliente que mira el super admin)`);
    assert.doesNotMatch(src, /<(ClosingBrowser|ScriptsBrowser|LandingAnalystApp|ChatAnalystVista|DashboardChatAgent|ComingSoon)\b/, `${f}: volvió a montar la pantalla vieja`);
  }
  // La cáscara de /chat-analyst se borró con la ruta (v5): su dashboard es la hoja Chat Analyst.
  assert.ok(!existsSync(join(RAIZ, 'app/chat-analyst/ChatAnalystVista.tsx')), 'volvió la pantalla vieja de /chat-analyst');
  // La tab vieja de Closing ya no tiene pantalla: su detalle es la ficha del Dashboard.
  assert.ok(existsSync(join(RAIZ, 'app/dashboard/entidades/FichaLlamada.tsx')), 'falta la ficha de la llamada en el Dashboard');
});

test('cada link a una hoja del Dashboard que escribe el producto abre ESA hoja (ninguno cae en la primera)', () => {
  // `?hoja=` nombra una plantilla o una hoja del informe inicial; `hojaDestino` la encuentra o la agrega.
  // Un nombre mal escrito no da error: abre Marketing.
  const ini = tableroInicial();
  const pedidas = new Map<string, string>();
  for (const f of archivosDeProducto()) {
    if (!existsSync(join(RAIZ, f))) continue;
    for (const m of leer(f).matchAll(/\/dashboard\?hoja=([a-z0-9-]+)/g)) if (!pedidas.has(m[1])) pedidas.set(m[1], f);
  }
  for (const href of Object.values(TOOL_HREF)) { const m = href?.match(/\?hoja=([a-z0-9-]+)/); if (m) pedidas.set(m[1], 'lib/retro-reporte.ts'); }
  assert.ok(pedidas.size >= 5, `encontré ${pedidas.size} hojas enlazadas: el barrido no está mirando`);
  for (const [hoja, f] of pedidas) assert.equal(hojaDestino(ini, hoja).hojaId, hoja, `«?hoja=${hoja}» (${f}) no es una hoja ni una plantilla: abre la primera`);
});

test('lo que nombra una tab: capacidades del Perro, «Ver en…» de la Retro, el área de la API y la tarjeta de WhatsApp', () => {
  // Las capacidades (el botón de una tarea del plan): a dónde manda cada una y cómo se llama ahí.
  const esperadas: Array<[string, string, string]> = [
    ['llamadas', 'Dashboard', '/dashboard?hoja=closing'],
    ['guiones-ads', 'Dashboard', '/dashboard?hoja=ads-analyst'],
    ['guion-valorar', 'Ads Writer', '/ads-writer?tab=analizar'],
    ['landing-diagnosticar', 'Web Generator', '/web-generator/analizar'],
  ];
  for (const [id, tab, ruta] of esperadas) {
    const c = capacidad(id);
    assert.ok(c, `falta la capacidad ${id}`);
    assert.equal(c!.ruta, ruta, id);
    assert.equal(c!.tab, tab, id);
    // La tab que nombra es la que se enciende en la barra al llegar (si no, la persona busca otra).
    assert.equal(itemDe(ruta)?.label, tab, `${id}: «${tab}» no es la tab que abre ${ruta}`);
  }
  for (const c of CAPACIDADES) {
    assert.ok(!['Closing Analyst', 'Ads Analyst', 'Landing Analyst'].includes(c.tab), `${c.id} nombra una tab que ya no está`);
    assert.ok(!c.como.some((p) => /Entra a (Closing|Ads|Landing) Analyst/.test(p)), `${c.id} manda a entrar a una tab que ya no está`);
  }
  // «Ver en … →» de la Retro: la hoja, con el nombre de la hoja.
  assert.equal(TOOL_HREF.closing, '/dashboard?hoja=closing');
  assert.equal(TOOL_HREF.script, '/dashboard?hoja=ads-analyst');
  assert.equal(TOOL_HREF.landing, '/dashboard?hoja=landing');
  assert.equal(TOOL_LABEL.closing, 'Closing');
  // v5: VSL, CS y Chat Analyst son hojas, y «Ver en…» lleva a cada una (antes no había a dónde).
  assert.deepEqual([TOOL_HREF.vsl, TOOL_HREF.cs, TOOL_HREF.chats], ['/dashboard?hoja=vsl-analyst', '/dashboard?hoja=cs-analyst', '/dashboard?hoja=chat-analyst']);
  assert.equal(TOOL_LABEL.chats, 'Chat Analyst');
  // El área de la API: la tab y la ruta donde vive hoy (la referencia y la consola de tokens las muestran).
  assert.deepEqual([AREA_INFO.closing.tab, AREA_INFO.closing.ruta], ['Dashboard', '/dashboard?hoja=closing']);
  assert.deepEqual([AREA_INFO.landing.tab, AREA_INFO.landing.ruta], ['Web Generator', '/web-generator']);
  for (const a of [AREA_INFO.closing, AREA_INFO.landing]) assert.equal(itemDe(a.ruta)?.label, a.tab, `${a.ruta} no enciende «${a.tab}»`);
  // La tarjeta del link en WhatsApp: el link nuevo dice lo mismo que el viejo, y no se lee como anuncios.
  assert.equal(previewDeDestino('/dashboard?hoja=closing&llamada=12345').tipo, 'closing');
  assert.equal(previewDeDestino('https://hola-mako.com/dashboard?ws=3&hoja=closing').tipo, 'closing');
  assert.equal(previewDeDestino('/closing?call=12345').tipo, 'closing', 'los links viejos que ya salieron');
  assert.equal(previewDeDestino('/dashboard').tipo, 'ads');
  assert.equal(previewDeDestino('/dashboard?hoja=marketing').tipo, 'ads');
  assert.notEqual(previewDeDestino('/closing-script').tipo, 'closing', 'Closing Script no es el análisis de llamadas');
  assert.ok(!previewDeDestino('/dashboard?hoja=closing&llamada=12345').descripcion.includes('12345'), 'el id de la llamada se filtró a la tarjeta');
});

test('MaKo en WhatsApp manda el link nuevo de una llamada, y el texto de Equipo dice qué ve un closer y un setter', () => {
  // El prompt arma el link a mano con `${APP_URL}`: es el que vuelve a nacer viejo si alguien lo copia.
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /\$\{APP_URL\}\/dashboard\?hoja=closing&llamada=\{recording_id\}/);
  assert.doesNotMatch(doer, /\/closing\?call=/);
  // Desde el 15/10/2026 el texto vive UNA vez: Equipo es su propia sección de «Configuración del negocio».
  for (const f of ['app/equipo/page.tsx']) {
    const src = leer(f);
    assert.doesNotMatch(src, /Closing Analyst/, `${f} promete una tab que ya no está`);
    assert.match(src, /El <b>Closer<\/b> ve CRM, WhatsApp y la hoja Closing del Dashboard/, f);
    // v5: el setter ve SÓLO la hoja Chat Analyst del Dashboard (y Automations, que el nav ya le daba).
    assert.match(src, /el <b>Setter<\/b> ve CRM, WhatsApp, Email, Automations y la hoja Chat Analyst del Dashboard/, f);
  }
});

// PROBADO ROMPIÉNDOLO (11/10/2026; base en verde: 5 pasan, 0 fallan). Una rotura por vez, con un arnés
// que restaura deshaciendo el reemplazo (nunca con git) y verifica que el archivo quedó idéntico
// (pasan / fallan):
//   · la capacidad `llamadas` vuelve a ruta '/closing'                      -> 3 / 2 (el barrido y lo que nombra una tab)
//   · el ejemplo del prompt de WhatsApp vuelve a `${APP_URL}/closing`        -> 4 / 1 (sólo lo ve la rama `${…}` del patrón)
//   · TOOL_HREF.closing con `?hoja=closin`                                   -> 3 / 2 (no resuelve; y el valor esperado)
//   · preview-links sin la regla `hoja: 'closing'`                           -> 4 / 1
//   · /closing redirige sin rutaConWs                                         -> 4 / 1
//   · Configuraciones vuelve a decir «Closing Analyst»                       -> 4 / 1
//   · el guard sin la salida de lib/api-mako/rest.ts                         -> 4 / 1 (las rutas REST SÍ calzan: la salida hace falta)
//   · el guard sin la excepción fechada (era DialogoAnalitica.tsx; desde el 11/10 sin excepciones)
// Y LO DE v5 (12/10/2026; base en verde: 5 / 0; arnés que restaura de memoria y compara el hash):
//   · TOOL_HREF.chats con `?hoja=chat-analist`                               -> 3 / 2 (no resuelve; y el valor esperado)
//   · TOOL_HREF.cs vuelve a `/cs-analyst`                                    -> 3 / 2 (el barrido y el valor esperado)
//   · /cs-analyst redirige sin rutaConWs                                      -> 4 / 1
//   · /chat-analyst vuelve a montar DashboardChatAgent                        -> 4 / 1
//   · vuelve app/chat-analyst/ChatAnalystVista.tsx                            -> 4 / 1
//   · Configuraciones vuelve a la frase vieja del Setter («CRM, WhatsApp y Email») -> 4 / 1
