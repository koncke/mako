// =============================================================================
// La receta de un reel replicado, en UN pedido y en la Edición automática (12/11/2026)
// =============================================================================
// Probando la tab Video entera en producción (ws 9), con «Replicar» de «La palabra clave gigante»:
//   · el chat ya sabía la receta, pero la aplicaba en dos pedidos: «No se aplica: los subtítulos que se generan en este
//     pedido todavía no existen: pide el preset después» y «no hay un video con sonido en la pista principal» (la toma la
//     ponía ese mismo pedido). Ahora lo que depende de algo que crea el pedido va ENCADENADO (chat/linea.ts →
//     `Revision.encadenadas`) y «Aceptar» da otra vuelta contra la línea de tiempo nueva (chat/aplicar.ts).
//   · la Edición automática no seguía la receta: claves en lima y del MISMO tamaño. Ahora la receta (lib/video-recetas.ts
//     → `editor`) manda en el estilo de los subtítulos, el tamaño y color de las claves y la pausa que se borra.
//
// Correr: node --import tsx --test tests/video-editor-receta-un-pedido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarOperacion, type OperacionChat } from '../lib/editor-video/chat-catalogo';
import { revisarOperaciones, VUELTAS_ENCADENADAS, vistaDeLinea } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import { PLANTILLAS_SUBTITULO, paramsDePlantilla, plantillaPorId } from '../app/video-editor/_opencut/subtitles/estilos';
import { PARAM_CLAVES_COLOR, PARAM_CLAVES_TAMANO, TOPES_CLAVES_TAMANO } from '../app/video-editor/_opencut/params/extra/subtitulos';
import { RECETAS, recetaDe, recetaDelHilo, textoDeReceta } from '../lib/video-recetas';
import { decidirPaso, LIMA, type EstadoLinea } from '../app/video-editor/_opencut/enjambre/plan';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: `${id}.mp4`, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
const MEDIOS = [{ id: 'toma', name: 'mi-toma.mp4', type: 'video' as const, duration: 56.1, hasAudio: true }];
const lienzo = { ancho: 1080, alto: 1920 };

/** El proyecto que arma «Replicar»: vacío; o, en la vuelta siguiente, con la toma puesta y (si ya se generaron) subtítulos. */
function escena({ toma = false, subs = false } = {}): SceneTracks {
  return {
    overlay: subs
      ? [{ id: 'ps', type: 'text', name: 'Subtítulos', hidden: false, elements: [el('s1', 'text', 0, 2, { params: { content: 'que paga la gente', subtitulo: true } }), el('s2', 'text', 2, 2, { params: { content: 'te exige mucho', subtitulo: true } })] }]
      : [],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: toma ? [el('vid1', 'video', 0, 56.1, { mediaId: 'toma' })] : [] },
    audio: [],
  } as unknown as SceneTracks;
}
const vista = (o: Parameters<typeof escena>[0] = {}) =>
  vistaDeLinea({ tracks: escena(o), tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor(), lienzo, medios: MEDIOS, fondo: null });
const ops = (xs: unknown[]): OperacionChat[] => xs.map((o) => { const r = validarOperacion(o); assert.ok(r.ok, r.ok ? '' : r.motivo); return r.op; });
const revisar = (xs: OperacionChat[], v = vista()) => revisarOperaciones({ operaciones: xs, vista: v, alcance: 'video' });

test('R1: la receta entera, en UN pedido: lo que depende de lo que crea el pedido va encadenado, nada se descarta', () => {
  const ref = [...vista().medios.values()][0].ref;
  const pedido = ops([
    { op: 'agregar_medios', medios: [ref] },
    { op: 'generar_subtitulos' },
    { op: 'usar_preset_subtitulos', preset: 'palabra-gigante' },
    { op: 'palabras_clave', modo: 'auto', color: '#ffffff', tamano: 300 },
    { op: 'borrar_silencios', pausa_min: 0.5 },
  ]);
  // Vuelta 1: la toma y los subtítulos. El estilo y las claves esperan a los subtítulos; los silencios, a la toma.
  const v1 = revisar(pedido);
  assert.deepEqual(v1.descartes, [], 'antes: «todavía no existen: pide el preset después» y «no hay un video con sonido»');
  assert.deepEqual(v1.resueltas.map((r) => r.op), ['agregar_medios', 'generar_subtitulos']);
  assert.deepEqual((v1.encadenadas ?? []).map((o) => o.op), ['usar_preset_subtitulos', 'palabras_clave', 'borrar_silencios']);
  const filas = v1.cambios.filter((c) => c.titulo.startsWith('Después de')).map((c) => `${c.titulo}: ${c.despues}`);
  assert.deepEqual(filas, [
    'Después de generar los subtítulos: el estilo «Palabra gigante»',
    'Después de generar los subtítulos: palabras clave en #ffffff al 300 %',
    'Después de poner el video: borrar los silencios (las pausas de 0,5 s o más)',
  ]);
  // Vuelta 2, con la toma y los subtítulos ya puestos: el estilo y los silencios van; las claves, después del estilo
  // (la plantilla reescribe su tamaño: subtitles/estilos.ts → paramsDePlantilla).
  const v2 = revisar(v1.encadenadas!, vista({ toma: true, subs: true }));
  assert.deepEqual(v2.descartes, []);
  assert.deepEqual(v2.resueltas.map((r) => r.op), ['usar_plantilla_subtitulos', 'borrar_silencios']);
  assert.deepEqual((v2.encadenadas ?? []).map((o) => o.op), ['palabras_clave']);
  assert.ok(v2.cambios.some((c) => c.titulo === 'Después de aplicar el estilo de los subtítulos'));
  // Vuelta 3: las claves, al 300 % y en blanco.
  const v3 = revisar(v2.encadenadas!, vista({ toma: true, subs: true }));
  assert.deepEqual(v3.descartes, []);
  assert.equal(v3.encadenadas, undefined);
  assert.ok(v3.resueltas.length > 0 && v3.resueltas.every((r) => r.op === 'params' && r.params[PARAM_CLAVES_TAMANO] === 300 && r.params[PARAM_CLAVES_COLOR] === '#ffffff'));
  assert.ok(VUELTAS_ENCADENADAS >= 2, 'alcanzan las vueltas para la receta (estilo → claves)');
});

test('R2: sin nada que lo produzca, lo de siempre: se descarta con su motivo, no se encadena', () => {
  const r = revisar(ops([{ op: 'usar_preset_subtitulos', preset: 'palabra-gigante' }]), vista({ toma: true }));
  assert.deepEqual(r.descartes, ['no hay subtítulos']);
  assert.equal(r.encadenadas, undefined);
  // Con subtítulos y sin plantilla en el pedido, las claves van en el momento.
  assert.equal(revisar(ops([{ op: 'palabras_clave', modo: 'auto' }]), vista({ toma: true, subs: true })).encadenadas, undefined);
});

test('R3: «Aceptar» da otra vuelta con lo encadenado, contra la línea de AHORA, y lo cuenta en los pasos de «Restaurar»', () => {
  const apl = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(apl, /const \{ resueltas, descartes, encadenadas \} = revisarOperaciones\(/);
  assert.match(apl, /for \(let vuelta = 0; pendientes\.length && vuelta < VUELTAS_ENCADENADAS; vuelta\+\+\) \{/);
  const vuelta = apl.slice(apl.indexOf('let pendientes = encadenadas'));
  assert.match(vuelta, /const enLaLinea = enSuLugar\(\);/, 'otra vez en su proyecto y escena');
  assert.match(vuelta, /tracks: enLaLinea\.escena\.tracks,/, 'la línea de AHORA');
  assert.match(vuelta, /refsPrevias: p\.refsPorId,/);
  assert.match(vuelta, /if \(otra\.resueltas\.length\) await aplicarVuelta\(otra\.resueltas, datosAhora\.transcripcion\.idioma\);/);
  // `pasos` es de toda la propuesta: «Restaurar» deshace las vueltas juntas.
  assert.match(apl, /const aplicarVuelta = async \(resueltas: OperacionResuelta\[\], idioma: string\) => \{[\s\S]*?pasos\+\+/);
});

test('R4: la receta dice lo que el editor aplica, y un proyecto replicado se reconoce por su chat', () => {
  const r = recetaDe('palabra-gigante')!;
  assert.deepEqual(r.editor, { subtitulos: 'palabra-gigante', claves: { tamano: 300, color: '#ffffff' }, pausaMinima: 0.5 });
  const texto = textoDeReceta(r);
  assert.match(texto, /En el editor de MaKo, todo en un pedido: subtítulos con el estilo «palabra-gigante» de la galería de Subtítulos, palabras clave en #ffffff al 300 %, borrar los silencios de 0,5 s o más\.$/);
  assert.equal(recetaDelHilo([{ de: 'yo', texto: 'hola' }, { de: 'mako', texto }])?.id, 'palabra-gigante');
  assert.equal(recetaDelHilo([{ de: 'yo', texto }]), null, 'lo que escribe la persona no cuenta');
  assert.equal(recetaDelHilo([{ de: 'mako', texto: 'Armé este proyecto para replicar «Otra cosa»' }]), null);
  // Cada estilo que nombra una receta existe en la galería, y cada tamaño de claves entra en el tope del editor.
  for (const x of RECETAS) {
    if (x.editor?.subtitulos) assert.ok(PLANTILLAS_SUBTITULO.some((p) => p.id === x.editor!.subtitulos), `${x.id}: no existe el estilo ${x.editor.subtitulos}`);
    if (x.editor?.claves) assert.ok(x.editor.claves.tamano >= TOPES_CLAVES_TAMANO.min && x.editor.claves.tamano <= TOPES_CLAVES_TAMANO.max, x.id);
  }
});

test('R5: el estilo «Palabra gigante»: serifa blanca, chico, y las claves en la MISMA letra y color, al tope', () => {
  const p = plantillaPorId('palabra-gigante');
  assert.equal(p.id, 'palabra-gigante');
  const params = paramsDePlantilla(p, { width: 1080, height: 1920 });
  assert.equal(params.fontFamily, 'Playfair Display');
  assert.equal(params.color, '#ffffff');
  assert.equal(params[PARAM_CLAVES_TAMANO], TOPES_CLAVES_TAMANO.max);
  assert.equal(params[PARAM_CLAVES_COLOR], '#ffffff');
  assert.ok((params.fontSize as number) < (paramsDePlantilla(plantillaPorId('predeterminado'), { width: 1080, height: 1920 }).fontSize as number), 'más chico que el de siempre');
  // Las demás no tocan el color de las claves.
  assert.equal(paramsDePlantilla(plantillaPorId('hormozi'), { width: 1080, height: 1920 })[PARAM_CLAVES_COLOR], undefined);
});

test('R6: la Edición automática sigue la receta: la pausa, sin subtítulos si va sin, y las claves a su tamaño y color', () => {
  const estado = (subs: number, claves = false) =>
    ({ conVoz: [{ ref: 'v1', ruido: false, normalizado: null }], subtitulos: Array.from({ length: subs }, (_, i) => ({ ref: `s${i}`, texto: 'x', inicio: i, claves: claves ? ['x'] : [] })), conPalabras: true, estiloLibre: true }) as unknown as EstadoLinea;
  const receta = recetaDe('palabra-gigante')!.editor!;
  assert.deepEqual(decidirPaso('pausas', estado(0), receta), { hace: true, operaciones: [{ op: 'borrar_silencios', pausa_min: 0.5 }] });
  assert.deepEqual(decidirPaso('claves', estado(2), receta), { hace: true, operaciones: [{ op: 'palabras_clave', modo: 'auto', color: '#ffffff', tamano: 300 }] });
  // Sin receta, lo de siempre.
  assert.deepEqual(decidirPaso('claves', estado(2)), { hace: true, operaciones: [{ op: 'palabras_clave', modo: 'auto', color: LIMA }] });
  assert.deepEqual(decidirPaso('pausas', estado(0)), { hace: true, operaciones: [{ op: 'borrar_silencios' }] });
  assert.equal(decidirPaso('subtitulos', estado(0), recetaDe('novato-experto')!.editor!).hace, false);
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /const recetaDelProyecto = recetaDelHilo\(leerHilo\(proyecto\.metadata\.id\)\.mensajes\);/);
  assert.match(correr, /const decision = decidirPaso\(paso\.id, antes\.estado, ctx\.receta\);/);
  // El estilo de la receta, sin probar otros; y con receta, aunque la persona tenga otra plantilla para todos.
  assert.match(correr, /if \(ctx\.receta\?\.subtitulos\) \{\s*const plantilla = plantillaPorId\(ctx\.receta\.subtitulos\);\s*await aplicarEstiloASubtitulos\(/);
  assert.match(correr, /const estiloLibre = subtitulosNuevos && \(!!receta\?\.subtitulos \|\| usePreferenciasSubtitulos\.getState\(\)\.plantilla === PLANTILLA_POR_DEFECTO\.id\);/);
});
