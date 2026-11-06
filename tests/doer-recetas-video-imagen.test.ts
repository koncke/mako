// =============================================================================
// Las recetas de video e imagen: preguntar lo que cambia el resultado, y viajar sólo con lo suyo
// =============================================================================
// Pieza 1.15 del Ops Center (docs/ops-center-principal.md §4.10, 20/10/2026). EL CASO: un pedido como
// «cortá el principio del video» no dice qué proyecto ni cuánto, y MaKo proponía un corte por defecto en
// silencio. La receta del editor le dice que PREGUNTE una sola cosa con opciones sacadas de los datos
// reales. Lo que fija este archivo:
//   · cada receta viaja con su herramienta: la del editor con sus 35 escrituras (no con las lecturas, que
//     son las que trae una pregunta), la del Generator con lo suyo, la de avatar con `ver_avatares` y la de
//     imagen con sus escrituras;
//   · toda operación de video o imagen del registro está en algún grupo: una operación nueva no queda sin
//     receta sin que nadie lo decida;
//   · con el selector REAL del turno (canal app), un pedido de edición que hoy ya llega trae la receta, y
//     una pregunta no.
// «cortá el principio del video» todavía no llega a su herramienta: es la 1.2 (MaKo Alert). Queda como
// `todo` abajo, con la frase exacta.
//
// PROBADO ROMPIÉNDOLO (20/10/2026; base 5 / 0, más el `todo`). Pasan / fallan:
//   R1 la receta del editor viaja siempre                       → 3 / 2
//   R2 viaja también con las lecturas (las de una pregunta)     → 2 / 3
//   R3 no pregunta cuánto cortar ni dónde                       → 4 / 1
//   R4 el Generator deja de explicar el saldo null              → 4 / 1
//   R5 una operación de video queda sin grupo                   → 4 / 1
//   R6 la de imagen no viaja nunca                              → 4 / 1
//   R7 la de avatar no viaja                                    → 4 / 1
//   R8 el grupo del editor sale vacío                           → 1 / 4

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESCRITURAS_EDITOR_VIDEO, ESCRITURAS_IMAGEN, OPERACIONES_GENERADOR_VIDEO, recetasDelTurno } from '../lib/doer-recetas';
import { REGISTRO, type Vista } from '../lib/api-mako/registro';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';

const RAIZ = resolve(import.meta.dirname, '..');
const EDITOR = /EL VIDEO EDITOR:/;
const GENERADOR = /EL VIDEO GENERATOR:/;
const AVATAR = /AI AVATAR:/;
const IMAGEN = /EL IMAGE EDITOR:/;

test('cada receta viaja con lo suyo, y no con otra cosa', () => {
  assert.match(recetasDelTurno(new Set(['cortar_tramo_video']), false), EDITOR);
  assert.match(recetasDelTurno(new Set(['ver_saldo_flow']), false), GENERADOR);
  assert.match(recetasDelTurno(new Set(['ver_avatares']), false), AVATAR);
  assert.match(recetasDelTurno(new Set(['crear_diseno_imagen']), false), IMAGEN);
  // Las lecturas del editor y de imagen son lo que trae una PREGUNTA: ahí no pesan.
  const pregunta = recetasDelTurno(new Set(['listar_proyectos_video', 'ver_proyecto_video', 'listar_disenos_imagen', 'ver_diseno_imagen']), true);
  assert.doesNotMatch(pregunta, EDITOR);
  assert.doesNotMatch(pregunta, IMAGEN);
  // Un turno del CRM no lleva nada de esto.
  const crm = recetasDelTurno(new Set(['buscar_leads', 'proponer_cambio_etapa']), false);
  for (const re of [EDITOR, GENERADOR, AVATAR, IMAGEN]) assert.doesNotMatch(crm, re);
});

test('la del editor pregunta lo que cambia el resultado, con opciones reales, y no dice «listo»', () => {
  const r = recetasDelTurno(new Set(['recortar_clip_video']), false);
  assert.match(r, /PREGUNTA UNA SOLA COSA con 2 o 3 opciones sacadas de los datos reales/);
  assert.match(r, /no propongas nada hasta tener la respuesta/);
  assert.match(r, /Cuánto cortar y dónde, si no te lo dicen/);
  assert.match(r, /los 3 más recientes/);
  assert.match(r, /un hecho \(fecha, precio, dirección, hora\): pídelo, nunca lo rellenes/);
  assert.match(r, /nunca digas «listo», «aplicado» ni «ya está»/);
  assert.match(r, /'ver_proyecto_video'/);
  // Las cuatro juntas no se comen el turno: es lo que se paga en cada paso del loop.
  const todas = recetasDelTurno(new Set(['recortar_clip_video', 'ver_saldo_flow', 'ver_avatares', 'crear_diseno_imagen']), false);
  assert.ok(todas.length < 3800, `las cuatro recetas pesan ${todas.length} caracteres`);
});

test('el Generator: el saldo null es «nunca se leyó», una toma por vez, sin prompt', () => {
  const r = recetasDelTurno(new Set(['calcular_alcance_anuncio']), false);
  assert.match(r, /créditos null quiere decir que NUNCA se leyó, no que tenga cero/);
  assert.match(r, /una toma por vez/);
  assert.match(r, /no se reintenta sola/);
  assert.match(r, /Nunca muestres un prompt/);
});

test('toda operación de video o imagen del registro está en un grupo (o es una lectura que no pide receta)', () => {
  const LECTURAS_SIN_RECETA = new Set(['listar_proyectos_video', 'ver_proyecto_video', 'listar_plantillas_video', 'ver_avatares', 'listar_disenos_imagen', 'ver_diseno_imagen', 'listar_plantillas_imagen', 'estado_carruseles', 'buscar_carruseles', 'ver_biblioteca_carruseles', 'listar_presets_subtitulos',
    // Las plantillas de venta de AI Avatar (6/11/2026): una lista de formas de negocios ficticios, como listar_plantillas_video.
    'ver_plantillas_avatar']);
  // Guardar un carrusel en las referencias (04/11/2026) no edita ningún diseño: la receta del Image Editor (qué diseño,
  // qué tamaño, los textos que son hechos) no tiene nada que decirle, y su descripción ya dice de dónde sale el id.
  // «Hacer el mío» (crear_carrusel_desde_referencia) crea con guías en cada lámina, sin textos que inventar: lo que falta
  // (el tipo, si la referencia no encaja con ninguno) lo pide su propio `preparar`.
  // La biblioteca de ejemplos (cambiar_biblioteca_carruseles) la edita la plataforma: suma o saca una cuenta o un tema y
  // no toca ningún diseño; lo que falta (el @, el motivo) lo pide su propio `preparar`.
  // «Editar» un ejemplo (editar_ejemplo_carrusel, 6/11/2026) escribe los textos con la IA del negocio leyendo él mismo el
  // negocio (lib/carruseles/replica-servidor.ts): el modelo del chat sólo pasa el id y, si lo dijo el dueño, el pedido.
  // Los presets de subtítulos de la marca (06/11/2026) no editan ningún proyecto del navegador: se guardan en el negocio,
  // con un «sí». La receta del editor (qué proyecto, qué refs) no tiene nada que decirles, y lo que falta (el nombre, la
  // marca si hay dos iguales) lo pide su propio `preparar`.
  const ACCIONES_SIN_RECETA = new Set(['guardar_carrusel', 'crear_carrusel_desde_referencia', 'cambiar_biblioteca_carruseles', 'editar_ejemplo_carrusel', 'guardar_preset_subtitulos', 'borrar_preset_subtitulos']);
  const sinGrupo = REGISTRO
    .filter((d) => d.area === 'video' || d.area === 'imagen')
    .map((d) => d.id)
    .filter((id) => !ESCRITURAS_EDITOR_VIDEO.has(id) && !OPERACIONES_GENERADOR_VIDEO.has(id) && !ESCRITURAS_IMAGEN.has(id) && !LECTURAS_SIN_RECETA.has(id) && !ACCIONES_SIN_RECETA.has(id));
  assert.deepEqual(sinGrupo, [], `operaciones sin receta decidida: ${sinGrupo.join(', ')}. Súmalas a un grupo de lib/doer-recetas.ts`);
  assert.equal(ESCRITURAS_EDITOR_VIDEO.size, 37, 'el editor tiene 37 operaciones de escritura (lib/editor-video/chat-api.ts; la 36 y la 37, resaltar_claves_subtitulos y usar_preset_subtitulos, 06/11)');
  // Leila se lo pidió a MaKo el 27/10 y la receta le hacía decir que no podía: lo que tiene operación no va en «no puede».
  const noPuede = /no puede por chat \(([^)]*)\)/.exec(recetasDelTurno(new Set(['borrar_silencios_video']), false))?.[1] ?? '';
  assert.ok(noPuede, 'la receta del editor ya no dice qué no se puede');
  assert.doesNotMatch(noPuede, /silencio/i, 'la receta dice que borrar silencios no se puede, y hay borrar_silencios_video');
});

// ── Con el selector REAL del turno ───────────────────────────────────────────────────────────────────

/** Los nombres de las de siempre viven en módulos con `server-only`: se piden a un node aparte (el molde de tests/mako-turno-app.test.ts). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const VISTA: Vista = { canal: 'app', alcance: 'proponer', ws: 9, rol: 'admin', tabs: null };

/** Las recetas que llevaría el system del Ops Center para este pedido (lib/mako-turno-app.ts arma lo mismo). */
function recetasDe(texto: string): string {
  const veredicto = clasificarIntencion(texto, {});
  const t = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: VISTA, hayPendientes: false });
  return recetasDelTurno(new Set(t.tools.map((x) => x.name)), t.ofrece);
}

test('un pedido de edición que hoy llega a su herramienta lleva la receta del editor; una pregunta, no', () => {
  assert.match(recetasDe('cambiá la velocidad del clip v1 del video Promo al doble'), EDITOR);
  assert.doesNotMatch(recetasDe('¿qué proyectos tengo en el editor de video?'), EDITOR);
});

test('«cortá el principio del video» lleva la receta del editor (pregunta cuánto y cuál)', { todo: 'depende de la 1.2: hoy el clasificador lo anota como idea y no viaja ninguna herramienta de video' }, () => {
  assert.match(recetasDe('cortá el principio del video'), EDITOR);
});
