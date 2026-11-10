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
import { CANDIDATOS_ESTILO, MAX_RENGLONES, elegirEstilo, esNadaQueHacer, evaluarPrueba } from '../app/video-editor/_opencut/enjambre/plan';
import { comoTerminaFalla, cuentaComoToque, gruposPorFuente, textoPastilla } from '../app/video-editor/_opencut/enjambre/plan';
import { NO_HAY_MULETILLAS, type ParrafoTx } from '../app/video-editor/_opencut/transcripcion/modelo';
import { MedidorIntensidad } from '../app/video-editor/_opencut/audio/dsp/intensidad';
import { dbNormalizacion, INTENSIDAD_MEDIDA, medidaDePedazos, NORMALIZAR, NORMALIZAR_OBJETIVO, TOLERANCIA_PEDAZO_LU } from '../app/video-editor/_opencut/audio/claves';
import { OBJETIVOS_NORMALIZAR } from '../lib/editor-video/chat-catalogo';
import { cajaDePlantilla, textoConCaja } from '../app/video-editor/_opencut/subtitles/estilos';
import { presetDesdeApi } from '../lib/editor-video/presets-subtitulos';
import { MOTIVO_SUBTITULOS } from '../app/video-editor/_opencut/subtitles/resultado';
import { textoSinSilencios } from '../app/video-editor/_opencut/audio/silencios-aviso';
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
  // Un clip que la persona normalizó a otro objetivo (TikTok) queda como lo dejó.
  const tiktok = decidirPaso('volumen', { ...con, conVoz: con.conVoz.map((c) => ({ ...c, normalizado: 'tiktok' })) });
  assert.deepEqual(tiktok, { hace: false, porque: 'ya está normalizado al objetivo que elegiste' });
  // Cortar las pausas debajo de subtítulos que ya estaban los desfasa (sus tiempos por palabra no se mueven).
  assert.deepEqual(decidirPaso('pausas', sin), { hace: true, operaciones: [{ op: 'borrar_silencios' }] });
  const pausasConSubs = decidirPaso('pausas', con);
  assert.equal(pausasConSubs.hace, false);
  assert.match(!pausasConSubs.hace ? pausasConSubs.porque : '', /desfasaría/);
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
  // Lo propuesto sin decidir (B-roll, planos) no es el corte final: la revisión lo marca, con la hora de la primera.
  const conPropuestas = revisionFinal({ ...bien, propuestas: [3, 8] });
  assert.ok(conPropuestas.some((c) => !c.ok && c.texto === '2 propuestas de B-roll o planos sin decidir: déjalas o sácalas' && c.en === 3));
  // Normalizado a otro objetivo que eligió la persona: no es «sin normalizar».
  assert.ok(revisionFinal({ ...bien, conVoz: bien.conVoz.map((c) => ({ ...c, normalizado: 'tiktok' })) }).every((c) => c.ok));
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
  assert.match(correr, /await aceptarPropuesta\(ctx\.editor, propuesta, \{ alProgreso \}\)/, 'lo del chat, con el «Aceptar» del chat');
  assert.match(correr, /await proponerBroll\(editor, \{\s*broll: esBroll,\s*planos: !esBroll,/, 'el B-roll, con la función de su sección');
  assert.match(correr, /const profundidadInicial = editor\.command\.profundidad\(\);/, 'cuenta los pasos que deja para «Deshacer todo»');
  assert.match(correr, /if \(useEnjambre\.getState\(\)\.detener\) break;/, '«Detener» corta entre paso y paso');
  // «Deshacer todo» sólo si nadie tocó después, y vuelve exactamente a lo de antes.
  assert.match(correr, /escena\.tracks !== d\.despues\) return false;/);
  assert.match(correr, /getActiveSceneOrNull\(\)\?\.tracks !== d\.antes\) \{\s*for \(let i = 0; i < d\.pasos; i\+\+\) editor\.command\.redo\(\);/);
  const aplicar = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(aplicar, /if \(r\.op === "edicion_automatica"\) \{[\s\S]*?await correrEnjambre\(editor, \{ desdeElChat: true \}\);[\s\S]*?pasos \+= hecho\.pasos;/, '«Restaurar» del chat deshace todos los pasos de los agentes');
  // Si la persona tocó el editor mientras trabajaban, sus cambios están en esa cuenta: no hay «Deshacer todo», y se dice.
  assert.match(correr, /const puedeDeshacer = !desdeElChat && !tocado && pasosHistorial > 0/);
  assert.match(correr, /if \(cuentaComoToque\(\{[\s\S]*?\}\)\)\s*tocado = true;/, 'el toque de la persona marca la corrida');
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
  assert.match(!decidirPaso('estilo', con).hace ? (decidirPaso('estilo', con) as { porque: string }).porque : '', /no se cambia/);
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

test('13. subs-03 aplica cada prueba DE VERDAD, la mide y la vuelve atrás, sin tocar la plantilla de la persona', () => {
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /await aplicarEstiloASubtitulos\(\{ editor, estilo: paramsDePlantilla\(plantilla, lienzo\) \}\);\s*const prueba = /);
  assert.match(correr, /const renglones = subtitulosDe\(prueba\)\.map\(\(\{ element \}\) => String\(element\.params\.content \?\? ""\)\.split\("\\n"\)\.length\);/, 'los renglones salen de lo que dejó el estilo aplicado');
  assert.match(correr, /editor\.command\.profundidad\(\) === profundidad \+ 1 && editor\.scenes\.getActiveSceneOrNull\(\)\?\.tracks === prueba\) \{\s*editor\.command\.undo\(\);/, 'la prueba no queda en el historial, y no se deshace lo de otro');
  assert.doesNotMatch(correr, /usePreferenciasSubtitulos\.getState\(\)\.fijar/, 'el estilo del agente es de este proyecto, no la plantilla de la persona para todos');
  assert.match(correr, /editor\.command\.undo\(\);\s*editor\.command\.olvidarRehacer\(\);/, 'Ctrl+Y no vuelve a poner un estilo descartado');
  assert.match(correr, /if \(!enSuLugar\(ctx\)\) \{\s*anotar\(agente, "falla", "se cerró el proyecto o cambió la escena: no sigue probando"\);/, 'no prueba estilos en otro proyecto');
  assert.match(correr, /const estiloLibre = subtitulosNuevos && usePreferenciasSubtitulos\.getState\(\)\.plantilla === PLANTILLA_POR_DEFECTO\.id;/, 'el estilo de la persona no se toca');
});

test('14. «no había nada que hacer» no es «no pudo»: una falla real se dice como falla', () => {
  assert.equal(esNadaQueHacer(`No se aplica: no se cortó las muletillas`), true);
  assert.equal(esNadaQueHacer('No se aplica: Ya no hay nada que cambiar'), true);
  assert.equal(esNadaQueHacer(`No se aplica: ${MOTIVO_SUBTITULOS['sin-voz']}`), true);
  assert.equal(esNadaQueHacer(textoSinSilencios({ clips: 1, segundos: 12, minimoS: 0.4, todoElVideo: true })), true);
  // «No se aplica: » lo lleva CUALQUIER motivo de «Aceptar»: no basta para decir que no había nada.
  assert.equal(esNadaQueHacer(`No se aplica: ${MOTIVO_SUBTITULOS.descarga}`), false, 'no bajó el reconocedor de voz: es una falla');
  assert.equal(esNadaQueHacer('No se aplica: no se pudo leer el audio'), false);
  assert.equal(esNadaQueHacer('No se guardó el proyecto'), false);
});

// ─── Los arreglos de la revisión del 9/11/2026 (tanda del 10/11) ─────────────

test('15. un video SIN muletillas no es una falla: el texto REAL de «sacar las muletillas» se lee como «no había nada»', () => {
  const p = (id: string, texto: string, inicio: number, fin: number) => ({ id, elementId: id.split('#')[0], texto, inicio, fin, muletilla: false });
  // Un video grabado con guion: palabras limpias, ninguna marcada ni reconocible como muletilla.
  const parrafos: ParrafoTx[] = [
    { elementId: 's1', trackId: 'ps', inicio: 0, fin: 2, texto: 'las grabaciones de pantalla', bloqueado: false, palabras: [p('s1#0', 'las', 0, 0.3), p('s1#1', 'grabaciones', 0.3, 1), p('s1#2', 'de', 1, 1.2), p('s1#3', 'pantalla', 1.2, 2)] },
    { elementId: 's2', trackId: 'ps', inicio: 2, fin: 4, texto: 'aparecen solas', bloqueado: false, palabras: [p('s2#0', 'aparecen', 2, 3), p('s2#1', 'solas', 3, 4)] },
  ];
  const vista = vistaDeLinea({ tracks: escena({ subtitulos: true }), tps: TPS, cabezal: 0, elegidos: [], conPalabras: true });
  const r = revisarOperaciones({ operaciones: [{ op: 'eliminar_muletillas' }], vista, alcance: 'video', transcripcion: { parrafos, idioma: 'es' } });
  assert.equal(r.resueltas.length, 0, 'no hay nada que cortar');
  assert.equal(r.descartes[0], NO_HAY_MULETILLAS, 'el motivo es el texto compartido');
  // Así lo arma «Aceptar» (chat/aplicar.ts → noSeAplica) y así lo lee el agente de las muletillas.
  assert.equal(esNadaQueHacer(`No se aplica: ${r.descartes[0]}`), true, 'un video con guion terminaba con «1 no pudo» y «Reportar a Soporte»');
});

test('16. «Detener» no es una falla, y una falla de verdad sigue siendo falla', () => {
  assert.equal(comoTerminaFalla({ nada: false, detener: true, cancelado: true }), 'detenido', 'detener los subtítulos contaba como «no pudo»');
  assert.equal(comoTerminaFalla({ nada: false, detener: false, cancelado: false }), 'fallo');
  assert.equal(comoTerminaFalla({ nada: false, detener: true, cancelado: false }), 'fallo', 'una falla real con «Detener» apretado sigue siendo falla');
  assert.equal(comoTerminaFalla({ nada: true, detener: true, cancelado: false }), 'salteado', 'no había nada que hacer, aunque se haya detenido');
  // El loop no suma un «detenido» a las fallas, y el texto de la cancelación es el de los subtítulos.
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /else if \(como === "fallo"\) fallas\+\+;/, 'un «detenido» no se cuenta como falla');
  assert.match(correr, /comoTerminaFalla\(\{ nada: r\.nada, detener: useEnjambre\.getState\(\)\.detener, cancelado: r\.texto === MOTIVO_SUBTITULOS\.cancelado \}\)/);
});

test('17. el B-roll y los planos leen lo que se dice UNA vez, y no transcriben si los subtítulos ya fallaron', () => {
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  // La lectura la hace proponerBroll (con su candado: Whisper no corre dos veces a la vez), y el segundo agente la reusa.
  assert.equal((correr.match(/frasesDelVideo\(/g) ?? []).length, 0, 'leer afuera del candado de proponerBroll pisaba el Whisper del botón');
  assert.match(correr, /\.\.\.\(ctx\.frases\.lista \? \{ frases: ctx\.frases\.lista \} : \{\}\),\s*alLeerFrases: \(f\) => \{\s*ctx\.frases\.lista = f;/);
  assert.match(correr, /if \(!r\.ok && r\.motivo === "red" && !ctx\.frases\.lista\) ctx\.frases\.fallo = true;/, 'un fallo leyendo no se repite en el agente siguiente');
  assert.match(correr, /if \(ctx\.frases\.fallo\) \{/);
  assert.match(correr, /if \(ctx\.subtitulosNoSalieron && !antes\.estado\.subtitulos\.length\) \{/, 'con los subtítulos caídos, no vuelve a transcribir');
  assert.match(correr, /if \(paso\.id === "subtitulos" && como !== "hecho"\) subtitulosNoSalieron = true;/, 'también si no se reconoció la voz');
  // proponerBroll usa lo que le pasan y avisa lo que leyó; y sin Pexels no le paga a la IA.
  const proponer = sinComentarios(leer('app/video-editor/_opencut/broll/proponer.ts'));
  assert.match(proponer, /const frases = opciones\.frases \?\? \(await frasesDelVideo\([^;]*;\s*opciones\.alLeerFrases\?\.\(frases\);/);
  const iPexels = proponer.indexOf('accion: "pexels"');
  const iElegir = proponer.indexOf('accion: "elegir"');
  assert.ok(iPexels > 0 && iElegir > 0, 'están las dos preguntas');
  assert.ok(iPexels < iElegir, 'se pregunta por Pexels ANTES de pedirle a la IA que elija');
  const ruta = sinComentarios(leer('app/api/video-editor/broll/route.ts'));
  assert.match(ruta, /if \(body\.accion === 'pexels'\) \{[\s\S]*?if \(clave\.falta\) return responder\(\{ ok: true, conectado: false \}\);/);
});

test('18. el volumen: los pedazos del MISMO video se miden juntos y les toca la misma ganancia', () => {
  // Después de «Borrar silencios», un video son muchos pedazos: van en UN grupo; uno de otro video, aparte.
  const pedazos = [
    { inicio: 3, fuente: 'video-a', id: 'p2' },
    { inicio: 0, fuente: 'video-a', id: 'p1' },
    { inicio: 5, fuente: 'video-b', id: 'otro' },
    { inicio: 7, fuente: null, id: 'sin-fuente' },
    { inicio: 9, fuente: 'video-a', id: 'p3' },
  ];
  assert.deepEqual(gruposPorFuente(pedazos).map((g) => g.map((c) => c.id)), [['p1', 'p2', 'p3'], ['otro'], ['sin-fuente']]);
  // Por qué importa: medido de a uno, un pedazo con la voz fuerte y uno casi todo respiración salen con ganancias
  // distintas y el volumen salta en cada corte. Medidos juntos, la misma medida → la misma ganancia.
  const sr = 48_000;
  const tono = (amp: number, s: number) => Float32Array.from({ length: Math.round(sr * s) }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr));
  const fuerte = tono(0.5, 2);
  const suave = tono(0.05, 2);
  const medir = (...trozos: Float32Array[]) => {
    const m = new MedidorIntensidad(sr);
    for (const t of trozos) m.agregar([t]);
    return m.resultado();
  };
  const objetivo = OBJETIVOS_NORMALIZAR.youtube;
  const db = (lufs: number) => dbNormalizacion({ [NORMALIZAR]: true, [INTENSIDAD_MEDIDA]: lufs, [NORMALIZAR_OBJETIVO]: objetivo });
  const separadas = [db(medir(fuerte)), db(medir(suave))];
  assert.ok(Math.abs(separadas[0] - separadas[1]) > 15, 'medidos de a uno, cada pedazo sube distinto (así saltaba el volumen)');
  // Dos pedazos de la misma toma (uno 3 dB más flojo): van con la medida del conjunto, la misma ganancia.
  const parejo = tono(0.35, 2);
  const conjunta = medir(fuerte, parejo);
  const [a, b] = medidaDePedazos([medir(fuerte), medir(parejo)], conjunta);
  assert.equal(a, conjunta);
  assert.equal(b, conjunta, 'el pedazo apenas más flojo lleva la misma ganancia: no salta en el corte');
  // Otra toma, 20 dB abajo (lejos del micrófono): con la ganancia del conjunto quedaría casi muda. Va con la suya.
  const conSuave = medir(fuerte, suave);
  const [c, d] = medidaDePedazos([medir(fuerte), medir(suave)], conSuave);
  assert.equal(c, conSuave);
  assert.equal(d, medir(suave), 'la toma floja queda con su propia medida');
  assert.ok(Math.abs(medir(suave) - conSuave) > TOLERANCIA_PEDAZO_LU);
  // Sin medida del conjunto, cada uno la suya; un pedazo mudo, la del conjunto.
  assert.deepEqual(medidaDePedazos([-20, null], null), [-20, null]);
  assert.deepEqual(medidaDePedazos([null], -18), [-18]);
  // El agente usa la medida conjunta por video, no la operación de a un clip.
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /const grupos = gruposPorFuente\(clips\);/);
  assert.match(correr, /quedaron \+= await normalizarJuntos\(\{/);
  const normalizar = sinComentarios(leer('app/video-editor/_opencut/audio/normalizar.ts'));
  assert.match(normalizar, /const medidas = medidaDePedazos\(propias, conjunta\);/, 'la medida de cada pedazo sale de la regla');
});

test('19. «Lima» se ve en minúsculas en su tarjeta y la API la puede guardar; la pastilla dice qué agente va', () => {
  const lima = plantillaPorId('lima');
  assert.equal(cajaDePlantilla(lima), 'lowercase', 'la tarjeta mostraba «Lima» con la caja de lo escrito');
  assert.equal(textoConCaja('Así Se Ve', lima), 'así se ve');
  assert.equal(cajaDePlantilla(plantillaPorId('recuadro-bebas')), 'uppercase');
  assert.equal(textoConCaja('así', { mayusculas: false }), 'así');
  // La API: minúsculas sí, y saca las mayúsculas (y al revés).
  const conMinus = presetDesdeApi({ nombre: 'Reel', minusculas: true }, null) as { estilo: Record<string, unknown> };
  assert.equal(conMinus.estilo.minusculas, true, 'presetDesdeApi no dejaba poner «minúsculas»');
  const saneado = sanearEstilo(conMinus.estilo);
  assert.ok(saneado.ok && saneado.valor.minusculas === true);
  const vuelta = presetDesdeApi({ mayusculas: true }, { id: 'x', actualizado: '', nombre: 'Reel', marca: null, estilo: { fuente: 'Inter', negrita: true, color: '#ffffff', minusculas: true }, claves: { auto: false, color: '#c8f53c', siempre: [] } }) as { estilo: Record<string, unknown> };
  assert.equal(vuelta.estilo.mayusculas, true);
  assert.equal(vuelta.estilo.minusculas, undefined, 'las dos no van juntas');
  const def = DEFS_VIDEO.find((d) => d.id === 'guardar_preset_subtitulos');
  assert.ok(def?.parametros.some((p) => p.nombre === 'minusculas'), 'la API ofrece «minúsculas»');
  // La pastilla: trabajan de a uno.
  assert.equal(textoPastilla('subtitulos'), `en vivo · Subtítulos · paso 2 de ${PASOS.length}`);
  assert.equal(textoPastilla(null), 'en vivo');
  assert.doesNotMatch(leer('app/video-editor/_opencut/enjambre/components/en-vivo.tsx'), /agentes"\)\} en vivo/, 'decía «10 agentes en vivo»');
});

test('20. tocar el editor: reproducir no saca «Deshacer todo»; lo que cambia la línea, aunque sea un botón, sí cuenta', () => {
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: null, tecla: ' ' }), false, 'la barra espaciadora reproduce');
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: 'reproductor', soloMira: true }), false, 'el botón de reproducir sacaba «Deshacer todo»');
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: 'reproductor' }), true, 'las manijas de escalar y el menú «Relación» son botones que SÍ cambian');
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: null, tecla: 'Delete' }), true, 'Supr con el foco en la página no contaba');
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: 'biblioteca', tecla: 'Delete' }), true, 'Supr con el foco en un renglón del registro también borra el clip elegido');
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: 'linea', tecla: 'z' }), true);
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: 'linea' }), true);
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: 'biblioteca' }), false, 'el panel de la edición está en la biblioteca');
  assert.equal(cuentaComoToque({ tipo: 'soltar', zona: 'linea' }), true, 'arrastrar un medio de la biblioteca a la línea');
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: null }), true, '«Aceptar» del chat o un menú en un portal');
  assert.equal(cuentaComoToque({ tipo: 'puntero', zona: null, enEditable: true }), false, 'tocar la caja del chat para escribir');
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: 'biblioteca', tecla: 'a', enEditable: true }), false, 'escribir en un buscador no cambia la línea');
  assert.equal(cuentaComoToque({ tipo: 'tecla', zona: 'propiedades', tecla: '5', enEditable: true }), true, 'un campo de las propiedades sí');
  const correr = sinComentarios(leer('app/video-editor/_opencut/enjambre/correr.ts'));
  assert.match(correr, /document\.addEventListener\("drop", mirar, true\);/);
  assert.match(correr, /soloMira: !!el\?\.closest\("\[data-ce-solo-mira\]"\)/);
  assert.match(leer('app/video-editor/_opencut/preview/components/toolbar.tsx'), /aria-label=\{isPlaying \? "Pausar" : "Reproducir"\}\s*\/\/[^\n]*\n\s*data-ce-solo-mira=""/, 'el botón de reproducir lleva la marca');
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
//   Revisión adversarial (base 14 de 14):
//   · «pausas» cortando debajo de subtítulos que ya estaban             → rojo el 3
//   · «volumen» renormalizando a −14 un clip que la persona puso en TikTok → rojo el 3
//   · la revisión sin marcar lo propuesto que nadie decidió             → rojo el 4
//   · esNadaQueHacer tomando cualquier «No se aplica: » como «no había nada» → rojo el 14
//   · «Deshacer todo» también cuando la corrió el chat                  → rojo el 8
//   · tocar el editor en medio sin marcar la corrida como tocada         → rojo el 8
//   · el chat corriendo la edición sin decir que viene del chat          → rojo el 8
//   · la prueba de estilos sin vaciar «Rehacer»                          → rojo el 13
//   Tanda del 10/11/2026 (los arreglos de la revisión, base 20 de 20):
//   · esNadaQueHacer sin «no se identificaron muletillas»              → rojo el 15
//   · linea.ts con otro texto para «no hay muletillas»                 → rojo el 15
//   · «Detener» contado como falla                                     → rojo el 16
//   · proponerBroll preguntando por Pexels después de pagar la IA      → rojo el 17
//   · el volumen sin juntar los pedazos del mismo video                → rojo el 18
//   · la tarjeta de «Lima» sin minúsculas                              → rojo el 19
//   · presetDesdeApi sin «minúsculas»                                  → rojo el 19
//   · la pastilla «10 agentes en vivo»                                 → rojo el 19
//   · «Reproducir» contado como un toque que cambia la línea           → rojo el 20
//   · un atajo con el foco fuera de los paneles sin contar             → rojo el 20
//   Revisión adversarial de la tanda del 10/11 (base 20 de 20):
//   · «Detener» con cualquier falla, no sólo la cancelación              → rojo el 16
//   · los botones del reproductor (manijas, «Relación») sin contar       → rojo el 20
//   · una tecla con el foco en la biblioteca sin contar                  → rojo el 20
//   · sin mirar el `drop` (arrastrar un medio a la línea)                 → rojo el 20
//   · la toma floja con la medida del conjunto (queda casi muda)          → rojo el 18
//   · cada pedazo con la suya (el volumen vuelve a saltar en los cortes)  → rojo el 18
//   · sin recordar que leer lo que se dice falló                         → rojo el 17
//   · «no se reconoció la voz» sin contar como subtítulos que no salieron → rojo el 17
