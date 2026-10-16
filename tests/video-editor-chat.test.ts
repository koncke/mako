// =============================================================================
// El chat del Video Editor: lo que la IA puede pedir, cómo se revisa y lo que no se negocia
// =============================================================================
// Pedido de Martín (15/10/2026): un chat al costado para editar el video con prompt, como el
// del Landing. Acá se prueba la parte pura (catálogo, vista de la línea de tiempo, revisión de
// la propuesta) y se fijan leyendo el fuente las reglas que no se negocian:
//   · nada se aplica sin «Aceptar» (el pedido sólo arma la propuesta);
//   · aceptar guarda lo pendiente ANTES de tocar la línea de tiempo;
//   · el modelo es GRATIS (Gemini del cliente) y Claude no tiene permiso;
//   · las keys y los slots del prompt coinciden con el registro editable;
//   · cada operación usa el comando del botón de la pantalla (tests 22-38, tanda del 15/10:
//     transiciones, animaciones, filtros, efectos, color, velocidad, recorte, estilo,
//     posición, audio, revertir, congelar y los cortes por frase, tramo y muletillas).
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPES_CHAT, validarOperacion, validarOperaciones, catalogoParaPrompt, OPERACIONES_CHAT } from '../lib/editor-video/chat-catalogo';
import { CHAT_VIDEO_SYSTEM_TEMPLATE, CHAT_VIDEO_USER_TEMPLATE, PROMPTS_CHAT_VIDEO } from '../lib/editor-video/chat-prompts';
import { vistaDeLinea, revisarOperaciones, resumenDeCambios, CLAVE_REVERTIDO, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import { AJUSTES_COLOR, MEZCLAS, OBJETIVOS_NORMALIZAR, colorHex } from '../lib/editor-video/chat-catalogo';
import { cambiosAlElegir, cambiosDeDuracion, DURACION_MINIMA_ANIMACION } from '../app/video-editor/_opencut/animaciones/elegir';
import { ANIM } from '../app/video-editor/_opencut/params/extra/animaciones';
import { PARAMS_BASICO } from '../app/video-editor/_opencut/effects/definitions/ajuste';
import { OBJETIVOS_INTENSIDAD } from '../app/video-editor/_opencut/audio/claves';
import { MIN_RETIME_RATE, MAX_RETIME_RATE } from '../app/video-editor/_opencut/retime/rate';
import { MAX_FONT_SIZE } from '../app/video-editor/_opencut/text/typography';
import { DURACION_MINIMA as TRANSICION_MINIMA } from '../app/video-editor/_opencut/transiciones/claves';
import type { ParrafoTx } from '../app/video-editor/_opencut/transcripcion/modelo';
import { DEFAULTS_RESALTADO, PARAM_NO_DICHAS_OPACIDAD, PARAM_RESALTAR, PARAM_RESALTAR_COLOR } from '../app/video-editor/_opencut/params/extra/subtitulos';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);

/** Una escena chica: un texto arriba, dos clips en la principal, un audio y una pista bloqueada. */
function escena(): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: 'archivo.mp4', startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  return {
    overlay: [
      { id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 'text', 1, 3, { params: { content: 'Hola mundo' } })] },
      { id: 'pb', type: 'text', name: 'Bloq', hidden: false, locked: true, elements: [el('txt2', 'text', 0, 2, { params: { content: 'Fijo' } })] },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 6, { params: { volume: 0 } }), el('vid2', 'video', 6, 4)] },
    audio: [{ id: 'pa', type: 'audio', name: 'Audio', muted: false, elements: [el('aud1', 'audio', 0, 10, { params: { volume: -3 } })] }],
  } as unknown as SceneTracks;
}

const vista = (elegidos: Array<{ trackId: string; elementId: string }> = []) =>
  vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: t(2), elegidos });

// ─── El catálogo ────────────────────────────────────────────────────────────

test('1: una operación válida pasa, con los tiempos a la centésima', () => {
  const v = validarOperacion({ op: 'agregar_texto', texto: ' Oferta ', inicio: 1.234, duracion: 3 });
  assert.deepEqual(v, { ok: true, op: { op: 'agregar_texto', texto: 'Oferta', inicio: 1.23, duracion: 3 } });
});

test('2: fuera de rango se RECHAZA con su motivo, nunca se recorta', () => {
  const v = validarOperacion({ op: 'volumen', ref: 'a1', db: 40 });
  assert.equal(v.ok, false);
  const largo = validarOperacion({ op: 'agregar_texto', texto: 'x'.repeat(TOPES_CHAT.texto + 1), inicio: 0, duracion: 3 });
  assert.equal(largo.ok, false);
  const corta = validarOperacion({ op: 'duracion', ref: 't1', duracion: 0.05 });
  assert.equal(corta.ok, false);
});

test('3: lo que no está en el catálogo no existe, y una ref inventada con otra forma tampoco', () => {
  assert.equal(validarOperacion({ op: 'agregar_transicion', ref: 'v1' }).ok, false);
  assert.equal(validarOperacion({ op: 'mover', ref: 'elemento-36-caracteres', inicio: 1 }).ok, false);
  const { operaciones, descartes } = validarOperaciones([{ op: 'borrar', refs: ['v1'] }, 'basura', { op: 'efecto' }]);
  assert.equal(operaciones.length, 1);
  assert.equal(descartes.length, 2);
});

test('4: más del tope de cambios de una vez se corta y se dice', () => {
  const muchas = Array.from({ length: TOPES_CHAT.operaciones + 5 }, () => ({ op: 'silenciar', ref: 'v1', silenciado: true }));
  const { operaciones, descartes } = validarOperaciones(muchas);
  assert.equal(operaciones.length, TOPES_CHAT.operaciones);
  assert.ok(descartes.some((d) => d.includes(String(TOPES_CHAT.operaciones))));
});

test('5: los topes de volumen son los del motor (audio-constants.ts)', () => {
  const src = leer('app/video-editor/_opencut/timeline/audio-constants.ts');
  assert.match(src, new RegExp(`VOLUME_DB_MIN = ${TOPES_CHAT.volumenMinDb};`));
  assert.match(src, new RegExp(`VOLUME_DB_MAX = ${TOPES_CHAT.volumenMaxDb};`));
});

test('6: el catálogo que lee la IA nombra todas las operaciones, una por renglón, y dice lo que no se puede', () => {
  const txt = catalogoParaPrompt();
  for (const o of OPERACIONES_CHAT) assert.ok(txt.includes(`"op":"${o.op}"`), o.op);
  assert.equal(txt.split('\n').filter((l) => l.startsWith('- {')).length, OPERACIONES_CHAT.length);
  assert.match(txt, /NO SE PUEDE DESDE EL CHAT .*fotogramas clave/);
});

// ─── La vista de la línea de tiempo ─────────────────────────────────────────

test('7: cada elemento tiene una ref corta por tipo, de arriba hacia abajo, y la IA no ve un id del motor', () => {
  const v = vista();
  assert.deepEqual([...v.refs.keys()], ['t1', 't2', 'v1', 'v2', 'a1']);
  assert.ok(!v.json.includes('txt1') && !v.json.includes('vid1'), 'la vista no lleva ids del motor');
  const j = JSON.parse(v.json);
  assert.equal(j.duracion_total, 10);
  assert.equal(j.cabezal, 2);
  assert.equal(j.pistas[0].elementos[0].texto, 'Hola mundo');
  assert.equal(j.pistas[1].bloqueada, true);
  assert.equal(j.pistas[2].principal, true);
  assert.equal(j.pistas[3].elementos[0].volumen_db, -3);
});

test('8: lo elegido viaja como ref, y las refs previas se conservan aunque se agregue algo adelante', () => {
  const v = vista([{ trackId: 'pm', elementId: 'vid2' }]);
  assert.deepEqual(v.elegidos, ['v2']);
  const previas = new Map([...v.refs.values()].map((r) => [r.elementId, r.ref] as const));
  const tracks = escena();
  // Un texto nuevo ADELANTE del que ya estaba: sin refs previas sería «t1» y correría a los demás.
  (tracks.overlay[0].elements as unknown[]).unshift({ id: 'nuevo', type: 'text', name: 'n', startTime: 0, duration: t(1), trimStart: 0, trimEnd: 0, params: { content: 'Nuevo' } });
  const v2 = vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [], refsPrevias: previas });
  assert.equal(v2.refs.get('t1')?.elementId, 'txt1');
  assert.equal(v2.refs.get('v2')?.elementId, 'vid2');
  assert.ok([...v2.refs.values()].some((r) => r.elementId === 'nuevo' && !['t1', 't2'].includes(r.ref)));
});

// ─── La revisión de la propuesta ────────────────────────────────────────────

test('9: un texto nuevo es una fila «agrega» con lo que dice y cuándo', () => {
  const r = revisarOperaciones({ operaciones: [{ op: 'agregar_texto', texto: 'Oferta', inicio: 0, duracion: 3 }], vista: vista(), alcance: 'video' });
  assert.equal(r.resueltas.length, 1);
  assert.equal(r.cambios[0].tipo, 'agrega');
  assert.match(r.cambios[0].despues, /«Oferta» · de 0 s a 3 s/);
});

test('10: lo que se borra deja de existir para las operaciones que siguen', () => {
  const r = revisarOperaciones({
    operaciones: [{ op: 'borrar', refs: ['v2'] }, { op: 'silenciar', ref: 'v2', silenciado: true }],
    vista: vista(),
    alcance: 'video',
  });
  assert.equal(r.resueltas.length, 1);
  assert.match(r.descartes[0], /ya se borra/);
  assert.equal(r.cambios[0].tipo, 'quita');
});

test('11: una pista bloqueada no se toca', () => {
  const r = revisarOperaciones({ operaciones: [{ op: 'cambiar_texto', ref: 't2', texto: 'Otro' }], vista: vista(), alcance: 'video' });
  assert.equal(r.resueltas.length, 0);
  assert.match(r.descartes[0], /bloqueada/);
});

test('12: con alcance «selección», sólo lo elegido (agregar un texto, sí)', () => {
  const v = vista([{ trackId: 'pm', elementId: 'vid2' }]);
  const r = revisarOperaciones({
    operaciones: [{ op: 'silenciar', ref: 'v1', silenciado: true }, { op: 'silenciar', ref: 'v2', silenciado: true }, { op: 'agregar_texto', texto: 'X', inicio: 6, duracion: 2 }],
    vista: v,
    alcance: 'seleccion',
  });
  assert.equal(r.resueltas.length, 2);
  assert.match(r.descartes[0], /no está elegido/);
});

test('13: mover no puede pisar a otro de la misma pista; donde entra, es una fila antes/después', () => {
  const pisa = revisarOperaciones({ operaciones: [{ op: 'mover', ref: 'v2', inicio: 3 }], vista: vista(), alcance: 'video' });
  assert.equal(pisa.resueltas.length, 0);
  assert.match(pisa.descartes[0], /se pisaría/);
  const ok = revisarOperaciones({ operaciones: [{ op: 'mover', ref: 't1', inicio: 5 }], vista: vista(), alcance: 'video' });
  assert.equal(ok.resueltas.length, 1);
  assert.deepEqual([ok.cambios[0].antes, ok.cambios[0].despues], ['empieza en 1 s', 'empieza en 5 s']);
});

test('14: un corte cae adentro del elemento; después del corte la ref es la parte izquierda', () => {
  const fuera = revisarOperaciones({ operaciones: [{ op: 'dividir', ref: 'v1', en: 7 }], vista: vista(), alcance: 'video' });
  assert.equal(fuera.resueltas.length, 0);
  const dos = revisarOperaciones({ operaciones: [{ op: 'dividir', ref: 'v1', en: 4 }, { op: 'dividir', ref: 'v1', en: 5 }], vista: vista(), alcance: 'video' });
  assert.equal(dos.resueltas.length, 1, 'el segundo corte cae en la parte DERECHA, que no se puede tocar');
  assert.match(dos.descartes[0], /cae fuera/);
});

test('15: la duración de un video o un audio no se cambia desde el chat; la de un texto, sí', () => {
  const r = revisarOperaciones({ operaciones: [{ op: 'duracion', ref: 'v1', duracion: 3 }, { op: 'duracion', ref: 't1', duracion: 4.5 }], vista: vista(), alcance: 'video' });
  assert.equal(r.resueltas.length, 1);
  assert.match(r.descartes[0], /recortándolo/);
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['dura 3 s', 'dura 4,5 s']);
});

test('16: el volumen es de lo que suena; lo que no cambia nada no es una fila', () => {
  const r = revisarOperaciones({
    operaciones: [{ op: 'volumen', ref: 't1', db: -6 }, { op: 'volumen', ref: 'a1', db: -3 }, { op: 'volumen', ref: 'a1', db: -9 }],
    vista: vista(),
    alcance: 'video',
  });
  assert.equal(r.resueltas.length, 1);
  assert.match(r.descartes[0], /no tiene sonido/);
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['volumen −3 dB', 'volumen −9 dB']);
  assert.equal(resumenDeCambios(r.cambios), '1 cambia');
});

test('16b: subtitular y reemplazar en los subtítulos, desde el chat', () => {
  // Una escena con un subtítulo, para reemplazar.
  const tracks = escena();
  (tracks.overlay[0].elements[0] as unknown as { params: Record<string, unknown> }).params = { content: 'Hola mundo', subtitulo: true };
  const v = vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [] });
  assert.equal(JSON.parse(v.json).pistas[0].elementos[0].subtitulo, true, 'la IA sabe cuál es subtítulo');
  const r = revisarOperaciones({
    operaciones: [
      { op: 'reemplazar_en_subtitulos', buscar: 'MUNDO', reemplazo: 'equipo' },
      { op: 'reemplazar_en_subtitulos', buscar: 'nada que ver', reemplazo: 'x' },
      { op: 'generar_subtitulos' },
    ],
    vista: v,
    alcance: 'video',
  });
  assert.equal(r.resueltas.length, 2);
  assert.match(r.descartes[0], /no aparece en ningún subtítulo/);
  assert.deepEqual([r.cambios[0].titulo, r.cambios[0].antes, r.cambios[0].despues], ['1 subtítulo', '«MUNDO»', '«equipo»']);
  assert.equal(r.cambios[1].titulo, 'Subtítulos automáticos');
  // El texto que no es subtítulo no cuenta para el reemplazo.
  const sinSub = revisarOperaciones({ operaciones: [{ op: 'reemplazar_en_subtitulos', buscar: 'Hola', reemplazo: 'Chau' }], vista: vista(), alcance: 'video' });
  assert.equal(sinSub.resueltas.length, 0);
  // Y sin nada que suene no hay qué subtitular.
  const muda = vistaDeLinea({ tracks: { overlay: [], main: { id: 'pm', type: 'video', name: 'P', muted: false, hidden: false, elements: [] }, audio: [] } as unknown as SceneTracks, tps: TPS, cabezal: 0, elegidos: [] });
  assert.equal(revisarOperaciones({ operaciones: [{ op: 'generar_subtitulos' }], vista: muda, alcance: 'video' }).resueltas.length, 0);
  // Un reemplazo que no cambia nada no es una operación.
  assert.equal(validarOperacion({ op: 'reemplazar_en_subtitulos', buscar: 'a', reemplazo: 'a' }).ok, false);
});

// ─── Lo que no se negocia ───────────────────────────────────────────────────

test('17: el pedido sólo ARMA la propuesta: aplicar pasa únicamente por «Aceptar»', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  const pedir = src.slice(src.indexOf('async function pedirEdicion'), src.indexOf('const rotuloSeleccion'));
  assert.ok(pedir.length > 500, 'no encontré pedirEdicion');
  assert.doesNotMatch(pedir, /aceptarPropuesta|\.command\.|execute\(/, 'pedirEdicion no puede tocar la línea de tiempo');
  assert.equal((src.match(/aceptarPropuesta\(/g) ?? []).length, 1, 'aceptarPropuesta se llama en UN lugar');
  const aceptar = src.slice(src.indexOf('const aceptar = async'), src.indexOf('const restaurar'));
  assert.match(aceptar, /aceptarPropuesta\(/);
  assert.match(src, /onAceptar=\{\(\) => void aceptar\(m\)\}/);
});

test('18: aceptar guarda lo pendiente ANTES de tocar la línea de tiempo, y en UN paso de deshacer', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  const cuerpo = src.slice(src.indexOf('export async function aceptarPropuesta'), src.indexOf('export function deshacerPropuesta'));
  const guardar = cuerpo.indexOf('editor.save.flush()');
  const aplicar = cuerpo.indexOf('editor.command.execute(');
  assert.ok(guardar > 0 && aplicar > 0, 'faltan el guardado o el comando');
  assert.ok(guardar < aplicar, 'el guardado va antes del cambio');
  assert.equal((cuerpo.match(/editor\.command\.execute\(/g) ?? []).length, 1, 'un solo execute: un paso de deshacer');
  assert.match(cuerpo, /new BatchCommand\(comandos\)/);
});

test('19: el modelo es GRATIS: Gemini por defecto, sin pagoPorque, y Claude sin permiso', () => {
  const cat = leer('lib/model-catalogo.ts');
  const fila = cat.split('\n').find((l) => l.includes("feature: 'video-editor-ia'"));
  assert.ok(fila, 'falta la fila de video-editor-ia en lib/model-catalogo.ts');
  assert.match(fila!, /def: GEMINI\(\)/);
  assert.doesNotMatch(fila!, /pagoPorque|fallback:/);
  const veto = sinComentarios(leer('lib/veto-claude.ts'));
  assert.doesNotMatch(veto, /video-editor-ia/);
  assert.match(leer('lib/editor-video/ia.ts'), /FEATURE_CHAT_VIDEO = 'video-editor-ia'/);
});

test('20: las keys y los slots del prompt son los del registro editable', () => {
  const reg = leer('lib/prompt-registry.ts');
  for (const { key } of Object.values(PROMPTS_CHAT_VIDEO)) assert.ok(reg.includes(`key: '${key}'`), key);
  for (const slot of ['catalogo', 'formato']) assert.ok(CHAT_VIDEO_SYSTEM_TEMPLATE.includes(`{{${slot}}}`), slot);
  for (const slot of ['instruccion', 'alcance', 'linea']) assert.ok(CHAT_VIDEO_USER_TEMPLATE.includes(`{{${slot}}}`), slot);
  const ia = sinComentarios(leer('lib/editor-video/ia.ts'));
  assert.match(ia, /renderPrompt\(PROMPTS_CHAT_VIDEO\.system\.key, CHAT_VIDEO_SYSTEM_TEMPLATE/);
  assert.match(ia, /renderPrompt\(PROMPTS_CHAT_VIDEO\.user\.key, CHAT_VIDEO_USER_TEMPLATE/);
  assert.match(CHAT_VIDEO_SYSTEM_TEMPLATE, /PROHIBIDO INVENTAR/);
  assert.match(CHAT_VIDEO_SYSTEM_TEMPLATE, /sin voseo/);
});

test('21: la ruta pide el workspace ANTES de llamar a la IA (corre con la key del cliente)', () => {
  const src = sinComentarios(leer('app/api/video-editor/ia/route.ts'));
  assert.match(src, /veEditorVideo\(\)/);
  const ws = src.indexOf('getWorkspaceActual()');
  const ia = src.indexOf('editarVideo(');
  assert.ok(ws > 0 && ia > ws, 'el workspace va antes de la IA');
  assert.match(src, /runWithWorkspace\(p\.ws/);
});

// ─── Lo que el editor sabe hacer, también por chat (tanda del 15/10) ─────────
// «Debería aceptar cualquier pedido del usuario» (Martín). Cada operación nueva se revisa
// contra lo disponible del motor de VERDAD (chat/disponibles.ts lee los catálogos), no
// contra una lista copiada.

const DISP = disponiblesDelMotor({
  atlas: { fonts: { Montserrat: { x: 0, y: 0, w: 0, ch: 0, s: [] }, 'Bebas Neue': { x: 0, y: 0, w: 0, ch: 0, s: [] } } },
});

/** Una escena con estado: una transición en v1 y material escondido, v2 sin sonido, un subtítulo y un audio recortado. */
function escenaRica(): SceneTracks {
  const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, name: `${id}.mp4`, startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
  return {
    overlay: [
      { id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: [el('txt1', 'text', 1, 3, { params: { content: 'Oferta', fontFamily: 'Arial', fontSize: 15, color: '#ffffff', 'transform.positionY': 300 } })] },
      { id: 'ps', type: 'text', name: 'Subs', hidden: false, elements: [el('sub1', 'text', 0, 3, { params: { content: 'hola mundo', subtitulo: true } })] },
    ],
    main: {
      id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false,
      elements: [
        el('vid1', 'video', 0, 6, { mediaId: 'm1', trimStart: t(1), trimEnd: t(2), params: { volume: 0, 'transicion.id': 'mezclar', 'transicion.duracion': 0.5 } }),
        el('vid2', 'video', 6, 4, { mediaId: 'm2' }),
        el('img1', 'image', 10, 3, { mediaId: 'm3' }),
      ],
    },
    audio: [{ id: 'pa', type: 'audio', name: 'Audio', muted: false, elements: [el('aud1', 'audio', 0, 10, { trimEnd: t(3), params: { volume: -3 } })] }],
  } as unknown as SceneTracks;
}
const vistaRica = (extra: Partial<Parameters<typeof vistaDeLinea>[0]> = {}, tracks = escenaRica()) =>
  vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, lienzo: { ancho: 1080, alto: 1920 }, mediosSinAudio: new Set(['m2']), ...extra });
const revisar = (operaciones: unknown[], extra: Partial<Parameters<typeof revisarOperaciones>[0]> = {}, tracks?: SceneTracks) =>
  revisarOperaciones({ operaciones: operaciones as never, vista: vistaRica({}, tracks), alcance: 'video', ...extra });
type Params = Extract<OperacionResuelta, { op: 'params' }>;
const motivos = (r: { descartes: string[] }) => r.descartes.join(' | ');

test('22: la FORMA de las operaciones nuevas: lo que sobra o está fuera de rango se rechaza, nunca se recorta', () => {
  const v = validarOperacion;
  assert.deepEqual(v({ op: 'transicion', ref: 'v1', id: 'Ninguna' }), { ok: true, op: { op: 'transicion', ref: 'v1', id: null } });
  assert.equal(v({ op: 'animacion', ref: 't1', tipo: 'rebote', id: 'x' }).ok, false, 'tipo de animación inventado');
  assert.equal(v({ op: 'estilo_texto', ref: 't1', color: '#fff', brillo: 3 }).ok, false, 'una clave de estilo que no existe');
  assert.deepEqual(v({ op: 'estilo_texto', ref: 't1', color: '#FD0', tamano: 24.4 }), { ok: true, op: { op: 'estilo_texto', ref: 't1', estilo: { color: '#ffdd00', tamano: 24 } } });
  assert.equal(v({ op: 'transformar', ref: 't1', escala: 900 }).ok, false);
  assert.equal(v({ op: 'ajustar_color', ref: 'v1', brillo: 80 }).ok, false);
  assert.equal(v({ op: 'velocidad', ref: 'v1', x: 2, curva: 'montaje' }).ok, false);
  assert.equal(v({ op: 'velocidad', ref: 'v1', x: 0.05 }).ok, false);
  assert.equal(v({ op: 'recortar', ref: 'v1' }).ok, false);
  assert.equal(v({ op: 'cortar_frase', frase: 'hola', vez: 0 }).ok, false);
  assert.equal(v({ op: 'cortar_tramo', inicio: 5, fin: 3 }).ok, false);
  assert.equal(v({ op: 'agregar_texto', texto: 'x', inicio: 0, duracion: 2, ref: 't9' }).ok, false, 'una ref nueva es «n1», «n2»…');
  assert.equal(v({ op: 'normalizar', ref: 'a1', activo: true, objetivo: 'spotify' }).ok, false);
  assert.equal(colorHex('rojo'), null);
});

test('23: los topes y las claves copiadas son las del motor', () => {
  assert.equal(TOPES_CHAT.velocidadMin, MIN_RETIME_RATE);
  assert.equal(TOPES_CHAT.velocidadMax, MAX_RETIME_RATE);
  assert.equal(TOPES_CHAT.tamanoMax, MAX_FONT_SIZE);
  assert.equal(TOPES_CHAT.efectoMin, TRANSICION_MINIMA);
  assert.equal(TOPES_CHAT.efectoMin, DURACION_MINIMA_ANIMACION);
  assert.equal(Object.keys(AJUSTES_COLOR).length, PARAMS_BASICO.length);
  for (const [k, r] of Object.entries(AJUSTES_COLOR)) {
    const def = PARAMS_BASICO.find((p) => p.key === r.clave);
    assert.ok(def, k);
    assert.deepEqual([def!.min, def!.max], [r.min, r.max], k);
  }
  assert.deepEqual(Object.values(OBJETIVOS_NORMALIZAR).sort(), OBJETIVOS_INTENSIDAD.map((o) => o.id).sort());
  const basico = leer('app/video-editor/_opencut/components/editor/panels/properties/video/basico.tsx');
  const modos = basico.slice(basico.indexOf('const MODOS_CAPCUT'), basico.indexOf('export function SeccionMezcla'));
  for (const m of Object.values(MEZCLAS)) assert.ok(modos.includes(`valor: "${m}"`), m);
  assert.match(leer('app/video-editor/_opencut/commands/timeline/element/revertir.ts'), new RegExp(`CLAVE_ORIGEN = "${CLAVE_REVERTIDO}"`));
});

test('24: lo disponible sale de los catálogos del motor, y 300 subtítulos con su estilo entran en el tope', () => {
  assert.ok(DISP.transiciones.some((x) => x.id === 'mezclar'));
  assert.equal(DISP.animaciones.entrada.find((a) => a.id === 'maquina-escribir')?.soloTexto, true);
  assert.ok(DISP.filtros.length > 0 && DISP.filtros.every((f) => f.tipo === `filtro.${f.id}`));
  assert.equal(DISP.efectos.find((x) => x.id === 'desenfoque')?.tipo, 'blur');
  assert.ok(!DISP.curvas.some((c) => c.id === 'personalizado'));
  assert.equal(DISP.fuentes.todas.get('bebas neue'), 'Bebas Neue');
  const subs = Array.from({ length: 300 }, (_, i) => ({
    id: `s${i}`, type: 'text', name: 's', startTime: t(i), duration: t(1), trimStart: 0, trimEnd: 0,
    params: { content: `frase número ${i} del anuncio`, subtitulo: true, fontFamily: 'Montserrat', fontSize: 18, color: '#ffffff', 'trazo.activo': true, 'trazo.color': '#000000' },
  }));
  const tracks = {
    overlay: [{ id: 'ps', type: 'text', name: 'S', hidden: false, elements: subs }],
    main: { id: 'pm', type: 'video', name: 'P', muted: false, hidden: false, elements: [{ id: 'v', type: 'video', name: 'v.mp4', mediaId: 'm', startTime: 0, duration: t(300), trimStart: 0, trimEnd: 0, params: {} }] },
    audio: [],
  } as unknown as SceneTracks;
  const v = vistaDeLinea({ tracks, tps: TPS, cabezal: 0, elegidos: [], disponibles: DISP, conPalabras: true });
  // Medido el 15/10: 36,6 k de 60 k (lo disponible, 3,9 k). El catálogo del system, 9,5 k.
  assert.ok(v.json.length < TOPES_CHAT.vistaMax, `${v.json.length}`);
  const j = JSON.parse(v.json);
  assert.equal(j.estilo_subtitulos.fuente, 'Montserrat');
  assert.equal(j.transcripcion_por_palabra, true);
  assert.ok(!j.pistas[0].elementos.some((e: Record<string, unknown>) => e.estilo), 'el estilo de los subtítulos va UNA vez');
  assert.equal(j.disponibles.transiciones.mezclar, 'Mezclar');
});

test('25: la vista dice el estado que no es el de siempre (y la Y va hacia arriba, como el panel)', () => {
  const j = JSON.parse(vistaRica().json);
  const [v1, v2] = j.pistas[2].elementos;
  assert.deepEqual(v1.transicion, { id: 'mezclar', duracion: 0.5 });
  assert.deepEqual(v1.recorte, [1, 2]);
  assert.ok(!('velocidad' in v1), 'a 1× no se manda');
  assert.equal(v2.sin_audio, true);
  const t1 = j.pistas[0].elementos[0];
  assert.deepEqual(t1.posicion, [0, -300]);
  assert.equal(t1.estilo.fuente, 'Arial');
  assert.equal(j.lienzo.alto, 1920);
});

test('26: transición: en el corte con el clip pegado, con un nombre del motor y sin pasar la mitad del clip más corto', () => {
  const r = revisar([
    { op: 'transicion', ref: 'v1', id: 'fundido-negro' },
    { op: 'transicion', ref: 'v2', id: 'no-existe' },
    { op: 'transicion', ref: 'v2', id: 'mezclar', duracion: 2.5 },
    { op: 'transicion', ref: 'i1', id: 'mezclar' },
    { op: 'transicion', ref: 't1', id: 'mezclar' },
  ]);
  assert.equal(r.resueltas.length, 1);
  assert.deepEqual((r.resueltas[0] as Params).params, { 'transicion.id': 'fundido-negro', 'transicion.duracion': 0.5 }, 'cambiar conserva la duración');
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['Mezclar · 0,5 s', 'Fundido a negro · 0,5 s']);
  const m = motivos(r);
  assert.match(m, /no existe la transición «no-existe»/);
  assert.match(m, /dura como mucho 1,5 s/);
  assert.match(m, /pegado a su derecha/);
  assert.match(m, /las transiciones van entre clips/);
});

test('27: animación: la regla del panel (el combinado saca la entrada), el tipo según el elemento y su largo', () => {
  const r = revisar([
    { op: 'animacion', ref: 'v1', tipo: 'entrada', id: 'rebote' },
    { op: 'animacion', ref: 'v1', tipo: 'combinado', id: 'pulso' },
    { op: 'animacion', ref: 'v2', tipo: 'bucle', id: 'pulso' },
    { op: 'animacion', ref: 'v2', tipo: 'entrada', id: 'maquina-escribir' },
    { op: 'animacion', ref: 't1', tipo: 'salida', id: 'caida', duracion: 5 },
    { op: 'animacion', ref: 't1', tipo: 'entrada', id: 'maquina-escribir' },
  ]);
  assert.equal(r.resueltas.length, 3);
  const combo = (r.resueltas[1] as Params).params;
  assert.equal(combo['anim.entrada.id'], 'ninguno');
  assert.equal(combo['anim.combo.duracion'], 6, 'el combinado ocupa el clip entero');
  assert.deepEqual([r.cambios[1].antes, r.cambios[1].despues], ['entrada Rebote 0,5 s', 'combinado Pulso 6 s']);
  const m = motivos(r);
  assert.match(m, /no lleva animación de bucle/);
  assert.match(m, /sólo para textos/);
  assert.match(m, /dura como mucho 3 s/);
});

test('28: filtro (uno por clip), efectos (se suman) y capas nuevas con ref para seguir operando', () => {
  const r = revisar([
    { op: 'filtro', ref: 'v1', id: 'calido', intensidad: 80 },
    { op: 'filtro', ref: 'v1', id: 'cine' },
    { op: 'filtro', ref: 'v2', id: 'no-existe' },
    { op: 'efecto', ref: 'v2', id: 'glitch' },
    { op: 'efecto', ref: 'v2', id: 'sacudida', quitar: true },
    { op: 'capa_efecto', tipo: 'efecto', id: 'destello', inicio: 2, duracion: 3, ref: 'n1' },
    { op: 'duracion', ref: 'n1', duracion: 5 },
    { op: 'capa_efecto', tipo: 'filtro', id: 'glitch', inicio: 0, duracion: 2 },
  ]);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['filtro', 'filtro', 'efecto', 'capa_efecto', 'duracion']);
  assert.deepEqual([r.cambios[1].antes, r.cambios[1].despues], ['filtro Cálido 80 %', 'filtro Cine 100 %'], 'el nuevo reemplaza al anterior');
  assert.equal((r.resueltas[3] as Extract<OperacionResuelta, { op: 'capa_efecto' }>).tipo, 'efecto.destello');
  const m = motivos(r);
  assert.match(m, /no existe el filtro «no-existe»/);
  assert.match(m, /no tiene el efecto «sacudida»/);
  assert.match(m, /no existe el filtro «glitch»/);
});

test('29: ajustar el color va con las claves del efecto «ajuste», y con ◇ no se toca', () => {
  const r = revisar([{ op: 'ajustar_color', ref: 'v1', valores: { brillo: 10, tinte: -5 } }, { op: 'ajustar_color', ref: 't1', valores: { brillo: 10 } }]);
  assert.equal(r.resueltas.length, 1);
  assert.deepEqual((r.resueltas[0] as Extract<OperacionResuelta, { op: 'ajustar_color' }>).valores, { brillo: 10, matiz: -5 });
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['brillo 0 · tinte 0', 'brillo 10 · tinte -5']);
  const tracks = escenaRica();
  (tracks.main.elements[0] as unknown as Record<string, unknown>).animations = { 'effects.aj.params.brillo': { keys: [{ id: 'k', time: 0, value: 5 }] } };
  const conRombo = revisar([{ op: 'ajustar_color', ref: 'v1', valores: { brillo: 10 } }], {}, tracks);
  assert.equal(conRombo.resueltas.length, 0);
  assert.match(conRombo.descartes[0], /fotogramas clave/);
});

test('30: velocidad: el clip se estira y lo que sigue se corre (como CambiarVelocidadCommand)', () => {
  const r = revisar([
    { op: 'velocidad', ref: 'v1', x: 0.5 },
    { op: 'dividir', ref: 'v2', en: 13 },
    { op: 'velocidad', ref: 'a1', curva: 'montaje' },
    { op: 'velocidad', ref: 'v2', curva: 'no-existe' },
  ]);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['velocidad', 'dividir'], 'v2 ahora va de 12 a 16: el corte en 13 cae adentro');
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['1× · dura 6 s', '0,5× · dura 12 s']);
  assert.match(motivos(r), /sólo para videos/);
  assert.match(motivos(r), /no existe la curva de velocidad/);
});

test('31: recortar: como arrastrar el borde, y un video o un audio no se alargan más allá de su material', () => {
  const r = revisar([
    { op: 'recortar', ref: 'v1', inicio: 0.5 },
    { op: 'recortar', ref: 't1', inicio: 0.5 },
    { op: 'recortar', ref: 'a1', fin: 12 },
    { op: 'recortar', ref: 'a1', fin: 14 },
    { op: 'recortar', ref: 'v2', fin: 12 },
  ]);
  assert.equal(r.resueltas.length, 3);
  assert.match(r.cambios[0].despues, /de 0,5 s a 6 s · lo que sigue se corre si el imán está prendido/);
  assert.match(motivos(r), /no tiene más material después: puede terminar hasta 13 s/);
  assert.match(motivos(r), /vid2\.mp4 no tiene más material después/);
});

test('32: estilo de texto: los params del panel, la fuente de la lista, y en un subtítulo sólo lo que no lo vuelve a partir', () => {
  const r = revisar([
    { op: 'estilo_texto', ref: 't1', estilo: { color: '#ffd400', tamano: 24, negrita: true, trazo: '#000000', fuente: 'montserrat' } },
    { op: 'estilo_texto', ref: 't2', estilo: { tamano: 30 } },
    { op: 'estilo_texto', ref: 't2', estilo: { color: '#ffd400' } },
    { op: 'estilo_texto', ref: 't1', estilo: { fuente: 'Comic Neue Ultra' } },
    { op: 'estilo_texto', ref: 'v1', estilo: { color: '#ffffff' } },
  ]);
  assert.equal(r.resueltas.length, 2);
  assert.deepEqual((r.resueltas[0] as Params).params, { fontFamily: 'Montserrat', fontSize: 24, color: '#ffd400', fontWeight: 'bold', 'trazo.activo': true, 'trazo.color': '#000000' });
  assert.match(r.cambios[0].antes, /color #ffffff/);
  assert.match(r.cambios[0].despues, /fuente Montserrat/);
  const m = motivos(r);
  assert.match(m, /subtítulo se cambian en el panel Texto/);
  assert.match(m, /no encontré la fuente «Comic Neue Ultra»/);
  assert.match(m, /no es un texto/);
});

test('33: transformar: Y hacia arriba, la escala conserva la proporción, y lo que tiene ◇ no se toca', () => {
  const tracks = escenaRica();
  const txt = tracks.overlay[0].elements[0] as unknown as { params: Record<string, unknown>; animations?: unknown };
  txt.params['transform.scaleY'] = 2;
  const r = revisar([{ op: 'transformar', ref: 't1', cambios: { y: 600, escala: 150, opacidad: 80 } }, { op: 'transformar', ref: 'a1', cambios: { x: 10 } }], {}, tracks);
  assert.equal(r.resueltas.length, 1);
  assert.deepEqual((r.resueltas[0] as Params).params, { 'transform.positionY': -600, 'transform.scaleX': 1.5, 'transform.scaleY': 3, opacity: 0.8 });
  assert.deepEqual([r.cambios[0].antes, r.cambios[0].despues], ['y -300 · escala 100 % · opacidad 100 %', 'y 600 · escala 150 % · opacidad 80 %']);
  txt.animations = { 'transform.positionX': { keys: [{ id: 'k', time: 0, value: 1 }] } };
  const conRombo = revisar([{ op: 'transformar', ref: 't1', cambios: { x: 10 } }], {}, tracks);
  assert.match(conRombo.descartes[0], /fotogramas clave en «posicion»/);
});

test('34: audio y operaciones de clip; lo que tarda (normalizar, revertir, congelar) va al final, en orden', () => {
  const r = revisar([
    { op: 'normalizar', ref: 'a1', activo: true, objetivo: 'youtube' },
    { op: 'fundido', ref: 'a1', entrada: 1, salida: 2 },
    { op: 'fundido', ref: 'v2', entrada: 3, salida: 2 },
    { op: 'separar_audio', ref: 'v2', separado: true },
    { op: 'separar_audio', ref: 'v1', separado: true },
    { op: 'reducir_ruido', ref: 'a1', activo: true },
    { op: 'reflejar', ref: 'v1', horizontal: true },
    { op: 'revertir', ref: 'v1', revertido: true },
    { op: 'congelar', ref: 'v2', en: 7 },
  ]);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['params', 'separar_audio', 'params', 'params', 'normalizar', 'revertir', 'congelar']);
  assert.equal((r.resueltas[4] as Extract<OperacionResuelta, { op: 'normalizar' }>).objetivo, '-14');
  assert.equal((r.resueltas[6] as Extract<OperacionResuelta, { op: 'congelar' }>).desde, 1, 'el segundo, contado desde el principio del clip');
  assert.deepEqual((r.resueltas[3] as Params).params, { 'reflejo.horizontal': true });
  const m = motivos(r);
  assert.match(m, /suman más que su largo/);
  assert.match(m, /vid2\.mp4 no tiene sonido/);
});

test('35: cortar por frase, por tramo y las muletillas: al final, con la transcripción, y lo que no se puede se dice', () => {
  const p = (id: string, texto: string, inicio: number, fin: number, muletilla = false) => ({ id, elementId: id.split('#')[0], texto, inicio, fin, muletilla });
  const parrafos: ParrafoTx[] = [
    { elementId: 'sub1', trackId: 'ps', inicio: 0, fin: 3, texto: 'Hola, mundo', bloqueado: false, palabras: [p('sub1#0', 'Hola,', 0, 0.5), p('sub1#1', 'eh', 0.6, 0.8, true), p('sub1#2', 'mundo', 0.9, 1.4)] },
    { elementId: 'sub2', trackId: 'ps', inicio: 4, fin: 6, texto: 'hola mundo otra vez', bloqueado: false, palabras: [p('sub2#0', 'hola', 4, 4.4), p('sub2#1', 'mundo', 4.5, 5), p('sub2#2', 'otra', 5.1, 5.4), p('sub2#3', 'vez', 5.5, 5.9)] },
  ];
  const tx = { transcripcion: { parrafos, idioma: 'es' } };
  const r = revisar([
    { op: 'cortar_frase', frase: 'hola mundo' },
    { op: 'cortar_frase', frase: 'hola mundo', vez: 3 },
    { op: 'cortar_frase', frase: 'adiós' },
    { op: 'eliminar_muletillas' },
    { op: 'silenciar', ref: 'v1', silenciado: true },
  ], tx);
  assert.deepEqual(r.resueltas.map((x) => x.op), ['silenciar', 'cortar_frase', 'eliminar_muletillas'], 'los cortes van después de lo demás');
  assert.equal(r.cambios[1].antes, 'se dice 2 veces: en 0 s, 4 s');
  assert.equal(r.cambios[2].titulo, '1 muletilla');
  assert.match(motivos(r), /se dice 2 veces, no 3/);
  assert.match(motivos(r), /no se dice «adiós»/);
  // Sin tiempos por palabra lo dice, y si se subtitula en el mismo pedido, también.
  assert.match(revisar([{ op: 'eliminar_muletillas' }]).descartes[0], /genera primero los subtítulos/);
  assert.match(revisar([{ op: 'generar_subtitulos' }, { op: 'cortar_frase', frase: 'hola' }]).descartes[0], /todavía no existen/);
  // Un tramo: con video debajo, y nunca junto con algo que mueva la principal.
  assert.equal(revisar([{ op: 'cortar_tramo', inicio: 2, fin: 3 }]).resueltas.length, 1);
  const conBorrar = revisar([{ op: 'borrar', refs: ['v2'] }, { op: 'cortar_tramo', inicio: 2, fin: 3 }]);
  assert.deepEqual(conBorrar.resueltas.map((x) => x.op), ['borrar']);
  assert.match(conBorrar.descartes[0], /pedido aparte/);
  assert.match(revisar([{ op: 'cortar_tramo', inicio: 20, fin: 25 }]).descartes[0], /no hay video en la pista principal/);
  // Congelar y cortar en el mismo pedido: congelar va aparte (los cortes corren el video).
  const cong = revisar([{ op: 'congelar', ref: 'v2', en: 7 }, { op: 'cortar_frase', frase: 'hola mundo' }], tx);
  assert.deepEqual(cong.resueltas.map((x) => x.op), ['cortar_frase']);
  assert.match(cong.descartes[0], /congelar .* pedido aparte/);
});

test('36: lo que se agrega con una ref nueva se puede seguir editando en el mismo pedido (también con alcance «selección»)', () => {
  const r = revisarOperaciones({
    operaciones: [
      { op: 'agregar_texto', texto: 'Oferta', inicio: 0, duracion: 3, ref: 'n1' },
      { op: 'estilo_texto', ref: 'n1', estilo: { color: '#ffd400' } },
      { op: 'transformar', ref: 'n1', cambios: { y: 700 } },
      { op: 'animacion', ref: 'n1', tipo: 'entrada', id: 'rebote' },
      { op: 'agregar_texto', texto: 'Otra', inicio: 0, duracion: 3, ref: 'n1' },
    ],
    vista: vistaRica({ elegidos: [{ trackId: 'pm', elementId: 'vid2' }] }),
    alcance: 'seleccion',
  });
  assert.equal(r.resueltas.length, 4);
  assert.equal((r.resueltas[1] as Params).el.nuevo, true);
  assert.match(r.descartes[0], /la ref «n1» ya existe/);
});

test('37: cada operación usa el comando del BOTÓN, y la regla de elegir animación es una sola', () => {
  const com = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  for (const pieza of [
    'new CambiarVelocidadCommand(', 'computeGroupResize(', 'buildResizeMembers(', 'new AddClipEffectCommand(', 'new RemoveClipEffectCommand(',
    'new CortarTramosCommand(', 'origenEfecto(', 'new ToggleSourceAudioSeparationCommand(', 'buildEffectElement(', 'new ReemplazarSubtitulosCommand(',
  ]) assert.ok(com.includes(pieza), pieza);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/animaciones/components/pestana-animacion.tsx')), /cambiosAlElegir\(clip, categoria, id\)/);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/chat/linea.ts')), /cambiosAlElegir\(clip, categoria/);
  const apl = sinComentarios(leer('app/video-editor/_opencut/chat/aplicar.ts'));
  assert.ok(apl.indexOf('new BatchCommand(comandos)') < apl.indexOf('await correrLarga('), 'lo que tarda va después del lote');
  assert.match(apl, /revertirClip\(editor, objetivo\)/);
  assert.match(apl, /congelarCuadro\(editor, \{/);
});

test('38: la regla de elegir animación (animaciones/elegir.ts) es la del panel', () => {
  const clip = { valores: { 'anim.entrada.id': 'rebote', 'anim.entrada.duracion': 0.5, 'anim.salida.id': 'caida', 'anim.salida.duracion': 0.5 }, tipo: 'video' as const, D: 3 };
  assert.deepEqual(cambiosAlElegir(clip, 'combo', 'pulso'), { [ANIM.combo.id]: 'pulso', [ANIM.combo.duracion]: 3, [ANIM.entrada.id]: 'ninguno', [ANIM.salida.id]: 'ninguno' });
  assert.deepEqual(cambiosDeDuracion(clip, 'entrada', 2.8), { [ANIM.entrada.duracion]: 2.8, [ANIM.salida.duracion]: 0.2 }, 'la que se toca manda y la otra se acorta');
  assert.deepEqual(cambiosAlElegir({ valores: {}, tipo: 'text', D: 3 }, 'entrada', 'rebote'), { [ANIM.entrada.id]: 'rebote', [ANIM.entrada.duracion]: 0.5 });
});

test('39: resaltar las palabras (karaoke): a todos los subtítulos con los params del panel, lo que ya está así no cambia, y sin tiempos se dice', () => {
  const v = validarOperacion;
  assert.deepEqual(v({ op: 'resaltar_palabras', modo: 'frase', color: 'FD0' }), { ok: true, op: { op: 'resaltar_palabras', modo: 'frase', color: '#ffdd00' } });
  assert.equal(v({ op: 'resaltar_palabras', modo: 'karaoke' }).ok, false, 'modo inventado');
  assert.equal(v({ op: 'resaltar_palabras', modo: 'palabra', opacidad_no_dichas: 140 }).ok, false, 'opacidad fuera de rango');
  assert.equal(v({ op: 'resaltar_palabras', modo: 'palabra', tamano: 2 }).ok, false, 'clave inventada');
  const palabra = (n: number, texto: string, inicio: number, fin: number) => ({ id: `sub1#${n}`, elementId: 'sub1', texto, inicio, fin, muletilla: false });
  const parrafos: ParrafoTx[] = [{ elementId: 'sub1', trackId: 'ps', inicio: 0, fin: 3, texto: 'hola mundo', bloqueado: false, palabras: [palabra(0, 'hola', 0, 0.5), palabra(1, 'mundo', 0.6, 1)] }];
  const tx = { transcripcion: { parrafos, idioma: 'es' } };
  const r = revisar([{ op: 'resaltar_palabras', modo: 'palabra', opacidad_no_dichas: 35 }], tx);
  const [p] = r.resueltas as Params[];
  assert.equal(p.op, 'params');
  assert.equal(p.el.elementId, 'sub1', 'sólo los subtítulos, no el texto «Oferta»');
  assert.deepEqual(p.params, { [PARAM_RESALTAR]: 'palabra', [PARAM_RESALTAR_COLOR]: DEFAULTS_RESALTADO.color, [PARAM_NO_DICHAS_OPACIDAD]: 35 });
  assert.equal(r.cambios[0].antes, 'sin resaltar');
  assert.match(r.cambios[0].despues, /la palabra que se dice .* al 35 %/);
  // Ya resaltado: la IA lo ve en «estilo_subtitulos», y pedir lo mismo no es un cambio.
  const tracks = escenaRica();
  (tracks.overlay[1].elements[0] as unknown as { params: Record<string, unknown> }).params = {
    content: 'hola mundo', subtitulo: true, [PARAM_RESALTAR]: 'palabra', [PARAM_RESALTAR_COLOR]: DEFAULTS_RESALTADO.color, [PARAM_NO_DICHAS_OPACIDAD]: 35,
  };
  assert.match(vistaRica({}, tracks).json, /"resaltar":\{"modo":"palabra"/);
  assert.equal(revisar([{ op: 'resaltar_palabras', modo: 'palabra' }], tx, tracks).resueltas.length, 0);
  // Sin tiempos por palabra lo dice (apagarlo, en cambio, no los necesita).
  assert.match(revisar([{ op: 'resaltar_palabras', modo: 'frase' }]).descartes[0], /tiempo de cada palabra/);
  assert.equal(revisar([{ op: 'resaltar_palabras', modo: 'ninguno' }], {}, tracks).resueltas.length, 1);
  assert.doesNotMatch(catalogoParaPrompt(), /resaltar palabras de los subtítulos \(karaoke\)/, 'ya no figura entre lo que no se puede');
});

test('40: recortar y dividir van RELATIVOS a dónde está el clip al aplicarse, y rehacer vuelve a armar el comando', () => {
  // Con el imán, recortar un clip corre los que siguen: en segundos absolutos de la vista,
  // «recorta 2 s al inicio de cada clip» recortaba 2, 4 y 8 s (revisión del 15/10).
  const r = revisar([
    { op: 'recortar', ref: 'v1', inicio: 0.5 },
    { op: 'recortar', ref: 'v2', inicio: 7 },
    { op: 'dividir', ref: 'v1', en: 3 },
  ]);
  const bases = (r.resueltas as Array<Extract<OperacionResuelta, { op: 'recortar' | 'dividir' }>>).map((x) => x.base);
  assert.deepEqual(bases, [0, 6, 0.5], 'dividir v1 después de recortarlo: en la simulación ya empieza en 0,5');
  const fuente = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  assert.match(fuente, /splitTime: segundos\(r\.en \+ corrimiento\(actual, r\.base\)\)/);
  assert.match(fuente, /const s = pedido \+ corrimiento\(actual, r\.base\)/);
  // Al rehacer, lo nuevo del lote vuelve en otra pista: `Diferido` se arma de nuevo.
  assert.match(fuente, /redo\(\): CommandResult \| undefined \{\s*return this\.execute\(\);/);
});

test('41: lo que el corte por texto no puede acompañar va aparte, y nada toca los subtítulos de una pista bloqueada', () => {
  const p = (id: string, texto: string, inicio: number, fin: number, muletilla = false) => ({ id, elementId: id.split('#')[0], texto, inicio, fin, muletilla });
  const parrafos: ParrafoTx[] = [
    { elementId: 'sub1', trackId: 'ps', inicio: 0, fin: 3, texto: 'hola mundo', bloqueado: false, palabras: [p('sub1#0', 'hola', 0, 0.5), p('sub1#1', 'eh', 0.6, 0.8, true), p('sub1#2', 'mundo', 0.9, 1.4)] },
  ];
  const tx = { transcripcion: { parrafos, idioma: 'es' } };
  // Un recorte de la principal corre el video y los subtítulos se quedan: el corte por texto va aparte.
  const conRecorte = revisar([{ op: 'recortar', ref: 'v2', inicio: 7 }, { op: 'cortar_frase', frase: 'hola mundo' }], tx);
  assert.deepEqual(conRecorte.resueltas.map((x) => x.op), ['recortar']);
  assert.match(motivos(conRecorte), /pedido aparte: los otros cambios corren el video de la pista principal/);
  // Un recorte de un audio que no es de la principal, no.
  assert.deepEqual(revisar([{ op: 'recortar', ref: 'a1', fin: 5 }, { op: 'eliminar_muletillas' }], tx).resueltas.map((x) => x.op), ['recortar', 'eliminar_muletillas']);
  // Normalizar o revertir un clip que los cortes parten: sólo se procesaría el primer pedazo.
  const largas = revisar([{ op: 'normalizar', ref: 'v1', activo: true }, { op: 'revertir', ref: 'v1', revertido: true }, { op: 'normalizar', ref: 'a1', activo: true }, { op: 'eliminar_muletillas' }], tx);
  assert.deepEqual(largas.resueltas.map((x) => x.op), ['eliminar_muletillas', 'normalizar']);
  assert.match(motivos(largas), /normalizar vid1\.mp4 va en un pedido aparte: los cortes parten el clip/);
  assert.match(motivos(largas), /revertir vid1\.mp4 va en un pedido aparte/);
  // Un subtítulo de una pista bloqueada no cuenta para cortar.
  const bloqueado = { transcripcion: { parrafos: parrafos.map((x) => ({ ...x, bloqueado: true })), idioma: 'es' } };
  assert.equal(revisar([{ op: 'cortar_frase', frase: 'hola mundo' }], bloqueado).resueltas.length, 0);
  // Las mayúsculas cambian el ancho: en un subtítulo, como la fuente, van por el panel.
  const may = revisar([{ op: 'estilo_texto', ref: 't2', estilo: { mayusculas: 'mayusculas' } }]);
  assert.equal(may.resueltas.length, 0);
  assert.match(motivos(may), /subtítulo se cambian en el panel Texto/);
});

test('42: el chat cumple las reglas del botón y del panel: borrar con lo vinculado, y el texto de un subtítulo con sus tiempos', () => {
  // Una regla, un lugar (AGENTS.md → «Una regla que vive en un COMPONENTE no la cumple otra entrada»).
  const comandos = sinComentarios(leer('app/video-editor/_opencut/chat/comandos.ts'));
  assert.ok(comandos.includes('conLoVinculado({ tracks, refs: elements })'), 'el borrar del chat, como el botón');
  assert.ok(comandos.includes('paramsConTexto(EditorCore.getInstance(), actual, r.texto)'), 'cambiar_texto de un subtítulo, como el panel');
  assert.ok(sinComentarios(leer('app/video-editor/_opencut/actions/use-editor-actions.ts')).includes('conLoVinculado({ tracks, refs: aBorrar })'));
  assert.ok(sinComentarios(leer('app/video-editor/_opencut/subtitles/components/pestana-subtitulos.tsx')).includes('paramsConTexto(editor, element, texto)'));
  assert.match(revisar([{ op: 'borrar', refs: ['v2'] }]).cambios[0].antes, /lo que tiene encima/);
});

// Roturas (15/10/2026), cada una sola y restaurada desde memoria; base 21 de 21:
// · lo borrado sigue vivo para las que siguen          → 1 fallo (10)
// · la pista bloqueada se toca                         → 1 fallo (11)
// · el alcance «selección» no filtra                   → 1 fallo (12)
// · mover sin mirar si pisa                            → 1 fallo (13)
// · el corte no corre el fin de la parte izquierda     → 1 fallo (14)
// · la ref es el id del motor                          → 9 fallos (7, 8, 10-16)
// · el volumen fuera de rango se acepta                → 1 fallo (2)
// · guardar DESPUÉS de aplicar (sin el flush)          → 1 fallo (18)
// · el pedido toca la línea de tiempo por su cuenta    → 1 fallo (17)
// · `fallback: []` en la fila del modelo               → 1 fallo (19)
// · la IA antes de pedir el workspace                  → 1 fallo (21)
//
// Tanda del 15/10 (operaciones nuevas), con un script que rompe, corre y restaura de a una;
// base 39 de 39 → con la rotura (pasan/fallan):
// · R1 transición sin el tope de la mitad del clip        → 38/1 (26)
// · R2 transición con un nombre que el motor no tiene     → 38/1 (26)
// · R3 animación sin la regla del panel                   → 38/1 (27)
// · R4 el combinado no saca la entrada (elegir.ts)        → 37/2 (27, 38)
// · R5 la velocidad no corre lo que sigue                 → 38/1 (30)
// · R6 recortar alarga más allá del material              → 38/1 (31)
// · R7 el subtítulo cambia de tamaño desde el chat        → 38/1 (32)
// · R8 la Y no se invierte al escribir                    → 38/1 (33)
// · R9 normalizar no espera al final                      → 38/1 (34)
// · R10 cortar_tramo junto con un borrado de la principal → 38/1 (35)
// · R11 el estilo de cada subtítulo, repetido             → 38/1 (24)
// · R12 una clave de estilo inventada se ignora           → 38/1 (22)
// · R13 lo que tiene fotogramas clave se toca igual       → 37/2 (29, 33)
// · R14 una ref nueva repetida se acepta                  → 38/1 (36)
// · R15 la velocidad sin CambiarVelocidadCommand          → 38/1 (37)
// · R16 la pestaña Animación con su propia regla          → 38/1 (37)
// · R17 el desenfoque de OpenCut con su id en inglés      → 38/1 (24)
// · R18 los cortes antes que lo demás                     → 38/1 (35)
// Restaurado: 39/0.
//
// «resaltar_palabras» (karaoke, test 39, 15/10), base 40 de 40:
// · R19 pedir lo mismo cuenta como cambio · R20 sin tiempos por palabra se acepta igual
// · R21 la vista no muestra el resaltado actual · R22 un modo inventado se acepta
// · R23 resalta también los textos que no son subtítulos · R24 sigue en «no se puede»
// → cada una 39/1 (39). Restaurado: 40/0.
//
// Los arreglos de la revisión adversarial (tests 40 y 41, 15/10), base 42 de 42:
// · R25 recortar sin la base · R26 dividir en segundos absolutos · R27 Diferido rehace el
//   comando viejo → cada una 41/1 (40).
// · R28 el corte por texto va con un recorte de la principal · R29 normalizar el clip que se
//   corta · R30 los subtítulos bloqueados cuentan · R31 mayúsculas en un subtítulo se aceptan
//   → cada una 41/1 (41). Restaurado: 42/0.
// · R32 el borrar del chat sin lo vinculado · R33 cambiar_texto de un subtítulo sin la regla del
//   panel · R34 la fila de borrar no avisa lo vinculado → cada una 42/1 (42). Restaurado: 43/0.
//
// Lo que NO cubre: que los comandos del motor hagan en pantalla lo que dice la fila
// (chat/comandos.ts, chat/aplicar.ts). Eso se mira en el navegador
// (docs/hallazgos-video-editor.md → «La API de MaKo y el chat»), y no se miró.
