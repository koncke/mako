// =============================================================================
// El chat del Video Editor: lo que la IA puede pedir, cómo se revisa y lo que no se negocia
// =============================================================================
// Pedido de Martín (15/10/2026): un chat al costado para editar el video con prompt, como el
// del Landing. Acá se prueba la parte pura (catálogo, vista de la línea de tiempo, revisión de
// la propuesta) y se fijan leyendo el fuente las reglas que no se negocian:
//   · nada se aplica sin «Aceptar» (el pedido sólo arma la propuesta);
//   · aceptar guarda lo pendiente ANTES de tocar la línea de tiempo;
//   · el modelo es GRATIS (Gemini del cliente) y Claude no tiene permiso;
//   · las keys y los slots del prompt coinciden con el registro editable.
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPES_CHAT, validarOperacion, validarOperaciones, catalogoParaPrompt, OPERACIONES_CHAT } from '../lib/editor-video/chat-catalogo';
import { CHAT_VIDEO_SYSTEM_TEMPLATE, CHAT_VIDEO_USER_TEMPLATE, PROMPTS_CHAT_VIDEO } from '../lib/editor-video/chat-prompts';
import { vistaDeLinea, revisarOperaciones, resumenDeCambios } from '../app/video-editor/_opencut/chat/linea';
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

test('6: el catálogo que lee la IA nombra todas las operaciones, una por renglón', () => {
  const txt = catalogoParaPrompt();
  for (const o of OPERACIONES_CHAT) assert.ok(txt.includes(`"op":"${o.op}"`), o.op);
  assert.equal(txt.split('\n').length, OPERACIONES_CHAT.length);
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
// Lo que NO cubre: que los comandos del motor hagan en pantalla lo que dice la fila. Eso se
// mira en el navegador (docs/hallazgos-video-editor.md → «La API de MaKo y el chat»).
