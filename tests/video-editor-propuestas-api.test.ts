// =============================================================================
// Las operaciones del chat «Editar con IA», en la API de MaKo: PROPONEN y se aceptan en el editor (16/10/2026)
// =============================================================================
// Etapa 3 del diseño AI-native: «las 32 operaciones del chat de Video Editor pasan a la API» (hoy 34). Fija:
//   · una acción por operación del chat, con su descripción sacada del MISMO `para` que lee la IA del chat, todas de
//     pantalla (proponen, nunca ejecutan), gratis y con la tab del editor;
//   · que lo declarado cubre al chat: el ejemplo de cada operación del catálogo pasa `validarInput` (que deja pasar SÓLO
//     lo declarado) y vuelve a la forma del chat validado por la MISMA `validarOperacion`;
//   · la revisión contra la copia del proyecto (refs que no existen, «n1» de la misma propuesta, la plantilla sola y con
//     la línea de tiempo vacía, el tope) y el proyecto por NOMBRE (en WhatsApp la lista puede no entrar al turno);
//   · el presupuesto del doer de WhatsApp: en un pedido de edición entra lo que hace falta, y en una pregunta las
//     lecturas del Video Generator siguen enteras;
//   · el cableado: el runner, la base (compare-and-set, sólo lo abierto), la ruta, la migración y el editor.
//
// PROBADO ROMPIÉNDOLO: ver el final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPERACIONES_CHAT, type OperacionChat } from '../lib/editor-video/chat-catalogo';
import { OPERACIONES_API, PARAM_PROYECTO, descripcionApi, operacionDesdeInput, type OperacionApi } from '../lib/editor-video/chat-api';
import { TOPE_OPERACIONES, leerVista, lineaDeOperacion, revisarContraCopia } from '../lib/editor-video/propuestas';
import { elegirProyecto, type FilaEspejo } from '../lib/editor-video/espejo';
import { validarInput } from '../lib/api-mako/validar';
import { porId, toolsDelRegistro } from '../lib/api-mako/registro';
import { PRESUPUESTO_REGISTRO_CHARS } from '../lib/doer-herramientas';
import { hiloParaGuardar } from '../lib/editor-video/chat-hilo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

/** El ejemplo del catálogo (`forma`) como entrada de la API: sin «op», con el proyecto, y la plantilla en listas. */
function entradaDeEjemplo(o: OperacionApi): Record<string, unknown> {
  const forma = JSON.parse(OPERACIONES_CHAT.find((x) => x.op === o.op)!.forma) as Record<string, unknown>;
  const { op: _op, ...campos } = forma;
  if (o.op === 'usar_plantilla') {
    campos.textos = Object.entries((campos.textos ?? {}) as Record<string, string>).map(([hueco, texto]) => ({ hueco, texto }));
    campos.clips = Object.entries((campos.clips ?? {}) as Record<string, string>).map(([hueco, medio]) => ({ hueco, medio }));
  }
  // «…» es el hueco de los ejemplos: un texto de verdad, distinto por campo (un reemplazo igual a lo buscado no cambia nada).
  for (const [k, v] of Object.entries(campos)) if (v === '…') campos[k] = `Hola ${k}`;
  if (Array.isArray(campos.textos)) campos.textos = (campos.textos as Array<{ hueco: string; texto: string }>).map((t) => ({ ...t, texto: t.texto === '…' ? 'Lo recomiendo' : t.texto }));
  return { proyecto: 'p-1', ...campos };
}

const vista = (elementos: Array<{ ref: string; texto?: string; nombre?: string }>, medios: string[] = []) =>
  leerVista({ pistas: [{ tipo: 'video', principal: true, elementos }], medios: medios.map((ref) => ({ ref, nombre: `archivo ${ref}` })) });
const OP_TEXTO: OperacionChat = { op: 'cambiar_texto', ref: 't1', texto: 'Hola' };

// ── Una acción por operación del chat ────────────────────────────────────────

test('1: cada operación del chat tiene UNA acción en la API, de pantalla, gratis y con la tab del editor', () => {
  assert.deepEqual(OPERACIONES_API.map((o) => o.op).sort(), OPERACIONES_CHAT.map((o) => o.op).sort(), 'ni una de más ni una de menos');
  assert.equal(new Set(OPERACIONES_API.map((o) => o.id)).size, OPERACIONES_API.length);
  for (const o of OPERACIONES_API) {
    const d = porId(o.id);
    assert.ok(d, `${o.id} no está en el registro`);
    assert.equal(d!.area, 'video');
    assert.equal(d!.tipo, 'accion');
    assert.ok(d!.tipo === 'accion' && d!.confirmacion === 'pantalla' && d!.pantalla === '/video-editor', `${o.id}: propone y se acepta en el editor`);
    assert.equal(d!.costo, 'gratis');
    assert.deepEqual(d!.gating, { tab: 'video-editor' });
    assert.equal(d!.parametros[0], PARAM_PROYECTO, `${o.id}: el proyecto, primero`);
    const para = OPERACIONES_CHAT.find((x) => x.op === o.op)!.para;
    if (o.op !== 'usar_plantilla') assert.ok(d!.descripcion.includes(para), `${o.id}: la descripción es el MISMO «para» del chat`);
    assert.match(descripcionApi(o), /PROPONE/);
  }
});

test('2: lo declarado cubre al chat: el ejemplo de cada operación pasa la validación de la API y vuelve a la forma del chat', () => {
  for (const o of OPERACIONES_API) {
    const def = porId(o.id)!;
    const v = validarInput(def.parametros, entradaDeEjemplo(o), 'json');
    assert.ok('input' in v, `${o.id}: ${'error' in v ? v.error : ''}`);
    const r = operacionDesdeInput(o, (v as { input: Record<string, unknown> }).input);
    assert.ok(r.ok, `${o.id}: ${!r.ok ? r.motivo : ''}`);
    assert.equal(r.ok && r.op.op, o.op);
    // Ningún campo del ejemplo quedó afuera: SOLO PASA LO DECLARADO, así que uno sin declarar se perdería.
    const nombres = new Set(def.parametros.map((p) => p.nombre));
    for (const k of Object.keys(entradaDeEjemplo(o))) assert.ok(nombres.has(k), `${o.id}: «${k}» no está declarado`);
  }
});

test('3: los estilos, el transformar y el color declaran TODOS sus campos', () => {
  const campos = (id: string) => new Set(porId(id)!.parametros.map((p) => p.nombre));
  const estilo = campos('cambiar_estilo_texto_video');
  for (const k of ['fuente', 'tamano', 'color', 'negrita', 'cursiva', 'subrayado', 'mayusculas', 'alineacion', 'espaciado', 'interlineado', 'trazo', 'grosor_trazo', 'sombra', 'fondo', 'opacidad_fondo', 'resplandor']) {
    assert.ok(estilo.has(k), `estilo_texto sin «${k}»`);
  }
  for (const k of ['x', 'y', 'escala', 'rotacion', 'opacidad', 'mezcla']) assert.ok(campos('transformar_elemento_video').has(k), `transformar sin «${k}»`);
  for (const k of ['temperatura', 'brillo', 'contraste', 'vineta']) assert.ok(campos('ajustar_color_video').has(k), `ajustar_color sin «${k}»`);
  for (const k of ['x', 'curva', 'cambiar_tono']) assert.ok(campos('cambiar_velocidad_video').has(k));
});

test('4: lo que se aplana vuelve a la forma del chat («no» saca un color, la plantilla en listas, el reemplazo vacío)', () => {
  const op = (id: string) => OPERACIONES_API.find((o) => o.id === id)!;
  const estilo = operacionDesdeInput(op('cambiar_estilo_texto_video'), { proyecto: 'p', ref: 't1', trazo: 'no', sombra: 'si', fondo: '#000000' });
  assert.ok(estilo.ok && estilo.op.op === 'estilo_texto');
  assert.deepEqual(estilo.ok && estilo.op.op === 'estilo_texto' && estilo.op.estilo, { trazo: false, sombra: true, fondo: '#000000' });
  const plantilla = operacionDesdeInput(op('usar_plantilla_video'), { proyecto: 'p', id: 'testimonio', textos: [{ hueco: 'cita', texto: 'Lo recomiendo' }], clips: [{ hueco: 'clip', medio: 'm1' }] });
  assert.ok(plantilla.ok && plantilla.op.op === 'usar_plantilla');
  assert.deepEqual(plantilla.ok && plantilla.op.op === 'usar_plantilla' && [plantilla.op.textos, plantilla.op.clips], [{ cita: 'Lo recomiendo' }, { clip: 'm1' }]);
  const reemplazo = operacionDesdeInput(op('reemplazar_en_subtitulos_video'), { proyecto: 'p', buscar: 'eh' });
  assert.ok(reemplazo.ok && reemplazo.op.op === 'reemplazar_en_subtitulos' && reemplazo.op.reemplazo === '', 'sin reemplazo, la palabra sale');
  const mala = operacionDesdeInput(op('cambiar_volumen_video'), { proyecto: 'p', ref: 'a1', db: 99 });
  assert.ok(!mala.ok && /volumen/.test(mala.motivo), 'el motivo del chat, para que el modelo se corrija');
});

// ── La revisión contra la copia y el proyecto por nombre ─────────────────────

test('5: contra la copia: una ref que no existe se rechaza, una «n1» de la misma propuesta vale, un medio tiene que estar', () => {
  const v = vista([{ ref: 'v1', nombre: 'clip.mp4' }, { ref: 't1', texto: 'Hola' }], ['m1']);
  assert.deepEqual(revisarContraCopia({ op: OP_TEXTO, vista: v, previas: [] }), { ok: true });
  const r = revisarContraCopia({ op: { ...OP_TEXTO, ref: 't9' }, vista: v, previas: [] });
  assert.ok(!r.ok && /«t9» no está en la línea de tiempo/.test(r.motivo));
  const agregado: OperacionChat = { op: 'agregar_texto', texto: 'Nuevo', inicio: 0, duracion: 2, ref: 'n1' };
  assert.deepEqual(revisarContraCopia({ op: { op: 'mover', ref: 'n1', inicio: 3 }, vista: v, previas: [agregado] }), { ok: true });
  assert.equal(revisarContraCopia({ op: { op: 'mover', ref: 'n1', inicio: 3 }, vista: v, previas: [] }).ok, false);
  assert.equal(revisarContraCopia({ op: agregado, vista: v, previas: [agregado] }).ok, false, 'dos «n1» en la misma propuesta');
  assert.equal(revisarContraCopia({ op: { op: 'reemplazar_clip', ref: 'v1', medio: 'm7' }, vista: v, previas: [] }).ok, false);
  // Sin vista (el proyecto es demasiado grande para la copia) no se revisa acá: lo revisa el editor al aceptar.
  assert.deepEqual(revisarContraCopia({ op: { ...OP_TEXTO, ref: 't9' }, vista: null, previas: [] }), { ok: true });
});

test('6: la plantilla va sola y con la línea de tiempo vacía, y nada se le suma; con el tope, no entra otra', () => {
  const plantilla: OperacionChat = { op: 'usar_plantilla', id: 'gancho', textos: {}, clips: {} };
  const vacia = vista([]);
  assert.deepEqual(revisarContraCopia({ op: plantilla, vista: vacia, previas: [] }), { ok: true });
  assert.ok(!revisarContraCopia({ op: plantilla, vista: vista([{ ref: 'v1' }]), previas: [] }).ok, 'con algo en la línea de tiempo');
  assert.ok(!revisarContraCopia({ op: plantilla, vista: vacia, previas: [OP_TEXTO] }).ok, 'con otra cosa en la propuesta');
  assert.ok(!revisarContraCopia({ op: OP_TEXTO, vista: vista([{ ref: 't1' }]), previas: [plantilla] }).ok, 'nada después de una plantilla');
  const llena = Array.from({ length: TOPE_OPERACIONES }, () => OP_TEXTO);
  assert.ok(!revisarContraCopia({ op: OP_TEXTO, vista: vista([{ ref: 't1' }]), previas: llena }).ok);
});

test('7: la línea de cada cambio dice sobre QUÉ, con el nombre del elemento', () => {
  const v = vista([{ ref: 't1', texto: 'Esto lo cambia todo' }]);
  assert.equal(lineaDeOperacion('Cambiar un texto del video', OP_TEXTO, v), 'Cambiar un texto del video: «Esto lo cambia todo» → «Hola»');
});

test('8: el proyecto se elige por id o por NOMBRE, y si no alcanza, el motivo lista los proyectos', () => {
  const f = (proyecto_id: string, nombre: string): FilaEspejo => ({ proyecto_id, nombre, duracion: 10, demasiado_grande: false, updated_at: 'x', editado_por: null });
  const filas = [f('a1', 'Anuncio Octubre'), f('b2', 'Testimonio María'), f('c3', 'Testimonio Juan')];
  assert.equal((elegirProyecto(filas, 'b2') as { fila: FilaEspejo }).fila.proyecto_id, 'b2');
  assert.equal((elegirProyecto(filas, 'anuncio octubre') as { fila: FilaEspejo }).fila.proyecto_id, 'a1', 'sin mayúsculas');
  assert.equal((elegirProyecto(filas, 'maria') as { fila: FilaEspejo }).fila.proyecto_id, 'b2', 'el único que lo contiene, sin tildes');
  const dos = elegirProyecto(filas, 'testimonio');
  assert.ok(!dos.ok && /hay 2 proyectos/.test(dos.motivo) && /c3/.test(dos.motivo));
  const ninguno = elegirProyecto(filas, 'otro');
  assert.ok(!ninguno.ok && /Anuncio Octubre/.test(ninguno.motivo), 'lista los proyectos: lo que la lista le habría dado');
  assert.ok(!elegirProyecto([], 'x').ok);
});

// ── El presupuesto del doer de WhatsApp ──────────────────────────────────────

test('9: en WhatsApp entra lo que hace falta: la acción (y la lectura con refs) en un pedido; en una pregunta, ninguna acción', () => {
  const vistaWa = { canal: 'whatsapp' as const, alcance: 'proponer' as const, ws: 9, rol: 'admin' as const, tabs: null };
  const turno = (frase: string, actuar: boolean) =>
    toolsDelRegistro({ vista: vistaWa, areas: ['video'], incluirAcciones: actuar, maxChars: PRESUPUESTO_REGISTRO_CHARS, relevanteA: frase }).map((t) => t.name);
  const texto = turno('en el proyecto Anuncio octubre cambiá el texto del gancho por «Esto lo cambia todo»', true);
  assert.ok(texto.includes('cambiar_texto_video') && texto.includes('ver_proyecto_video'), texto.join(', '));
  assert.ok(turno('quitale las muletillas al video de testimonio', true).includes('eliminar_muletillas_video'));
  const pregunta = turno('cuántos créditos me quedan para filmar el anuncio', false);
  assert.ok(!pregunta.some((n) => porId(n)?.tipo === 'accion'), 'en una pregunta no viaja ninguna acción');
  for (const n of ['ver_saldo_flow', 'ver_montaje_anuncio', 'listar_anuncios_video']) assert.ok(pregunta.includes(n), `${n} sigue entrando`);
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('10: el runner resuelve el proyecto, valida con el chat, propone en el canal y NUNCA ejecuta', () => {
  const run = leer('lib', 'api-mako', 'areas', 'video.run.ts');
  for (const o of OPERACIONES_API) assert.match(run, new RegExp(`^  ${o.id}: \\{ \\.\\.\\.enElEditor\\('${o.id}'\\) \\},$`, 'm'), `${o.id} sin su runner`);
  const f = run.slice(run.indexOf('async function proponerEnElEditor'), run.indexOf('const resumenPedido'));
  assert.match(f, /const cual = await resolverProyecto\(ctx\.ws, str\(input, 'proyecto'\) \?\? ''\);/);
  assert.match(f, /const v = operacionDesdeInput\(o, input\);/);
  assert.match(f, /canalKey: ctx\.canalKey/);
  assert.match(f, /url: linkApp\(`\/video-editor\/\$\{proyecto\}\?propuesta=\$\{r\.id\}`, ctx\.ws\)/);
  assert.match(run, /ejecutar: async \(\) => \(\{ ok: false, resumen: 'Este cambio se acepta en el editor/);
});

test('11: la base suma con compare-and-set dentro de la ventana, revisa contra la copia y sólo cierra lo abierto', () => {
  const srv = leer('lib', 'editor-video', 'propuestas-server.ts');
  assert.match(srv, /const r = revisarContraCopia\(\{ op: p\.op, vista, previas \}\);/);
  assert.match(srv, /\.gte\('created_at', desde\)/, 'lo de ayer no se suma a lo de hoy');
  assert.match(srv, /\.eq\('estado', 'abierta'\)\.eq\('version', abierta\.version\)/);
  const resolver = srv.slice(srv.indexOf('export async function resolverPropuesta'));
  assert.match(resolver, /\.eq\('estado', 'abierta'\)/, 'un segundo clic no la reescribe');
  const ruta = leer('app', 'api', 'video-editor', 'propuestas', 'route.ts');
  assert.match(ruta, /await veEditorVideo\(\)/);
  assert.match(ruta, /if \(body\.estado !== 'aplicada' && body\.estado !== 'descartada'\)/);
  assert.match(ruta, /persona: p\.persona/, 'quien la cerró sale de la sesión');
  const sql = readFileSync(join(RAIZ, 'supabase', 'migrations', '0302_video_editor_propuestas.sql'), 'utf8').replace(/^\s*--.*$/gm, '');
  assert.match(sql, /alter table video_editor_propuestas enable row level security;/);
  assert.match(sql, /revoke all on video_editor_propuestas from anon, authenticated;/);
  assert.match(leer('lib', 'workspace.ts'), /'video_editor_propuestas',/);
  assert.match(leer('lib', 'tablas-de-inquilino.ts'), /'video_editor_propuestas',/);
  assert.match(leer('lib', 'api-mako', 'tipos.ts'), /\| '\/video-editor';/);
});

test('12: el editor la muestra como un cambio más del chat, la acepta con el mismo «Aceptar» y la cierra en la base', () => {
  const p = leer('app', 'video-editor', '_opencut', 'chat', 'propuestas.ts');
  assert.match(p, /export const idDeMensaje = \(propuestaId: string\) => `api-\$\{propuestaId\}`;/, 'un id estable: no se repite al volver a buscar');
  assert.match(p, /refsPrevias: refsPorId,/, 'las refs de la propuesta: «t2» es el de cuando se propuso');
  assert.match(p, /propuesta: \{ proyectoId, escenaId: p\.escenaId, refsPorId, elegidos: \[\], alcance: "video", operaciones \}/);
  assert.match(p, /useChatAbierto\.getState\(\)\.setAbierto\(true\);/);
  const panel = leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx');
  assert.equal((panel.match(/aceptarPropuesta\(/g) ?? []).length, 1, 'el MISMO «Aceptar»');
  assert.match(panel, /if \(m\.propuestaApi\) resolverEnServidor\(m\.propuestaApi\.id, "aplicada", r\.descartes\);/);
  assert.match(panel, /if \(m\.propuestaApi\) resolverEnServidor\(m\.propuestaApi\.id, "descartada"\);/);
  assert.match(leer('app', 'video-editor', '_opencut', 'editor-page.tsx'), /useEffect\(\(\) => iniciarPropuestas\(editor\), \[editor\]\);/);
  // Y el hilo guardado la recuerda (si no, al recargar no se cerraría en la base).
  const [g] = hiloParaGuardar([{ id: 'api-x', c: 1, t: 1, de: 'mako', texto: 'Propuesta', propuestaApi: { id: '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f', canal: 'whatsapp' } }]) as Array<{ propuestaApi?: unknown }>;
  assert.deepEqual(g.propuestaApi, { id: '0b9e5f4c-1a2b-4c3d-8e9f-0a1b2c3d4e5f', canal: 'whatsapp' });
});

test('13: una automatización no las ofrece ni las corre: se aceptan en el editor, y un flujo corre sin nadie mirando', () => {
  const f = leer('lib', 'api-mako', 'flujo.ts');
  assert.match(f, /export const enElEditorDeVideo = \(d: AccionDef\): boolean => d\.pantalla === '\/video-editor';/);
  assert.match(f, /!NO_EN_FLUJOS\.has\(d\.id\) && !enElEditorDeVideo\(d\)\)/, 'fuera de la lista de «⚡ Acción»');
  assert.match(f, /if \(enElEditorDeVideo\(def\)\) return \{ ok: false,/, 'y un paso viejo no la corre');
});

// Probado rompiéndolo (16/10/2026), cada rotura restaurada (base 12/0), todas -> 11/1 salvo la marcada:
//   · una operación del chat sin acción / se confirman por chat / la descripción no es el `para` / el proyecto no va primero
//   · la velocidad sin la curva / el estilo sin resplandor
//   · «no» no saca el color / sin el reemplazo vacío / la plantilla no vuelve a objetos (-> 10/2)
//   · no revisa las refs / las «n1» de la propuesta no valen / dos «n1» / no revisa los medios
//   · una plantilla con la línea de tiempo llena / algo después de una plantilla / sin el tope
//   · la línea sin el nombre del elemento
//   · el nombre sólo exacto / con dos que se llaman igual elige el primero / el runner sólo por id
//   · el ejecutar no se niega / todas en el mismo canal
//   · suma sin compare-and-set / lo de ayer se suma a lo de hoy / un segundo clic la reescribe / la ruta acepta
//     cualquier estado / la tabla sin RLS / fuera de TENANT_TABLES / sin la pantalla del editor
//   · el mensaje con un id nuevo cada vez / la revisión sin las refs de la propuesta / aceptar o descartar no la cierran
//     en la base / el editor no las busca / el hilo guardado la olvida
//   · (la prueba 13, sumada después, base 13/0) los flujos las ofrecen / un paso viejo la corre -> 12/1 cada una
// Y lo que el test 2 encontró de entrada: el ejemplo del catálogo con «…» en buscar y en reemplazo era un reemplazo
// que no cambia nada (el chat lo rechaza bien): el ejemplo usa un texto distinto por campo.
