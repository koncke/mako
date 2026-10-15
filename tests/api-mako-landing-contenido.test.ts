// =============================================================================
// El editor ENTERO del Web Generator en la API de MaKo (tanda 7, 15/10/2026)
// =============================================================================
// Pedido de Martín, textual: «Ambos, tienen que pasarle absolutamente todos los botones. Todas las funciones a
// la API de MaKo.» Las operaciones de lib/api-mako/areas/landing-editor.def.ts / .run.ts y lo puro de
// landing-contenido.helpers.ts. Lo que fija, y por qué:
//   1. la FORMA: la puerta de la página (admin + la tab), lo que gasta IA en PANTALLA y sin http, el dominio
//      sin http, los comentarios del equipo sin http, los datos exactos (Píxel, dominio) en pantalla, toda
//      edición reversible porque guarda antes una versión (y restaurar_version_landing existe), y su ruta REST;
//   2. que corran por el MISMO server que la pantalla (ningún `.from(`), con la versión de antes ANTES del
//      guardado, y que nada corra en una automatización;
//   3. lo puro: cada plan hace lo pedido y nada más, rechaza en preparar lo imposible (con `faltan`,
//      `disponibles` o `yaEstaba`), devuelve el id de lo que crea, y lo que arma pasa el saneo SIN descartes;
//   4. las copias de reglas de módulos 'use client' (PanelPaginas, SelectorTemaCrear, EstiloSeccion), iguales a
//      las de la pantalla hasta que se muden a un módulo puro.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), con un arnés que rompe UNA cosa, corre este archivo, restaura de memoria y
// compara el sha256. Base: 22 pasan / 0 fallan / 1 todo (el de WhatsApp, abajo). Cada rotura, 21 / 1:
//   R1  generar_landing_con_ia por chat y no en pantalla                    → «lo que gasta IA va en PANTALLA…»
//   R2  conectar_dominio_landing por http                                    → «lo que gasta IA va en PANTALLA…»
//   R3  la fábrica sin la versión de antes (guardarVersion)                  → «los runners corren por el server…»
//   R4  un `.from('landing_docs')` en ver_dominio_landing                     → «los runners corren por el server…»
//   R5  generar_landing_con_ia sin el freno de las automatizaciones           → «los runners corren por el server…»
//   R6  cambiar_texto_landing reemplaza todas sin `todas:true`                → «cambiar un texto…»
//   R7  duplicar una sección sin ids nuevos en los campos del formulario      → «acomodar una sección…»
//   R8  poner_enlace_landing en cualquier hueco (sin mirar la clase)          → «poner el enlace…»
//   R9  el título para buscadores cortado en silencio en vez de rechazado     → «el sitio y la navegación…»
//   R10 rutaLibreApi distinta de la de PanelPaginas                           → «las páginas…»
//   R11 temaSugeridoApi distinto del de SelectorTemaCrear                     → «generar con IA…»
//   R12 generarConIA (server.ts) sin resolverAnclas                           → «crear y editar con IA en el server…»
//   R13 «Restablecer estilo» sin imagenFocoY                                  → «Restablecer estilo toca las MISMAS claves…»
//   R14 listaParaApi ignorando papelera:true                                  → «listar_landings_creadas con papelera…»
//   R15 analizar_landing sin la dirección tal cual (`leer`)                    → «analizar_landing corre por el server…»
//   R16 agregar_seccion_landing siempre al final (ignora `despuesDe`)          → «agregar una sección…»
// Restaurado: 22 / 0 / 1 todo. Después se sumó «crear en blanco» (base 23 / 0 / 1 todo):
//   R17 pedidoEnBlanco sin el origen «cero» de «Usar este tema»               → 22 / 1 «crear en blanco…»
// Restaurado: 23 / 0 / 1 todo.
// La corrección de la tanda 7 le sacó el `todo` (editar por WhatsApp) y sumó «basadaEn», el «restaurar» de un tema
// propio y la biblioteca de imágenes, cada uno con sus roturas arriba de su test. Base final: 27 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId, porArea, REGISTRO } from '../lib/api-mako/registro';
import { esAccion, esLectura, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';
import { DEFS_EDITOR } from '../lib/api-mako/areas/landing-editor.def';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT, type ConfigLanding, type TemaPropio } from '../lib/editor-landing/api-tipos';
import { TEMAS } from '../lib/editor-landing/temas';
import { OBJETIVOS_LANDING } from '../lib/landing-spec';
import { bloqueJson } from '../app/web-generator/editor/insertar';
import { listaParaApi } from '../lib/api-mako/areas/landing-editor.helpers';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';
import {
  MOTIVO_ANTES_DE_MAKO, descartesDe, ubicarSeccion, estructuraParaApi, planAgregarSeccion, planCambiarTexto,
  planAcomodarSeccion, planConfigurarSeccion, planAgregarBloque, planAcomodarBloque, planPonerEnlace,
  planConfigurarFormulario, planConfigurarBoton, planQuitarCobro, planAcomodarPagina, planTema, planConfigurarLanding,
  planConfigurarSitio, planNavegacion, planTemaPropio, pedidoGenerar, temaElegido, temaSugeridoApi, rutaLibreApi,
  hacerInicioApi, ESTILO_RESTABLECIDO_API, esFallaPlan, pedidoEnBlanco, restaurarDeTema, type PlanContenido, type FallaPlan,
} from '../lib/api-mako/areas/landing-contenido.helpers';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const IDS = DEFS_EDITOR.map((d) => d.id);
/** Las que gastan IA: en pantalla, sólo admin y sin http (tardan más que el techo de 60 s de /api/v1). */
const CON_IA = ['generar_landing_con_ia', 'editar_landing_con_ia', 'diagnosticar_landing_creada', 'aplicar_todos_comentarios_landing'];
/** Las que salen a Vercel y al DNS. */
const DOMINIO = ['conectar_dominio_landing', 'verificar_dominio_landing', 'quitar_dominio_landing'];
/** Las ediciones de UNA landing por la fábrica `edicion` (versión de antes + compare-and-set). */
const EDICIONES = [
  'agregar_seccion_landing', 'cambiar_texto_landing', 'acomodar_seccion_landing', 'configurar_seccion_landing',
  'agregar_bloque_landing', 'acomodar_bloque_landing', 'poner_enlace_landing', 'configurar_formulario_landing',
  'configurar_boton_landing', 'quitar_cobro_landing', 'acomodar_pagina_landing', 'cambiar_tema_landing',
  'configurar_landing', 'configurar_sitio_landing', 'configurar_navegacion_landing',
];

const accion = (id: string): AccionDef => {
  const d = porId(id);
  assert.ok(d && esAccion(d), `«${id}» no es una acción del registro`);
  return d;
};

/** El bloque de un runner en landing-editor.run.ts: desde `  <id>: {` hasta el próximo runner o el cierre. */
function runnerDe(id: string): string {
  const src = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  const i = src.search(new RegExp(`^  ${id}: \\{`, 'm'));
  assert.ok(i >= 0, `no encuentro el runner de ${id}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/^ {2}[a-z_]+: \{|^\};/m);
  return src.slice(i, i + 1 + (fin < 0 ? resto.length : fin));
}

// ── Un documento de prueba ─────────────────────────────────────────────────────

const txt = (t: string): JsonNodo => ({ type: 'text', text: t });
const p = (t: string): JsonNodo => ({ type: 'paragraph', content: [txt(t)] });
const h = (t: string, level = 2): JsonNodo => ({ type: 'heading', attrs: { level }, content: [txt(t)] });
const tarjeta = (id: string, content: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({ type: NODO.tarjeta, attrs: { id, ...attrs }, content });
const boton = (texto: string, href = '#'): JsonNodo => ({ type: NODO.boton, attrs: { href, variante: 'primario', nuevaPestana: false }, content: [txt(texto)] });

function landing(): LandingContenido {
  return {
    v: 1,
    paginas: [
      {
        id: 'pInicio', titulo: 'Inicio', ruta: '',
        doc: {
          type: 'doc',
          content: [
            tarjeta('tHero', [h('Aprende a vender', 1), p('Agenda tu llamada gratis hoy'), { type: NODO.insertado, attrs: { src: '', proveedor: 'youtube', alto: null } }]),
            tarjeta('tBeneficios', [h('Beneficios'), p('Llamada gratis y sin compromiso'), { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [boton('Agenda ahora', '#t-tForm'), boton('Pagar ahora', 'pago:7')] }]),
            tarjeta('tForm', [h('Déjanos tus datos'), bloqueJson('formulario') as JsonNodo, { type: NODO.insertado, attrs: { src: '', proveedor: 'calendly', alto: null } }]),
          ],
        },
      },
      { id: 'pGracias', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc', content: [tarjeta('tGracias', [h('¡Gracias!', 1), p('Te escribimos pronto')])] } },
    ],
  };
}
const ok = (r: PlanContenido | FallaPlan): PlanContenido => {
  assert.ok(!esFallaPlan(r), `el plan falló: ${(r as FallaPlan).error}`);
  return r as PlanContenido;
};
const falla = (r: object): FallaPlan => {
  assert.ok(esFallaPlan(r), `se esperaba un rechazo y pasó: ${JSON.stringify(r).slice(0, 200)}`);
  return r as FallaPlan;
};
const secciones = (c: LandingContenido, pg = 0) => (c.paginas[pg].doc.content ?? []).map((t) => String(t.attrs?.id));
const textoTodo = (c: LandingContenido) => JSON.stringify(c);

// ── 1. La forma ─────────────────────────────────────────────────────────────────

test('todas en el área landing con la puerta de /web-generator, y sumadas a DEFS de landing.def.ts', () => {
  const area = new Set(porArea('landing').map((d) => d.id));
  assert.ok(IDS.length >= 35, `son ${IDS.length}`);
  for (const id of IDS) {
    assert.ok(area.has(id), `${id} no quedó en el área landing`);
    assert.deepEqual(porId(id)!.gating, { tab: 'landing-writer', rolMinimo: 'admin' }, `${id}: la puerta no es la de la página`);
  }
  // Una sola vez cada una en el registro (el spread no las duplica).
  for (const id of IDS) assert.equal(REGISTRO.filter((d) => d.id === id).length, 1, id);
});

test('lo que gasta IA va en PANTALLA, sólo admin y sin http; el dominio, sin http; los comentarios del equipo, sin http', () => {
  for (const id of CON_IA) {
    const d = accion(id);
    assert.equal(d.costo, 'ia', id);
    assert.equal(d.confirmacion, 'pantalla', `${id}: gasta IA, se confirma en pantalla`);
    assert.equal(d.pantalla, '/mako/revisar', id);
    assert.equal(d.gating?.rolMinimo, 'admin', id);
    assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp'], `${id}: tarda más que los 60 s de la ruta HTTP`);
    assert.equal(d.lenta, true, id);
    assert.equal(rutaRestDe(id), undefined, `${id}: sin http, sin ruta REST`);
  }
  // Ninguna otra de la tanda gasta IA a escondidas.
  for (const d of DEFS_EDITOR) if (!CON_IA.includes(d.id)) assert.notEqual(d.costo, 'ia', d.id);
  for (const id of DOMINIO) assert.deepEqual([...porId(id)!.canales].sort(), ['app', 'whatsapp'], id);
  assert.deepEqual([...porId('listar_comentarios_equipo_landing')!.canales].sort(), ['app', 'whatsapp'], 'nombra a personas del equipo');
  assert.deepEqual([...porId('resolver_comentario_equipo_landing')!.canales].sort(), ['app', 'whatsapp']);
  // Los datos exactos que un modelo puede transcribir mal: el dominio (reclamarlo es global) y el Píxel de Meta.
  for (const id of ['conectar_dominio_landing', 'configurar_sitio_landing', 'borrar_landing_creada']) assert.equal(accion(id).confirmacion, 'pantalla', id);
  // Lo que sale por http tiene su ruta REST (y lo que no, no).
  for (const d of DEFS_EDITOR) assert.equal(!!rutaRestDe(d.id), d.canales.includes('http'), d.id);
});

test('toda edición es reversible DENTRO de la API (guarda antes una versión y restaurar_version_landing existe)', () => {
  assert.ok(porId('restaurar_version_landing') && porId('listar_versiones_landing') && porId('ver_version_landing'));
  for (const id of [...EDICIONES, 'editar_landing_con_ia', 'aplicar_todos_comentarios_landing']) {
    const d = accion(id);
    assert.equal(d.reversible, true, id);
    assert.match(d.descripcion, /restaurar_version_landing/, `${id}: la descripción tiene que decir cómo se vuelve`);
  }
  // Lo que NO se deshace se dice: borrar para siempre, borrar un tema propio, un link que se regenera.
  for (const id of ['borrar_landing_creada', 'borrar_tema_landing', 'compartir_borrador_landing', 'diagnosticar_landing_creada']) assert.equal(accion(id).reversible, false, id);
  // Lo que crea devuelve su id (AGENTS.md, «Una acción que CREA algo devuelve su id en Ejecutado.datos»).
  assert.match(runnerDe('generar_landing_con_ia'), /datos: \{ id: r\.doc\.id,/);
  assert.match(runnerDe('importar_borrador_landing'), /datos: \{ id: r\.doc\.id,/);
  assert.match(runnerDe('guardar_tema_landing'), /datos: \{ tema: id,/);
  assert.match(runnerDe('guardar_version_landing'), /datos: \{ id, version: r\.version\.id \}/);
});

// ── 2. El mismo server que la pantalla ──────────────────────────────────────────

test('los runners corren por el server de la pantalla: ningún acceso a la base propio, y la versión de antes ANTES de guardar', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  assert.ok(!/\.from\(|getTenantDb|getSupabaseServer/.test(run), 'landing-editor.run.ts lee o escribe la base por su cuenta (segunda implementación)');
  for (const f of ['lib/api-mako/areas/landing-contenido.helpers.ts', 'lib/api-mako/areas/landing-listas.helpers.ts']) {
    assert.ok(!/\.from\(|getTenantDb|getSupabaseServer|^import 'server-only'/m.test(sinComentarios(leer(f))), `${f} no es puro`);
  }
  // La fábrica de ediciones: abre, planea, guarda la versión de antes y RECIÉN AHÍ guarda con la versión que abrió.
  const fab = run.slice(run.indexOf('function edicion('), run.indexOf('export const RUNNERS_EDITOR'));
  const iVersion = fab.indexOf('docsEditor.guardarVersion(id, MOTIVO_ANTES_DE_MAKO)');
  const iGuardar = fab.indexOf("docsEditor.guardar({\n            accion: 'guardar', id, version: a.doc.version,");
  assert.ok(iVersion > 0 && iGuardar > iVersion, 'la versión de antes va ANTES del guardado (sin ella no hay vuelta atrás)');
  assert.match(fab, /if \(!v\.ok\) return \{ ok: false,/, 'sin la versión de antes no se cambia nada');
  assert.match(fab, /if \(enFlujo\(ctx\)\) return \{ error: NO_EN_FLUJO \}/, 'no corre en una automatización');
  for (const id of EDICIONES) assert.match(runnerDe(id), /\.\.\.edicion\(\{/, `${id} no pasa por la fábrica de ediciones`);
  // Las demás acciones también se frenan en un flujo (las IA, crear, importar…).
  for (const d of DEFS_EDITOR) {
    if (!esAccion(d) || EDICIONES.includes(d.id)) continue;
    if (d.id === 'quitar_dominio_landing' || d.id === 'verificar_dominio_landing') { assert.match(runnerDe(d.id), /if \(enFlujo\(ctx\)\)/, d.id); continue; }
    assert.match(runnerDe(d.id), /if \(enFlujo\(ctx\)\) return \{ error:/, `${d.id} corre en una automatización`);
  }
  // Por el MISMO server que la pantalla, cada una con su función.
  const llamadas: Record<string, RegExp> = {
    generar_landing_con_ia: /docsEditor\.generarConIA\(/,
    editar_landing_con_ia: /docsEditor\.editarConIA\(/,
    conectar_dominio_landing: /conectarDominio\(id, payload\.dominio\)/,
    verificar_dominio_landing: /estadoDominio\(id, \{ verificar: true \}\)/,
    quitar_dominio_landing: /quitarDominio\(id\)/,
    compartir_borrador_landing: /docsEditor\.vistaPrevia\(id, payload\.regenerar === true\)/,
    borrar_landing_creada: /docsEditor\.borrar\(id\)/,
    importar_borrador_landing: /docsEditor\.importarBorrador\(/,
    diagnosticar_landing_creada: /diagnosticar\(\{ docId: id \}\)/,
    aplicar_todos_comentarios_landing: /aplicarComentarios\(\{ docId: id, ids: g\.ids, versionAntes: versionAntes == null/,
    pasar_comentarios_a_copia_landing: /pasarACopia\(\{ url: payload\.url, docId: id/,
    guardar_tema_landing: /docsEditor\.guardarTema\(plan\.tema\)/,
    borrar_tema_landing: /docsEditor\.borrarTema\(/,
    guardar_version_landing: /docsEditor\.guardarVersion\(id, payload\.motivo\)/,
    resolver_comentario_equipo_landing: /docsEditor\.resolverComentario\(/,
  };
  for (const [id, re] of Object.entries(llamadas)) assert.match(runnerDe(id), re, `${id}: no pasa por el server de la pantalla`);
  // ver_dominio_landing lee la FILA: estadoDominio sale a Vercel y puede escribir (verifica un pendiente).
  assert.doesNotMatch(runnerDe('ver_dominio_landing'), /estadoDominio\(/);
});

test('crear y editar con IA en el server: las MISMAS piezas que la pantalla, y la versión de antes primero', () => {
  const srv = sinComentarios(leer('lib/editor-landing/server.ts'));
  const gen = srv.slice(srv.indexOf('export async function generarConIA('), srv.indexOf('export type PedidoEditarIA'));
  assert.match(gen, /ia\.esquema\(\{ modo: p\.modo, prompt: p\.idea, texto: p\.texto, params: p\.params \}\)/);
  assert.match(gen, /ia\.secciones\(\{ esquema: esq, indices,/);
  assert.match(gen, /r\.ok && r\.tarjetas\.length === indices\.length/, 'el contrato de la pantalla: una por índice pedido');
  assert.match(gen, /tarjetaDesdeEsquema\(s, i === 0\)/, 'lo que no salió va desde el esquema, nunca una sección de menos');
  assert.match(gen, /resolverAnclas\(tarjetas\)/, 'las anclas pendientes, como `contenidoGenerado`');
  assert.match(gen, /crearEn\(ws, /, 'el MISMO alta que la pantalla (saneo y autor)');
  const ed = srv.slice(srv.indexOf('export async function editarConIA('));
  const iVersion = ed.indexOf('guardarVersion(p.docId, dif.MOTIVO_ANTES_DE_IA)');
  const iGuardar = ed.indexOf("guardar({ accion: 'guardar', id: p.docId, version: doc.version, contenido })");
  assert.ok(iVersion > 0 && iGuardar > iVersion, 'la versión «Antes de un cambio de IA» va ANTES del guardado (aceptarPropuesta)');
  assert.match(ed, /dif\.anclasResueltas\(r\.tarjetas, enviadas, todas\)/);
  assert.match(ed, /dif\.planDeAplicacion\(todas, propuestas, \{ anclaNuevas: activa \? dif\.idDe\(activa\) : null \}\)/);
  // La def lo dice: generar crea un borrador (se puede mandar a la papelera) y devuelve el id.
  assert.match(accion('generar_landing_con_ia').descripcion, /Devuelve el id/);
});

test('analizar_landing corre por el server del Diagnóstico: guarda los COMENTARIOS (antes no los veía listar_comentarios_landing)', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = run.search(/^ {2}analizar_landing: \{/m);
  const bloque = run.slice(i, run.indexOf('\n  crear_landing_desde_diseno: {', i));
  assert.match(bloque, /await analizarDiagnostico\(\{ url: typeof payload\.leer === 'string' && payload\.leer \? payload\.leer : url, texto \}\)/);
  assert.match(bloque, /payload: \{ url, leer: crudo,/, 'la dirección TAL CUAL viaja para bajarla');
  assert.doesNotMatch(bloque, /analizarLanding\(/, 'el analizador suelto no guarda los comentarios');
});

// ── 3. Lo puro: cada plan ───────────────────────────────────────────────────────

test('agregar una sección: va donde se pide, devuelve su id y lo que arma pasa el saneo sin descartes', () => {
  const c = landing();
  const r = ok(planAgregarSeccion(c, { titulo: 'Preguntas frecuentes', texto: '- ¿Cuánto dura?\n- ¿Hay garantía?', despuesDe: 'tBeneficios' }));
  const ids = secciones(r.contenido);
  const nueva = String(r.datos?.seccion);
  assert.deepEqual(ids, ['tHero', 'tBeneficios', nueva, 'tForm'], 'va justo después de la pedida');
  const t = ubicarSeccion(r.contenido, nueva)!.tarjeta;
  assert.deepEqual(t.content?.map((n) => n.type), ['heading', 'bulletList'], 'dos líneas = viñetas, como tarjetaDesdeEsquema');
  assert.deepEqual(descartesDe([t]), []);
  assert.equal(secciones(c).length, 3, 'no muta la entrada');
  // Sin `despuesDe`, al final de la página pedida; sin título, falta.
  assert.equal(secciones(ok(planAgregarSeccion(c, { titulo: 'Bonus', pagina: 'pGracias' })).contenido, 1).length, 2);
  assert.deepEqual(falla(planAgregarSeccion(c, { texto: 'x' })).faltan, ['titulo']);
  const noEsta = falla(planAgregarSeccion(c, { titulo: 'X', despuesDe: 'tNoExiste' }));
  assert.ok(Array.isArray(noEsta.disponibles) && (noEsta.disponibles as string[]).some((s) => s.startsWith('tHero')), 'nombra las secciones que hay');
  assert.match(r.resumen, new RegExp(MOTIVO_ANTES_DE_MAKO));
});

test('cambiar un texto: la frase EXACTA, nunca de más; los enlaces no se tocan; partida por formatos se dice', () => {
  const c = landing();
  const r = ok(planCambiarTexto(c, { buscar: 'Aprende a vender', reemplazar: 'Vende más en 30 días' }));
  assert.ok(textoTodo(r.contenido).includes('Vende más en 30 días') && !textoTodo(r.contenido).includes('Aprende a vender'));
  // «gratis» aparece dos veces: sin sección ni todas:true, pregunta y nombra dónde.
  const dos = falla(planCambiarTexto(c, { buscar: 'gratis', reemplazar: 'sin costo' }));
  assert.match(dos.error, /aparece 2 veces/);
  assert.equal((dos.disponibles as string[]).length, 2);
  assert.equal((textoTodo(ok(planCambiarTexto(c, { buscar: 'gratis', reemplazar: 'sin costo', todas: true })).contenido).match(/sin costo/g) ?? []).length, 2);
  assert.equal((textoTodo(ok(planCambiarTexto(c, { buscar: 'gratis', reemplazar: 'sin costo', seccion: 'tHero' })).contenido).match(/sin costo/g) ?? []).length, 1);
  // Un href no es texto: «#t-tForm» queda.
  assert.match(falla(planCambiarTexto(c, { buscar: '#t-tForm', reemplazar: '#t-otra' })).error, /No encontré/);
  // Igual al de ahora: ya está así.
  assert.equal(falla(planCambiarTexto(c, { buscar: 'Beneficios', reemplazar: 'Beneficios' })).yaEstaba, true);
  // Una frase partida en dos textos (una parte en negrita) no es un texto.
  const conNegrita = landing();
  conNegrita.paginas[0].doc.content![0].content![1] = { type: 'paragraph', content: [txt('Agenda tu '), { type: 'text', text: 'llamada', marks: [{ type: 'bold' }] }] };
  assert.match(falla(planCambiarTexto(conNegrita, { buscar: 'Agenda tu llamada', reemplazar: 'x' })).error, /formatos distintos/);
  // Borrarlo todo no deja un nodo de texto vacío (rompe la carga del editor): el saneo no descarta nada.
  const vacio = ok(planCambiarTexto(c, { buscar: 'Te escribimos pronto', reemplazar: '' }));
  assert.deepEqual(descartesDe([ubicarSeccion(vacio.contenido, 'tGracias')!.tarjeta]), []);
});

test('acomodar una sección: mover, duplicar con ids nuevos, ocultar «ya está», y la única no se borra', () => {
  const c = landing();
  assert.deepEqual(secciones(ok(planAcomodarSeccion(c, { seccion: 'tForm', accion: 'mover', posicion: 1 })).contenido), ['tForm', 'tHero', 'tBeneficios']);
  assert.equal(falla(planAcomodarSeccion(c, { seccion: 'tHero', accion: 'mover', posicion: 1 })).yaEstaba, true);
  assert.deepEqual(falla(planAcomodarSeccion(c, { seccion: 'tHero', accion: 'mover' })).faltan, ['posicion']);
  const dup = ok(planAcomodarSeccion(c, { seccion: 'tForm', accion: 'duplicar' }));
  const ids = secciones(dup.contenido);
  assert.equal(ids.length, 4);
  assert.equal(ids[3], dup.datos?.seccion);
  assert.notEqual(ids[3], 'tForm');
  // La copia trae un formulario: sus campos con ids NUEVOS (el saneo exige ids únicos en toda la landing).
  const campos = (t: JsonNodo) => ((t.content ?? []).find((n) => n.type === NODO.formulario)?.attrs?.campos as { id: string }[]).map((x) => x.id);
  const orig = campos(ubicarSeccion(dup.contenido, 'tForm')!.tarjeta);
  const copia = campos(ubicarSeccion(dup.contenido, String(dup.datos?.seccion))!.tarjeta);
  assert.ok(copia.every((id) => !orig.includes(id)), 'los campos de la copia repiten los ids del original');
  assert.deepEqual(descartesDe(dup.contenido.paginas[0].doc.content!), []);
  const oculta = ok(planAcomodarSeccion(c, { seccion: 'tBeneficios', accion: 'ocultar' }));
  assert.equal(ubicarSeccion(oculta.contenido, 'tBeneficios')!.tarjeta.attrs?.oculta, true);
  assert.equal(falla(planAcomodarSeccion(oculta.contenido, { seccion: 'tBeneficios', accion: 'ocultar' })).yaEstaba, true);
  assert.match(falla(planAcomodarSeccion(c, { seccion: 'tGracias', accion: 'borrar' })).error, /única sección/);
  assert.deepEqual(secciones(ok(planAcomodarSeccion(c, { seccion: 'tBeneficios', accion: 'borrar' })).contenido), ['tHero', 'tForm']);
});

test('agregar un bloque: el MISMO que inserta el menú «/», el enlace de su clase, y el cobro no va por acá', () => {
  const c = landing();
  const form = ok(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'formulario' }));
  const nodo = ubicarSeccion(form.contenido, 'tGracias')!.tarjeta.content!.at(-1)!;
  const esperado = bloqueJson('formulario') as JsonNodo;
  const sinIds = (n: JsonNodo) => JSON.stringify(n).replace(/"id":"c[a-z0-9]+"/g, '"id":"?"');
  assert.equal(sinIds(nodo), sinIds(esperado), 'el formulario no es el del menú «/»');
  // La agenda con un enlace de Calendly queda con su proveedor; un video en «agenda» se rechaza.
  const agenda = ok(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'agenda', enlace: 'https://calendly.com/mi-negocio/llamada' }));
  assert.equal(ubicarSeccion(agenda.contenido, 'tGracias')!.tarjeta.content!.at(-1)!.attrs?.proveedor, 'calendly');
  assert.match(falla(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'agenda', enlace: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).error, /no es de una agenda/);
  assert.match(falla(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'boton', texto: 'Comprar', destino: 'pago:3' })).error, /cobrar_producto_landing/);
  assert.deepEqual(falla(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'titulo' })).faltan, ['texto']);
  // Una imagen que no está en la biblioteca no entra sin copiarse (en preparar va como pendiente).
  assert.ok(esFallaPlan(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'imagen', imagen: 'https://otro-sitio.com/foto.jpg' })));
  assert.ok(!esFallaPlan(planAgregarBloque(c, { seccion: 'tGracias', bloque: 'imagen', imagen: 'https://otro-sitio.com/foto.jpg' }, { imagenPendiente: true })));
  const vinetas = ok(planAgregarBloque(c, { seccion: 'tHero', bloque: 'vinetas', texto: 'Uno\nDos\nTres', posicion: 2 }));
  assert.equal(ubicarSeccion(vinetas.contenido, 'tHero')!.tarjeta.content![1].type, 'bulletList');
  assert.deepEqual(descartesDe([ubicarSeccion(vinetas.contenido, 'tHero')!.tarjeta]), []);
});

test('acomodar un bloque: por su posición; borrar el último deja un párrafo (una sección sin bloques no se guarda)', () => {
  const c = landing();
  const mov = ok(planAcomodarBloque(c, { seccion: 'tHero', bloque: 3, accion: 'mover', posicion: 1 }));
  assert.equal(ubicarSeccion(mov.contenido, 'tHero')!.tarjeta.content![0].type, NODO.insertado);
  assert.match(falla(planAcomodarBloque(c, { seccion: 'tHero', bloque: 9, accion: 'borrar' })).error, /de 1 a 3/);
  const solo = { ...c, paginas: [c.paginas[0], { ...c.paginas[1], doc: { type: 'doc' as const, content: [tarjeta('tGracias', [p('Solo')])] } }] };
  const borrado = ok(planAcomodarBloque(solo, { seccion: 'tGracias', bloque: 1, accion: 'borrar' }));
  assert.deepEqual(ubicarSeccion(borrado.contenido, 'tGracias')!.tarjeta.content!.map((n) => n.type), ['paragraph']);
});

test('poner el enlace: completa el hueco de SU clase (el VSL o la agenda), y con dos lugares pregunta', () => {
  const c = landing();
  const vsl = ok(planPonerEnlace(c, { enlace: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }));
  assert.match(String(ubicarSeccion(vsl.contenido, 'tHero')!.tarjeta.content![2].attrs?.src), /youtube/);
  assert.equal(ubicarSeccion(vsl.contenido, 'tForm')!.tarjeta.content![2].attrs?.src, '', 'el video no va en el hueco de la agenda');
  const ag = ok(planPonerEnlace(c, { enlace: 'https://calendly.com/mi-negocio/llamada' }));
  assert.match(String(ubicarSeccion(ag.contenido, 'tForm')!.tarjeta.content![2].attrs?.src), /calendly/);
  assert.equal(falla(planPonerEnlace(vsl.contenido, { enlace: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).yaEstaba, true);
  // Dos huecos de video: no adivina.
  const dos = landing();
  dos.paginas[1].doc.content![0].content!.push({ type: NODO.insertado, attrs: { src: '', proveedor: 'youtube', alto: null } });
  assert.match(falla(planPonerEnlace(dos, { enlace: 'https://vimeo.com/76979871' })).error, /pasa la sección/);
  assert.match(falla(planPonerEnlace(c, { enlace: 'https://un-sitio-cualquiera.com/x' })).error, /no es de un sitio/);
});

test('el estilo de una sección, el formulario, los botones y quitar el cobro', () => {
  const c = landing();
  const color = ok(planConfigurarSeccion(c, { seccion: 'tHero', color: '#1f6feb' }));
  const a = ubicarSeccion(color.contenido, 'tHero')!.tarjeta.attrs!;
  assert.deepEqual([a.fondo, a.fondoColor], ['color', '#1f6feb'], 'un color sin `fondo` dice qué fondo se quiere');
  assert.match(falla(planConfigurarSeccion(c, { seccion: 'tHero', color: 'azul' })).error, /#rrggbb/);
  assert.equal(falla(planConfigurarSeccion(c, { seccion: 'tHero', ancho: 'normal' })).yaEstaba, true, 'el ancho de fábrica ya es normal');
  // El formulario: los campos se reemplazan, el id del mismo tipo se conserva.
  const antes = (ubicarSeccion(c, 'tForm')!.tarjeta.content![1].attrs!.campos as { id: string; tipo: string }[]);
  const f = ok(planConfigurarFormulario(c, { campos: [{ tipo: 'email', requerido: true }, { tipo: 'empresa' }], boton: 'Quiero mi lugar' }));
  const despues = (ubicarSeccion(f.contenido, 'tForm')!.tarjeta.content![1].attrs!.campos as { id: string; tipo: string; etiqueta: string }[]);
  assert.deepEqual(despues.map((x) => x.tipo), ['email', 'empresa']);
  assert.equal(despues[0].id, antes.find((x) => x.tipo === 'email')!.id, 'el campo del mismo tipo conserva su id');
  assert.equal(despues[1].etiqueta, 'Empresa', 'sin etiqueta, la de su tipo');
  assert.match(falla(planConfigurarFormulario(c, { campos: [{ tipo: 'email' }, { tipo: 'email' }] })).error, /una sola vez/);
  assert.match(falla(planConfigurarFormulario(c, { redirigir: 'javascript:alert(1)' })).error, /https/);
  // Un botón por su texto de hoy; para cobrar, la otra operación.
  const b = ok(planConfigurarBoton(c, { boton: 'agenda ahora', texto: 'Agendar mi llamada', destino: 'https://calendly.com/x' }));
  assert.ok(textoTodo(b.contenido).includes('Agendar mi llamada') && textoTodo(b.contenido).includes('https://calendly.com/x'));
  assert.match(falla(planConfigurarBoton(c, { boton: 'Agenda ahora', destino: 'pago:9' })).error, /cobrar_producto_landing/);
  assert.ok(Array.isArray(falla(planConfigurarBoton(c, { boton: 'No existe' })).disponibles));
  const q = ok(planQuitarCobro(c, {}));
  assert.ok(!textoTodo(q.contenido).includes('pago:7'), 'el botón sigue cobrando');
  assert.equal(falla(planQuitarCobro(q.contenido, {})).yaEstaba, true);
});

test('las páginas: agregar con una ruta libre, hacer de inicio, borrar la de inicio promueve otra (como PanelPaginas)', async () => {
  const c = landing();
  const ag = ok(planAcomodarPagina(c, { accion: 'agregar', titulo: 'Gracias' }));
  assert.equal(ag.contenido.paginas.at(-1)!.ruta, 'gracias-2', 'la ruta libre, como «Añadir página»');
  const ini = ok(planAcomodarPagina(c, { accion: 'inicio', pagina: 'pGracias' }));
  assert.equal(ini.contenido.paginas.filter((x) => x.ruta === '').length, 1);
  assert.equal(ini.contenido.paginas[0].id, 'pGracias');
  const borr = ok(planAcomodarPagina(c, { accion: 'borrar', pagina: 'pInicio' }));
  assert.equal(borr.contenido.paginas[0].ruta, '', 'siempre hay una de inicio');
  assert.match(falla(planAcomodarPagina(c, { accion: 'renombrar', pagina: 'pGracias', ruta: 'Mala Ruta' })).error, /a-z/);
  assert.equal(falla(planAcomodarPagina(c, { accion: 'inicio', pagina: 'pInicio' })).yaEstaba, true);
  // Las copias de las reglas de PanelPaginas.tsx ('use client') dan lo MISMO que las de la pantalla.
  const { rutaLibre, hacerInicio } = await import('../app/web-generator/editor/PanelPaginas');
  for (const [t, usadas] of [['Gracias por tu compra', []], ['Oferta', ['oferta', 'oferta-2']], ['Sí', []], ['Ñandú Ágil', ['nandu-agil']]] as const) {
    assert.equal(rutaLibreApi(t, usadas), rutaLibre(t, usadas), t);
  }
  assert.deepEqual(hacerInicioApi(c.paginas, 'pGracias'), hacerInicio(c.paginas, 'pGracias'));
});

// ── El tema, la configuración y el sitio ──────────────────────────────────────

const config = (): ConfigLanding => JSON.parse(JSON.stringify({ ...CONFIG_DEFAULT, tema: TEMAS[0].id })) as ConfigLanding;
const PROPIOS: TemaPropio[] = [{ id: 'mi-marca-ab12', nombre: 'Mi marca', base: TEMAS[1].id, cambios: { colores: { acento: '#ff0000' } } }];

test('el tema: por id o por nombre, el propio con «ws:», «ya está así» y lo que no existe nombra los que hay', () => {
  const c = config();
  const otro = TEMAS[2];
  const r = planTema(c, otro.nombre, PROPIOS);
  assert.ok(!esFallaPlan(r) && r.config.tema === otro.id, 'por su nombre');
  const propio = planTema(c, 'ws:mi-marca-ab12', PROPIOS);
  assert.ok(!esFallaPlan(propio) && propio.config.tema === 'ws:mi-marca-ab12');
  assert.equal(falla(planTema(c, TEMAS[0].id, PROPIOS)).yaEstaba, true);
  assert.ok(Array.isArray(falla(planTema(c, 'no-existe', PROPIOS)).disponibles));
  assert.deepEqual(temaElegido('Mi marca', PROPIOS), { id: 'ws:mi-marca-ab12', nombre: 'Mi marca' });
});

test('el sitio y la navegación: los topes se rechazan (no se cortan en silencio) y las listas se vacían con []', () => {
  const c = config();
  assert.match(falla(planConfigurarSitio(c, { seoTitulo: 'x'.repeat(61) })).error, /60/);
  assert.match(falla(planConfigurarSitio(c, { metaPixelId: '12ab' })).error, /dígitos/);
  const pix = planConfigurarSitio(c, { metaPixelId: '1234567890', indexar: true });
  assert.ok(!esFallaPlan(pix) && pix.config.sitio.metaPixelId === '1234567890' && pix.config.sitio.indexar);
  const sinPix = planConfigurarSitio(esFallaPlan(pix) ? c : pix.config, { metaPixelId: '' });
  assert.ok(!esFallaPlan(sinPix) && sinPix.config.sitio.metaPixelId === null, '"" lo quita');
  assert.equal(falla(planConfigurarSitio(c, { marcaMako: true })).yaEstaba, true);
  const seis = Array.from({ length: 6 }, (_, i) => ({ texto: `E${i}`, destino: 'https://ejemplo.com' }));
  assert.match(falla(planNavegacion(c, { enlaces: seis })).error, /hasta 5/);
  assert.match(falla(planNavegacion(c, { enlaces: [{ texto: 'X', destino: 'javascript:alert(1)' }] })).error, /destino válido/);
  const con = planNavegacion(c, { mostrarBarra: true, enlaces: [{ texto: 'Precios', destino: '#t-tBeneficios' }] });
  assert.ok(!esFallaPlan(con) && con.config.sitio.nav.enlaces.length === 1);
  const vacia = planNavegacion(esFallaPlan(con) ? c : con.config, { enlaces: [] });
  assert.ok(!esFallaPlan(vacia) && vacia.config.sitio.nav.enlaces.length === 0, '[] vacía la lista');
});

test('la configuración de la página: la relación de aspecto es de una presentación, y el ancho va a TODAS las secciones', () => {
  const c = landing();
  assert.match(falla(planConfigurarLanding({ config: config(), contenido: c }, { proporcion: '4:3' })).error, /presentación/);
  const r = planConfigurarLanding({ config: config(), contenido: c }, { ancho: 'amplio', animaciones: false });
  assert.ok(!esFallaPlan(r) && r.contenido);
  if (!esFallaPlan(r) && r.contenido) {
    assert.ok(r.contenido.paginas.every((pg) => (pg.doc.content ?? []).every((t) => t.attrs?.ancho === 'amplio')));
    assert.equal(r.config.pagina.animaciones, false);
  }
  const pres = planConfigurarLanding({ config: config(), contenido: c }, { formato: 'presentacion', proporcion: '4:3' });
  assert.ok(!esFallaPlan(pres) && pres.config.formato === 'presentacion' && pres.config.proporcion === '4:3');
});

test('un tema propio: crear pide nombre, los colores van #rrggbb, la fuente es del catálogo y el tope se respeta', () => {
  assert.deepEqual(falla(planTemaPropio([], { acento: '#00ff00' })).faltan, ['nombre']);
  assert.match(falla(planTemaPropio([], { nombre: 'Nuevo', acento: 'verde' })).error, /#rrggbb/);
  assert.ok(Array.isArray(falla(planTemaPropio([], { nombre: 'Nuevo', fuenteTitulos: 'Comic Sans Inventada' })).disponibles));
  const nuevo = planTemaPropio([], { nombre: 'Nuevo', base: TEMAS[3].id, acento: '#00FF00', fuenteTitulos: 'montserrat', redondez: 'lg' });
  assert.ok(!esFallaPlan(nuevo) && nuevo.nuevo && nuevo.tema.base === TEMAS[3].id);
  if (!esFallaPlan(nuevo)) {
    assert.deepEqual((nuevo.tema.cambios as { colores: Record<string, string> }).colores, { acento: '#00ff00' });
    assert.equal((nuevo.tema.cambios as { fuentes: { titulo: { familia: string } } }).fuentes.titulo.familia, 'Montserrat');
  }
  const editado = planTemaPropio(PROPIOS, { tema: 'ws:mi-marca-ab12', texto: '#222222' });
  assert.ok(!esFallaPlan(editado) && !editado.nuevo);
  if (!esFallaPlan(editado)) assert.deepEqual((editado.tema.cambios as { colores: Record<string, string> }).colores, { acento: '#ff0000', texto: '#222222' }, 'lo de antes se conserva');
  const treinta = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, nombre: `T${i}`, base: TEMAS[0].id, cambios: {} }));
  assert.match(falla(planTemaPropio(treinta, { nombre: 'Uno más' })).error, /tope/);
});

// Corrección de la tanda 7 (15/10/2026): guardar_tema_landing se declaraba `reversible: true` y cambiar un tema que
// EXISTE no tenía vuelta (no se devolvía el de antes y la API sólo pone #rrggbb: un color que antes no estaba no se
// sacaba, y eso cambia TODAS las landings que lo usan). AGENTS.md: «reversible: true exige el camino de vuelta EN la API».
// PROBADO ROMPIÉNDOLO (15/10/2026), base 26 / 0:
//   · el runner sin devolver «restaurar»                                   → 25 / 1 (éste)
//   · restaurar MEZCLANDO con lo que hay (como un cambio más)               → 25 / 1 (éste; la primera versión daba
//     26 / 0: el cambio de prueba sólo tocaba colores y la mezcla superficial lo tapaba, así que se sumó una fuente)
//   · restaurar aceptando otros cambios al lado                             → 25 / 1 (éste)
//   · la definición sin el parámetro «restaurar»                            → 25 / 1 (éste)
// Restaurado: 26 / 0.
test('un tema propio se vuelve atrás DENTRO de la API: «restaurar» lo devuelve entero, también lo que no tenía', () => {
  const editado = planTemaPropio(PROPIOS, { tema: 'ws:mi-marca-ab12', texto: '#222222', fuenteTitulos: 'montserrat', nombre: 'Mi marca 2' });
  assert.ok(!esFallaPlan(editado));
  if (esFallaPlan(editado)) return;
  assert.deepEqual(editado.antes, PROPIOS[0], 'el plan sabe cómo estaba');
  const vuelta = restaurarDeTema(editado.antes!);
  // Después del cambio, el tema guardado tiene un color y una fuente que antes no estaban: «restaurar» los saca.
  const ahora: TemaPropio[] = [{ id: 'mi-marca-ab12', ...editado.tema } as TemaPropio];
  const atras = planTemaPropio(ahora, { tema: 'ws:mi-marca-ab12', restaurar: vuelta });
  assert.ok(!esFallaPlan(atras), JSON.stringify(atras));
  if (!esFallaPlan(atras)) {
    assert.deepEqual({ nombre: atras.tema.nombre, base: atras.tema.base, cambios: atras.tema.cambios }, { nombre: 'Mi marca', base: TEMAS[1].id, cambios: { colores: { acento: '#ff0000' } } });
    assert.match(atras.resumen, /a como estaba/);
  }
  assert.ok(falla(planTemaPropio(PROPIOS, { tema: 'ws:mi-marca-ab12', restaurar: vuelta })).yaEstaba, 'si ya está así, lo dice');
  assert.deepEqual(falla(planTemaPropio(ahora, { restaurar: vuelta })).faltan, ['tema']);
  assert.match(falla(planTemaPropio(ahora, { tema: 'ws:mi-marca-ab12', restaurar: vuelta, acento: '#000000' })).error, /no va nada más/);
  assert.match(falla(planTemaPropio(ahora, { tema: 'ws:mi-marca-ab12', restaurar: '{roto' })).error, /no tiene la forma/);
  assert.match(falla(planTemaPropio(ahora, { tema: 'ws:mi-marca-ab12', restaurar: JSON.stringify({ nombre: 'X', base: 'no-existe', cambios: {} }) })).error, /no tiene la forma/);
  // Crear uno nuevo no tiene «antes» (se deshace con borrar_tema_landing).
  const nuevo = planTemaPropio([], { nombre: 'Nuevo' });
  assert.ok(!esFallaPlan(nuevo) && nuevo.antes === null);
  // La respuesta lleva el camino de vuelta, y la definición lo declara.
  const run = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  const bloque = run.slice(run.indexOf('  guardar_tema_landing: {'), run.indexOf('  borrar_tema_landing: {'));
  assert.ok(bloque.length > 100, 'no encontré el runner');
  assert.match(bloque, /datos: \{ tema: id, nombre: r\.tema\.nombre, \.\.\.\(plan\.antes \? \{ restaurar: restaurarDeTema\(plan\.antes\) \} : \{\}\) \}/);
  const def = porId('guardar_tema_landing')!;
  assert.ok(esAccion(def) && def.reversible === true);
  assert.ok(def.parametros.some((p) => p.nombre === 'restaurar'));
  assert.match(def.descripcion, /restaurar/);
});

test('crear en blanco: EL MISMO pedido que «Usar este tema» del Panel, y crea por el server de la pantalla', () => {
  const p = pedidoEnBlanco({ tema: TEMAS[4].nombre }, []);
  assert.ok(!esFallaPlan(p));
  if (!esFallaPlan(p)) assert.deepEqual(p.pedido, { accion: 'crear', config: { tema: TEMAS[4].id, formato: 'pagina', origen: { modo: 'cero' } } });
  // Inicio.tsx, `usarTema`: la forma que manda la pantalla (si cambia allá, este test lo dice).
  assert.match(sinComentarios(leer('app/web-generator/Inicio.tsx')), /crearYAbrir\(\{ accion: 'crear', config: \{ tema: t\.id, formato: 'pagina', origen: \{ modo: 'cero' \} \} \}\)/);
  const pres = pedidoEnBlanco({ tema: 'ws:mi-marca-ab12', formato: 'presentacion', titulo: 'Charla' }, PROPIOS);
  assert.ok(!esFallaPlan(pres) && pres.pedido.config.formato === 'presentacion' && pres.pedido.titulo === 'Charla');
  assert.ok(esFallaPlan(pedidoEnBlanco({ tema: 'no-existe' }, [])));
  const b = runnerDe('crear_landing_en_blanco');
  assert.match(b, /docsEditor\.crear\(p\.pedido\)/);
  assert.match(b, /if \(enFlujo\(ctx\)\) return \{ error:/);
  assert.match(b, /datos: \{ id: r\.doc\.id,/, 'lo que crea devuelve su id');
});

// ── Generar con IA ───────────────────────────────────────────────────────────────

test('generar con IA: una idea o un texto (no los dos), el modo del texto sólo con texto, y el tema que sugiere la pantalla', async () => {
  const sinTemas = (t: string) => temaElegido(t, []);
  assert.deepEqual(falla(pedidoGenerar({}, sinTemas)).faltan, ['idea']);
  assert.match(falla(pedidoGenerar({ idea: 'Una landing', texto: 'Un texto' }, sinTemas)).error, /no los dos/);
  assert.match(falla(pedidoGenerar({ idea: 'Una landing', modoTexto: 'conservar' }, sinTemas)).error, /sólo con «texto»/);
  const idea = pedidoGenerar({ idea: 'Una landing para mi taller de cerámica', objetivo: 'vender' }, sinTemas);
  assert.ok(!esFallaPlan(idea));
  if (!esFallaPlan(idea)) {
    assert.equal(idea.modo, 'generar');
    assert.equal(idea.params.cantidad, 8);
    assert.equal(idea.tipo, 'landing');
    assert.equal(idea.params.formato, 'pagina');
  }
  const texto = pedidoGenerar({ texto: 'Mi curso de cerámica tiene 4 módulos...', modoTexto: 'conservar', formato: 'presentacion' }, sinTemas);
  assert.ok(!esFallaPlan(texto) && texto.modo === 'pegar' && texto.params.modoTexto === 'conservar' && texto.params.formato === 'presentacion');
  assert.ok(esFallaPlan(pedidoGenerar({ idea: 'x', secciones: 25 }, sinTemas)), 'de 1 a 20');
  // El tema sugerido es EXACTAMENTE el de la pantalla (SelectorTemaCrear.tsx, 'use client': la copia se compara).
  const { temaSugerido } = await import('../app/web-generator/crear/SelectorTemaCrear');
  for (const o of OBJETIVOS_LANDING) assert.equal(temaSugeridoApi(o.value), temaSugerido(o.value), o.value);
});

// Corrección de la tanda 7 (15/10/2026; Martín: «Todas las funciones a la API de MaKo»): crear «sobre una página ya
// analizada» —la «Landing de base» de «Más ajustes» y el `?url=` del ex Landing Analyst— no tenía camino en la API:
// pedidoGenerar y el runner mandaban siempre `basadoEnUrl: null`, y mako-capacidades lo prometía igual.
// PROBADO ROMPIÉNDOLO (15/10/2026), base 25 / 0:
//   · pedidoGenerar aceptando cualquier dirección (sin baseDelDeepLink)      → 24 / 1 (éste)
//   · pedidoGenerar sin pasar la base a params (basadoEnUrl: null otra vez)  → 24 / 1 (éste)
//   · el runner sin pasar la base al config de la landing nueva              → 24 / 1 (éste)
//   · el runner sin leer las analizadas en ejecutar (sólo en preparar)       → 24 / 1 (éste)
//   · la definición sin el parámetro                                         → 24 / 1 (éste)
// Restaurado: 25 / 0.
test('generar con IA sobre una página YA ANALIZADA («basadaEn»): sólo una del negocio, exacta, y llega a la generación', () => {
  const sinTemas = (t: string) => temaElegido(t, []);
  const analizadas = [{ url: 'https://minegocio.com/oferta' }, { url: 'https://minegocio.com/webinar' }];
  const base = pedidoGenerar({ idea: 'La misma oferta, más clara', basadaEn: 'https://minegocio.com/oferta' }, sinTemas, analizadas);
  assert.ok(!esFallaPlan(base));
  if (!esFallaPlan(base)) assert.equal(base.params.basadoEnUrl, 'https://minegocio.com/oferta');
  // Un parecido no es una clave (como baseDelDeepLink de la pantalla); una que no está nombra las que hay.
  for (const u of ['https://www.minegocio.com/oferta', 'https://minegocio.com/oferta/', 'https://otro.com']) {
    const f = falla(pedidoGenerar({ idea: 'x', basadaEn: u }, sinTemas, analizadas));
    assert.match(f.error, /analizadas del negocio/, u);
    assert.deepEqual(f.disponibles, analizadas.map((a) => a.url), u);
  }
  assert.ok(esFallaPlan(pedidoGenerar({ idea: 'x', basadaEn: 'https://minegocio.com/oferta' }, sinTemas)), 'sin la lista, ninguna vale');
  const sin = pedidoGenerar({ idea: 'x' }, sinTemas, analizadas);
  assert.ok(!esFallaPlan(sin) && sin.params.basadoEnUrl === null, 'sin pedirla, sin base');
  // El parámetro está declarado, y el runner lee las analizadas en los DOS pasos y pasa la base al config.
  assert.ok(porId('generar_landing_con_ia')!.parametros.some((p) => p.nombre === 'basadaEn'));
  const run = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  const bloque = run.slice(run.indexOf('  generar_landing_con_ia: {'), run.indexOf('  editar_landing_con_ia: {'));
  assert.ok(bloque.length > 100, 'no encontré el runner');
  assert.equal(bloque.match(/pedidoGenerar\((?:input|payload), \(t\) => temaElegido\(t, propios\), analizadas\)/g)?.length, 2);
  assert.equal(bloque.match(/const analizadas = (?:input|payload)\.basadaEn \? await listarAnalizadas\(\) : \[\];/g)?.length, 2);
  assert.match(bloque, /basadoEnUrl: p\.params\.basadoEnUrl \?\? null,/);
});

// Corrección de la tanda 7 (15/10/2026): «Imagen → Biblioteca» del editor no tenía camino en la API, y la lectura vivía
// DENTRO de la ruta de la pantalla (app/api/landing-generator/imagenes/route.ts): declararla era escribir una segunda
// implementación. Se mudó tal cual a lib/editor-landing/server.ts (`bibliotecaDeImagenes`) y la leen las dos.
// PROBADO ROMPIÉNDOLO (15/10/2026), base 27 / 0:
//   · la ruta con su propio `bucket.list(` otra vez (dos implementaciones)  → 26 / 1 (éste)
//   · el runner leyendo el ws del pedido (`input.ws`) y no del contexto     → 26 / 1 (éste)
//   · bibliotecaDeImagenes sin paginar de a 1000                            → 26 / 1 (éste)
//   · la operación sin su fila REST                                         → 25 / 2 (éste y «lo que gasta IA…», que
//     exige ruta REST a todo lo que sale por http)
// Restaurado: 27 / 0.
test('la biblioteca de imágenes por la API: lectura, por http, y UNA implementación que lee la pantalla también', () => {
  const d = porId('listar_imagenes_landing');
  assert.ok(d && esLectura(d), 'listar_imagenes_landing no está en el registro');
  assert.ok(d.canales.includes('http') && d.canales.includes('whatsapp'));
  assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' });
  assert.deepEqual(rutaRestDe('listar_imagenes_landing'), { metodo: 'GET', ruta: '/landing/imagenes' });
  const srv = sinComentarios(leer('lib/editor-landing/server.ts'));
  const i = srv.indexOf('export async function bibliotecaDeImagenes(ws: number)');
  assert.ok(i >= 0, 'no encontré bibliotecaDeImagenes');
  const fn = srv.slice(i, srv.indexOf('\n}\n', i) + 2);
  assert.match(fn, /bucket\.list\(`\$\{ws\}`, \{ limit: 1000, offset, sortBy: \{ column: 'created_at', order: 'desc' \} \}\)/);
  assert.match(fn, /for \(let offset = 0; archivos\.length < TOPE_BIBLIOTECA; offset \+= 1000\)/);
  assert.match(fn, /const tipo = f\.id \? archivoDeBiblioteca\(f\.name\) : null;/, 'sólo lo verificado, sin la carpeta de subidas');
  const ruta = sinComentarios(leer('app/api/landing-generator/imagenes/route.ts'));
  assert.match(ruta, /case 'biblioteca': \{\s*const r = await bibliotecaDeImagenes\(ws\);/);
  // (Su `.list` de la carpeta de SUBIDAS es de `registrar`, otra cosa: lo que no puede es listar la raíz del ws.)
  assert.doesNotMatch(ruta, /\.list\(`\$\{ws\}`/, 'la ruta no lista la biblioteca por su cuenta');
  assert.doesNotMatch(ruta, /TOPE_BIBLIOTECA|archivoDeBiblioteca/, 'ni conserva la copia vieja');
  const run = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  const bloque = run.slice(run.indexOf('  listar_imagenes_landing: {'), run.indexOf('  crear_landing_en_blanco: {'));
  assert.ok(bloque.length > 100, 'no encontré el runner');
  assert.match(bloque, /await docsEditor\.bibliotecaDeImagenes\(ctx\.ws\)/, 'el ws sale del contexto, nunca del pedido');
});

// ── 4. Las copias de reglas de la pantalla, y lo demás ─────────────────────────

test('«Restablecer estilo» toca las MISMAS claves que el panel Estilo (EstiloSeccion.tsx)', () => {
  const src = sinComentarios(leer('app/web-generator/editor/paneles/EstiloSeccion.tsx'));
  const bloque = src.slice(src.indexOf('export const ESTILO_RESTABLECIDO'), src.indexOf('};', src.indexOf('export const ESTILO_RESTABLECIDO')));
  const claves = [...bloque.matchAll(/^\s+([a-zA-Z]+): ATTRS_TARJETA_DEFAULT\./gm)].map((m) => m[1]).sort();
  assert.ok(claves.length >= 8, `leí ${claves.length} claves del panel`);
  assert.deepEqual(Object.keys(ESTILO_RESTABLECIDO_API).sort(), claves);
});

test('ver_secciones_landing: también las ocultas, con su id y la posición de cada bloque', () => {
  const c = landing();
  c.paginas[0].doc.content![1].attrs!.oculta = true;
  const e = estructuraParaApi(5, c);
  assert.equal(e.paginas.length, 2);
  const s = e.paginas[0].secciones;
  assert.deepEqual(s.map((x) => [x.n, x.id, x.oculta]), [[1, 'tHero', false], [2, 'tBeneficios', true], [3, 'tForm', false]]);
  assert.deepEqual(s[0].bloques.map((b) => b.tipo), ['título 1', 'texto', 'video sin enlace']);
  assert.equal(s[2].bloques[2].tipo, 'agenda sin enlace');
  assert.equal(estructuraParaApi(5, c, 'pGracias').paginas.length, 1);
});

test('listar_landings_creadas con papelera:true lista SÓLO las de la papelera, con su id', () => {
  const r = (id: number, papelera: boolean): LandingResumen => ({ id, titulo: `L${id}`, tema: 'pewter', creado: '2026-10-01', actualizado: `2026-10-0${id}`, creadoPor: null, favorito: false, carpeta: null, papelera, slug: null, publicadoAt: null, primera: null });
  const docs = [r(1, false), r(2, true), r(3, false)];
  const normal = listaParaApi(docs, 50);
  assert.deepEqual(normal.landings.map((l) => l.id), [1, 3]);
  assert.equal(normal.en_papelera, 1);
  const pap = listaParaApi(docs, 50, { papelera: true });
  assert.deepEqual(pap.landings.map((l) => l.id), [2]);
  assert.match(pap.nota, /borrar_landing_creada/);
  assert.ok(porId('listar_landings_creadas')!.parametros.some((x) => x.nombre === 'papelera'));
  assert.ok(esLectura(porId('listar_landings_creadas')!));
});

// ── Por WhatsApp (el turno que corre) ───────────────────────────────────────────
// Medido el 15/10/2026 con el turno que CORRE (clasificarIntencion + herramientasDelTurno): las frases de editar
// salen `capturar` dudosa y ninguna herramienta de landing viaja. Es el MISMO bloqueante que tuvo publicar en la
// tanda 4: `esPedidoDeLanding` (lib/mako-intencion.ts, otra área) no conoce editar/cambiar/agregar/ocultar/conectar.
// Por la app (Pregúntale a MaKo), la bandeja y /api/v1 las operaciones ya existen. Corrección de la tanda 7
// (15/10/2026): `{ tipo: 'editar' }` en esPedidoDeLanding, y se le sacó el `todo`. Los casos negativos y las roturas
// de la regla están en tests/mako-intencion-landing.test.ts.
test('por WhatsApp: los pedidos de EDITAR una landing llegan con su herramienta', async () => {
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { herramientasDelTurno } = await import('../lib/doer-herramientas');
  const vista = { canal: 'whatsapp' as const, alcance: 'ejecutar' as const, ws: 13, rol: 'admin' as const, tabs: null };
  const casos: Array<[string, string]> = [
    ['cambia el titular de mi landing del webinar por Aprende a vender', 'cambiar_texto_landing'],
    ['agrega una sección de preguntas frecuentes a mi landing', 'agregar_seccion_landing'],
    ['ponle este video a mi landing https://www.youtube.com/watch?v=abc', 'poner_enlace_landing'],
    ['cambia el tema de mi landing a uno oscuro', 'cambiar_tema_landing'],
    ['conecta el dominio promo.minegocio.com a mi landing', 'conectar_dominio_landing'],
    ['oculta la sección de precios de la landing', 'acomodar_seccion_landing'],
  ];
  const sin: string[] = [];
  for (const [f, tool] of casos) {
    const n = herramientasDelTurno({ veredicto: clasificarIntencion(f, {}), texto: f, agendaAbierta: false, deSiempre: [], vista, hayPendientes: false }).tools.map((t) => t.name);
    if (!n.includes(tool)) sin.push(`${f} → sin ${tool}`);
  }
  assert.deepEqual(sin, []);
});
