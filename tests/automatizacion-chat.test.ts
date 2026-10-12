// =============================================================================
// El chat con MaKo de una automatización: la forma y sus reglas puras (lib/automatizacion-chat.ts)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5 y §3.3). El chat vive en `app_settings` (texto) y
// lo escriben la ruta de IA, `crearConIA` y la API de MaKo: lo guardado puede venir de otra versión del código o roto.
// Lo que fija:
//   1. `sanearChat` NUNCA tira: con basura devuelve un chat vacío, y descarta SÓLO lo malformado;
//   2. el tope: quedan los ÚLTIMOS 60;
//   3. el dedupe por id (gana lo que ya estaba) al sanear y al agregar;
//   4. `claveChat` es la clave del diseño (va por workspace en `app_settings`).
// Además fija, por fuente, que lib/automatizacion-chat-db.ts escribe dentro de `runWithWorkspace` y que el
// compare-and-set de una fila que ya existe NO filtra por el valor entero (medido: con 8 KB de valor PostgREST
// contesta «fetch failed», con 16 KB 400 y con 64 KB 414; scratchpad/wf-duodecima/ia-contexto-chat/url-largo.mjs).
//
// PROBADO ROMPIÉNDOLO (12/10/2026; arnés scratchpad/wf-duodecima/ia-contexto-chat/romper.mjs, en un ESPEJO del
// worktree). Base: 6 pass / 0 fail. Una rotura por vez, y cada una tumba SU test:
//   1. `sanearChat` sin el try del JSON.parse                         → 5 / 1 (la basura).
//   2. el tope con `slice(0, TOPE_CHAT)` (los PRIMEROS)               → 5 / 1 (el tope).
//   3. el dedupe gana el ÚLTIMO (lo nuevo pisa lo guardado)           → 5 / 1 (el dedupe).
//   4. un mensaje sin `via` se acepta                                 → 5 / 1 (la basura).
//   5. la db escribe la fila existente con `cambiarSettingSi(clave, fila.value, …)` → 5 / 1 (la db).
//   6. `claveChat` con otro prefijo                                   → 5 / 1 (la clave).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sanearChat, agregarMensajes, claveChat, sanearMensaje, TOPE_CHAT, TOPE_RONDAS,
  type MensajeChatMako, type ChatAutomatizacion,
} from '../lib/automatizacion-chat';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const AT = '2026-10-12T06:00:00.000Z';
const msg = (id: string, o: Partial<MensajeChatMako> = {}): MensajeChatMako => ({ id, de: 'yo', texto: `pedido ${id}`, at: AT, via: 'app', ...o });
const VACIO: ChatAutomatizacion = { v: 1, mensajes: [] };

test('sanear: la basura no tira y da un chat vacío; lo malformado se descarta y lo bueno queda', () => {
  for (const basura of [null, undefined, '', '{', 'null', '[]', '"hola"', 42, true, [], {}, { mensajes: 'x' }, { v: 1, mensajes: null }]) {
    assert.deepEqual(sanearChat(basura), VACIO, `con ${JSON.stringify(basura)}`);
  }
  const bueno = msg('a');
  const mako: MensajeChatMako = {
    id: 'b', de: 'mako', texto: 'Cambié 3 · saqué 1 · agregué 2', at: AT, via: 'whatsapp',
    pregunta: { id: 'p1', sobre: 'canal', texto: '¿Por dónde le escribo?', opciones: [{ valor: 'instagram', label: 'Instagram' }, { valor: 'whatsapp', label: 'WhatsApp', detalle: 'tu línea' }], otra: true },
    cambios: { cambiadas: 3, quitadas: 1, agregadas: 2 }, avisos: ['Saqué «Pagó»: no está en tus condiciones'],
  };
  const respuesta: MensajeChatMako = { ...msg('c'), respuesta: { preguntaId: 'p1', sobre: 'canal', valor: null } };
  const guardado = JSON.stringify({ v: 1, mensajes: [
    bueno, 7, null, 'x',
    { ...msg('sin-via'), via: undefined }, { ...msg('via-mala'), via: 'sms' }, { ...msg('de-malo'), de: 'otro' },
    { ...msg('sin-at'), at: 'ayer' }, { ...msg(''), id: '' }, { ...msg('texto-num'), texto: 5 },
    mako, respuesta,
  ] });
  const c = sanearChat(guardado);
  assert.deepEqual(c.mensajes.map((m) => m.id), ['a', 'b', 'c'], 'quedan los tres buenos, en su orden');
  assert.deepEqual(c.mensajes[1], mako, 'un mensaje completo pasa entero');
  assert.deepEqual(c.mensajes[2].respuesta, { preguntaId: 'p1', sobre: 'canal', valor: null }, '«Elige tú» es valor null');
  // Lo OPCIONAL roto se cae solo y el mensaje se sigue viendo.
  const roto = sanearMensaje({ ...msg('d'), pregunta: { id: 'p2', sobre: 'nada', texto: 'x', opciones: [], otra: true }, cambios: { cambiadas: 'tres' }, avisos: [1, '', 'Ojo'] });
  assert.deepEqual(roto, { ...msg('d'), avisos: ['Ojo'] });
  // El objeto ya parseado también vale (no sólo el texto de la base).
  assert.deepEqual(sanearChat({ v: 1, mensajes: [bueno] }).mensajes, [bueno]);
});

test('el tope: quedan los ÚLTIMOS 60, al sanear y al agregar', () => {
  assert.equal(TOPE_CHAT, 60);
  assert.equal(TOPE_RONDAS, 2);
  const muchos = Array.from({ length: 75 }, (_, i) => msg(`m${i}`));
  const c = sanearChat(JSON.stringify({ v: 1, mensajes: muchos }));
  assert.equal(c.mensajes.length, 60);
  assert.equal(c.mensajes[0].id, 'm15');
  assert.equal(c.mensajes[59].id, 'm74');
  const mas = agregarMensajes(c, [msg('n1'), msg('n2')]);
  assert.equal(mas.mensajes.length, 60);
  assert.deepEqual([mas.mensajes[0].id, mas.mensajes[58].id, mas.mensajes[59].id], ['m17', 'n1', 'n2']);
});

test('el dedupe por id: lo que ya estaba gana, un reintento no repite, y lo malformado no entra', () => {
  const c = agregarMensajes(VACIO, [msg('a'), msg('b')]);
  const otraVez = agregarMensajes(c, [{ ...msg('a'), texto: 'OTRO texto' }, msg('c')]);
  assert.deepEqual(otraVez.mensajes.map((m) => [m.id, m.texto]), [['a', 'pedido a'], ['b', 'pedido b'], ['c', 'pedido c']]);
  // Dos veces el mismo id en el mismo lote: uno.
  assert.deepEqual(agregarMensajes(VACIO, [msg('x'), msg('x')]).mensajes.map((m) => m.id), ['x']);
  // Lo guardado con repetidos también se limpia al sanear.
  assert.deepEqual(sanearChat(JSON.stringify({ v: 1, mensajes: [msg('a'), msg('a'), msg('b')] })).mensajes.map((m) => m.id), ['a', 'b']);
  // Un nuevo malformado no entra (y no tira).
  assert.deepEqual(agregarMensajes(c, [{ ...msg('z'), de: 'nadie' } as unknown as MensajeChatMako]).mensajes.map((m) => m.id), ['a', 'b']);
  // No muta lo que recibe.
  assert.equal(c.mensajes.length, 2);
});

test('claveChat: la clave de app_settings del diseño', () => {
  assert.equal(claveChat(243), 'automatizacion.chat:243');
});

test('la db: siempre dentro de runWithWorkspace, y el compare-and-set de una fila que existe compara `updated_at`', () => {
  const src = sinComentarios(leer('lib/automatizacion-chat-db.ts'));
  assert.match(src, /^import 'server-only';/m);
  assert.match(src, /export async function leerChat\(ws: number, secuenciaId: number\): Promise<ChatAutomatizacion> \{[\s\S]*?return runWithWorkspace\(ws, /);
  assert.match(src, /export async function agregarAlChat\(ws: number, secuenciaId: number, nuevos: MensajeChatMako\[\]\): Promise<ChatAutomatizacion> \{[\s\S]*?return runWithWorkspace\(ws, /);
  // La primera escritura (no hay fila) por `cambiarSettingSi` con esperado null; las demás, NO con el valor entero.
  assert.match(src, /if \(!fila\) \{\n\s*if \(await cambiarSettingSi\(clave, null, valor\)\) return nuevo;/);
  assert.doesNotMatch(src, /cambiarSettingSi\(clave, (fila|crudo|actual)/, 'el valor entero va en la URL: desde ~8 KB PostgREST no contesta');
  assert.match(src, /\.eq\('workspace_id', ws\)\.eq\('key', clave\)\.eq\('updated_at', fila\.updated_at\)/);
  assert.match(src, /for \(let vuelta = 0; vuelta < VUELTAS; vuelta\+\+\)/);
  assert.match(src, /const VUELTAS = 3;/);
  // La lectura es estricta: «no pude leer» no es «no hay chat».
  assert.match(src, /if \(error\) throw new Error\(`No pude leer el chat de MaKo/);
});

test('sanear: un texto largo se corta y no rompe', () => {
  const largo = 'a'.repeat(10_000);
  const m = sanearMensaje({ ...msg('l'), texto: largo });
  assert.ok(m && m.texto.length === 4000);
});
