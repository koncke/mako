// =============================================================================
// Video Editor: el rango I / O de CapCut y los atajos que faltaban
// =============================================================================
// CapCut (relevamiento-capcut-armazon §7.4 y §10): I = punto de entrada, O =
// punto de salida, Shift+X = «Seleccionar por clip», Alt+X = «Anular selección»
// (del rango), y «solo se exporta ese rango». Más Ctrl+R (panel de velocidad),
// Shift+B (velocidad de la curva) y Ctrl+J (agregar ritmo).
//
// Lo que se fija, ejecutando el código (rango/reglas.ts y rango/acciones.ts no
// cargan el motor; speed/abrir.ts tampoco):
//   1. las marcas: I / O en el cabezal, y una que cae del otro lado suelta la otra;
//   2. el tramo que vale se CALCULA con la duración de ahora: una sola marca es un
//      rango, se recorta al borrar clips y desaparece si queda vacío;
//   3. «Seleccionar por clip»: el rango de los elegidos, o el de la principal bajo
//      el cabezal (un clip que empieza ahí cuenta; uno que termina ahí, no);
//   4. qué tramo exporta: los cuadros, las muestras de audio y los subtítulos;
//   5. el texto del pie y los segundos que se exportan;
//   6. las acciones sobre un editor de mentira (por proyecto, Alt+X las quita);
//   7. Ctrl+R / Shift+B abren la pestaña «Velocidad» que corresponde, y nada más;
//   8. el preset: las teclas nuevas, sin una tecla para dos acciones;
//   9. la migración de atajos de quien los personalizó;
//  10. el cableado: los manejadores, la regla y Exportar leen esto.
//
// Correr: node --import tsx --test tests/video-editor-rango.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SIN_MARCAS,
  clipEnElTiempo,
  cuadrosDelTramo,
  hayMarcas,
  marcarEntrada,
  marcarSalida,
  marcasDeClips,
  muestrasDelTramo,
  seCruzaConElTramo,
  segundosAExportar,
  subtitulosDelTramo,
  tiempoDeRango,
  tramoEfectivo,
  tramoEnSegundos,
} from '../app/video-editor/_opencut/rango/reglas';
import {
  marcarEntradaEnCabezal,
  marcarRangoDelClip,
  marcarSalidaEnCabezal,
  quitarRango,
  tramoVigente,
} from '../app/video-editor/_opencut/rango/acciones';
import { useRangoStore } from '../app/video-editor/_opencut/rango/rango-store';
import { mostrarPanelVelocidad, mostrarVelocidadCurva } from '../app/video-editor/_opencut/speed/abrir';
import { usePropertiesStore } from '../app/video-editor/_opencut/components/editor/panels/properties/stores/properties-store';
import { ACTIONS, getActionDefinition, getDefaultShortcuts } from '../app/video-editor/_opencut/actions/definitions';
import { CURRENT_VERSION, runMigrations } from '../app/video-editor/_opencut/actions/keybindings/migrations';
import type { EditorCore } from '../app/video-editor/_opencut/core';

const TPS = 120_000; // ticks por segundo de mentira: las reglas lo reciben por parámetro
const seg = (s: number) => s * TPS;

const RAIZ = process.cwd();
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1: I / O en el cabezal, y una marca del otro lado suelta la otra', () => {
  let m = marcarEntrada(SIN_MARCAS, seg(2));
  assert.deepEqual(m, { entrada: seg(2), salida: null });
  m = marcarSalida(m, seg(5));
  assert.deepEqual(m, { entrada: seg(2), salida: seg(5) });
  // Entrada en o después de la salida: la salida se suelta (nunca un rango al revés).
  assert.deepEqual(marcarEntrada(m, seg(5)), { entrada: seg(5), salida: null });
  assert.deepEqual(marcarEntrada(m, seg(7)), { entrada: seg(7), salida: null });
  // Salida en o antes de la entrada: la entrada se suelta.
  assert.deepEqual(marcarSalida(m, seg(2)), { entrada: null, salida: seg(2) });
  assert.deepEqual(marcarSalida(m, seg(1)), { entrada: null, salida: seg(1) });
  // Mover una punta sin cruzar conserva la otra.
  assert.deepEqual(marcarEntrada(m, seg(3)), { entrada: seg(3), salida: seg(5) });
  assert.deepEqual(marcarSalida(m, seg(9)), { entrada: seg(2), salida: seg(9) });
  // Ticks enteros y nunca negativos.
  assert.deepEqual(marcarEntrada(SIN_MARCAS, -40.6), { entrada: 0, salida: null });
  assert.equal(marcarSalida(SIN_MARCAS, 10.6).salida, 11);
  assert.equal(hayMarcas(SIN_MARCAS), false);
  assert.equal(hayMarcas(null), false);
  assert.equal(hayMarcas({ entrada: null, salida: 0 }), true);
});

test('2: el tramo que vale se calcula con la duración de ahora', () => {
  const dur = seg(10);
  assert.equal(tramoEfectivo(SIN_MARCAS, dur), null, 'sin marcas no hay rango');
  assert.equal(tramoEfectivo(undefined, dur), null);
  assert.deepEqual(tramoEfectivo({ entrada: seg(2), salida: seg(5) }, dur), { desde: seg(2), hasta: seg(5) });
  // Una sola marca también es un rango.
  assert.deepEqual(tramoEfectivo({ entrada: seg(4), salida: null }, dur), { desde: seg(4), hasta: dur }, 'sólo la entrada: hasta el final');
  assert.deepEqual(tramoEfectivo({ entrada: null, salida: seg(3) }, dur), { desde: 0, hasta: seg(3) }, 'sólo la salida: desde 0');
  // Se borraron clips y la línea se acortó: el rango se recorta solo…
  assert.deepEqual(tramoEfectivo({ entrada: seg(2), salida: seg(8) }, seg(6)), { desde: seg(2), hasta: seg(6) });
  // …y si queda vacío, no hay rango (ni se dibuja ni recorta el export).
  assert.equal(tramoEfectivo({ entrada: seg(7), salida: seg(9) }, seg(6)), null);
  assert.equal(tramoEfectivo({ entrada: seg(6), salida: null }, seg(6)), null);
  assert.equal(tramoEfectivo({ entrada: null, salida: 0 }, dur), null);
  assert.equal(tramoEfectivo({ entrada: seg(1), salida: seg(2) }, 0), null, 'proyecto vacío');
  // Un mínimo en ticks: un tramo más corto no cuenta.
  assert.equal(tramoEfectivo({ entrada: seg(1), salida: seg(1) + 10 }, dur, 20), null);
  assert.deepEqual(tramoEfectivo({ entrada: seg(1), salida: seg(1) + 20 }, dur, 20), { desde: seg(1), hasta: seg(1) + 20 });
});

test('3: «Seleccionar por clip» y el clip bajo el cabezal', () => {
  assert.deepEqual(marcasDeClips([{ startTime: seg(3), duration: seg(2) }]), { entrada: seg(3), salida: seg(5) });
  // Varios elegidos: el rango los cubre a todos, en cualquier orden.
  assert.deepEqual(
    marcasDeClips([
      { startTime: seg(6), duration: seg(1) },
      { startTime: seg(1), duration: seg(2) },
    ]),
    { entrada: seg(1), salida: seg(7) },
  );
  assert.equal(marcasDeClips([]), null, 'sin clips no cambia nada');
  assert.equal(marcasDeClips([{ startTime: seg(1), duration: 0 }]), null);
  const principal = [
    { id: 'a', startTime: 0, duration: seg(4) },
    { id: 'b', startTime: seg(4), duration: seg(3) },
  ];
  assert.equal(clipEnElTiempo(principal, seg(2))?.id, 'a');
  assert.equal(clipEnElTiempo(principal, seg(4))?.id, 'b', 'el que empieza en el cabezal es el que se ve');
  assert.equal(clipEnElTiempo(principal, seg(7)), null, 'el que termina en el cabezal no cuenta');
  assert.equal(clipEnElTiempo([], 0), null);
});

test('4: qué tramo exporta (cuadros, muestras y subtítulos)', () => {
  const porCuadro = TPS / 30;
  // Sin rango, la misma cuenta que antes: de 0 a la duración, al menos un cuadro.
  assert.deepEqual(cuadrosDelTramo(null, seg(10), porCuadro), { primero: 0, cantidad: 300 });
  assert.deepEqual(cuadrosDelTramo(null, 1, porCuadro), { primero: 0, cantidad: 1 });
  // Con rango: arranca en la entrada y cuenta sólo sus cuadros.
  assert.deepEqual(cuadrosDelTramo({ desde: seg(2), hasta: seg(5) }, seg(10), porCuadro), { primero: seg(2), cantidad: 90 });
  assert.deepEqual(cuadrosDelTramo({ desde: seg(2), hasta: seg(2) + 5 }, seg(10), porCuadro), { primero: seg(2), cantidad: 1 });

  // La mezcla de audio cubre la línea entera desde 0: se toma la ventana del tramo.
  assert.deepEqual(muestrasDelTramo({ desde: seg(2), hasta: seg(5) }, TPS, 48_000, 480_000), { inicio: 96_000, cantidad: 144_000 });
  // Recortada al largo de la mezcla.
  assert.deepEqual(muestrasDelTramo({ desde: seg(8), hasta: seg(12) }, TPS, 48_000, 480_000), { inicio: 384_000, cantidad: 96_000 });
  assert.deepEqual(muestrasDelTramo({ desde: seg(11), hasta: seg(12) }, TPS, 48_000, 480_000), { inicio: 480_000, cantidad: 0 });

  // Subtítulos (en segundos): sólo los del tramo, recortados al borde y corridos a 0.
  const subs = [
    { inicio: 0, fin: 1.5, texto: 'antes' },
    { inicio: 1.5, fin: 2.5, texto: 'cruza la entrada' },
    { inicio: 3, fin: 4, texto: 'adentro' },
    { inicio: 4.5, fin: 6, texto: 'cruza la salida' },
    { inicio: 5, fin: 7, texto: 'después' },
  ];
  assert.deepEqual(subtitulosDelTramo(subs, { desde: 2, hasta: 5 }), [
    { inicio: 0, fin: 0.5, texto: 'cruza la entrada' },
    { inicio: 1, fin: 2, texto: 'adentro' },
    { inicio: 2.5, fin: 3, texto: 'cruza la salida' },
  ]);
  assert.deepEqual(tramoEnSegundos({ desde: seg(2), hasta: seg(5) }, TPS), { desde: 2, hasta: 5 });
});

test('5: el pie de Exportar (el rango y los segundos que salen)', () => {
  assert.equal(tiempoDeRango(3), '00:03');
  assert.equal(tiempoDeRango(72), '01:12');
  assert.equal(tiempoDeRango(3725), '1:02:05');
  assert.equal(tiempoDeRango(3.5), '00:03,5');
  assert.equal(tiempoDeRango(2.96), '00:02,9', 'la décima se corta, no se redondea al segundo siguiente');
  assert.equal(tiempoDeRango(-1), '00:00');
  assert.equal(segundosAExportar(null, seg(10), TPS), 10);
  assert.equal(segundosAExportar({ desde: seg(2), hasta: seg(5) }, seg(10), TPS), 3);
});

// Un editor de mentira con lo que leen rango/acciones.ts y speed/abrir.ts.
function editorDeMentira(o: {
  proyecto?: string | null;
  cabezal?: number;
  duracion?: number;
  elegidos?: { trackId: string; elementId: string }[];
  elementos?: Record<string, { type: string; startTime: number; duration: number }>;
  principal?: { id: string; startTime: number; duration: number }[];
}) {
  const estado = { cabezal: o.cabezal ?? 0, elegidos: o.elegidos ?? [] };
  const editor = {
    project: { getActiveOrNull: () => (o.proyecto === null ? null : { metadata: { id: o.proyecto ?? 'p1' } }) },
    playback: { getCurrentTime: () => estado.cabezal },
    timeline: {
      getTotalDuration: () => o.duracion ?? seg(10),
      getElementsWithTracks: ({ elements }: { elements: { trackId: string; elementId: string }[] }) =>
        elements
          .filter((r) => o.elementos?.[r.elementId])
          .map((r) => ({ track: { id: r.trackId }, element: { id: r.elementId, ...o.elementos![r.elementId] } })),
    },
    selection: { getSelectedElements: () => estado.elegidos },
    scenes: { getActiveSceneOrNull: () => ({ tracks: { main: { elements: o.principal ?? [] } } }) },
  };
  return { editor: editor as unknown as EditorCore, estado };
}

test('6: las acciones del rango sobre el editor (por proyecto; Alt+X las quita)', () => {
  useRangoStore.setState({ porProyecto: {} });
  const { editor, estado } = editorDeMentira({ proyecto: 'p1', cabezal: seg(2) });
  marcarEntradaEnCabezal(editor);
  estado.cabezal = seg(6);
  marcarSalidaEnCabezal(editor);
  assert.deepEqual(tramoVigente(editor), { desde: seg(2), hasta: seg(6) });
  // Otro proyecto no lo ve.
  const otro = editorDeMentira({ proyecto: 'p2' }).editor;
  assert.equal(tramoVigente(otro), null);
  // Alt+X: «Anular selección» del rango.
  quitarRango(editor);
  assert.equal(tramoVigente(editor), null);
  assert.deepEqual(useRangoStore.getState().porProyecto, {}, 'quitarlo no deja una fila vacía');
  // Sin proyecto abierto no hace nada (ni tira).
  const sinProyecto = editorDeMentira({ proyecto: null, cabezal: seg(1) }).editor;
  marcarEntradaEnCabezal(sinProyecto);
  assert.deepEqual(useRangoStore.getState().porProyecto, {});

  // Shift+X con dos clips elegidos: el rango de los dos.
  const conClips = editorDeMentira({
    proyecto: 'p3',
    cabezal: seg(9),
    elegidos: [
      { trackId: 't1', elementId: 'x' },
      { trackId: 't2', elementId: 'y' },
    ],
    elementos: {
      x: { type: 'video', startTime: seg(1), duration: seg(2) },
      y: { type: 'text', startTime: seg(4), duration: seg(1) },
    },
  }).editor;
  marcarRangoDelClip(conClips);
  assert.deepEqual(tramoVigente(conClips), { desde: seg(1), hasta: seg(5) });
  // Sin nada elegido: el clip de la principal bajo el cabezal.
  const sinElegir = editorDeMentira({
    proyecto: 'p4',
    cabezal: seg(5),
    principal: [
      { id: 'a', startTime: 0, duration: seg(4) },
      { id: 'b', startTime: seg(4), duration: seg(3) },
    ],
  }).editor;
  marcarRangoDelClip(sinElegir);
  assert.deepEqual(tramoVigente(sinElegir), { desde: seg(4), hasta: seg(7) });
  // Sin clip bajo el cabezal no cambia lo que había.
  const vacio = editorDeMentira({ proyecto: 'p4', cabezal: seg(9), principal: [] }).editor;
  marcarRangoDelClip(vacio);
  assert.deepEqual(tramoVigente(vacio), { desde: seg(4), hasta: seg(7) });
  // La línea se acortó (se borraron clips): el rango se recorta al leerlo.
  const corta = editorDeMentira({ proyecto: 'p4', duracion: seg(5) }).editor;
  assert.deepEqual(tramoVigente(corta), { desde: seg(4), hasta: seg(5) });
});

test('7: Ctrl+R y Shift+B abren la pestaña «Velocidad» del clip elegido, y nada más', () => {
  const limpio = () => usePropertiesStore.setState({ activeTabPerType: {}, subpestanaPorPestana: {} });
  const con = (type: string, elegidos = 1) =>
    editorDeMentira({
      elegidos: Array.from({ length: elegidos }, (_, i) => ({ trackId: 't', elementId: `e${i}` })),
      elementos: Object.fromEntries(
        Array.from({ length: elegidos }, (_, i) => [`e${i}`, { type, startTime: 0, duration: seg(1) }]),
      ),
    }).editor;

  limpio();
  mostrarPanelVelocidad(con('video'));
  assert.equal(usePropertiesStore.getState().activeTabPerType.video, 'velocidad-estandar');
  // Si la última vez se usó la Curva, vuelve a la Curva (como un clic en la pestaña).
  limpio();
  usePropertiesStore.getState().recordarSubpestana({ elementType: 'video', pestana: 'velocidad', subpestana: 'velocidad-curva' });
  mostrarPanelVelocidad(con('video'));
  assert.equal(usePropertiesStore.getState().activeTabPerType.video, 'velocidad-curva');
  // El audio sólo tiene «Estándar».
  limpio();
  mostrarPanelVelocidad(con('audio'));
  assert.equal(usePropertiesStore.getState().activeTabPerType.audio, 'velocidad-estandar');
  // Shift+B: la Curva, y la recuerda.
  limpio();
  mostrarVelocidadCurva(con('video'));
  assert.equal(usePropertiesStore.getState().activeTabPerType.video, 'velocidad-curva');
  assert.equal(usePropertiesStore.getState().subpestanaPorPestana['video:velocidad'], 'velocidad-curva');
  // Sin un clip con velocidad (audio en Shift+B, un texto, dos elegidos, nada), no toca el panel.
  limpio();
  mostrarVelocidadCurva(con('audio'));
  mostrarPanelVelocidad(con('text'));
  mostrarPanelVelocidad(con('video', 2));
  mostrarPanelVelocidad(con('video', 0));
  assert.deepEqual(usePropertiesStore.getState().activeTabPerType, {});
});

test('8: el preset «CapCut» trae las teclas nuevas, sin una tecla para dos acciones', () => {
  const atajos = getDefaultShortcuts();
  const esperado: Record<string, string> = {
    i: 'punto-entrada',
    o: 'punto-salida',
    'shift+x': 'seleccionar-por-clip',
    'alt+x': 'quitar-rango',
    'ctrl+r': 'panel-velocidad',
    'shift+b': 'velocidad-curva',
    'ctrl+j': 'agregar-ritmo',
    // Las vecinas que no se tocaron.
    'ctrl+shift+b': 'dividir-todo',
    b: 'modo-division',
    'ctrl+b': 'split',
    'ctrl+i': 'importar-multimedia',
    escape: 'cancel-interaction',
  };
  for (const [tecla, accion] of Object.entries(esperado)) assert.equal(atajos.get(tecla as never), accion, tecla);
  // Ninguna tecla atada a dos acciones (el Map se quedaría con la última, en silencio).
  const todas = (Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]).flatMap((a) => getActionDefinition({ action: a }).defaultShortcuts ?? []);
  assert.equal(new Set(todas).size, todas.length, 'tecla repetida en el preset');
  assert.equal(atajos.size, todas.length);
  // Los clips se dejan de elegir con Esc: «deselect-all» ya no tiene tecla ni fila en el panel.
  assert.equal(getActionDefinition({ action: 'deselect-all' }).defaultShortcuts, undefined);
  assert.equal(ACTIONS['deselect-all'].category, 'interno');
  assert.equal(ACTIONS['quitar-rango'].description, 'Anular selección');
  assert.equal(ACTIONS['punto-entrada'].description, 'Punto de entrada');
});

test('9: la migración de atajos de quien los personalizó', () => {
  assert.equal(CURRENT_VERSION, 8);
  const migrado = runMigrations({
    fromVersion: 7,
    state: {
      isCustomized: true,
      keybindings: { 'alt+x': 'deselect-all', i: 'toggle-bookmark', 'ctrl+b': 'split' },
    },
  }) as { isCustomized: boolean; keybindings: Record<string, string> };
  assert.equal(migrado.isCustomized, true);
  assert.equal(migrado.keybindings['alt+x'], 'quitar-rango', 'Alt+X seguía con lo del preset viejo: pasa al rango');
  assert.equal(migrado.keybindings.i, 'toggle-bookmark', 'lo que la persona puso en una tecla se respeta');
  assert.equal(migrado.keybindings.o, 'punto-salida', 'una tecla libre recibe la nueva');
  assert.equal(migrado.keybindings['ctrl+j'], 'agregar-ritmo');
  assert.equal(migrado.keybindings['ctrl+b'], 'split');
  // Alt+X cambiado a mano es de la persona.
  const propio = runMigrations({
    fromVersion: 7,
    state: { isCustomized: true, keybindings: { 'alt+x': 'select-all' } },
  }) as { keybindings: Record<string, string> };
  assert.equal(propio.keybindings['alt+x'], 'select-all');
  // Una forma que no se reconoce vuelve tal cual.
  assert.equal(runMigrations({ fromVersion: 7, state: 'basura' }), 'basura');
});

test('10: el cableado (manejadores, la regla y Exportar)', () => {
  const acciones = sinComentarios(leer('app/video-editor/_opencut/actions/use-editor-actions.ts'));
  for (const id of ['punto-entrada', 'punto-salida', 'seleccionar-por-clip', 'quitar-rango', 'panel-velocidad', 'velocidad-curva', 'agregar-ritmo']) {
    assert.ok(acciones.includes(`useActionHandler("${id}"`) || acciones.includes(`useActionHandler(\n\t\t"${id}"`), `sin manejador: ${id}`);
  }
  // Ctrl+J es el «Agregar ritmo» del menú de ritmos, no una segunda implementación.
  assert.ok(acciones.includes('alternarRitmoEnCabezal('));
  assert.ok(sinComentarios(leer('app/video-editor/_opencut/timeline/components/timeline-ruler.tsx')).includes('<RangoEnRegla zoomLevel={zoomLevel} />'));
  const exportar = sinComentarios(leer('app/video-editor/_opencut/export/exportar.ts'));
  assert.ok(exportar.includes('this.exportador.export({ rootNode: escena, tramo })'), 'el video exporta el tramo');
  assert.ok(exportar.includes('recortarAudio(mezcla, tramo)'), 'el audio se recorta al tramo');
  assert.ok(exportar.includes('subtitulosDelTramo('), 'los subtítulos se recortan al tramo');
  assert.ok(/exportarGif\(\{[\s\S]*?tramo,[\s\S]*?\}\)/.test(exportar), 'el GIF exporta el tramo');
  assert.ok(exportar.includes('tramo: tramoVigente(editor)') || exportar.includes('const tramo = tramoVigente(editor)'));
  const dialogo = sinComentarios(leer('app/video-editor/_opencut/export/dialogo-exportar.tsx'));
  assert.ok(dialogo.includes('tramo: datos.tramo'), 'el diálogo pasa el rango a la exportación');
  assert.ok(dialogo.includes('tramo: _tramo'), 'el rango no se recuerda entre aperturas');
  assert.ok(dialogo.includes('data-exportar-rango'), 'se ve que se exporta el rango');
});

test('11: exportar un rango mezcla sólo lo que suena en él (los clips enteros), y Cancelar corta la mezcla', () => {
  const T = { desde: 10_000, hasta: 20_000 };
  const clip = (ini: number, dur: number) => ({ startTime: ini, duration: dur });
  assert.equal(seCruzaConElTramo(clip(0, 5_000), T), false, 'termina antes');
  assert.equal(seCruzaConElTramo(clip(0, 10_000), T), false, 'termina justo donde empieza el tramo');
  assert.equal(seCruzaConElTramo(clip(0, 10_001), T), true);
  assert.equal(seCruzaConElTramo(clip(12_000, 1_000), T), true, 'adentro');
  assert.equal(seCruzaConElTramo(clip(5_000, 30_000), T), true, 'lo cubre');
  assert.equal(seCruzaConElTramo(clip(20_000, 5_000), T), false, 'empieza justo donde termina');
  assert.equal(seCruzaConElTramo(clip(19_999, 5_000), T), true);
  assert.equal(seCruzaConElTramo(clip(30_000, 5_000), null), true, 'sin tramo, todos');
  // El cableado: la mezcla saltea lo de afuera ANTES de decodificar, mira la cancelación antes de cada clip y se la
  // pasa a la reducción de ruido; Exportar le pasa el tramo y el corte, y un corte no es una falla.
  const audio = sinComentarios(leer('app/video-editor/_opencut/media/audio.ts'));
  const salteo = audio.indexOf('if (!seCruzaConElTramo(element, tramo)) continue;');
  assert.ok(salteo > 0 && salteo < audio.indexOf('resolveAudioBufferForElement({\n\t\t\t\t\telement,'), 'lo de afuera no se decodifica');
  assert.match(audio, /audioContext: context,\s*tramo,\s*\}\);\s*signal\?\.throwIfAborted\(\);/);
  assert.match(audio, /for \(const element of audioElements\) \{\s*signal\?\.throwIfAborted\(\);/);
  assert.match(audio, /procesarClip\(\{ buffer: enSuTiempo, params, signal \}\)/);
  const exportar = sinComentarios(leer('app/video-editor/_opencut/export/exportar.ts'));
  assert.ok(exportar.includes('createTimelineAudioBuffer({ tracks, mediaAssets, duration: duracion, tramo, signal: this.corte.signal })'));
  assert.match(exportar, /cancelar\(\): void \{\s*this\.cancelada = true;\s*this\.corte\.abort\(\);/);
  assert.match(exportar, /\} catch \(error\) \{\s*if \(this\.cancelada\) return \{ estado: "cancelado" \};/);
});

// ── Roturas (10/11/2026; base en verde: 10 pasan, 0 fallan). Las corrió un script que rompe, corre este
// archivo y devuelve el original desde memoria ──
//   R1  marcarEntrada sin soltar la salida que cruza                         -> 9 / 1 (el 1)
//   R2  tramoEfectivo sin recortar a la duración                              -> 8 / 2 (el 2 y el 6)
//   R3  tramoEfectivo sin mirar si hay marcas                                 -> 8 / 2 (el 2 y el 6)
//   R4  clipEnElTiempo: el que empieza en el cabezal no cuenta                -> 9 / 1 (el 3)
//   R5  cuadrosDelTramo arranca siempre en 0                                  -> 9 / 1 (el 4)
//   R6  muestrasDelTramo sin recortar al largo de la mezcla                   -> 9 / 1 (el 4)
//   R7  subtitulosDelTramo sin correr a 0                                     -> 9 / 1 (el 4)
//   R8  tiempoDeRango sin la décima                                           -> 9 / 1 (el 5)
//   R9  Shift+X ignora la selección                                           -> 9 / 1 (el 6)
//   R10 quitar el rango deja la fila en el store                              -> 9 / 1 (el 6)
//   R11 Shift+B también abre la Curva en un audio                             -> 9 / 1 (el 7)
//   R12 Ctrl+R sin la sub-pestaña recordada                                   -> 9 / 1 (el 7)
//   R13 Alt+X queda también en «deselect-all» (tecla repetida)                -> 9 / 1 (el 8)
//   R14 la migración pisa la tecla que la persona usó                         -> 9 / 1 (el 9)
//   R15 el video se exporta sin el tramo                                      -> 9 / 1 (el 10)
//   R16 (sin efecto) renombrar la variable local de tramoEfectivo             -> 10 / 0
//   (10/11/2026, la revisión: base 11/0, una rotura por vez, restaurada de memoria)
//   R17 seCruzaConElTramo con <= (cuenta el que termina justo en el borde)    -> 10 / 1 (el 11)
//   R18 la mezcla sin saltear lo de afuera                                    -> 10 / 1 (el 11)
//   R19 la mezcla no mira la cancelación antes de cada clip                    -> 10 / 1 (el 11)
//   R20 la reducción de ruido del export sin el corte                          -> 10 / 1 (el 11)
//   R21 Exportar no le pasa el tramo a la mezcla                               -> 10 / 1 (el 11)
//   R22 un corte de Cancelar se cuenta como falla                              -> 10 / 1 (el 11)
