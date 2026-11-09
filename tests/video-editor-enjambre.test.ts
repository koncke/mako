// La «Edición automática» del Video Editor: el enjambre de agentes del reel que mandó Martín (9/11/2026, «PARA LA
// EDICIÓN EN MAKO, ESTO QUIERO»). Lo que se prueba EJECUTANDO: el plan (qué hace cada agente según la línea de
// tiempo de ese momento, y que lo que pide sea lo que el chat acepta), la revisión final con sus chequeos medidos,
// el registro (la hora del video y las operaciones por segundo) y la operación del chat y de la API. Lo que se
// prueba leyendo el fuente es el CABLEADO: que el panel y la barra estén registrados, que «Aceptar» corra a los
// agentes y cuente sus pasos para «Restaurar», y que cada agente use la MISMA función que su botón.
//
// Probado rompiéndolo (base en verde primero): ver la tabla del final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENTES, LIMA, OBJETIVO_VOLUMEN, PASOS, conTope, decidirPaso, estadoDeLinea, opsPorAgente, opsPorSegundo, relojLinea,
  revisionFinal, type ElementoParaPlan, type EstadoLinea, type LineaActividad,
} from '../app/video-editor/_opencut/enjambre/plan';
import { puntoDeCursor, ZONA_DE } from '../app/video-editor/_opencut/enjambre/cursores';
import { CANDIDATOS_ESTILO, MAX_RENGLONES, elegirEstilo, evaluarPrueba } from '../app/video-editor/_opencut/enjambre/plan';
import { PLANTILLAS_SUBTITULO, paramsDePlantilla, plantillaDeParams, plantillaPorId } from '../app/video-editor/_opencut/subtitles/estilos';
import { TEXTO } from '../app/video-editor/_opencut/params/extra/texto';
import { sanearEstilo } from '../lib/editor-video/presets-subtitulos';
import { vistaDeLinea, revisarOperaciones } from '../app/video-editor/_opencut/chat/linea';
import { OPERACIONES_CHAT, validarOperacion } from '../lib/editor-video/chat-catalogo';
import { operacionApiPorId, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { DEFS as DEFS_VIDEO } from '../lib/api-mako/areas/video.def';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);

/** Una escena: dos clips en la principal (uno con un hueco antes), un audio aparte y, si se pide, subtítulos. */
function escena({ subtitulos = false, hueco = false }: { subtitulos?: boolean; hueco?: boolean } = {}): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: `${id}.mp4`, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  const subs = subtitulos
    ? [
        { id: 'ps', type: 'text', name: 'Subtítulos', hidden: false, elements: [
          el('s1', 'text', 0, 2, { params: { content: 'las grabaciones de pantalla', subtitulo: true } }),
          el('s2', 'text', 2, 2, { params: { content: 'aparecen solas', subtitulo: true } }),
        ] },
      ]
    : [];
  return {
    overlay: subs,
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 6), el('vid2', 'video', hueco ? 7 : 6, 4)] },
    audio: [{ id: 'pa', type: 'audio', name: 'Audio', muted: false, elements: [el('aud1', 'audio', 0, 10)] }],
  } as unknown as SceneTracks;
}

const estadoDe = (tracks: SceneTracks, conPalabras = false): EstadoLinea =>
  estadoDeLinea(vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [] }).refs.values(), { conPalabras });

// ─── Los agentes y los pasos ────────────────────────────────────────────────

test('1. cada paso tiene su agente, cada agente un paso, y cada color es un hex', () => {
  const ids = AGENTES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'dos agentes con el mismo nombre');
  for (const a of AGENTES) assert.match(a.color, /^#[0-9a-f]{6}$/, a.id);
  assert.deepEqual(PASOS.map((p) => p.agente).sort(), [...ids].sort(), 'un agente sin paso o un paso sin agente');
  // El orden importa: se corta ANTES de transcribir, y el B-roll lee los subtítulos.
  const orden = PASOS.map((p) => p.id);
  assert.ok(orden.indexOf('pausas') < orden.indexOf('subtitulos'));
  assert.ok(orden.indexOf('subtitulos') < orden.indexOf('muletillas'));
  assert.ok(orden.indexOf('subtitulos') < orden.indexOf('broll'));
  assert.equal(orden.at(-1), 'revision', 'la revisión va última');
});

test('2. lo que lee de la línea de tiempo: la voz es la de la PRINCIPAL; los subtítulos, en orden', () => {
  const e = estadoDe(escena({ subtitulos: true }));
  assert.deepEqual(e.conVoz.map((c) => c.titulo), ['vid1.mp4', 'vid2.mp4'], 'el audio de otra pista no es la voz');
  assert.deepEqual(e.subtitulos.map((s) => s.texto), ['las grabaciones de pantalla', 'aparecen solas']);
  assert.equal(e.duracion, 10);
  // Un clip sin sonido no es voz, ni uno bloqueado.
  const mudo: ElementoParaPlan = { ref: 'v9', tipo: 'video', titulo: 'mudo', inicio: 0, fin: 1, bloqueada: false, principal: true, estado: { sinAudio: true } };
  const fijo: ElementoParaPlan = { ref: 'v8', tipo: 'video', titulo: 'fijo', inicio: 0, fin: 1, bloqueada: true, principal: true, estado: {} };
  assert.equal(estadoDeLinea([mudo, fijo], { conPalabras: false }).conVoz.length, 0);
});

test('3. cada agente decide con la línea de tiempo de SU momento, y lo que pide lo acepta el chat', () => {
  const sin = estadoDe(escena());
  const con = estadoDe(escena({ subtitulos: true }), true);
  for (const e of [sin, con]) {
    for (const p of PASOS) {
      const d = decidirPaso(p.id, e);
      if (d.hace && 'operaciones' in d) {
        for (const op of d.operaciones) assert.equal(validarOperacion(op).ok, true, `${p.id}: el chat no acepta ${JSON.stringify(op)}`);
      }
    }
  }
  // Sin subtítulos: subtitula; con: se saltea y dice cuántos tiene.
  assert.deepEqual(decidirPaso('subtitulos', sin), { hace: true, operaciones: [{ op: 'generar_subtitulos' }] });
  assert.deepEqual(decidirPaso('subtitulos', con), { hace: false, porque: 'ya tiene 2 subtítulos' });
  // Las muletillas piden los tiempos de cada palabra.
  assert.equal(decidirPaso('muletillas', estadoDe(escena({ subtitulos: true }), false)).hace, false);
  assert.deepEqual(decidirPaso('muletillas', con), { hace: true, operaciones: [{ op: 'eliminar_muletillas' }] });
  // Las palabras clave, en el lima del reel («appear»); y no pisa las que ya puso alguien.
  assert.equal(LIMA, '#c8f53c', 'el lima del reel');
  assert.deepEqual(decidirPaso('claves', con), { hace: true, operaciones: [{ op: 'palabras_clave', modo: 'auto', color: LIMA }] });
  const conClaves = { ...con, subtitulos: con.subtitulos.map((s, i) => (i === 0 ? { ...s, claves: ['pantalla'] } : s)) };
  assert.equal(decidirPaso('claves', conClaves).hace, false);
  // El sonido: sólo los clips que faltan, y a −14 LUFS («youtube»).
  const vol = decidirPaso('volumen', { ...con, conVoz: con.conVoz.map((c, i) => (i === 0 ? { ...c, normalizado: OBJETIVO_VOLUMEN } : c)) });
  assert.ok(vol.hace && 'operaciones' in vol);
  assert.deepEqual(vol.hace && 'operaciones' in vol ? vol.operaciones : null, [{ op: 'normalizar', ref: 'v2', activo: true, objetivo: 'youtube' }]);
  const ruido = decidirPaso('ruido', { ...con, conVoz: con.conVoz.map((c) => ({ ...c, ruido: true })) });
  assert.equal(ruido.hace, false, 'con la voz ya limpia no hay nada que hacer');
  // Sin voz en la principal, todo lo de la voz se saltea (y lo dice).
  const mudo = { ...sin, conVoz: [] };
  for (const id of ['pausas', 'subtitulos', 'broll', 'planos', 'ruido', 'volumen'] as const) {
    const d = decidirPaso(id, mudo);
    assert.equal(d.hace, false, id);
    assert.ok(!d.hace && d.porque.length > 5, `${id} se saltea sin decir por qué`);
  }
  assert.equal(decidirPaso('revision', mudo).hace, true, 'la revisión corre siempre');
});

// ─── La revisión final ──────────────────────────────────────────────────────

test('4. la revisión mide: huecos negros, subtítulos que se pisan y el volumen', () => {
  const bien = { ...estadoDe(escena({ subtitulos: true }), true) };
  bien.conVoz = bien.conVoz.map((c) => ({ ...c, normalizado: OBJETIVO_VOLUMEN }));
  const r = revisionFinal(bien);
  assert.ok(r.every((c) => c.ok), JSON.stringify(r));
  assert.ok(r.some((c) => c.texto === '2 subtítulos, ninguno se pisa'));
  assert.ok(r.some((c) => c.texto === 'volumen a −14 LUFS'));

  const conHueco = estadoDe(escena({ subtitulos: true, hueco: true }), true);
  const malos = revisionFinal(conHueco).filter((c) => !c.ok);
  assert.deepEqual(malos.map((c) => [c.texto, c.en]), [['hueco negro de 1 s', 6], ['2 clips sin normalizar a −14 LUFS', 0]]);

  const pisados = { ...bien, subtitulos: [{ ref: 't1', texto: 'a', inicio: 0, fin: 3, claves: [] }, { ref: 't2', texto: 'b', inicio: 2, fin: 4, claves: [] }] };
  assert.ok(revisionFinal(pisados).some((c) => !c.ok && c.texto === 'dos subtítulos se pisan' && c.en === 2));
  // Sin voz no se afirma nada de los subtítulos ni del volumen: no se midió.
  const sinVoz = revisionFinal({ ...bien, conVoz: [] });
  assert.ok(!sinVoz.some((c) => /subtítulo|LUFS/.test(c.texto)), JSON.stringify(sinVoz));
});

// ─── El registro ────────────────────────────────────────────────────────────

test('5. el registro: la hora del video como el reel, y las operaciones por segundo son las de verdad', () => {
  assert.equal(relojLinea(138.7), '02:18');
  assert.equal(relojLinea(0), '00:00');
  assert.equal(relojLinea(null), '--:--');
  const l = (id: number, tipo: LineaActividad['tipo'], ms: number, agente: LineaActividad['agente'] = 'corte-01'): LineaActividad =>
    ({ id, agente, en: null, texto: 'x', tipo, ms });
  const lineas = [l(1, 'empieza', 9_000), l(2, 'mira', 9_500), l(3, 'hace', 9_600), l(4, 'hace', 9_900), l(5, 'listo', 9_950, 'subs-01'), l(6, 'hace', 8_000), l(7, 'salta', 9_990)];
  assert.equal(opsPorSegundo(lineas, 10_000), 3, 'cuenta lo hecho en el último segundo, ni lo que mira ni lo que saltea');
  assert.equal(opsPorSegundo(lineas, 20_000), 0);
  assert.deepEqual([...opsPorAgente(lineas)], [['corte-01', 3], ['subs-01', 1]]);
  assert.deepEqual(conTope([1, 2, 3, 4, 5], 3), { primeros: [1, 2, 3], resto: 2 });
});

// ─── El chat y la API ───────────────────────────────────────────────────────

test('6. «edicion_automatica» en el chat va SOLA y en la API es editar_video_automatico, que propone', () => {
  assert.deepEqual(validarOperacion({ op: 'edicion_automatica' }), { ok: true, op: { op: 'edicion_automatica' } });
  assert.equal(validarOperacion({ op: 'edicion_automatica', pasos: ['pausas'] }).ok, false, 'no lleva nada más');
  const orden = OPERACIONES_CHAT.map((o) => o.op);
  assert.ok(orden.indexOf('edicion_automatica') > orden.indexOf('clips_magicos'), 'una operación nueva va al final');
  const vista = vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [] });
  const transcripcion = { parrafos: [], idioma: 'es' };
  const sola = revisarOperaciones({ operaciones: [{ op: 'edicion_automatica' }], vista, alcance: 'video', transcripcion });
  assert.deepEqual(sola.resueltas, [{ op: 'edicion_automatica' }]);
  assert.equal(sola.cambios[0]?.titulo, 'Edición automática');
  // Con una operación que SÍ se resolvería sola (un volumen): sin la regla, iría junto con los agentes.
  assert.equal(revisarOperaciones({ operaciones: [{ op: 'volumen', ref: 'v1', db: -3 }], vista, alcance: 'video', transcripcion }).resueltas.length, 1);
  const juntas = revisarOperaciones({ operaciones: [{ op: 'volumen', ref: 'v1', db: -3 }, { op: 'edicion_automatica' }], vista, alcance: 'video', transcripcion });
  assert.deepEqual(juntas.resueltas.map((r) => r.op), ['edicion_automatica'], 'otra operación en el mismo pedido no va');
  assert.ok(juntas.descartes.some((d) => /va sola/.test(d)));
  const vacia = { overlay: [], main: { id: 'pm', type: 'video', name: 'P', elements: [] }, audio: [] } as unknown as SceneTracks;
  const nada = revisarOperaciones({ operaciones: [{ op: 'edicion_automatica' }], vista: vistaDeLinea({ tracks: vacia, tps: TPS, cabezal: 0, elegidos: [] }), alcance: 'video', transcripcion });
  assert.equal(nada.resueltas.length, 0, 'con la línea de tiempo vacía no hay nada que editar');

  const api = operacionApiPorId('editar_video_automatico');
  assert.equal(api?.op, 'edicion_automatica');
  assert.deepEqual(operacionDesdeInput(api!, {}), { ok: true, op: { op: 'edicion_automatica' } });
  const def = DEFS_VIDEO.find((d) => d.id === 'editar_video_automatico');
  assert.equal(def && 'confirmacion' in def ? def.confirmacion : null, 'pantalla', 'propone; se acepta en el editor');
  assert.match(sinComentarios(leer('lib/api-mako/areas/video.run.ts')), /editar_video_automatico: \{ \.\.\.enElEditor\('editar_video_automatico'\) \},/);
});

// ─── El cableado ────────────────────────────────────────────────────────────

test('7. el panel, la barra y la pastilla «en vivo» están registrados', () => {
  assert.match(leer('app/video-editor/ce/extensiones.ts'), /^import '\.\.\/_opencut\/enjambre\/registro';$/m, 'un registro que nadie importa no existe');
  const registro = sinComentarios(leer('app/video-editor/_opencut/enjambre/registro.ts'));
  assert.match(registro, /seccionesBiblioteca\.registrar\(\{[\s\S]*?id: SECCION_ENJAMBRE,[\s\S]*?Contenido: EnjambreView,/);
  assert.match(registro, /herramientasLinea\.registrar\(\{[\s\S]*?id: "linea-edicion-automatica",[\s\S]*?correrEnjambre\(editor\)/);
  const cabecera = sinComentarios(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.match(cabecera, /<EnVivo \/>\s*<MenuDiseno \/>/, 'la pastilla de los agentes en vivo, en la barra de arriba');
});

test('8. cada agente usa la MISMA función que su botón; «Aceptar» corre a los agentes y cuenta sus pasos', () => {
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /await aceptarPropuesta\(editor, propuesta, \{ alProgreso \}\)/, 'lo del chat, con el «Aceptar» del chat');
  assert.match(correr, /await proponerBroll\(editor, esBroll \? \{ broll: true, planos: false/, 'el B-roll, con la función de su sección');
  assert.match(correr, /const profundidadInicial = editor\.command\.profundidad\(\);/, 'cuenta los pasos que deja para «Deshacer todo»');
  assert.match(correr, /if \(useEnjambre\.getState\(\)\.detener\) break;/, '«Detener» corta entre paso y paso');
  // «Deshacer todo» sólo si nadie tocó después, y vuelve exactamente a lo de antes.
  assert.match(correr, /escena\.tracks !== d\.despues\) return false;/);
  assert.match(correr, /getActiveSceneOrNull\(\)\?\.tracks !== d\.antes\) \{\s*for \(let i = 0; i < d\.pasos; i\+\+\) editor\.command\.redo\(\);/);
  const aplicar = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(aplicar, /if \(r\.op === "edicion_automatica"\) \{[\s\S]*?await correrEnjambre\(editor\);[\s\S]*?pasos \+= hecho\.pasos;/, '«Restaurar» del chat deshace todos los pasos de los agentes');
  assert.match(sinComentarios(leer('app/video-editor/_opencut/core/managers/commands.ts')), /profundidad\(\): number \{\s*return this\.history\.length;/);
});

// ─── Los cursores (tanda 2) ─────────────────────────────────────────────────

test('9. el cursor de un agente va a la hora del video donde actuó, o a su panel; nunca afuera', () => {
  const linea = { caja: { left: 100, top: 500, width: 800, height: 200 }, scrollLeft: 50, pps: 40 };
  const zonas = { reproductor: { left: 400, top: 50, width: 300, height: 400 }, propiedades: { left: 750, top: 50, width: 250, height: 400 }, biblioteca: { left: 0, top: 50, width: 350, height: 400 }, linea: linea.caja };
  // 02:03 → 3 s: 100 + 3 × 40 − 50 = 170.
  const p = puntoDeCursor({ agente: 'corte-01', en: 3, zonas, linea });
  assert.equal(p?.x, 170);
  assert.ok(p && p.y > 500 && p.y < 700, 'a la altura de la línea de tiempo');
  // Fuera de lo visible: al borde, no afuera de la ventana.
  assert.equal(puntoDeCursor({ agente: 'corte-01', en: 500, zonas, linea })?.x, 100 + 800 - 12);
  assert.equal(puntoDeCursor({ agente: 'corte-01', en: 0, zonas, linea })?.x, 104);
  // Sin hora: a su panel. El sonido a las propiedades, el B-roll a la biblioteca, los subtítulos al reproductor.
  const dentro = (pt: { x: number; y: number } | null, c: { left: number; top: number; width: number; height: number }) =>
    !!pt && pt.x >= c.left && pt.x <= c.left + c.width && pt.y >= c.top && pt.y <= c.top + c.height;
  assert.ok(dentro(puntoDeCursor({ agente: 'mezcla-02', en: null, zonas, linea }), zonas.propiedades));
  assert.ok(dentro(puntoDeCursor({ agente: 'broll-01', en: null, zonas, linea }), zonas.biblioteca));
  assert.ok(dentro(puntoDeCursor({ agente: 'subs-01', en: null, zonas, linea }), zonas.reproductor));
  // Dos agentes del mismo panel no quedan uno encima del otro.
  const a = puntoDeCursor({ agente: 'subs-01', en: null, zonas, linea });
  const b = puntoDeCursor({ agente: 'subs-02', en: null, zonas, linea });
  assert.notDeepEqual(a, b);
  // Sin nada medido no se inventa un lugar.
  assert.equal(puntoDeCursor({ agente: 'subs-01', en: null, zonas: {}, linea: null }), null);
  for (const ag of AGENTES) assert.ok(ZONA_DE[ag.id], `${ag.id} sin panel`);
});

test('10. los cursores leen lo que marcan el editor y la línea de tiempo, y van montados', () => {
  const pagina = sinComentarios(leer('app/video-editor/_opencut/editor-page.tsx'));
  for (const z of ['biblioteca', 'reproductor', 'propiedades', 'linea']) assert.match(pagina, new RegExp(`<Marco zona="${z}">`), z);
  assert.match(pagina, /<CursoresAgentes \/>/);
  const linea = leer('app/video-editor/_opencut/timeline/components/index.tsx');
  assert.match(linea, /data-ce-linea=""\s*data-ce-pps=\{BASE_TIMELINE_PIXELS_PER_SECOND \* zoomLevel\}/, 'sin la escala, el cursor no sabe dónde cae cada segundo');
  const cursores = sinComentarios(leer('app/video-editor/_opencut/enjambre/components/cursores.tsx'));
  assert.match(cursores, /pointer-events-none fixed inset-0/, 'los cursores no le quitan el mouse a la persona');
  assert.match(cursores, /if \(fase !== "corriendo" \|\| !medida/, 'sólo mientras trabajan');
});

// ─── La prueba de estilos (tanda 3) ─────────────────────────────────────────

test('11. subs-03 prueba los estilos del reel sólo si el estilo es suyo, y elige por renglones MEDIDOS', () => {
  const con = estadoDe(escena({ subtitulos: true }), true);
  assert.equal(decidirPaso('estilo', con).hace, false, 'subtítulos que ya estaban: su estilo es de la persona');
  assert.match(!decidirPaso('estilo', con).hace ? (decidirPaso('estilo', con) as { porque: string }).porque : '', /el tuyo no se cambia/);
  assert.deepEqual(decidirPaso('estilo', { ...con, estiloLibre: true }), { hace: true, directo: true });
  assert.equal(decidirPaso('estilo', { ...con, subtitulos: [], estiloLibre: true }).hace, false);
  // El orden de los pasos: el estilo después de subtitular y antes de las palabras clave (que pintan en lima encima).
  const orden = PASOS.map((p) => p.id);
  assert.ok(orden.indexOf('subtitulos') < orden.indexOf('estilo') && orden.indexOf('estilo') < orden.indexOf('claves'));
  // La medida: más de dos renglones no entra.
  assert.equal(MAX_RENGLONES, 2);
  assert.deepEqual(evaluarPrueba([1, 2, 2]), { ok: true, porque: 'todos entran en 2 renglones o menos' });
  assert.deepEqual(evaluarPrueba([1, 3, 4]), { ok: false, porque: '2 subtítulos quedan en más de 2 renglones' });
  assert.equal(evaluarPrueba([]).ok, false, 'sin nada medido no se afirma que entra');
  // Gana el primero que entra, en el orden del reel; si ninguno entra, ninguno (no se cambia nada).
  assert.deepEqual(elegirEstilo([{ id: 'lima', nombre: 'Lima', renglones: [3] }, { id: 'recuadro-bebas', nombre: 'R', renglones: [2] }, { id: 'marcador', nombre: 'M', renglones: [1] }]), { elegido: 'recuadro-bebas' });
  assert.deepEqual(elegirEstilo([{ id: 'lima', nombre: 'Lima', renglones: [3] }]), { elegido: null });
  assert.equal(CANDIDATOS_ESTILO[0], 'lima', 'la que gana en el reel va primero');
});

test('12. las plantillas del reel existen, «Lima» va en minúsculas, y un preset no lo pierde', () => {
  for (const id of CANDIDATOS_ESTILO) assert.equal(plantillaPorId(id).id, id, `«${id}» no está en PLANTILLAS_SUBTITULO`);
  const lienzo = { width: 1080, height: 1920 };
  const lima = paramsDePlantilla(plantillaPorId('lima'), lienzo);
  assert.equal(lima[TEXTO.mayusculas], 'minusculas');
  assert.equal(lima['background.enabled'], false, 'sin caja, como en el reel');
  assert.equal(paramsDePlantilla(plantillaPorId('recuadro-bebas'), lienzo)[TEXTO.mayusculas], 'mayusculas');
  // Ida y vuelta: el estilo de un subtítulo «Lima» guardado como preset vuelve en minúsculas.
  const vuelta = plantillaDeParams(lima, lienzo);
  assert.equal(vuelta.minusculas, true);
  const saneado = sanearEstilo(vuelta);
  assert.ok(saneado.ok && saneado.valor.minusculas === true, 'el saneador del preset tiraba «minúsculas» en silencio');
  // Los ids no se repiten (la galería y las preferencias los usan de clave).
  const ids = PLANTILLAS_SUBTITULO.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('13. subs-03 aplica cada prueba DE VERDAD, la mide y la vuelve atrás; el elegido queda para los próximos', () => {
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /await aplicarEstiloASubtitulos\(\{ editor, estilo: paramsDePlantilla\(plantilla, lienzo\) \}\);\s*const prueba = /);
  assert.match(correr, /const renglones = subtitulosDe\(prueba\)\.map\(\(\{ element \}\) => String\(element\.params\.content \?\? ""\)\.split\("\\n"\)\.length\);/, 'los renglones salen de lo que dejó el estilo aplicado');
  assert.match(correr, /editor\.command\.profundidad\(\) === profundidad \+ 1 && editor\.scenes\.getActiveSceneOrNull\(\)\?\.tracks === prueba\) editor\.command\.undo\(\);/, 'la prueba no queda en el historial, y no se deshace lo de otro');
  assert.match(correr, /usePreferenciasSubtitulos\.getState\(\)\.fijar\(\{ plantilla: elegido \}\);/);
  assert.match(correr, /const estiloLibre = subtitulosNuevos && usePreferenciasSubtitulos\.getState\(\)\.plantilla === PLANTILLA_POR_DEFECTO\.id;/, 'el estilo de la persona no se toca');
});

// Probado rompiéndolo (base en verde), un cambio por vez y restaurado desde memoria, con su resultado:
//   Tanda 1 (base 8 de 8):
//   · PASOS con «subtitulos» antes de «pausas»                        → rojo el 1
//   · estadoDeLinea sin el filtro `e.principal` en la voz              → rojos el 2, el 3 y el 4 (el audio aparte pasaba por voz)
//   · LIMA con otro valor (#c8f53d)                                    → rojo el 3 (antes de fijar el valor del reel: verde)
//   · opsPorSegundo contando también «mira»                            → rojo el 5
//   · revisionFinal con un hueco mínimo de 5 s                         → rojo el 4
//   · linea.ts sin el `return` de la edición sola                      → rojo el 6 (con las muletillas de antes: verde, porque se
//     descartaban por otra razón; ahora el test usa un volumen, que sí se resuelve)
//   · aplicar.ts con `pasos++` en lugar de `pasos += hecho.pasos`      → rojo el 8
//   · extensiones.ts sin el import del registro                         → rojo el 7
//   · correr.ts sin «Detener» entre pasos                               → rojo el 8
//   · decidirPaso «claves» pisando las palabras clave que ya están     → rojo el 3
//   Tanda 2 (base 10 de 10):
//   · el cursor sin restar el scroll de la línea de tiempo             → rojo el 9
//   · el cursor sin acotarse a lo visible                              → rojo el 9
//   · «mezcla-02» en el reproductor y no en las propiedades            → rojo el 9
//   · todos los cursores de un panel en la misma x                     → sigue verde: la altura ya los separa (lo que cuida)
//   · la línea de tiempo sin el zoom en `data-ce-pps`                  → rojo el 10
//   · la página sin <CursoresAgentes />                                → rojo el 10
//   Tanda 3 (base 13 de 13):
//   · subs-03 cambiando el estilo de la persona (sin `estiloLibre`)    → rojo el 11
//   · la medida dejando pasar tres renglones                           → rojo el 11
//   · «entra» sin nada medido                                          → rojo el 11
//   · «Lima» sin minúsculas en los params, o de vuelta                 → rojo el 12 (las dos)
//   · el saneador del preset sin «minúsculas»                          → rojo el 12
//   · deshacer la prueba sin mirar que nadie tocó la línea de tiempo   → rojo el 13
//   · el estilo libre también con una plantilla elegida por la persona → rojo el 13
