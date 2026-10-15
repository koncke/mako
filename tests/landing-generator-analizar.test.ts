// =============================================================================
// Landing Analyst → Landing Generator (11/10/2026): el diagnóstico se mudó y la tab se retiró
// =============================================================================
// Decisión de Martín: «Lo de Landing Analyst se muda a Landing Generator y Landing Analyst se
// ELIMINA (la ruta redirige)». Lo que este archivo fija:
//   1. /landing-analyst REDIRIGE, y TRADUCE la pestaña: `?tab=pulso|mapa` (análisis) → la hoja
//      «Landing» del Dashboard; todo lo demás (el diagnóstico) → /landing-generator/analizar con la
//      query entera menos `tab`. Siempre con `rutaConWs` (un redirect pelado pierde la pestaña del
//      cliente que mira el super admin). La traducción se EJECUTA, no se lee.
//   2. La pantalla nueva: guard de Landing Generator ANTES de leer nada, el componente importado
//      de donde estaba (no se mudó: la sesión del editor de landings toca su link de «Escribir la
//      nueva versión»), y la carpeta estática `analizar/`.
//   3. El componente quedó SÓLO con la tarea: sin las pestañas «Lo que mide tu Pixel» y «Mapa de
//      calor», sin los KPIs del pie y sin escribir la URL vieja — y con TODAS las tareas adentro
//      (analizar, buscar, pegar el texto, reintentar, quitar, escribir la nueva versión). Un recorte
//      que se lleva una tarea deja al cliente sin la única pantalla para hacerla.
//   4. El onboarding de 'landing-an' apunta a la pantalla nueva con la MISMA key y los MISMOS pasos
//      (están escritos en la base: cambiarlos reabre el onboarding de todos).
//   5. La API de MaKo deja de nombrar las tabs retiradas en lo que lee el modelo, y el gating sigue
//      en 'landing-an'.
//   6. Voseo de los archivos NUEVOS: el guard que barre el repo usa `git ls-files` y no los ve.
//
// PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez contra la base en verde de este archivo
// (12 pass / 0 fail), con un arnés que restaura DE MEMORIA y verifica con md5 (pass / fail):
//   · destino: «mapa» deja de ser análisis                                   → 11 / 1
//   · destino: el diagnóstico no saca `tab`                                   → 11 / 1
//   · destino: la hoja pierde el `?ws=` que traía el link                     → 10 / 2
//   · el redirect sin la query (`destinoLandingAnalyst({})`)                  → 11 / 1
//   · el redirect sin `rutaConWs`                                             → 11 / 1
//   · la página nueva con el guard de la key vieja (`nav: 'landing-an'`)      → 11 / 1
//   · la página nueva lee los diagnósticos ANTES del guard                    → 11 / 1
//   · la página nueva importa una copia del componente (`./LandingAnalystApp`) → 11 / 1
//   · vuelve `import { Tabs }` al componente                                  → 11 / 1
//   · el componente vuelve a escribir `'/landing-analyst?tab=pulso'`          → 11 / 1
//   · vuelve `kpis` al componente (el pie)                                    → 11 / 1
//   · el recorte se lleva «Buscar mis páginas»                                → 11 / 1
//   · la vuelta apunta a otra cosa que /landing-generator                     → 11 / 1
//   · el onboarding vuelve a `href: '/landing-analyst'`                       → 11 / 1
//   · el onboarding renombra el paso `seguimiento`                            → 11 / 1
//   · vuelve «Landing Analyst» a una descripción de la API                    → 11 / 1
//   · vuelve «Closing Analyst» al parámetro de ver_activacion_tab             → 11 / 1
//   · el diagnóstico pasa a gatearse con 'landing-writer'                     → 11 / 1
//   · «Mirá tu landing» en el componente (voseo)                              → 11 / 1
//   · CONTROL: la ruta vieja sólo en un comentario (prosa, no un link)        → 12 / 0
// Restaurado: 12 / 0, los siete archivos con su md5 de antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { destinoLandingAnalyst, RUTA_DIAGNOSTICO, RUTA_HOJA_LANDING } from '../app/landing-analyst/destino';
import { conWs } from '../lib/ws-tab';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { DEFS as DEFS_LANDING } from '../lib/api-mako/areas/landing.def';
import { DEFS as DEFS_INTEGRACIONES } from '../lib/api-mako/areas/integraciones.def';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (un `/*` adentro de un `//` abre un bloque falso)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\}/g, '');          // lo que queda de un `{/* … */}` de JSX

const PAGINA_NUEVA = 'app/web-generator/analizar/page.tsx';
const REDIRECT = 'app/landing-analyst/page.tsx';
const DESTINO = 'app/landing-analyst/destino.ts';
const COMPONENTE = 'app/landing-analyst/LandingAnalystApp.tsx';

// ── 1 · El redirect traduce la pestaña ───────────────────────────────────────────────────────

test('las rutas de destino: el diagnóstico en Web Generator y la hoja Landing del Dashboard', () => {
  assert.equal(RUTA_DIAGNOSTICO, '/web-generator/analizar');
  assert.equal(RUTA_HOJA_LANDING, '/dashboard?hoja=landing');
});

test('`?tab=pulso` y `?tab=mapa` (análisis) van a la hoja Landing del Dashboard, con el `?ws=` si venía', () => {
  assert.equal(destinoLandingAnalyst({ tab: 'pulso' }), '/dashboard?hoja=landing');
  assert.equal(destinoLandingAnalyst({ tab: 'mapa' }), '/dashboard?hoja=landing');
  assert.equal(destinoLandingAnalyst({ tab: 'mapa', ws: '3' }), '/dashboard?hoja=landing&ws=3');
  // Lo demás no viaja a la hoja: el pulso y el mapa no leían nada más.
  assert.equal(destinoLandingAnalyst({ tab: 'pulso', url: 'https://a.com/x', ws: '3' }), '/dashboard?hoja=landing&ws=3');
  // Un parámetro repetido: manda el primero, como en cualquier lectura de la query de la casa.
  assert.equal(destinoLandingAnalyst({ tab: ['mapa', 'copy'] }), '/dashboard?hoja=landing');
});

test('todo lo demás es el diagnóstico: /web-generator/analizar con la query entera MENOS `tab`', () => {
  assert.equal(destinoLandingAnalyst({}), '/web-generator/analizar');
  assert.equal(destinoLandingAnalyst({ tab: 'copy' }), '/web-generator/analizar');
  assert.equal(destinoLandingAnalyst({ tab: ['copy', 'mapa'] }), '/web-generator/analizar', 'el primero manda también en el diagnóstico');
  // La comparación es exacta, como la de la tab vieja: una pestaña que no existe abría el diagnóstico.
  assert.equal(destinoLandingAnalyst({ tab: 'Pulso' }), '/web-generator/analizar');
  assert.equal(destinoLandingAnalyst({ tab: 'inexistente', url: 'https://a.com/x', ws: '3' }),
    '/web-generator/analizar?url=https%3A%2F%2Fa.com%2Fx&ws=3');
  assert.equal(destinoLandingAnalyst({ a: ['1', '2'], vacio: '', nada: undefined }), '/web-generator/analizar?a=1&a=2&vacio=');
});

test('con `rutaConWs` encima: el `?ws=` que ya trae el link se respeta, y si no trae, se agrega el de la pestaña', () => {
  // `rutaConWs(href)` es `conWs(href, <ws de la pestaña>)` (lib/workspace.ts).
  assert.equal(conWs(destinoLandingAnalyst({ tab: 'pulso' }), 7), '/dashboard?hoja=landing&ws=7');
  assert.equal(conWs(destinoLandingAnalyst({ tab: 'pulso', ws: '3' }), 7), '/dashboard?hoja=landing&ws=3');
  assert.equal(conWs(destinoLandingAnalyst({}), 7), '/web-generator/analizar?ws=7');
  assert.equal(conWs(destinoLandingAnalyst({}), null), '/web-generator/analizar', 'un cliente normal no tiene pestaña');
});

test('/landing-analyst es SÓLO el redirect, con `rutaConWs` y la query', () => {
  const page = sinComentarios(leer(REDIRECT));
  assert.match(page, /redirect\(await rutaConWs\(destinoLandingAnalyst\(await searchParams\)\)\)/,
    'el redirect perdió la query (el `?tab=` que hay que traducir) o el `?ws=` de la pestaña');
  assert.doesNotMatch(page, /LandingAnalystApp|getLandingViewData/, 'la ruta retirada volvió a dibujar la pantalla');
  // Los componentes de la carpeta se quedan: el Dashboard monta el mapa desde acá.
  const carpeta = readdirSync(join(RAIZ, 'app/landing-analyst')).sort();
  for (const f of ['LandingAnalystApp.tsx', 'MapaDeCalor.tsx', 'PulsoPaginas.tsx', 'destino.ts', 'page.tsx']) {
    assert.ok(carpeta.includes(f), `falta app/landing-analyst/${f}`);
  }
});

// ── 2 · La pantalla nueva ─────────────────────────────────────────────────────────────────────

// Tanda 2 del editor de landings (T2, 11/10/2026: «"Diagnóstico" no debería ser otra ruta, debería
// abrirse ahí a la derecha»): esta ruta pasó a REDIRIGIR al Panel con el Diagnóstico abierto. Lo que
// sigue valiendo: la puerta ANTES de cualquier otra cosa, y el `?ws=` (rutaConWs). La traducción de
// la query (`destinoAnalizar`, puro) la prueba tests/editor-landing-panel.test.ts. Actualizado en la
// integración (12/10/2026). Probado rompiéndolo: el redirect antes del guard → 1 fallo; sin
// rutaConWs → 1 fallo; vuelve el import de LandingAnalystApp → 1 fallo.
test('/web-generator/analizar: la puerta de Web Generator ANTES del redirect al Panel, con el ?ws=', () => {
  assert.ok(existsSync(join(RAIZ, PAGINA_NUEVA)), 'falta la ruta del diagnóstico');
  const src = sinComentarios(leer(PAGINA_NUEVA));
  const guard = src.indexOf("await requireRolWs([], { nav: 'landing-writer' });");
  const salto = src.indexOf('redirect(');
  assert.ok(guard > 0, 'la ruta no tiene la puerta de Web Generator (admin + landing-writer en la capa)');
  assert.ok(salto > guard, 'el redirect corre antes del guard');
  assert.match(src, /redirect\(await rutaConWs\(destinoAnalizar\(await searchParams\)\)\);/);
  assert.doesNotMatch(src, /LandingAnalystApp|getLandingViewData/, 'el diagnóstico ya no se dibuja en esta ruta: se abre en el Panel');
  assert.match(src, /export const dynamic = 'force-dynamic';/);
  assert.doesNotMatch(src, /<Suspense/, 'una página privada no necesita Suspense');
});

// ── 3 · El componente: sólo la tarea, y la tarea entera ──────────────────────────────────────

test('el componente perdió las pestañas, los KPIs del pie y la URL vieja', () => {
  const src = sinComentarios(leer(COMPONENTE));
  assert.doesNotMatch(src, /import \{[^}]*\bTabs\b[^}]*\} from/, 'volvieron las pestañas');
  assert.doesNotMatch(src, /\bPulsoPaginas\b|\bMapaDeCalor\b/, 'el pulso o el mapa volvieron a la tarea (son la hoja Landing del Dashboard)');
  assert.doesNotMatch(src, /vistaInicial|cambiarVista|vista === '/, 'volvió el estado de la pestaña');
  assert.doesNotMatch(src, /<Kpi\b|kpis\.|Páginas analizadas|Hallazgos graves/, 'volvieron los KPIs del pie (son análisis)');
  // Ninguna cadena que ARRANQUE con la ruta retirada (las de /api/landing-analyst/* no se renombran).
  for (const f of [COMPONENTE, PAGINA_NUEVA, DESTINO, REDIRECT]) {
    const malas = sinComentarios(leer(f)).split('\n').filter((l) => /['"`]\/landing-analyst(?![\w-])/.test(l));
    assert.deepEqual(malas, [], `${f} vuelve a enlazar la tab retirada`);
  }
});

test('…y conserva TODAS las tareas del diagnóstico', () => {
  const src = sinComentarios(leer(COMPONENTE));
  const tareas: Array<[RegExp, string]> = [
    [/fetch\('\/api\/landing-analyst\/analyze'/, 'analizar una URL'],
    [/fetch\('\/api\/landing-analyst\/sync'/, 'Buscar mis páginas'],
    [/fetch\(`\/api\/landing-analyst\/view\?url=\$\{encodeURIComponent\(u\)\}`, \{ method: 'DELETE' \}\)/, 'quitar de la lista'],
    [/'Buscar mis páginas'/, 'el botón de buscar'],
    [/'Analizar con este texto'/, 'pegar el texto de una página que se arma en el navegador'],
    [/Tu seguimiento vio estas páginas/, 'los chips de lo que vio el Pixel'],
    [/>Reintentar</, 'reintentar'],
    [/'Volver a analizar'/, 'volver a analizar'],
    [/Quitar de la lista/, 'quitar'],
    [/Escribir la nueva versión/, 'escribir la nueva versión'],
    [/<Comportamiento c=\{sel\.comportamiento\} \/>/, 'el comportamiento medido, arriba del diagnóstico'],
    [/router\.refresh\(\), 15_000/, 'el sondeo mientras un análisis automático corre por detrás'],
  ];
  const faltan = tareas.filter(([re]) => !re.test(src)).map(([, que]) => que);
  assert.deepEqual(faltan, [], 'el recorte se llevó una tarea');
  // El nivel de arriba de esta pantalla es el panel de la tab, con el Link de la casa (lleva el ?ws=).
  assert.match(src, /<Link href="\/web-generator" style=/, 'falta la vuelta a Web Generator');
  assert.match(src, /^import Link from '@\/app\/_ui\/Link';$/m);
});

// ── 4 · El onboarding ─────────────────────────────────────────────────────────────────────────

test("el onboarding de 'landing-an' apunta a la pantalla nueva, con la misma key y los mismos pasos", () => {
  const def = TAB_ONBOARDINGS['landing-an'];
  assert.ok(def, "se fue el onboarding 'landing-an' (la key está escrita en la base)");
  assert.equal(def.key, 'landing-an');
  assert.equal(def.href, '/web-generator/analizar');
  assert.deepEqual(def.pasos.map((p) => [p.key, p.opcional === true]), [['analizar', false], ['seguimiento', true]],
    'cambió un paso: el registro compartido los guarda por key');
});

// ── 5 · La API de MaKo ────────────────────────────────────────────────────────────────────────

/** Todo lo que lee el modelo (o la persona en una confirmación) de una operación. */
function textosDe(d: { titulo: string; descripcion: string; escribe?: string; parametros: readonly { descripcion?: string }[] }): string[] {
  return [d.titulo, d.descripcion, d.escribe ?? '', ...d.parametros.map((p) => p.descripcion ?? '')];
}

test('la API de MaKo ya no nombra las tabs retiradas en lo que lee el modelo', () => {
  // «la hoja Ads Analyst del Dashboard» SÍ vale: es el nombre de la hoja (lib/graficos-plantillas-analysts.ts).
  const malas: string[] = [];
  for (const d of [...DEFS_LANDING, ...DEFS_INTEGRACIONES]) {
    for (const t of textosDe(d)) if (/(?<!hoja )\b(Landing|Closing|Ads) Analyst\b|\/landing-analyst(?![\w-])/.test(t)) malas.push(`${d.id}: ${t.slice(0, 90)}`);
  }
  assert.deepEqual(malas, []);
});

test("…y el gating del diagnóstico sigue en 'landing-an' (la key es un contrato de la base)", () => {
  const delDiagnostico = ['listar_landings_detectadas', 'listar_analisis_landing', 'ver_diagnostico_landing', 'ver_comportamiento_landing', 'analizar_landing', 'borrar_analisis_landing'];
  for (const id of delDiagnostico) {
    const d = DEFS_LANDING.find((x) => x.id === id);
    assert.ok(d, `se fue ${id}`);
    assert.equal(d.gating?.tab, 'landing-an', `${id} cambió de key`);
    assert.equal(d.gating?.rolMinimo, 'admin', `${id} perdió el rol mínimo (la pantalla es sólo admin)`);
  }
});

// ── 6 · Voseo de lo nuevo ─────────────────────────────────────────────────────────────────────

test('ni la pantalla nueva, ni el redirect, ni el componente, ni la API tienen voseo', () => {
  const malas: Record<string, string[]> = {};
  for (const f of [PAGINA_NUEVA, REDIRECT, DESTINO, COMPONENTE]) {
    const m = marcasDeVoseo(sinComentarios(leer(f)));
    if (m.length) malas[f] = m;
  }
  for (const d of [...DEFS_LANDING, ...DEFS_INTEGRACIONES]) {
    const m = marcasDeVoseo(textosDe(d).join(' '));
    if (m.length) malas[d.id] = m;
  }
  assert.deepEqual(malas, {});
});
