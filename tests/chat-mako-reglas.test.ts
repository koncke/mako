// =============================================================================
// La pieza única de chat con MaKo: el jefe «Second Brain» y sus sub-chats (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md. Lo que se fija (lib/chat-mako-reglas.ts):
//   · el jefe es la conversación MÁS VIEJA de la persona, y escribir en otra no lo cambia (con la más reciente, el
//     jefe saltaba de fila cada vez que se escribía);
//   · los sub-chats van con la que se movió último arriba, y la búsqueda no distingue mayúsculas ni tildes;
//   · el nombre de un sub-chat lleva al jefe adelante (de ahí sale su muñeco, de la familia del jefe).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 4 pases (5 con el de la base de la persona):
//   · el jefe por la más reciente (`updatedAt`) en vez de la más vieja → 1 fallo («el jefe es la más vieja»);
//   · los sub-chats sin ordenar → 1 fallo («el jefe es la más vieja»);
//   · la búsqueda con mayúsculas y tildes → 1 fallo («la búsqueda»).

import test from 'node:test';
import assert from 'node:assert/strict';
import { JEFE_SECOND_BRAIN, SIN_TITULO, arbolDelJefe, baseDeLaPersona, edadCorta, filtrarSubs, nombreDeSub, sesionDelCanal, tituloDe } from '../lib/chat-mako-reglas';
import type { SesionChat } from '../lib/mako-turno-app-reglas';

const s = (id: number, titulo: string | null, updatedAt: string): SesionChat => ({ id, titulo, pinned: false, updatedAt });

test('el jefe es la conversación más vieja, y escribir en otra no lo cambia', () => {
  const antes = [s(12, 'Precios', '2026-10-16T10:00:00Z'), s(7, 'Primera', '2026-10-10T10:00:00Z'), s(30, 'Campaña de octubre', '2026-10-16T09:00:00Z')];
  const a = arbolDelJefe(antes);
  assert.equal(a.jefe?.id, 7);
  assert.deepEqual(a.subs.map((x) => x.id), [12, 30], 'la que se movió último, arriba');
  // Se escribe en la 30: sube entre los sub-chats, el jefe sigue siendo el mismo.
  const despues = antes.map((x) => (x.id === 30 ? { ...x, updatedAt: '2026-10-16T12:00:00Z' } : x));
  const b = arbolDelJefe(despues);
  assert.equal(b.jefe?.id, 7, 'el jefe no salta de fila');
  assert.deepEqual(b.subs.map((x) => x.id), [30, 12]);
  assert.deepEqual(arbolDelJefe([]), { jefe: null, subs: [] }, 'sin conversaciones, el jefe es virtual y el primer mensaje lo crea');
});

test('la búsqueda de la barra: sin mayúsculas ni tildes, y el título de lo que todavía no tiene', () => {
  const subs = [s(2, 'Campaña de Octubre', '2026-10-16T10:00:00Z'), s(3, null, '2026-10-16T09:00:00Z'), s(4, 'Precios', '2026-10-16T08:00:00Z')];
  assert.deepEqual(filtrarSubs(subs, 'CAMPANA').map((x) => x.id), [2]);
  assert.deepEqual(filtrarSubs(subs, '  ').map((x) => x.id), [2, 3, 4], 'sin búsqueda, todos');
  assert.equal(tituloDe(s(3, null, '')), SIN_TITULO);
  assert.equal(tituloDe(s(3, '   ', '')), SIN_TITULO);
});

test('un sub-chat lleva al jefe en el nombre (la convención «Jefe › Sub», de la que sale su muñeco)', () => {
  assert.equal(nombreDeSub(s(2, 'Precios', '')), `${JEFE_SECOND_BRAIN} › Precios`);
  assert.equal(nombreDeSub({ titulo: null }), `${JEFE_SECOND_BRAIN} › ${SIN_TITULO}`);
});

test('la edad corta de una fila', () => {
  const ahora = Date.parse('2026-10-16T12:00:00Z');
  assert.equal(edadCorta(ahora - 30_000, ahora), 'ahora');
  assert.equal(edadCorta(ahora - 12 * 60_000, ahora), '12 min');
  assert.equal(edadCorta(ahora - 3 * 3_600_000, ahora), '3 h');
  assert.equal(edadCorta(ahora - 2 * 86_400_000, ahora), '2 d');
  assert.equal(edadCorta(null, ahora), '');
});

test('de quién es un chat: la base de su clave, y la conversación del turno por su canal', () => {
  // La API de MaKo lee los chats de la persona DESDE el turno: la persona sale del dato, nunca de un parámetro.
  // ⚠️ Probado ROMPIÉNDOLO (16/10/2026): con la base sin cortar en el primer «:» → 1 fallo (éste).
  assert.equal(baseDeLaPersona('mako-movil:u5'), 'mako-movil:u5');
  assert.equal(baseDeLaPersona('mako-movil:u5:crm:12'), 'mako-movil:u5', 'un sub-chat del CRM es de la misma persona');
  assert.equal(baseDeLaPersona('mako-movil:ana@negocio.com'), 'mako-movil:ana@negocio.com');
  assert.equal(baseDeLaPersona('persona:u5:mako-general'), null, 'un chat de /mako no es del Second Brain');
  assert.equal(baseDeLaPersona('mako-general'), null);
  assert.equal(sesionDelCanal('app:123'), 123);
  assert.equal(sesionDelCanal('app:flujo:centro'), null, 'una automatización no es una conversación');
  assert.equal(sesionDelCanal('120363@g.us'), null, 'WhatsApp tampoco');
  assert.equal(sesionDelCanal('api:9'), null);
});
