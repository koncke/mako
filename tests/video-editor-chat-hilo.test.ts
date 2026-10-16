// =============================================================================
// El hilo del chat «Editar con IA», guardado (etapa 3 del diseño AI-native, 16/10/2026)
// =============================================================================
// Vivía en la memoria de la pestaña y se perdía al recargar; ahora se guarda por persona y por proyecto
// (`video_editor_chats`, mig 0298). Fija:
//   · el formato y el saneo (lib/editor-video/chat-hilo.ts): topes, orden, sin repetidos, las operaciones de una
//     propuesta vueltas a validar, y lo que no sobrevive a recargar («aplicando» no vuelve a pendiente);
//   · la unión de dos copias por id (gana el último cambio, no se pierde nada);
//   · el store del navegador (app/video-editor/_opencut/chat/hilo.ts) con un fetch de mentira: carga y une, guarda
//     después de un cambio, ante un 409 une y vuelve a guardar, sin la tabla deja de intentar;
//   · la ruta (la persona sale de la SESIÓN), el server (sólo la tabla que falta se tolera) y la migración.
//
// PROBADO ROMPIÉNDOLO: ver el final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVISO_CORTADA, TOPES_HILO, hiloAlAbrir, hiloParaGuardar, unirHilos, type MensajeGuardado } from '../lib/editor-video/chat-hilo';
import { aGuardado, cambiarHilo, cambiarMensaje, cargarHilo, conId, deGuardado, leerHilo, unirConServidor, type Mensaje } from '../app/video-editor/_opencut/chat/hilo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const OP = { op: 'cambiar_texto', ref: 't1', texto: 'Hola' } as const;
const yo = (id: string, c: number, texto = 'pon un título'): MensajeGuardado => ({ id, c, t: c, de: 'yo', texto, alcance: null });
/** `extra` es suelto a propósito: el saneo recibe lo que venga (operaciones inventadas, cambios con cualquier tipo). */
const mako = (id: string, c: number, extra: Record<string, unknown> = {}): MensajeGuardado =>
  ({ id, c, t: c, de: 'mako', texto: 'Listo.', ...extra }) as unknown as MensajeGuardado;
const PROPUESTA = { escenaId: 'esc1', refsPorId: [['el-1', 't1']] as Array<[string, string]>, elegidos: [], alcance: 'video' as const, operaciones: [OP] };

// ── El formato ───────────────────────────────────────────────────────────────

test('1: se guarda lo saneado, en orden, sin repetidos (gana el último cambio) y sin lo que no es un mensaje', () => {
  const r = hiloParaGuardar([
    mako('b', 20),
    { ...yo('a', 10, 'versión vieja'), t: 5 },
    yo('a', 10),
    { ...yo('a', 10, 'otra vieja, después'), t: 7 },
    { id: 'x y', c: 1, t: 1, de: 'yo', texto: 'id inválido' },
    { id: 'z', c: 1, t: 1, de: 'otro', texto: 'no es de nadie' },
    { id: 'v', c: 1, t: 1, de: 'yo', texto: '' },
    'basura',
  ]);
  assert.deepEqual(r.map((m) => m.id), ['a', 'b']);
  assert.equal((r[0] as { texto: string }).texto, 'pon un título', 'de dos copias del mismo id queda la del último cambio');
});

test('2: con topes: los últimos mensajes, cada texto y cada lista recortados; lo que se cae es lo más viejo', () => {
  const muchos = Array.from({ length: TOPES_HILO.mensajes + 5 }, (_, i) => yo(`m${i}`, i));
  const r = hiloParaGuardar(muchos);
  assert.equal(r.length, TOPES_HILO.mensajes);
  assert.equal(r[0].id, 'm5', 'se caen los cinco más viejos');
  const largo = hiloParaGuardar([yo('a', 1, 'x'.repeat(TOPES_HILO.texto + 50))]);
  assert.equal((largo[0] as { texto: string }).texto.length, TOPES_HILO.texto);
  const cambios = Array.from({ length: TOPES_HILO.cambios + 3 }, () => ({ tipo: 'cambia', titulo: 'T', antes: 'a', despues: 'b' }));
  const conCambios = hiloParaGuardar([mako('a', 1, { cambios })]) as Array<Extract<MensajeGuardado, { de: 'mako' }>>;
  assert.equal(conCambios[0].cambios?.length, TOPES_HILO.cambios);
  // Un hilo que pasa del total en caracteres pierde los más viejos, nunca el último (con 80 textos no alcanza: hacen
  // falta las listas de cambios llenas).
  const fila = { tipo: 'cambia', titulo: 't'.repeat(300), antes: 'a'.repeat(600), despues: 'd'.repeat(600) };
  const gordos = Array.from({ length: 20 }, (_, i) => mako(`g${i}`, i, { cambios: Array.from({ length: TOPES_HILO.cambios }, () => fila) as never }));
  assert.ok(JSON.stringify(gordos).length > TOPES_HILO.total, 'el caso pasa del total');
  const recortado = hiloParaGuardar(gordos);
  assert.ok(recortado.length < gordos.length && JSON.stringify(recortado).length <= TOPES_HILO.total);
  assert.equal(recortado.at(-1)?.id, 'g19');
});

test('3: una propuesta guarda lo necesario para aceptarla, con las operaciones vueltas a validar', () => {
  const [m] = hiloParaGuardar([mako('a', 1, { estado: 'pendiente', propuesta: { ...PROPUESTA, operaciones: [OP, { op: 'inventada' }] } })]) as Array<Extract<MensajeGuardado, { de: 'mako' }>>;
  assert.deepEqual(m.propuesta?.operaciones, [OP], 'una operación que no es del catálogo no se guarda');
  assert.equal(m.estado, 'pendiente');
  // Sin ninguna operación válida no hay qué aceptar: una «pendiente» así queda descartada.
  const [sin] = hiloParaGuardar([mako('b', 1, { estado: 'pendiente', propuesta: { ...PROPUESTA, operaciones: [{ op: 'inventada' }] } })]) as Array<Extract<MensajeGuardado, { de: 'mako' }>>;
  assert.equal(sin.propuesta, undefined);
  assert.equal(sin.estado, 'descartada');
});

test('4: al abrir, «aplicando» se cortó a la mitad (queda descartada con su aviso) y «sin-versión» vuelve a pendiente', () => {
  const r = hiloAlAbrir([
    mako('a', 1, { estado: 'aplicando', propuesta: PROPUESTA }),
    mako('b', 2, { estado: 'sin-version', propuesta: PROPUESTA, aviso: 'No se guardó el proyecto' }),
    mako('c', 3, { estado: 'aplicada', propuesta: PROPUESTA }),
  ]) as Array<Extract<MensajeGuardado, { de: 'mako' }>>;
  assert.equal(r[0].estado, 'descartada', 'aceptarla de nuevo aplicaría dos veces lo que ya entró');
  assert.equal(r[0].aviso, AVISO_CORTADA);
  assert.equal(r[1].estado, 'pendiente');
  assert.equal(r[1].aviso, undefined);
  assert.equal(r[2].estado, 'aplicada');
});

test('5: dos copias se UNEN por id: no se pierde nada de ninguna, y de cada mensaje gana el último cambio', () => {
  const pestana = [yo('a', 1), mako('b', 2, { estado: 'aplicada', t: 50 } as never)];
  const server = [yo('a', 1), mako('b', 2, { estado: 'pendiente', t: 10 } as never), yo('c', 3)];
  const r = unirHilos(pestana, server) as Array<{ id: string; estado?: string }>;
  assert.deepEqual(r.map((m) => m.id), ['a', 'b', 'c']);
  assert.equal(r[1].estado, 'aplicada');
});

// ── El store del navegador ───────────────────────────────────────────────────

test('6: lo que no viaja (el deshacer, las pistas) no se guarda; al unir, el de la pestaña se queda con lo suyo si es más nuevo', () => {
  const local: Mensaje = {
    id: 'p', c: 1, t: 100, de: 'mako', texto: 'Listo.', estado: 'aplicada',
    propuesta: { proyectoId: 'P1', escenaId: 'esc1', refsPorId: new Map([['el-1', 't1']]), elegidos: [], alcance: 'video', operaciones: [OP as never], tracksEnviados: { main: {} } as never },
    aplicada: { escenaId: 'esc1', antes: {} as never, despues: {} as never, pasos: 1 },
  };
  const g = aGuardado(local) as Extract<MensajeGuardado, { de: 'mako' }>;
  assert.equal('aplicada' in g, false);
  assert.equal('tracksEnviados' in (g.propuesta ?? {}), false);
  assert.deepEqual(g.propuesta?.refsPorId, [['el-1', 't1']]);
  const vuelta = deGuardado(g, 'P1');
  assert.ok(vuelta.de === 'mako' && vuelta.propuesta?.refsPorId instanceof Map && vuelta.propuesta.proyectoId === 'P1');
  // Más nuevo en la pestaña: queda el MISMO objeto (con su deshacer). Más nuevo en el server: el del server.
  const unidos = unirConServidor([local], [{ ...g, t: 50 }], 'P1');
  assert.equal(unidos[0], local);
  const ganaServer = unirConServidor([local], [{ ...g, t: 500, estado: 'restaurada' }], 'P1');
  assert.ok(ganaServer[0] !== local && ganaServer[0].de === 'mako' && ganaServer[0].estado === 'restaurada');
});

type Llamada = { metodo: string; cuerpo: Record<string, unknown> | null };
function fetchFalso(respuestas: Array<(c: Llamada) => unknown>) {
  const llamadas: Llamada[] = [];
  const f = async (_url: string, init?: { method?: string; body?: string }) => {
    const c: Llamada = { metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(init.body) : null };
    llamadas.push(c);
    const r = respuestas.shift();
    const json = r ? r(c) : { ok: false, error: 'sin respuesta' };
    return { json: async () => json } as Response;
  };
  return { f, llamadas };
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('7: carga y une con lo de la pestaña; un cambio se guarda con la versión leída', async () => {
  const P = 'proy-7';
  cambiarHilo(P, (h) => ({ ...h, mensajes: [conId({ de: 'yo', texto: 'antes de cargar', alcance: null })] }));
  const { f, llamadas } = fetchFalso([
    () => ({ ok: true, hilo: { version: 3, mensajes: [yo('viejo', 1, 'del server')] } }),
    () => ({ ok: true, version: 4 }),
  ]);
  globalThis.fetch = f as never;
  await cargarHilo(P, 'Mi proyecto');
  assert.deepEqual(leerHilo(P).mensajes.map((m) => (m as { texto: string }).texto), ['del server', 'antes de cargar']);
  await esperar(800);
  const put = llamadas.find((l) => l.metodo === 'PUT');
  assert.ok(put, 'guardó la unión');
  assert.equal(put!.cuerpo!.version, 3, 'con la versión que leyó');
  assert.equal(put!.cuerpo!.nombre, 'Mi proyecto');
  assert.equal((put!.cuerpo!.mensajes as unknown[]).length, 2);
});

test('8: ante un 409 une con lo del server y vuelve a guardar sobre SU versión', async () => {
  const P = 'proy-8';
  const { f, llamadas } = fetchFalso([
    () => ({ ok: true, hilo: null }),
    () => ({ ok: false, conflicto: true, hilo: { version: 9, mensajes: [yo('otra', 1, 'de la otra pestaña')] } }),
    () => ({ ok: true, version: 10 }),
  ]);
  globalThis.fetch = f as never;
  await cargarHilo(P, null);
  cambiarHilo(P, (h) => ({ ...h, mensajes: [...h.mensajes, conId({ de: 'yo', texto: 'de esta', alcance: null })] }));
  await esperar(1700);
  const puts = llamadas.filter((l) => l.metodo === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[0].cuerpo!.version, null, 'la primera vez no había fila');
  assert.equal(puts[1].cuerpo!.version, 9, 'el segundo, sobre la versión del server');
  assert.deepEqual((puts[1].cuerpo!.mensajes as Array<{ texto: string }>).map((m) => m.texto).sort(), ['de esta', 'de la otra pestaña']);
});

test('9: sin la tabla deja de intentar (el hilo sigue en la pestaña)', async () => {
  const P = 'proy-9';
  const { f, llamadas } = fetchFalso([() => ({ ok: false, sinTabla: true })]);
  globalThis.fetch = f as never;
  await cargarHilo(P, null);
  cambiarHilo(P, (h) => ({ ...h, mensajes: [conId({ de: 'yo', texto: 'hola', alcance: null })] }));
  cambiarMensaje(P, leerHilo(P).mensajes[0].id, { estado: 'pendiente' });
  await esperar(800);
  assert.equal(llamadas.length, 1, 'sólo la lectura');
  assert.equal(leerHilo(P).mensajes.length, 1);
});

// ── La ruta, el server, la migración y el panel ──────────────────────────────

test('10: la ruta: el candado del editor, la persona de la SESIÓN y el hilo vuelto a sanear por el server', () => {
  const ruta = leer('app', 'api', 'video-editor', 'chat', 'route.ts');
  assert.match(ruta, /await veEditorVideo\(\)/);
  assert.match(ruta, /if \(rol !== 'admin'\)/);
  assert.match(ruta, /const persona = personaDeSesion\(sesion\);/);
  assert.doesNotMatch(ruta, /body\.persona|searchParams\.get\('persona'\)/, 'la persona nunca sale del pedido');
  const srv = leer('lib', 'editor-video', 'chat-hilo-server.ts');
  assert.match(srv, /const mensajes = hiloParaGuardar\(k\.mensajes\);/, 'el server no le cree al navegador');
  assert.match(srv, /\.eq\('version', k\.version\)/, 'compare-and-set');
  assert.match(srv, /e\?\.code === 'PGRST205' \|\| e\?\.code === '42P01'/);
  assert.doesNotMatch(srv, /42703|PGRST204/, 'una columna que falta no se tolera: sólo la tabla');
});

test('11: la migración: una fila por persona y proyecto, RLS sin políticas, y la tabla en los dos registros', () => {
  const crudo = readFileSync(join(RAIZ, 'supabase', 'migrations', '0298_video_editor_chats.sql'), 'utf8');
  assert.match(crudo, /ORDEN DE DESPLIEGUE: ANTES o JUNTO/);
  const sql = crudo.replace(/^\s*--.*$/gm, '');
  assert.match(sql, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade,/);
  assert.doesNotMatch(sql, /workspace_id[^,\n]*default/, 'el workspace sin default');
  assert.match(sql, /primary key \(workspace_id, persona, proyecto_id\)/);
  assert.match(sql, /alter table video_editor_chats enable row level security;/);
  assert.match(sql, /revoke all on video_editor_chats from anon, authenticated;/);
  assert.match(leer('lib', 'workspace.ts'), /'video_editor_chats',/);
  assert.match(leer('lib', 'tablas-de-inquilino.ts'), /'video_editor_chats',/);
});

test('12: el panel carga el hilo al abrir y «Restaurar» sólo aparece si hay con qué deshacer', () => {
  const p = leer('app', 'video-editor', '_opencut', 'chat', 'PanelChat.tsx');
  assert.match(p, /if \(proyectoId\) void cargarHilo\(proyectoId, nombreProyecto\);/);
  assert.match(p, /puedeRestaurar=\{!!m\.aplicada\}/);
  assert.match(p, /\{puedeRestaurar && \(\s*<button [^>]*onClick=\{onRestaurar\}/);
  assert.match(p, /!!m\.propuesta\.tracksEnviados && tracksVivos !== m\.propuesta\.tracksEnviados/, 'sin las pistas de cuando se pidió no se avisa «cambiaste la línea de tiempo»');
  assert.doesNotMatch(p, /const hilos = new Map/, 'el hilo vive en chat/hilo.ts, no en el panel');
});

// Probado rompiéndolo (16/10/2026), cada rotura restaurada (base 12/0):
//   · de dos copias del mismo mensaje gana la primera                  -> 10/2
//   · sin el tope de mensajes / sin el tope total                      -> 11/1 cada una (la del total sobrevivió
//     con 200 textos: con 80 no llegan al tope; el caso usa listas de cambios llenas)
//   · las operaciones de la propuesta sin volver a validar             -> 11/1
//   · una pendiente sin propuesta sigue pendiente                      -> 11/1
//   · «aplicando» vuelve a pendiente / «sin-versión» queda así         -> 11/1 cada una
//   · se guarda el deshacer / al unir gana siempre el server            -> 11/1 cada una
//   · cargar pisa lo de la pestaña / el guardado no manda la versión   -> 10/2 cada una
//   · ante un 409 no une / sin la tabla sigue intentando               -> 11/1 cada una
//   · la persona sale del pedido / el server no vuelve a sanear / tolera una columna que falta -> 11/1 cada una
//   · la tabla sin RLS / fuera de TENANT_TABLES                        -> 11/1 cada una
//   · el panel no carga el hilo / «Restaurar» sin con qué deshacer / avisa «cambiaste» sin las pistas -> 11/1 cada una
