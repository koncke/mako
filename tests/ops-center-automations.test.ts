// =============================================================================
// Las charlas del lienzo de Automations en el Ops Center (22/10/2026, OC5)
// =============================================================================
// Automations guarda la charla con MaKo de cada automatización en app_settings (`automatizacion.chat:<id>`) y nadie la
// proyectaba: medido ese día, 239 chats; el ws1 tiene 4 («Sprint · apertura», con 14 mensajes, la más reciente).
//   1. el chat se lee PARSEADO: `value` es un STRING JSON, y `value.mensajes` sin parsear da 0 sin error (la trampa medida);
//   2. la proyección es del workspace y con la puerta de la tab, que es `setting` (con 'automations' no la ve nadie);
//   3. en la lista: «Automations › <nombre>», agrupada con las demás de Automations, con su hilo y sus opciones;
//   4. se LEE acá y se sigue en el lienzo («Seguir en el lienzo»); lo que se escribe no sale.
//
// Correr: node --import tsx --test tests/ops-center-automations.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claveChat, idDeClaveChat, sanearChat, type MensajeChatMako } from '../lib/automatizacion-chat';
import { AVISO_LIENZO, listaDelCliente, mensajesDeAutomatizacion, rutaDelLienzo } from '../lib/chat-mako-reglas';
import { partesDelNombre, porJefe } from '../lib/centro-chats';
import { puedeVerKey } from '../lib/movil-rutas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Una charla con la forma de las del ws1: el pedido, una pregunta de MaKo con opciones, la respuesta y un turno de una tarjeta.
const CHARLA: MensajeChatMako[] = [
  { id: 'a', de: 'yo', texto: 'Arma una automatización nueva llamada «Sprint · apertura»', at: '2026-10-22T14:40:00Z', via: 'app' },
  {
    id: 'b', de: 'mako', texto: '¿Por dónde le escribo?', at: '2026-10-22T14:40:20Z', via: 'app',
    pregunta: { id: 'p1', sobre: 'canal', texto: '¿Por dónde le escribo?', otra: true, opciones: [{ valor: 'wa', label: 'WhatsApp' }, { valor: 'ig', label: 'Instagram' }] },
  },
  { id: 'c', de: 'yo', texto: 'WhatsApp', at: '2026-10-22T14:41:00Z', via: 'app', respuesta: { preguntaId: 'p1', sobre: 'canal', valor: 'wa' } },
  { id: 'd', de: 'mako', texto: 'Listo, lo escribí más corto.', at: '2026-10-22T14:48:00Z', via: 'app', tarjeta: 'Mensaje 1' },
  { id: 'e', de: 'mako', texto: '   ', at: '2026-10-22T14:48:10Z', via: 'app' },
];

test('1. el chat se lee PARSEADO: el value es un string JSON (sin parsear, 0 mensajes y ningún error)', () => {
  const value = JSON.stringify({ v: 1, mensajes: CHARLA });
  assert.equal((value as unknown as { mensajes?: unknown[] }).mensajes?.length ?? 0, 0, 'la trampa: leído sin parsear, no hay nada');
  assert.equal(sanearChat(value).mensajes.length, 5, 'parseado (sanearChat), están todos');
  assert.equal(idDeClaveChat(claveChat(289)), 289);
  assert.equal(idDeClaveChat('automatizacion.chat:abc'), null);
  assert.equal(idDeClaveChat('automatizacion.chatx:12'), null);
  // El índice lee el chat con leerChat (que parsea) y lista por la clave, nunca por value.mensajes.
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(indice, /leerChatDeAutomatizacion\(ws, id\)/);
  const db = sinComentarios(leer('lib/automatizacion-chat-db.ts'));
  assert.match(db, /\.like\('key', 'automatizacion\.chat:%'\)/);
  assert.doesNotMatch(db, /value\.mensajes/);
});

test('2. del workspace y con la puerta de la tab, que es `setting` (con «automations» no la ve nadie)', () => {
  assert.equal(puedeVerKey('setting', 'admin', null), true);
  assert.equal(puedeVerKey('automations', 'admin', null), false, 'la trampa: con el nombre, ni el admin');
  const indice = sinComentarios(leer('lib/chat-mako-indice.ts'));
  assert.match(indice, /\{ origen: 'automations', alcance: 'workspace', tab: 'setting' \}/);
  assert.match(indice, /export async function chatsDeAutomations\(\)[\s\S]{0,120}?await wsSiVe\('setting'\)/);
  assert.match(indice, /export async function hiloDeAutomatizacion\([\s\S]{0,200}?await wsSiVe\('setting'\);\n\s*if \(ws == null \|\| !\(await secuenciaDelWorkspace\(ws, id\)\)\) return null;/, 'una de otro negocio no se abre');
  assert.match(indice, /runWithWorkspace\(ws, \(\) => listarChatsDeAutomations\(ws\)\)/, 'la lista, dentro del workspace');
});

test('3. en la lista, «Automations › <nombre>», agrupada; el hilo con las opciones y la tarjeta', () => {
  const lista = listaDelCliente({
    sesiones: [], offer: [], antes: [], busca: '',
    automations: [
      { id: 289, titulo: 'Sprint · apertura', updatedAt: '2026-10-22T14:48:00Z' },
      { id: 268, titulo: 'Bienvenida y acceso a nuevo cliente', updatedAt: '2026-10-16T23:50:00Z' },
    ],
  });
  const filas = lista.slice(1);
  assert.deepEqual(filas.map((f) => f.titulo), ['Automations › Sprint · apertura', 'Automations › Bienvenida y acceso a nuevo cliente']);
  assert.deepEqual(filas[0].elegido, { automatizacion: 289 });
  assert.equal(filas[0].origen, 'automations');
  const [g] = porJefe(filas);
  assert.equal(g.jefe, 'Automations');
  assert.deepEqual(g.subs.map((f) => partesDelNombre(f.titulo).sub), ['Sprint · apertura', 'Bienvenida y acceso a nuevo cliente']);
  assert.deepEqual(mensajesDeAutomatizacion(CHARLA), [
    { role: 'user', content: 'Arma una automatización nueva llamada «Sprint · apertura»', created_at: '2026-10-22T14:40:00Z' },
    { role: 'assistant', content: '¿Por dónde le escribo?\n\n- WhatsApp\n- Instagram', created_at: '2026-10-22T14:40:20Z' },
    { role: 'user', content: 'WhatsApp', created_at: '2026-10-22T14:41:00Z' },
    { role: 'assistant', content: 'Desde «Mensaje 1»: Listo, lo escribí más corto.', created_at: '2026-10-22T14:48:00Z' },
  ], 'lo vacío no se dibuja');
});

test('4. se lee acá y se sigue en el lienzo: «Seguir en el lienzo», y lo que se escribe no sale', () => {
  assert.equal(rutaDelLienzo(289), '/automations?sec=289&mako=1');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(esAutomatizacion \|\| (?:esEditor \|\| )?\(!t && !archivos\.length\)/, 'enviar no manda nada');
  assert.match(motor, /pedir<\{ mensajes: MensajeChat\[\] \}>\(`\$\{RUTA\}\?automatizacionId=\$\{idAutomatizacion\}`\)/);
  assert.match(motor, /const hrefLienzo = idAutomatizacion != null \? conWs\(rutaDelLienzo\(idAutomatizacion\), ws\) : null;/, 'el lienzo, en este negocio');
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /if \(k\.esAutomatizacion\) \{\n\s*return <p className="co-solo-lectura" role="note">\{AVISO_LIENZO\}\{k\.hrefLienzo && <> <a className="ch-enlace" href=\{k\.hrefLienzo\}>Seguir en el lienzo<\/a><\/>\}<\/p>;/);
  assert.match(AVISO_LIENZO, /se sigue ahí/);
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.get\('automations'\)\) return json\(\{ ok: true, automations: await chatsDeAutomations\(\) \}\);/);
  assert.match(ruta, /const hilo = id == null \? null : await hiloDeAutomatizacion\(id\);/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 4/0):
//   · el hilo sin leerChat (el value sin parsear)            → 3/1 (1)
//   · la puerta con otra clave que `setting`                  → 3/1 (2)
//   · el hilo sin las opciones de la pregunta                 → 3/1 (3)
//   · la lista sin las charlas del lienzo                     → 3/1 (3)
//   · enviar sin frenar una charla del lienzo                 → 3/1 (4)
