// =============================================================================
// Los editores de imagen y de video, en los DOS planes; editar con IA, SÓLO en MaKo Pro (14/11/2026)
// =============================================================================
// Martín: «el editor de imágenes y editor de videos sí deberían estar disponibles para la versión de 47, pero no deberían
// estar disponibles el tema de editar con inteligencia artificial». Hasta ese día `image-editor` y `video-editor` estaban en
// `TABS_SOLO_PRO` / `NAV_SOLO_PRO`: un Esencial rebotaba de la tab entera. Lo que se cuida acá:
//   1. la regla: las tabs salieron, 'ia-editores' es la función de Pro y su texto;
//   2. el editor SIN IA no tiene candado de plan: las puertas de las páginas, de su API y de la API de MaKo son las de toda
//      tab, y ninguna ruta del editor que no llame a la IA mira el plan;
//   3. el candado del SERVIDOR (lib/editores-ia-pro.ts) en CADA ruta que llama a la IA, antes de llamarla y después de la
//      puerta (401 / 404 primero); y en la API de MaKo, al proponer y al ejecutar las operaciones con IA;
//   4. la PANTALLA: un Esencial ve el candado con «Pasar a Pro» en cada entrada a la IA (el chat de Image, el de Video, la
//      «Edición automática», «Clips mágicos», «B-roll de MaKo», «Editar» un ejemplo y «Replicar en Image» de Spy), y el primer
//      403 del servidor también lo prende (app/_components/solo-pro.ts).
//
// Correr: node --import tsx --test tests/editores-ia-solo-pro.test.ts
// Probado rompiéndolo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FUNCIONES_SOLO_PRO, RUTA_CAMBIAR_PLAN, TABS_SOLO_PRO, textoSoloPro } from '../lib/topes-plan';
import { NAV_SOLO_PRO, esNavSoloPro } from '../lib/plan-esencial-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: lo que dice un comentario no es lo que corre. */
const codigo = (rel: string) => fuente(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function rutasDe(dir: string): string[] {
  const salida: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) salida.push(...rutasDe(rel));
    else if (n === 'route.ts') salida.push(rel);
  }
  return salida;
}

/** El cuerpo de una operación de un `.run.ts` de la API de MaKo: desde `  id: {` hasta la operación siguiente. */
function operacion(rel: string, id: string): string {
  const src = codigo(rel);
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i >= 0, `no encontré ${id} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.slice(1).search(/\n {2}[a-z_]+: \{/);
  return fin > 0 ? resto.slice(0, fin + 1) : resto;
}

/** Lo que llama a la IA desde un editor (o desde su réplica): con esto en la ruta, la ruta lleva el candado. */
const LLAMA_A_LA_IA = /\b(editarImagen|editarVideo|replicarEjemplo|replicarCarrusel|leerLoQueTiene|elegirClips|elegirBroll|conSuIADelNegocio)\(/;
const CANDADO_RUTA = /const pro = await candadoIaDeEditores\(\);\n\s*if \(pro\) return pro;/;

test('1 · la regla: los editores salieron de lo que es sólo de Pro, y su IA entró, con su texto', () => {
  for (const t of ['image-editor', 'video-editor']) {
    assert.equal((TABS_SOLO_PRO as readonly string[]).includes(t), false, `${t} sigue en TABS_SOLO_PRO: la vitrina lo vende como sólo de Pro`);
    assert.equal(NAV_SOLO_PRO.has(t), false, `${t} sigue en NAV_SOLO_PRO: un Esencial rebota de la tab entera`);
    assert.equal(esNavSoloPro(t), false);
  }
  assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes('ia-editores'));
  assert.equal(textoSoloPro('ia-editores'), 'Editar con IA es de MaKo Pro. Pasa a Pro para usarlo.');
  assert.equal(RUTA_CAMBIAR_PLAN, '/configuraciones/plan', '«Pasar a Pro» lleva a «Tu plan»');
});

test('2 · el editor SIN IA no tiene candado de plan: páginas, su API y la API de MaKo son las de toda tab', () => {
  for (const rel of ['app/image-editor/acceso.ts', 'lib/image-editor/acceso.ts', 'app/video-editor/acceso.ts']) {
    assert.doesNotMatch(codigo(rel), /esEsencial|esNavSoloPro|SOLO_PRO|candadoIaDeEditores/, `${rel}: el editor volvió a mirar el plan`);
  }
  assert.match(codigo('app/image-editor/acceso.ts'), /await requireRolWs\(\[\], \{ nav: 'image-editor' \}\);/);
  assert.match(codigo('app/video-editor/acceso.ts'), /await requireRolWs\(\[\], \{ nav: 'video-editor' \}\);/);
  // La puerta de /api/image-editor/* (y del área `imagen` de la API de MaKo): la de la tab, sin plan.
  const server = codigo('lib/image-editor/server.ts');
  const puerta = server.slice(server.indexOf('export async function puerta('), server.indexOf('\n}', server.indexOf('export async function puerta(')));
  assert.match(puerta, /if \(!\(await veEditorImagen\(\)\)\) return mal\('No existe', 404\);/);
  assert.doesNotMatch(puerta, /esEsencial|candadoIaDeEditores|SOLO_PRO/, 'la puerta del editor de imagen volvió a mirar el plan');
  // La API de MaKo: qué tabs ve un negocio sale de su capa, no de su plan.
  const registro = codigo('lib/api-mako/registro.ts');
  const tabs = registro.slice(registro.indexOf('export function tabsDeCapa('));
  assert.doesNotMatch(tabs.slice(0, tabs.indexOf('\n}')), /esEsencial|SOLO_PRO/);
  assert.doesNotMatch(codigo('lib/api-mako/vista.ts'), /esEsencial|SOLO_PRO/);
  // Cada ruta del editor que NO llama a la IA (diseños, subidos, el hilo guardado del chat, proyectos, presets, propuestas,
  // outliers, Texto a voz, buscar en Pexels…) queda sin candado de plan.
  const rutas = [...rutasDe('app/api/image-editor'), ...rutasDe('app/api/video-editor')];
  assert.ok(rutas.length >= 15, `son ${rutas.length}`);
  for (const r of rutas) {
    const src = codigo(r);
    if (LLAMA_A_LA_IA.test(src)) continue;
    assert.doesNotMatch(src, /candadoIaDeEditores|esEsencial/, `${r}: no usa IA y tiene candado de plan`);
  }
});

test('3 · el candado del servidor: sólo a un Esencial, 403 con el texto y «Pasar a Pro» a «Tu plan»', () => {
  const lib = codigo('lib/editores-ia-pro.ts');
  assert.match(lib, /^import 'server-only';$/m);
  const ruta = lib.slice(lib.indexOf('export async function candadoIaDeEditores('), lib.indexOf('export async function candadoIaDeEditoresDe('));
  assert.match(ruta, /if \(!\(await esEsencialDeLaSesion\(\)\)\) return null;/, 'ante la duda pasa: esEsencialDeLaSesion ya devuelve false');
  assert.match(ruta, /\{ ok: false, error: textoSoloPro\('ia-editores'\), pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \}/);
  assert.match(ruta, /status: 403/);
  const api = lib.slice(lib.indexOf('export async function candadoIaDeEditoresDe('));
  assert.match(api, /return \(await esEsencialDe\(ws\)\) \? textoSoloPro\('ia-editores'\) : null;/, 'la API mira el negocio de `ctx.ws`');
});

test('4 · CADA ruta que llama a la IA lleva el candado, después de la puerta y antes de la IA', () => {
  const conIA = [
    ['app/api/image-editor/ia/route.ts', 'editarImagen('],
    ['app/api/image-editor/carruseles/replicar/route.ts', 'replicarEjemplo('],
    ['app/api/image-editor/carruseles/leer/route.ts', 'leerLoQueTiene('],
    ['app/api/video-editor/ia/route.ts', 'editarVideo('],
    ['app/api/video-editor/clips/route.ts', 'elegirClips('],
    ['app/api/video-editor/broll/route.ts', 'elegirBroll('],
  ] as const;
  for (const [r, ia] of conIA) {
    const src = codigo(r);
    assert.match(src, CANDADO_RUTA, `${r}: sin el candado de Pro`);
    const candado = src.search(CANDADO_RUTA);
    assert.ok(src.indexOf('await puerta()') >= 0 && src.indexOf('await puerta()') < candado, `${r}: el candado antes de la puerta (un 403 a quien no tiene sesión)`);
    assert.ok(candado < src.indexOf(ia, src.indexOf('export async function')), `${r}: la IA se llama antes del candado`);
  }
  // Ninguna ruta de los editores llama a la IA sin el candado (una nueva entra sola a esta regla).
  for (const r of [...rutasDe('app/api/image-editor'), ...rutasDe('app/api/video-editor')]) {
    const src = codigo(r);
    if (LLAMA_A_LA_IA.test(src)) assert.match(src, CANDADO_RUTA, `${r}: llama a la IA sin el candado de Pro`);
  }
  // B-roll: SÓLO `elegir` (la IA). Buscar en Pexels y bajar la foto o el video quedan abiertos.
  const broll = codigo('app/api/video-editor/broll/route.ts');
  assert.equal(broll.match(/await candadoIaDeEditores\(\)/g)?.length, 1, 'el candado del B-roll es uno, el de `elegir`');
  const elegir = broll.slice(broll.indexOf("if (body.accion === 'elegir') {"), broll.indexOf("if (body.accion === 'buscar') {"));
  assert.match(elegir, CANDADO_RUTA, 'el candado no está en `elegir`');
});

test('5 · la API de MaKo: las operaciones con IA lo frenan al proponer y al ejecutar; las que no usan IA, no', () => {
  const rel = 'lib/api-mako/areas/imagen.run.ts';
  for (const id of ['editar_ejemplo_carrusel', 'editar_ejemplo_thumbnail']) {
    const op = operacion(rel, id);
    assert.match(op, /preparar: async \(input, ctx\): Promise<Preparado> => \{\n\s*const pro = await candadoIaDeEditoresDe\(ctx\.ws\);\n\s*if \(pro\) return \{ error: pro \};/, `${id}: sin candado al proponer`);
    assert.match(op, /ejecutar: async \(payload, ctx\): Promise<Ejecutado> => \{\n\s*const pro = await candadoIaDeEditoresDe\(ctx\.ws\);\n\s*if \(pro\) return \{ ok: false, resumen: pro \};/, `${id}: sin candado al ejecutar`);
  }
  // Sin IA: la estructura con guías (lib/carruseles/crear-servidor.ts) y cambiar textos a mano (`cambiarTextos`, puro).
  for (const id of ['crear_carrusel_desde_referencia', 'cambiar_textos_diseno_imagen']) {
    const op = operacion(rel, id);
    assert.doesNotMatch(op, /candadoIaDeEditoresDe|replicarEjemplo|replicarCarrusel/, `${id}: no usa IA, no lleva candado`);
  }
  assert.doesNotMatch(codigo('lib/carruseles/crear-servidor.ts'), /conSuIADelNegocio|replica-servidor/, '«Hacer el mío» empezó a usar IA: lleva candado');
  // Cualquier operación del área que llame a la réplica con IA, con el candado.
  const src = codigo(rel);
  for (const m of src.matchAll(/\n {2}([a-z_]+): \{/g)) {
    const op = operacion(rel, m[1]);
    if (/replicarEjemplo\(|replicarCarrusel\(/.test(op)) assert.match(op, /candadoIaDeEditoresDe\(ctx\.ws\)/, `${m[1]}: usa la IA sin candado`);
  }
});

test('6 · la pantalla: el dato del plan, el candado con «Pasar a Pro» y el 403 que lo prende', async () => {
  // El dato: `planEsencial` de /api/auth/me, la misma lectura de la pestaña; un fallo es «no hay candado».
  const yo = codigo('app/_components/useClienteDeAgencia.ts');
  assert.match(yo, /planEsencial: j\.planEsencial === true,/);
  assert.match(yo, /return leerQuienMira\(\)\.then\(\(q\) => q\?\.planEsencial === true\);/);
  const sp = codigo('app/_components/solo-pro.ts');
  assert.match(sp, /return plan === true \|\| marcada;/);
  // El candado: el texto, «Pasar a Pro» a «Tu plan» adentro de CtaPasarAPro, y sin el botón en el teléfono (no vende).
  const candado = codigo('app/_components/CandadoSoloPro.tsx');
  assert.match(candado, /\{textoSoloPro\(funcion\)\}/);
  assert.match(candado, /\{!telefono && <CtaPasarAPro><Link href=\{RUTA_CAMBIAR_PLAN\} style=\{btnPro\}>\{ROTULO_PASAR_A_PRO\}<\/Link><\/CtaPasarAPro>\}/);

  // Lo que prende el candado sin esperar el plan: la respuesta del servidor.
  const { esRespuestaSoloPro, esSoloPro, marcarSoloPro } = await import('../app/_components/solo-pro');
  assert.equal(esRespuestaSoloPro({ ok: false, error: textoSoloPro('ia-editores'), pasarAPro: RUTA_CAMBIAR_PLAN }), true);
  assert.equal(esRespuestaSoloPro({ ok: false, error: 'Demasiados pedidos. Espera un minuto.' }), false, 'un error cualquiera no es el candado');
  assert.equal(esRespuestaSoloPro(null), false);
  assert.equal(await esSoloPro('ia-editores'), false, 'sin poder leer el plan (acá no hay /api/auth/me), no hay candado');
  marcarSoloPro('ia-editores');
  assert.equal(await esSoloPro('ia-editores'), true, 'el 403 del servidor prende el candado');
});

test('7 · cada entrada a la IA muestra el candado, y su pedido lo prende con el 403', () => {
  const LOCK = /<CandadoSoloPro funcion="ia-editores"/;
  // El chat «MaKo IA» de Image: el candado en vez del chat; «Usar plantilla» (escribe con IA) espera el plan y no corre.
  const image = codigo('app/image-editor/mako/chat/PanelMakoIA.tsx');
  assert.match(image, /const soloPro = useSoloPro\('ia-editores'\);/);
  assert.match(image, /if \(soloPro\) \{\n\s*return \(\n\s*<div className=\{styles\.panel\}>[\s\S]{0,700}?<CandadoSoloPro funcion="ia-editores"/);
  assert.match(image, /if \(plan !== false \|\| soloPro\) return;\n[\s\S]{0,400}?pedirEdicion\(editorRef\.current, PEDIDO_ESCRIBIR_PLANTILLA/, '«Usar plantilla» escribe con IA a un Esencial');
  assert.match(codigo('app/image-editor/mako/chat/acciones.ts'), /if \(res\.status === 403 && esRespuestaSoloPro\(json\)\) marcarSoloPro\('ia-editores'\);/);
  // El chat «Editar con IA» de Video: la caja y las píldoras, por el candado (el hilo y los subtítulos, sin IA, siguen).
  const video = codigo('app/video-editor/_opencut/chat/PanelChat.tsx');
  assert.match(video, /const soloPro = useSoloPro\("ia-editores"\);/);
  assert.match(video, /\{soloPro \? \(\n\s*<footer[^>]*>\n\s*<CandadoSoloPro funcion="ia-editores" \/>/);
  assert.equal(video.match(/!guiaHablando && !soloPro && \(/g)?.length, 2, 'las píldoras de sugerencias siguen a la vista de un Esencial');
  assert.match(video, /if \(res\.status === 403 && esRespuestaSoloPro\(json\)\) marcarSoloPro\("ia-editores"\);/);
  // La «Edición automática» corre en el navegador: el candado está en `correrEnjambre` (lo PRIMERO), en el botón del panel y
  // en el de la barra (abre el panel con el candado, no un aviso que se va).
  const correr = codigo('app/video-editor/_opencut/enjambre/correr.ts');
  assert.match(correr, /\): Promise<ResultadoEnjambre> \{\n\s*if \(await esSoloPro\("ia-editores"\)\) return \{ ok: false, motivo: "solo-pro", texto: NO_ARRANCA\["solo-pro"\] \};\n\s*if \(useEnjambre\.getState\(\)\.fase === "corriendo"\)/);
  assert.match(correr, /"solo-pro": textoSoloPro\("ia-editores"\),/);
  assert.match(codigo('app/video-editor/_opencut/enjambre/components/enjambre-view.tsx'), /\) : soloPro \? \(\n\s*<CandadoSoloPro funcion="ia-editores" \/>\n\s*\) : \(\n\s*<Button[^>]*onClick=\{\(\) => void editar\(\)\}/);
  assert.match(codigo('app/video-editor/_opencut/enjambre/registro.ts'), /if \(!r\.ok && r\.motivo === "solo-pro"\) \{\n\s*useAssetsPanelStore\.getState\(\)\.irA\(\{ categoria: "multimedia", seccion: SECCION_ENJAMBRE \}\);/);
  // «Clips mágicos»: el candado en vez de «Buscar…», y ANTES de transcribir el video (lo largo).
  assert.match(codigo('app/video-editor/_opencut/clips/components/clips-view.tsx'), /\) : soloPro \? \(\n\s*<CandadoSoloPro funcion="ia-editores" \/>\n\s*\) : \(\n\s*<Button[\s\S]{0,160}?buscarClips\(/);
  const buscar = codigo('app/video-editor/_opencut/clips/buscar.ts');
  const guarda = buscar.indexOf('if (await esSoloPro("ia-editores")) return { ok: false, motivo: "solo-pro" };');
  assert.ok(guarda > 0 && guarda < buscar.indexOf('await frasesDelVideo('), 'Clips mágicos transcribe el video entero antes de saber que es de Pro');
  assert.match(buscar, /if \(r\.status === 403 && esRespuestaSoloPro\(datos\)\) \{\n\s*marcarSoloPro\("ia-editores"\);/);
  // «B-roll de MaKo»: el candado en vez de «Proponer»; el 403 de `elegir` lo prende.
  assert.match(codigo('app/video-editor/_opencut/broll/components/broll-view.tsx'), /\) : soloPro \? \(\n\s*<CandadoSoloPro funcion="ia-editores" \/>\n\s*\) : \(\n\s*<Button[^>]*onClick=\{proponer\}/);
  assert.match(codigo('app/video-editor/_opencut/broll/red.ts'), /if \(r\.status === 403 && esRespuestaSoloPro\(j\)\) marcarSoloPro\("ia-editores"\);/);
  // «Editar» un ejemplo (carrusel, miniatura, vertical, el guiado y el teléfono pasan por acá): el candado, no «No se pudo armar».
  const editar = codigo('app/image-editor/carruseles/EditarCarrusel.tsx');
  assert.match(editar, /if \(r\.status === 403 && esRespuestaSoloPro\(j\)\) \{ marcarSoloPro\('ia-editores'\); return; \}\n\s*setError\(/);
  assert.match(editar, /if \(soloPro && !fin && !paginas\.length\) \{[\s\S]{0,600}?<CandadoSoloPro funcion="ia-editores" \/>/);
  // «Replicar en Image» de Competitor Spy: el 403 de Pro NO es «Tu plan no incluye Image» (Image es de los dos planes).
  const spy = codigo('app/competitor-spy/DesarmarImagen.tsx');
  const pro = spy.indexOf("if (r.status === 403 && esRespuestaSoloPro(j)) { marcarSoloPro('ia-editores'); return; }");
  assert.ok(pro > 0 && pro < spy.indexOf("'Tu plan no incluye Image.'"), 'un Esencial leía «Tu plan no incluye Image.»');
  assert.match(spy, /: soloPro\n\s*\? <CandadoSoloPro funcion="ia-editores" \/>\n\s*: <button[\s\S]{0,120}?>Replicar en Image<\/button>/);
  for (const rel of [
    'app/image-editor/mako/chat/PanelMakoIA.tsx', 'app/video-editor/_opencut/chat/PanelChat.tsx', 'app/video-editor/_opencut/enjambre/components/enjambre-view.tsx',
    'app/video-editor/_opencut/clips/components/clips-view.tsx', 'app/video-editor/_opencut/broll/components/broll-view.tsx',
    'app/image-editor/carruseles/EditarCarrusel.tsx', 'app/competitor-spy/DesarmarImagen.tsx',
  ]) assert.match(codigo(rel), LOCK, `${rel}: sin el candado de Pro`);
});

// ── PROBADO ROMPIÉNDOLO (14/11/2026, corrido de verdad: cada rotura sola, restaurada con una copia, nunca git; base 7/0) ──────────
//   R1 sin el candado en app/api/video-editor/clips/route.ts                     → 6/1
//   R5 `correrEnjambre` sin su motivo «solo-pro» (app/video-editor/_opencut/enjambre/correr.ts) → 6/1
//   R6 `image-editor` de vuelta en NAV_SOLO_PRO (lib/plan-esencial-reglas.ts)    → 6/1
// (El primer pie de este archivo describía roturas que no se habían corrido: se reemplazó por éste.)
