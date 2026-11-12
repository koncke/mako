// =============================================================================
// Ticket 73: el chat del Video Editor pone videos de Multimedia en la línea de tiempo
// =============================================================================
// Martín, 10/11/2026, en el chat del Video Editor: «Poné los dos videos en la línea de tiempo, primero prueba-con-pausa y
// después clip-4». MaKo: «Eso todavía no existe en MaKo». El catálogo lo listaba en «NO SE PUEDE» («agregar a la línea
// de tiempo videos, imágenes…»): sólo se podía SUSTITUIR el archivo de un clip que ya estaba (reemplazar_clip).
//
// Ahora `agregar_medios` pone uno o varios videos o fotos de "medios" al FINAL de la pista principal, uno detrás del otro
// EN EL ORDEN pedido, con el comando del ⊕ de cada tarjeta de Multimedia (InsertElementCommand + buildElementFromMedia,
// chat/comandos.ts). Y está en la API de MaKo como `poner_medios_linea_tiempo`, que propone y se acepta en el editor.
//
// Lo que fija este archivo EJECUTA el catálogo, la vista, la revisión y la API; el cableado del comando se lee del fuente
// (el comando necesita el editor y el WASM, que no cargan en node). Lo que hace en pantalla se mira en el navegador.
//
// Correr: node --import tsx --test tests/video-editor-chat-medios.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NO_SE_PUEDE_CHAT, OPERACIONES_CHAT, TOPES_CHAT, catalogoParaPrompt, validarOperacion } from '../lib/editor-video/chat-catalogo';
import { vistaDeLinea, revisarOperaciones, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import { OPERACIONES_API, descripcionApi, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { despuesDe, elementosDeVista } from '../lib/editor-video/propuesta-bloque';
import { leerVista, refsDeOperacion, revisarContraCopia } from '../lib/editor-video/propuestas';
import { AGENTE_DE_OPERACION } from '../app/video-editor/_opencut/enjambre/cursores-sueltos';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const v = validarOperacion;
const motivo = (r: ReturnType<typeof validarOperacion>) => (r.ok ? '' : r.motivo);
const DISP = disponiblesDelMotor();

const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: `${id}.mp4`, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });

/** Un video de 10 s en la principal (dos clips) y un texto encima. */
function escena({ vacia = false, bloqueada = false } = {}): SceneTracks {
  return {
    overlay: vacia ? [] : [{ id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 'text', 1, 3, { params: { content: 'Oferta' } })] }],
    main: {
      id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, ...(bloqueada ? { locked: true } : {}),
      elements: vacia ? [] : [el('vid1', 'video', 0, 6, { mediaId: 'base' }), el('vid2', 'video', 6, 4, { mediaId: 'base' })],
    },
    audio: [],
  } as unknown as SceneTracks;
}

/** Lo que había en Multimedia el 10/11: los dos del pedido, el video de base, una foto y lo que no se lista. */
const MEDIOS = [
  { id: 'base', name: 'clase.mp4', type: 'video' as const, duration: 30, hasAudio: true },
  { id: 'clip4', name: 'clip-4.mp4', type: 'video' as const, duration: 7, hasAudio: true },
  { id: 'pausa', name: 'prueba-con-pausa.mp4', type: 'video' as const, duration: 4.25, hasAudio: true },
  { id: 'foto', name: 'logo.png', type: 'image' as const },
  { id: 'mudo', name: 'pantalla.mp4', type: 'video' as const, duration: 3, hasAudio: false },
  { id: 'musica', name: 'tema.mp3', type: 'audio' as const, duration: 60 },
  { id: 'muestra', name: 'muestra.jpg', type: 'image' as const, ephemeral: true },
];

const vista = (opciones: Parameters<typeof escena>[0] = {}) =>
  vistaDeLinea({ tracks: escena(opciones), tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, lienzo: { ancho: 1080, alto: 1920 }, medios: MEDIOS, fondo: null });
/** La ref («m2») de un medio por su nombre, como la busca la IA en "medios". */
const medio = (vis: ReturnType<typeof vista>, nombre: string) => [...vis.medios.values()].find((m) => m.nombre === nombre)!.ref;
const revisar = (operaciones: unknown[], vis = vista()) =>
  revisarOperaciones({ operaciones: operaciones.map((o) => { const r = v(o); assert.ok(r.ok, motivo(r)); return r.op; }), vista: vis, alcance: 'video' });
type Agregar = Extract<OperacionResuelta, { op: 'agregar_medios' }>;

// ─── La FORMA (el catálogo) ──────────────────────────────────────────────────

test('M1: la forma: medios en orden, refs nuevas una por medio, y lo que no es se rechaza con su motivo', () => {
  assert.deepEqual(v({ op: 'agregar_medios', medios: ['m2', 'm1'] }), { ok: true, op: { op: 'agregar_medios', medios: ['m2', 'm1'] } }, 'el orden es el de la lista');
  assert.deepEqual(v({ op: 'agregar_medios', medios: ['m2', 'm1'], refs: ['n1', 'n2'] }), { ok: true, op: { op: 'agregar_medios', medios: ['m2', 'm1'], refs: ['n1', 'n2'] } });
  assert.deepEqual(v({ op: 'agregar_medios', medios: 'm3' }), { ok: true, op: { op: 'agregar_medios', medios: ['m3'] } }, 'un medio solo, sin la lista');
  assert.deepEqual(v({ op: 'agregar_medios', medios: ['m3'], ref: 'n4' }), { ok: true, op: { op: 'agregar_medios', medios: ['m3'], refs: ['n4'] } }, 'un medio con "ref", como las otras que agregan');
  assert.deepEqual(v({ op: 'agregar_medios', medios: ['m1', 'm1'] }), { ok: true, op: { op: 'agregar_medios', medios: ['m1', 'm1'] } }, 'el mismo medio dos veces');

  assert.match(motivo(v({ op: 'agregar_medios', medios: [] })), /sin decir cuáles/);
  assert.match(motivo(v({ op: 'agregar_medios' })), /sin decir cuáles/);
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['prueba-con-pausa'] })), /no es una ref de "medios"/, 'el nombre del archivo no es la ref');
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['v1'] })), /no es una ref de "medios"/, 'un clip de la línea no es un medio');
  assert.match(motivo(v({ op: 'agregar_medios', medios: Array.from({ length: TOPES_CHAT.mediosPorOperacion + 1 }, (_, i) => `m${i + 1}`) })), /más de 20 medios/);
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1', 'm2'], refs: ['n1'] })), /una por medio/);
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1', 'm2'], refs: ['n1', 'v2'] })), /una por medio/, 'una ref que no es nueva');
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1', 'm2'], refs: ['n1', 'n1'] })), /misma ref nueva/);
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1', 'm2'], ref: 'n1' })), /una por medio/, 'con dos medios, una "ref" sola no alcanza');
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1'], ref: 'n1', refs: ['n1'] })), /lleva "refs"/);
  assert.match(motivo(v({ op: 'agregar_medios', medios: ['m1'], inicio: 3 })), /«inicio» no es algo de agregar_medios/, 'no se pone en un segundo: va al final');
});

// ─── La REVISIÓN (lo que se ve en «Original | Modificado») ────────────────────

test('M2: el pedido del ticket: «primero prueba-con-pausa y después clip-4», al final de la principal y en ese orden', () => {
  const vis = vista();
  const pausa = medio(vis, 'prueba-con-pausa.mp4');
  const clip4 = medio(vis, 'clip-4.mp4');
  // La IA los ve por su nombre en "medios" (la vista que lee): sin eso no los puede nombrar.
  const leido = JSON.parse(vis.json) as { medios: Array<{ ref: string; nombre: string; tipo: string; duracion?: number }> };
  assert.deepEqual(leido.medios.find((m) => m.ref === pausa), { ref: pausa, nombre: 'prueba-con-pausa.mp4', tipo: 'video', duracion: 4.25 });
  assert.ok(!leido.medios.some((m) => m.nombre === 'tema.mp3' || m.nombre === 'muestra.jpg'), 'ni los audios ni las muestras escondidas');

  const r = revisar([{ op: 'agregar_medios', medios: [pausa, clip4] }], vis);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.resueltas, [{ op: 'agregar_medios', medios: [{ mediaId: 'pausa' }, { mediaId: 'clip4' }] }], 'primero prueba-con-pausa, después clip-4');
  assert.deepEqual(r.cambios.map((c) => [c.tipo, c.titulo, c.despues]), [
    ['agrega', 'Video «prueba-con-pausa.mp4»', 'de 10 s a 14,3 s, al final de la pista principal'],
    ['agrega', 'Video «clip-4.mp4»', 'de 14,3 s a 21,3 s, al final de la pista principal'],
  ]);
  // Al revés, al revés: el orden lo dice la persona, no Multimedia.
  const alReves = revisar([{ op: 'agregar_medios', medios: [clip4, pausa] }], vis).resueltas[0] as Agregar;
  assert.deepEqual(alReves.medios.map((m) => m.mediaId), ['clip4', 'pausa']);
});

test('M3: con la línea de tiempo vacía arrancan en 0; una foto dura lo del ⊕ y un video mudo lo dice', () => {
  const vis = vista({ vacia: true });
  const r = revisar([{ op: 'agregar_medios', medios: [medio(vis, 'logo.png'), medio(vis, 'pantalla.mp4')] }], vis);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.cambios.map((c) => [c.titulo, c.despues]), [
    ['Foto «logo.png»', 'de 0 s a 5 s, al final de la pista principal'],
    ['Video «pantalla.mp4»', 'de 5 s a 8 s, al final de la pista principal (sin sonido)'],
  ]);
  // Los 5 s de una foto son los del ⊕ de Multimedia (DEFAULT_NEW_ELEMENT_DURATION): si el motor cambia, cambia acá.
  assert.match(leer('app/video-editor/_opencut/timeline/creation.ts'), new RegExp(`DEFAULT_NEW_ELEMENT_DURATION = mediaTime\\(\\{\\s*ticks: ${TOPES_CHAT.fotoSegundos} \\* TICKS_PER_SECOND`));
});

test('M4: con refs nuevas se siguen editando en el mismo pedido; dos pedidos seguidos se encolan', () => {
  const vis = vista();
  const pausa = medio(vis, 'prueba-con-pausa.mp4');
  const clip4 = medio(vis, 'clip-4.mp4');
  const ultimo = [...vis.refs.values()].find((x) => x.elementId === 'vid2')!.ref;
  const r = revisar([
    { op: 'agregar_medios', medios: [pausa, clip4], refs: ['n1', 'n2'] },
    { op: 'silenciar', ref: 'n2', silenciado: true },
    // La transición va en el clip de la IZQUIERDA y busca a su vecino por pista: entre los dos nuevos, y entre el último
    // que ya estaba y el primero nuevo (los nuevos llevan la pista de la principal).
    { op: 'transicion', ref: 'n1', id: DISP.transiciones[0].id },
    { op: 'transicion', ref: ultimo, id: DISP.transiciones[0].id },
    { op: 'agregar_medios', medios: [medio(vis, 'logo.png')] },
  ], vis);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual((r.resueltas[0] as Agregar).medios, [{ mediaId: 'pausa', ref: 'n1' }, { mediaId: 'clip4', ref: 'n2' }]);
  assert.equal(r.resueltas[1].op, 'silenciar', 'n2 es el clip-4 recién puesto');
  assert.equal(r.resueltas.filter((x) => x.op === 'params' && x.de === 'transicion').length, 2, 'las dos transiciones le llegan');
  // El segundo agregar_medios sigue donde terminó el primero, no encima.
  assert.equal(r.cambios.at(-1)!.despues, 'de 21,3 s a 26,3 s, al final de la pista principal');
});

test('M5: lo que no se puede, se dice: un medio que no está, la principal bloqueada y una ref que ya existe', () => {
  const vis = vista();
  const r = revisar([{ op: 'agregar_medios', medios: ['m99', medio(vis, 'clip-4.mp4')] }], vis);
  assert.match(r.descartes.join(), /no encontré el medio «m99» en Multimedia/);
  assert.deepEqual((r.resueltas[0] as Agregar).medios, [{ mediaId: 'clip4' }], 'lo que sí está, va igual');
  assert.equal(r.cambios[0].despues, 'de 10 s a 17 s, al final de la pista principal', 'el que falta no deja un hueco');

  const bloq = vista({ bloqueada: true });
  const b = revisar([{ op: 'agregar_medios', medios: [medio(bloq, 'clip-4.mp4')] }], bloq);
  assert.deepEqual(b.resueltas, []);
  assert.match(b.descartes.join(), /pista principal está bloqueada/);

  const ref = [...vis.refs.keys()][0];
  const choca = revisarOperaciones({ operaciones: [{ op: 'agregar_medios', medios: [medio(vis, 'clip-4.mp4')], refs: [ref] }], vista: vis, alcance: 'video' });
  assert.match(choca.descartes.join(), new RegExp(`la ref «${ref}» ya existe`));
});

// ─── El COMANDO (se lee del fuente: necesita el editor y el WASM) ─────────────

test('M6: el comando es el del ⊕ de Multimedia, en la principal, al final medido AL EJECUTAR y en el orden pedido', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  const clase = /class AgregarAlFinal[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
  assert.ok(clase, 'falta AgregarAlFinal en chat/comandos.ts');
  assert.match(clase, /editor\.media\.getAssets\(\)\.find\(\(a\) => a\.id === this\.mediaId\)/, 'el medio sale de Multimedia al ejecutar');
  assert.match(clase, /principal\.elements\.reduce\(\(max, e\) => Math\.max\(max, e\.startTime \+ e\.duration\), 0\)/, 'el final de la principal de ESE momento');
  assert.match(clase, /buildElementFromMedia\(/);
  assert.match(clase, /placement: \{ mode: "explicit", trackId: principal\.id \}/, 'en la principal, no en otra pista');
  assert.match(clase, /redo\(\)[^{]*\{\s*return this\.execute\(\);/, 'al rehacer se vuelve a medir');
  // Cada medio, su comando, en orden; la ref nueva apunta a su inserción.
  assert.match(src, /case "agregar_medios":\s*for \(const m of r\.medios\) \{\s*const insercion = new AgregarAlFinal\(m\.mediaId\);\s*if \(m\.ref\) nuevos\.set\(m\.ref, insercion\);\s*comandos\.push\(insercion\);/);
  // Lo mismo que hace el ⊕ (assets.tsx): duración del medio, o la de un elemento nuevo.
  assert.match(leer('app/video-editor/_opencut/components/editor/panels/assets/views/assets.tsx'), /asset\.duration != null[\s\S]{0,80}DEFAULT_NEW_ELEMENT_DURATION/);
  assert.equal(AGENTE_DE_OPERACION.agregar_medios, 'corte-01', 'mientras se aplica, se ve el cursor del agente que arma el corte');
});

// ─── Lo que lee la IA y la API de MaKo ────────────────────────────────────────

test('M7: la IA lo lee en el catálogo, y «no se puede» ya no dice que no pone videos', () => {
  const cat = catalogoParaPrompt();
  assert.match(cat, /"op":"agregar_medios","medios":\["m1","m2"\]/);
  assert.match(cat, /PISTA PRINCIPAL, uno detrás del otro EN EL ORDEN de la lista, al FINAL/);
  assert.match(cat, /«primero X y después Y»/);
  assert.doesNotMatch(NO_SE_PUEDE_CHAT, /agregar a la línea de tiempo videos, imágenes/);
  assert.match(NO_SE_PUEDE_CHAT, /los videos y las fotos de "medios", sí: agregar_medios/);
  assert.match(NO_SE_PUEDE_CHAT, /música, sonidos, formas o stickers/, 'lo que sigue sin poder se sigue diciendo');
  assert.doesNotMatch(cat, /videos, imágenes, música/);
  assert.equal(OPERACIONES_CHAT.at(-1)!.op, 'agregar_medios', 'la nueva va al FINAL (pierde los empates: docs/hallazgos-api-mako.md)');
});

test('M8: la API: poner_medios_linea_tiempo propone en el editor, con su tarjeta y sus refs contra la copia', () => {
  const op = OPERACIONES_API.find((o) => o.id === 'poner_medios_linea_tiempo')!;
  assert.ok(op, 'falta poner_medios_linea_tiempo en lib/editor-video/chat-api.ts');
  assert.equal(OPERACIONES_API.at(-1), op, 'al FINAL del área');
  assert.doesNotMatch(`${op.id} ${op.titulo}`, /video/i, 'sin la palabra de todas las del área: suma un punto en cada empate (docs/hallazgos-api-mako.md)');
  assert.deepEqual(op.parametros.map((p) => [p.nombre, p.tipo, !!p.obligatorio]), [['medios', 'string[]', true], ['refs', 'string[]', false]]);
  assert.match(descripcionApi(op), /^PROPONE en un proyecto del Video Editor; NO lo aplica/);
  assert.deepEqual(operacionDesdeInput(op, { proyecto: 'Reel', medios: ['m3', 'm2'] }), { ok: true, op: { op: 'agregar_medios', medios: ['m3', 'm2'] } });
  assert.deepEqual(operacionDesdeInput(op, { proyecto: 'Reel', medios: ['m3'], refs: ['n1'] }), { ok: true, op: { op: 'agregar_medios', medios: ['m3'], refs: ['n1'] } });
  assert.equal(operacionDesdeInput(op, { proyecto: 'Reel', medios: ['clip-4'] }).ok, false);
  // El runner: propone, no ejecuta.
  assert.match(leer('lib/api-mako/areas/video.run.ts'), /poner_medios_linea_tiempo: \{ \.\.\.enElEditor\('poner_medios_linea_tiempo'\) \}/);

  const ag = { op: 'agregar_medios', medios: ['m3', 'm2'], refs: ['n1', 'n2'] } as const;
  assert.deepEqual(refsDeOperacion({ ...ag, medios: [...ag.medios], refs: [...ag.refs] }), { usa: [], medios: ['m3', 'm2'], define: ['n1', 'n2'] });
  const copia = { pistas: [{ tipo: 'video', elementos: [{ ref: 'v1', nombre: 'clase.mp4' }] }], medios: [{ ref: 'm2', nombre: 'clip-4.mp4' }, { ref: 'm3', nombre: 'prueba-con-pausa.mp4' }] };
  assert.deepEqual(revisarContraCopia({ op: { op: 'agregar_medios', medios: ['m3', 'm2'] }, vista: leerVista(copia), previas: [] }), { ok: true });
  assert.match(String((revisarContraCopia({ op: { op: 'agregar_medios', medios: ['m9'] }, vista: leerVista(copia), previas: [] }) as { motivo?: string }).motivo), /«m9» no está en Multimedia/);
  // Las refs nuevas se pueden usar en la acción siguiente de la misma propuesta.
  assert.deepEqual(revisarContraCopia({ op: { op: 'silenciar', ref: 'n2', silenciado: true }, vista: leerVista(copia), previas: [{ op: 'agregar_medios', medios: ['m3', 'm2'], refs: ['n1', 'n2'] }] }), { ok: true });
  // La tarjeta del chat (Original | Modificado) los nombra en su orden.
  assert.equal(despuesDe({ op: 'agregar_medios', medios: ['m3', 'm2'] }, elementosDeVista(copia)), 'Al final de la pista principal, en este orden: prueba-con-pausa.mp4, clip-4.mp4');
});

// PROBADO ROMPIÉNDOLO (12/11/2026, base 8/0, cada rotura restaurada):
//   · la revisión no corre el final después de cada medio (quedan los dos en 10 s)  -> 5/3 (M2, M4, M5)
//   · el comando inserta con `mode: "auto"` en vez de la principal                 -> 7/1 (M6)
//   · la API sin el runner de poner_medios_linea_tiempo                            -> 7/1 (M8)
//   · los clips nuevos sin la pista de la principal (trackId "")                   -> 7/1 (M4: la transición del último
//     clip que ya estaba no encuentra a su vecino nuevo)
