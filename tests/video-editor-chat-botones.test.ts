// =============================================================================
// Lo que el chat «Editar con IA» no sabía hacer (pendientes-video-editor.md §9.1, 10/11/2026)
// =============================================================================
// Martín (15/10): «tienen que pasarle absolutamente todos los botones». Cinco botones del editor entran al chat y a la API
// de MaKo, cada uno por el MISMO camino que su botón (chat/comandos.ts):
//   · duplicar      → DuplicateElementsCommand (el de «Duplicar» y Ctrl+D): la copia encima, en el mismo tiempo;
//   · fondo_lienzo  → UpdateProjectSettingsCommand con `background` (Proyecto › Fondo), un paso aunque no cambien las pistas;
//   · efecto_texto  → los params de un «Efecto de texto» (text/estilos-predefinidos.ts), con la regla del panel (un efecto
//                     con fondo no va en un texto curvado);
//   · agregar_texto con "plantilla" → los params de una «Plantilla de texto», con el tamaño llevado al lienzo;
//   · agregar_emoji → un sticker «emojis:<código>» de la biblioteca (Stickers › Emojis), sólo los que la pestaña tiene;
//   · encuadre      → `recorte.*`, lo que guarda «Confirmar» del diálogo «Recortar» (recorte/geometria.ts).
// Lo que fija este archivo EJECUTA el catálogo, la vista y la revisión; el cableado del comando se lee del fuente (el
// comando necesita el editor y el WASM, que no cargan en node).
//
// Correr: node --import tsx --test tests/video-editor-chat-botones.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DESENFOQUES_FONDO, NO_SE_PUEDE_CHAT, OPERACIONES_CHAT, PROPORCIONES_ENCUADRE, catalogoParaPrompt, validarOperacion,
  type OperacionChat,
} from '../lib/editor-video/chat-catalogo';
import { vistaDeLinea, revisarOperaciones, emojiDeLaBiblioteca, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import { BACKGROUND_BLUR_INTENSITY_PRESETS } from '../app/video-editor/_opencut/background/blur';
import { PROPORCIONES_RECORTE } from '../app/video-editor/_opencut/params/extra/recorte';
import { EFECTOS_TEXTO, PLANTILLAS_TEXTO, SIN_EFECTO, paramsParaLienzo } from '../app/video-editor/_opencut/text/estilos-predefinidos';
import { paramsDeRect, rectConProporcion, RECT_COMPLETO } from '../app/video-editor/_opencut/recorte/geometria';
import { OPERACIONES_API, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { despuesDe } from '../lib/editor-video/propuesta-bloque';
import { leerVista, refsDeOperacion, revisarContraCopia } from '../lib/editor-video/propuestas';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const v = validarOperacion;
const motivo = (r: ReturnType<typeof validarOperacion>) => (r.ok ? '' : r.motivo);
const DISP = disponiblesDelMotor();

/** Un texto, un texto curvado, un subtítulo, un video 16:9 (1920×1080) recortado a mano y una imagen sin tamaño. */
function escena(): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: `${id}.mp4`, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  return {
    overlay: [
      {
        id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [
          el('txt1', 'text', 1, 3, { params: { content: 'Oferta', color: '#ffffff' } }),
          el('txt2', 'text', 5, 2, { params: { content: 'Curvo', 'curva.activa': true, 'curva.fuerza': 40 } }),
        ],
      },
      { id: 'ps', type: 'text', name: 'Subs', hidden: false, elements: [el('sub1', 'text', 0, 3, { params: { content: 'hola mundo', subtitulo: true } })] },
      { id: 'pb', type: 'text', name: 'Bloq', hidden: false, locked: true, elements: [el('txt3', 'text', 0, 2, { params: { content: 'Fijo' } })] },
    ],
    main: {
      id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [
        el('vid1', 'video', 0, 6, { mediaId: 'm1' }),
        el('vid2', 'video', 6, 4, { mediaId: 'm1', params: { 'recorte.izquierda': 0.1, 'recorte.derecha': 0.1, 'recorte.proporcion': 'libre' } }),
        el('img1', 'image', 10, 3, { mediaId: 'm9' }),
      ],
    },
    audio: [],
  } as unknown as SceneTracks;
}

const MEDIOS = [{ id: 'm1', name: 'clase.mp4', type: 'video' as const, duration: 30, hasAudio: true, width: 1920, height: 1080 }];
const vista = (extra: Partial<Parameters<typeof vistaDeLinea>[0]> = {}) =>
  vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, lienzo: { ancho: 1080, alto: 1920 }, medios: MEDIOS, fondo: { type: 'color', color: '#000000' }, ...extra });
/** Como al pedir: lo que devolvió la IA pasa primero por la forma (el encuadre completa sus lados), después por la revisión. */
const revisar = (operaciones: unknown[], extra: { vista?: ReturnType<typeof vista>; alcance?: 'video' | 'seleccion' } = {}) =>
  revisarOperaciones({ operaciones: operaciones.map((o) => { const r = v(o); assert.ok(r.ok, motivo(r)); return r.op; }), vista: extra.vista ?? vista(), alcance: extra.alcance ?? 'video' });
const refDe = (vis: ReturnType<typeof vista>, id: string) => [...vis.refs.values()].find((r) => r.elementId === id)!.ref;
type Params = Extract<OperacionResuelta, { op: 'params' }>;

// ─── La FORMA (el catálogo) ──────────────────────────────────────────────────

test('B1: la forma de las cinco operaciones nuevas: lo bueno pasa, validar lo validado da lo mismo, lo malo dice por qué', () => {
  const buenas: unknown[] = [
    { op: 'duplicar', ref: 't1', copia: 'n1' },
    { op: 'duplicar', ref: 'v2' },
    { op: 'fondo_lienzo', color: '#FD0' },
    { op: 'fondo_lienzo', desenfoque: ' Medio ' },
    { op: 'efecto_texto', ref: 't1', id: 'Neon-Rosa' },
    { op: 'efecto_texto', ref: 't1', id: 'ninguno' },
    { op: 'agregar_emoji', emoji: ' 🔥 ', inicio: 1.234, duracion: 2, ref: 'n2' },
    { op: 'encuadre', ref: 'v1', proporcion: '9:16' },
    { op: 'encuadre', ref: 'v1', izquierda: 10, derecha: 12.34 },
    { op: 'encuadre', ref: 'v1', quitar: true },
    { op: 'agregar_texto', texto: 'Compra ya', inicio: 0, duracion: 3, plantilla: 'accion' },
  ];
  for (const b of buenas) {
    const r = v(b);
    assert.ok(r.ok, `${JSON.stringify(b)}: ${motivo(r)}`);
    assert.deepEqual(v(r.ok ? r.op : null), r, `idempotente: ${JSON.stringify(b)}`);
  }
  assert.deepEqual(v({ op: 'fondo_lienzo', color: '#FD0' }), { ok: true, op: { op: 'fondo_lienzo', color: '#ffdd00' } });
  assert.deepEqual(v({ op: 'fondo_lienzo', desenfoque: ' Medio ' }), { ok: true, op: { op: 'fondo_lienzo', desenfoque: 'medio' } });
  assert.deepEqual(v({ op: 'efecto_texto', ref: 't1', id: 'ninguno' }), { ok: true, op: { op: 'efecto_texto', ref: 't1', id: null } });
  assert.deepEqual(v({ op: 'encuadre', ref: 'v1', izquierda: 10, derecha: 12.34 }), {
    ok: true, op: { op: 'encuadre', ref: 'v1', izquierda: 10, arriba: 0, derecha: 12.3, abajo: 0 },
  }, 'los lados que no vienen van en 0, a la décima');

  assert.match(motivo(v({ op: 'duplicar', ref: 't1', copia: 't9' })), /ref que no es «n1»/);
  assert.match(motivo(v({ op: 'duplicar', ref: 't1', donde: 3 })), /«donde» no es algo de duplicar/);
  assert.match(motivo(v({ op: 'fondo_lienzo' })), /uno de los dos/);
  assert.match(motivo(v({ op: 'fondo_lienzo', color: '#000000', desenfoque: 'medio' })), /uno de los dos/);
  assert.match(motivo(v({ op: 'fondo_lienzo', color: 'negro' })), /no es #RRGGBB/);
  assert.match(motivo(v({ op: 'fondo_lienzo', desenfoque: 'extremo' })), /«suave», «medio» o «fuerte»/);
  assert.match(motivo(v({ op: 'agregar_emoji', emoji: 'fuego', inicio: 0, duracion: 2 })), /no es UN emoji/);
  assert.match(motivo(v({ op: 'agregar_emoji', emoji: '🔥 💰', inicio: 0, duracion: 2 })), /no es UN emoji/, 'dos son dos operaciones');
  assert.match(motivo(v({ op: 'agregar_emoji', emoji: '🔥', inicio: 0 })), /sin duración/);
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1' })), /uno de los tres/);
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1', proporcion: '9:16', izquierda: 5 })), /uno de los tres/);
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1', proporcion: 'libre' })), /«libre» no es una proporción/, 'libre va con los lados');
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1', izquierda: 60, derecha: 40 })), /al menos el 2 %/);
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1', izquierda: 0 })), /sin nada que recortar/);
  assert.match(motivo(v({ op: 'encuadre', ref: 'v1', arriba: 96 })), /fuera de 0 a 95/);
  assert.match(motivo(v({ op: 'agregar_texto', texto: 'Hola', inicio: 0, duracion: 3, plantilla: 'Una Plantilla Rara!' })), /plantilla sin forma/);
});

test('B2: las tablas copiadas son las del motor: los desenfoques del panel Fondo y las proporciones de «Recortar»', () => {
  assert.deepEqual(Object.values(DESENFOQUES_FONDO), BACKGROUND_BLUR_INTENSITY_PRESETS.map((p) => p.value), 'suave, medio y fuerte son Light, Medium y Heavy');
  assert.deepEqual([...PROPORCIONES_ENCUADRE], PROPORCIONES_RECORTE.map((p) => p.id).filter((id) => id !== 'libre'));
});

// ─── La vista ────────────────────────────────────────────────────────────────

test('B3: la vista dice el fondo del lienzo, el encuadre de un clip, el texto curvado y los efectos y plantillas de texto', () => {
  const j = JSON.parse(vista().json);
  assert.deepEqual(j.fondo_lienzo, { color: '#000000' });
  assert.deepEqual(JSON.parse(vista({ fondo: { type: 'blur', blurIntensity: 200 } }).json).fondo_lienzo, { desenfoque: 'medio' });
  assert.deepEqual(JSON.parse(vista({ fondo: { type: 'blur', blurIntensity: 10 } }).json).fondo_lienzo, { desenfoque: 10 }, 'uno que no es del panel, con su número');
  const elementos = j.pistas.flatMap((p: { elementos: unknown[] }) => p.elementos) as Array<Record<string, unknown>>;
  const vid2 = elementos.find((e) => e.ref === refDe(vista(), 'vid2'))!;
  assert.deepEqual(vid2.encuadre, { izquierda: 10, arriba: 0, derecha: 10, abajo: 0 });
  assert.equal(elementos.find((e) => e.ref === refDe(vista(), 'vid1'))!.encuadre, undefined, 'sin recorte no se dice');
  assert.equal(elementos.find((e) => e.ref === refDe(vista(), 'txt2'))!.curvado, true);
  assert.equal(j.disponibles.efectos_texto['neon-rosa'], 'Neón rosa');
  assert.equal(j.disponibles.plantillas_texto.accion, 'Llamada a la acción');
  assert.equal(Object.keys(j.disponibles.efectos_texto).length, EFECTOS_TEXTO.length);
});

// ─── La revisión ─────────────────────────────────────────────────────────────

test('B4: duplicar: la copia encima y en el mismo tiempo, se puede seguir editando con su ref, y un subtítulo no se copia', () => {
  const vis = vista();
  const t1 = refDe(vis, 'txt1');
  const r = revisar([
    { op: 'duplicar', ref: t1, copia: 'n1' },
    { op: 'mover', ref: 'n1', inicio: 8 },
    { op: 'cambiar_texto', ref: 'n1', texto: 'Oferta 2' },
  ], { vista: vis });
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['duplicar', 'mover', 'cambiar_texto']);
  const dup = r.resueltas[0] as Extract<OperacionResuelta, { op: 'duplicar' }>;
  assert.equal(dup.el.elementId, 'txt1');
  assert.equal(dup.copia, 'n1');
  assert.deepEqual(r.cambios[0], { tipo: 'agrega', titulo: 'Copia de «Oferta»', antes: '', despues: 'de 1 s a 4 s, encima, en una pista nueva' });
  // El original no se movió: la copia es otra cosa.
  assert.equal((r.resueltas[1] as Extract<OperacionResuelta, { op: 'mover' }>).el.ref, 'n1');

  const sub = revisar([{ op: 'duplicar', ref: refDe(vis, 'sub1') }], { vista: vis });
  assert.equal(sub.resueltas.length, 0);
  assert.match(sub.descartes.join(), /es un subtítulo: duplicarlo lo repetiría en la transcripción/);
  assert.match(revisar([{ op: 'duplicar', ref: refDe(vis, 'txt3') }], { vista: vis }).descartes.join(), /pista bloqueada/);
  assert.match(revisar([{ op: 'agregar_texto', texto: 'x', inicio: 0, duracion: 1, ref: 'n1' }, { op: 'duplicar', ref: t1, copia: 'n1' }], { vista: vis }).descartes.join(), /la ref «n1» ya existe/);
  // Con alcance «selección», lo nuevo (la copia) se sigue editando aunque no esté elegido.
  const sel = vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [{ trackId: 'pt', elementId: 'txt1' }], disponibles: DISP });
  const rs = revisarOperaciones({ operaciones: [{ op: 'duplicar', ref: t1, copia: 'n1' }, { op: 'transformar', ref: 'n1', cambios: { y: 300 } }], vista: sel, alcance: 'seleccion' });
  assert.deepEqual(rs.resueltas.map((x) => x.op), ['duplicar', 'params']);
});

test('B5: el fondo del lienzo: de todo el proyecto, con su fila, y el que ya está no cambia nada', () => {
  const r = revisar([{ op: 'fondo_lienzo', desenfoque: 'fuerte' }, { op: 'fondo_lienzo', color: '#ffffff' }]);
  assert.deepEqual(r.resueltas, [
    { op: 'fondo_lienzo', fondo: { type: 'blur', blurIntensity: 500 } },
    { op: 'fondo_lienzo', fondo: { type: 'color', color: '#ffffff' } },
  ]);
  assert.deepEqual(r.cambios.map((c) => [c.antes, c.despues]), [['color #000000', 'desenfoque fuerte'], ['desenfoque fuerte', 'color #ffffff']], 'el segundo parte del primero');
  assert.deepEqual(revisar([{ op: 'fondo_lienzo', color: '#000000' }]).resueltas, [], 'el que ya tiene no es un cambio');
  // También con alcance «selección»: es del proyecto, como los cambios de todo el video.
  assert.equal(revisar([{ op: 'fondo_lienzo', color: '#ff0000' }], { alcance: 'seleccion' }).resueltas.length, 1);
});

test('B6: efecto de texto: los params del panel, la regla del texto curvado, «ninguno», y lo que ya está así no cambia', () => {
  const vis = vista();
  const t1 = refDe(vis, 'txt1');
  const neon = EFECTOS_TEXTO.find((e) => e.id === 'neon-rosa')!;
  const r = revisar([{ op: 'efecto_texto', ref: t1, id: 'neon-rosa' }], { vista: vis });
  assert.deepEqual(r.descartes, []);
  const p = r.resueltas[0] as Params;
  assert.equal(p.op, 'params');
  assert.deepEqual(p.params, neon.params, 'los mismos params que la tarjeta del panel');
  assert.match(r.cambios[0].despues, /«Neón rosa» · color #fff0f8 · trazo #ff2d95 · brillo #ff2d95/);
  assert.match(r.cambios[0].antes, /^color #ffffff$/);

  // El mismo efecto dos veces: la segunda ya no cambia nada.
  const dos = revisar([{ op: 'efecto_texto', ref: t1, id: 'neon-rosa' }, { op: 'efecto_texto', ref: t1, id: 'neon-rosa' }], { vista: vis });
  assert.equal(dos.resueltas.length, 1);
  // Ninguno saca todo (SIN_EFECTO), y sobre un texto sin efecto no es un cambio.
  assert.deepEqual((revisar([{ op: 'efecto_texto', ref: t1, id: 'neon-rosa' }, { op: 'efecto_texto', ref: t1, id: null }], { vista: vis }).resueltas[1] as Params).params, SIN_EFECTO);
  assert.equal(revisar([{ op: 'efecto_texto', ref: t1, id: null }], { vista: vis }).resueltas.length, 0);

  const curvo = refDe(vis, 'txt2');
  assert.match(revisar([{ op: 'efecto_texto', ref: curvo, id: 'recuadro-negro' }], { vista: vis }).descartes.join(), /está curvado: un efecto con fondo no se le aplica/);
  assert.equal(revisar([{ op: 'efecto_texto', ref: curvo, id: 'neon-rosa' }], { vista: vis }).resueltas.length, 1, 'sin fondo, sí');
  assert.match(revisar([{ op: 'efecto_texto', ref: t1, id: 'arcoiris' }], { vista: vis }).descartes.join(), /no existe el efecto de texto «arcoiris»/);
  assert.match(revisar([{ op: 'efecto_texto', ref: refDe(vis, 'vid1'), id: 'neon-rosa' }], { vista: vis }).descartes.join(), /no es un texto/);
  // Sin lo del motor (un editor sin cargar), ningún nombre existe.
  const vacia = vista({ disponibles: undefined });
  assert.match(revisar([{ op: 'efecto_texto', ref: refDe(vacia, 'txt1'), id: 'neon-rosa' }], { vista: vacia }).descartes.join(), /no existe/);
});

test('B7: un texto con «Plantilla de texto»: sus params con el tamaño llevado al lienzo, y su animación', () => {
  const plantilla = PLANTILLAS_TEXTO.find((p) => p.id === 'accion')!;
  const r = revisar([{ op: 'agregar_texto', texto: 'Compra ya', inicio: 1, duracion: 3, ref: 'n1', plantilla: 'accion' }, { op: 'animacion', ref: 'n1', tipo: 'bucle', id: null }]);
  assert.deepEqual(r.descartes, []);
  const a = r.resueltas[0] as Extract<OperacionResuelta, { op: 'agregar_texto' }>;
  assert.deepEqual(a.params, paramsParaLienzo(plantilla.params, { width: 1080, height: 1920 }));
  assert.ok(Number(a.params!.fontSize) < Number(plantilla.params.fontSize), 'en un 9:16 la letra se achica, como al agregarla desde la biblioteca');
  assert.equal(r.cambios[0].titulo, 'Texto nuevo · plantilla «Llamada a la acción»');
  // La revisión sabe que nace con su bucle («respirar»): sacarlo es un cambio.
  assert.equal(r.resueltas[1].op, 'params', 'la animación de la plantilla se ve en la simulación');
  assert.match(revisar([{ op: 'agregar_texto', texto: 'x', inicio: 0, duracion: 2, plantilla: 'inexistente' }]).descartes.join(), /no existe la plantilla de texto/);
  const sin = revisar([{ op: 'agregar_texto', texto: 'x', inicio: 0, duracion: 2 }]).resueltas[0] as Extract<OperacionResuelta, { op: 'agregar_texto' }>;
  assert.equal(sin.params, undefined, 'sin plantilla, el texto de siempre');
});

test('B8: agregar un emoji: sólo los de la biblioteca, con el id del sticker de la pestaña, y se sigue editando con su ref', () => {
  const r = revisar([{ op: 'agregar_emoji', emoji: '🔥', inicio: 2, duracion: 2, ref: 'n1' }, { op: 'transformar', ref: 'n1', cambios: { escala: 50 } }]);
  assert.deepEqual(r.descartes, []);
  assert.deepEqual(r.resueltas[0], { op: 'agregar_emoji', emoji: '🔥', stickerId: 'emojis:1f525', inicio: 2, duracion: 2, ref: 'n1' });
  assert.equal(r.resueltas[1].op, 'params');
  assert.equal(r.cambios[0].titulo, 'Emoji 🔥');
  // Con o sin el selector de variante: el de la biblioteca.
  assert.equal(emojiDeLaBiblioteca('\u2764'), '\u2764\uFE0F');
  assert.equal(emojiDeLaBiblioteca('\u2764\uFE0F'), '\u2764\uFE0F');
  const corazon = revisar([{ op: 'agregar_emoji', emoji: '❤', inicio: 0, duracion: 1 }]).resueltas[0] as Extract<OperacionResuelta, { op: 'agregar_emoji' }>;
  assert.equal(corazon.stickerId, 'emojis:2764-fe0f');
  assert.match(revisar([{ op: 'agregar_emoji', emoji: '🫠', inicio: 0, duracion: 1 }]).descartes.join(), /no está en la biblioteca de emojis/);
});

test('B9: el encuadre: lo que guarda el diálogo «Recortar», con la proporción centrada en el de ahora', () => {
  const vis = vista();
  const v1 = refDe(vis, 'vid1');
  const r = revisar([{ op: 'encuadre', ref: v1, proporcion: '9:16' }], { vista: vis });
  assert.deepEqual(r.descartes, []);
  const p = r.resueltas[0] as Params;
  assert.deepEqual(p.params, paramsDeRect(rectConProporcion(RECT_COMPLETO, 9 / 16, { width: 1920, height: 1080 }), '9:16'));
  assert.equal(p.params['recorte.proporcion'], '9:16');
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['sin recortar', '9:16 · se saca izquierda 34,2 % · derecha 34,2 %']);

  // Los lados, y «quitar» sobre el que ya tiene recorte.
  const lados = revisar([{ op: 'encuadre', ref: v1, izquierda: 5, arriba: 10, derecha: 5, abajo: 10 }], { vista: vis }).resueltas[0] as Params;
  assert.deepEqual(lados.params, { 'recorte.izquierda': 0.05, 'recorte.arriba': 0.1, 'recorte.derecha': 0.05, 'recorte.abajo': 0.1, 'recorte.proporcion': 'libre' });
  const v2 = refDe(vis, 'vid2');
  const quitar = revisar([{ op: 'encuadre', ref: v2, quitar: true }], { vista: vis });
  assert.deepEqual((quitar.resueltas[0] as Params).params, { 'recorte.izquierda': 0, 'recorte.arriba': 0, 'recorte.derecha': 0, 'recorte.abajo': 0, 'recorte.proporcion': 'libre' });
  assert.equal(quitar.cambios[0].despues, 'sin recortar');
  // Lo que ya está así no es un cambio; y dos en el mismo pedido parten del primero.
  assert.equal(revisar([{ op: 'encuadre', ref: v2, izquierda: 10, derecha: 10 }], { vista: vis }).resueltas.length, 0);
  assert.equal(revisar([{ op: 'encuadre', ref: v1, quitar: true }], { vista: vis }).resueltas.length, 0, 'un clip sin recorte ya está entero');
  // Sin el tamaño del archivo no se adivina la proporción; los lados, sí.
  const img = refDe(vis, 'img1');
  assert.match(revisar([{ op: 'encuadre', ref: img, proporcion: '1:1' }], { vista: vis }).descartes.join(), /no sé el tamaño del archivo/);
  assert.equal(revisar([{ op: 'encuadre', ref: img, izquierda: 20 }], { vista: vis }).resueltas.length, 1);
  assert.match(revisar([{ op: 'encuadre', ref: refDe(vis, 'txt1'), proporcion: '1:1' }], { vista: vis }).descartes.join(), /no es un clip de video o imagen/);
});

// ─── Lo que lo aplica, la API y lo que se le dice a la IA ────────────────────

test('B10: cada una va por el comando de su BOTÓN, y el fondo cuenta como un paso aunque no cambien las pistas', () => {
  const com = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  assert.match(com, /new DuplicateElementsCommand\(\{ elements: \[o\] \}\)/, 'el comando de «Duplicar»');
  assert.match(com, /new UpdateProjectSettingsCommand\(\{ background: r\.fondo \}\)/, 'el de Proyecto › Fondo');
  assert.match(com, /buildStickerElement\(\{\s*stickerId: r\.stickerId/, 'el sticker de la pestaña Emojis');
  assert.match(com, /params: \{ \.\.\.\(r\.params \?\? \{\}\), content: r\.texto \}/, 'la plantilla de texto, con lo que dice encima');
  assert.match(com, /if \(r\.copia\) nuevos\.set\(r\.copia, copia\)/, 'la copia se puede seguir editando en el lote');
  // El botón «Duplicar» usa el mismo comando (core/managers/timeline-manager.ts).
  assert.match(sinComentarios(leer('app/video-editor/_opencut/core/managers/timeline-manager.ts')), /new DuplicateElementsCommand\(\{ elements \}\)/);
  const apl = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.match(apl, /if \(actuales\(\) !== antes \|\| ajustesDe\(\) !== ajustesAntes\) pasos\+\+/, 'un cambio sólo de fondo es un paso');
  assert.match(apl, /despues === antes && !cambiaronAjustes/, 'y no se cuenta como «no se aplicó»');
  assert.match(apl, /a\.ajustes && ajustes\(\) !== a\.ajustes\.despues/, '«Restaurar» no deshace un fondo que cambió otro');
  // Las cinco miradas del editor (pedir, aceptar, el espejo, las propuestas y los agentes) le pasan el fondo a la vista.
  for (const archivo of ['chat/PanelChat.tsx', 'chat/aplicar.ts', 'chat/espejo.ts', 'chat/propuestas.ts', 'enjambre/correr.ts']) {
    assert.match(leer(`app/video-editor/_opencut/${archivo}`), /fondo: datos\.fondo,/, `${archivo} sin el fondo del lienzo`);
  }
});

test('B11: la API: el encuadre sin «quitar», la tarjeta de la propuesta y las refs nuevas de la copia y el emoji', () => {
  const op = (id: string) => OPERACIONES_API.find((o) => o.id === id)!;
  for (const id of ['duplicar_elemento_video', 'cambiar_fondo_lienzo', 'poner_efecto_texto_video', 'agregar_emoji_video', 'encuadrar_clip_video']) assert.ok(op(id), id);
  const enc = operacionDesdeInput(op('encuadrar_clip_video'), { proyecto: 'p', ref: 'v1', proporcion: '1:1', quitar: false });
  assert.deepEqual(enc, { ok: true, op: { op: 'encuadre', ref: 'v1', proporcion: '1:1' } }, '«quitar»: false es no decirlo');
  const fondo = operacionDesdeInput(op('cambiar_fondo_lienzo'), { proyecto: 'p', desenfoque: 'suave' });
  assert.deepEqual(fondo, { ok: true, op: { op: 'fondo_lienzo', desenfoque: 'suave' } });

  assert.equal(despuesDe({ op: 'fondo_lienzo', desenfoque: 'medio' }), 'Fondo del lienzo desenfocado (medio)');
  assert.equal(despuesDe({ op: 'encuadre', ref: 'v1', izquierda: 10, arriba: 0, derecha: 10, abajo: 0 }), 'El cuadro recortado (izquierda 10 %, derecha 10 %)');
  assert.equal(despuesDe({ op: 'agregar_emoji', emoji: '🔥', inicio: 2, duracion: 2 }), 'Emoji 🔥 de 0:02 a 0:04');

  assert.deepEqual(refsDeOperacion({ op: 'duplicar', ref: 't1', copia: 'n1' }), { usa: ['t1'], medios: [], define: ['n1'] });
  assert.deepEqual(refsDeOperacion({ op: 'agregar_emoji', emoji: '🔥', inicio: 0, duracion: 1, ref: 'n2' }), { usa: [], medios: [], define: ['n2'] });
  const copia = leerVista({ pistas: [{ tipo: 'texto', elementos: [{ ref: 't1', texto: 'Hola' }] }], medios: [] });
  assert.deepEqual(revisarContraCopia({ op: { op: 'duplicar', ref: 't1', copia: 'n1' }, vista: copia, previas: [] }), { ok: true });
  assert.match(String((revisarContraCopia({ op: { op: 'duplicar', ref: 't1', copia: 't1' }, vista: copia, previas: [] }) as { motivo?: string }).motivo), /ya se usa/);
  // La copia de una propuesta anterior se puede mover en la siguiente acción.
  assert.deepEqual(revisarContraCopia({ op: { op: 'mover', ref: 'n1', inicio: 3 }, vista: copia, previas: [{ op: 'duplicar', ref: 't1', copia: 'n1' }] }), { ok: true });
});

test('B12: lo que lee la IA: las cinco en el catálogo, y «no se puede» ya no dice lo que sí se puede', () => {
  const cat = catalogoParaPrompt();
  for (const op of ['duplicar', 'fondo_lienzo', 'efecto_texto', 'agregar_emoji', 'encuadre']) {
    assert.ok(OPERACIONES_CHAT.some((o) => o.op === op), op);
    assert.match(cat, new RegExp(`"op":"${op}"`), `${op} no está en el catálogo que lee la IA`);
  }
  assert.match(cat, /"plantilla" \(opcional\): el id de una «Plantilla de texto»/);
  for (const ya of [/duplicar o copiar/, /el fondo del lienzo;/, /recortar el encuadre/, /las plantillas de estilo de texto/]) assert.doesNotMatch(NO_SE_PUEDE_CHAT, ya);
  assert.match(NO_SE_PUEDE_CHAT, /un emoji, sí: agregar_emoji/);
  assert.match(NO_SE_PUEDE_CHAT, /pegar atributos/, 'lo que sigue sin poder se sigue diciendo');
  // Las operaciones nuevas van al FINAL: no le sacan el lugar a las de antes (AGENTS.md).
  assert.deepEqual(OPERACIONES_CHAT.slice(-5).map((o) => o.op), ['duplicar', 'fondo_lienzo', 'efecto_texto', 'agregar_emoji', 'encuadre']);
  assert.deepEqual(OPERACIONES_API.slice(-5).map((o) => o.op), ['duplicar', 'fondo_lienzo', 'efecto_texto', 'agregar_emoji', 'encuadre']);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 12/0, cada rotura restaurada de memoria):
//   · duplicar deja copiar un subtítulo                                           -> 11/1 (B4)
//   · la copia no se registra con su ref (`refs.set(copia.ref…)`)                 -> 11/1 (B4)
//   · un efecto con fondo sobre un texto curvado pasa                             -> 11/1 (B6)
//   · elegir el efecto que ya tiene cuenta como cambio                            -> 11/1 (B6)
//   · la plantilla de texto sin llevar el tamaño al lienzo                        -> 11/1 (B7)
//   · el emoji sin el selector de variante (U+FE0F)                               -> 11/1 (B8)
//   · cualquier emoji pasa, esté o no en la biblioteca                            -> 11/1 (B8)
//   · el encuadre igual al de ahora cuenta como cambio                            -> 11/1 (B9)
//   · la proporción pegada a la izquierda en vez de centrada                      -> 11/1 (B9)
//   · «medio» con otro número que el panel (250)                                  -> 10/2 (B2, B3)
//   · la vista sin el fondo del lienzo                                            -> 11/1 (B3)
//   · aplicar sin contar el cambio de ajustes como un paso                        -> 11/1 (B10)
//   · la copia de un duplicar no es una ref nueva para la API                     -> 11/1 (B11)
//   · «no se puede» sin decir que un emoji sí se puede                            -> 11/1 (B12)
//   · un cambio sin efecto (renombrar `nombrePlantilla`)                          -> 12/0
// Lo que NO ve este archivo: que `datosDeLinea` (chat/contexto.ts) lea el fondo del proyecto (necesita el editor) y que
// el comando haga en pantalla lo que dice la fila: eso se mira en el navegador.
