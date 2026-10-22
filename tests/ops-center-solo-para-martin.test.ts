// =============================================================================
// El Ops Center sólo muestra lo que es para Martín (22/10/2026, pedido f7fb8e80, con captura del teléfono)
// =============================================================================
// Martín: «me salen estos textos largos innecesarios en muchos chats... No los quiero». En su «Cerebro» se leía entero un
// mensaje de un chat a otro («Integración → Cerebro: READY. 87365c830 está EN PRODUCCIÓN…»), con «Cerebro › Integración» de
// cita. Medido ese día: 279 de 1.937 turnos guardados eran de OTRO chat, y 14 «de Martín» eran el resumen de una compactación.
//   1. el caso de uso, de punta a punta: un transcript con un turno de Martín, uno del Runner, uno de otro chat, el resumen de
//      una compactación y un aviso de sesiones, por el cartero (`turnosDeLineas`), lo que guarda el servidor
//      (`sanearTurnos`) y lo que dibuja el hilo (`historialDelChat` → `lineasDeConversacion`);
//   2. lo YA guardado tampoco se dibuja, y no es «lo último» de la fila (`vistaPrevia`);
//   3. el `otro` se sigue guardando (supera las preguntas), y la computadora y el teléfono dibujan por la misma regla.
//
// Correr: node --import tsx --test tests/ops-center-solo-para-martin.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esParaMartin, sanearTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { historialDelChat, lineasDeConversacion, vistaPrevia, type ChatCentro, type LineaChat } from '../lib/centro-chats';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cartero = () => import('../scripts/operaciones/cartero.mjs');

const LOCAL = 'local_dd16f102-c670-41ff-9bfc-2780dca3fc05';
const TRABAJO = '2a5e4317-235f-4619-87d8-5fe9482e209e';
const chat = { clave: LOCAL, miembros: [LOCAL], pedidos: [], trabajos: [] } as unknown as ChatCentro;

// Las líneas con la forma del transcript de Claude Code (los textos, cortos, de los mensajes de verdad del 22/10).
const usuario = (uuid: string, at: string, texto: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'user', uuid, timestamp: at, isSidechain: false, userType: 'external', message: { role: 'user', content: texto }, ...extra });
const chatDice = (uuid: string, at: string, texto: string) =>
  JSON.stringify({ type: 'assistant', uuid, timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text: texto }] } });
const fin = (uuid: string, at: string) => JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', uuid, timestamp: at });

const MARTIN = 'También revisa que me salen estos textos largos innecesarios en muchos chats. No los quiero.';
const RUNNER = `<cross-session-message from="local_5cc6190d-8390-4df1-b215-849f5590ee30" name="Runner">Pedido de Martín desde el Centro de Operaciones (firmado en su dispositivo, 22/10, 09:41 a. m.).

Mirá el Ops Center del teléfono.

— Al terminar, dejá el cierre en cuatro renglones:
node "~/.claude/operaciones/cartero.mjs" cierre ${TRABAJO} --decidido "…" --hecho "…"</cross-session-message>`;
const OTRO_CHAT = `<cross-session-message from="local_1ec5ff9f-ff84-4e3e-bde3-d0d537077ccc" name="Cerebro › Integración">Integración → Cerebro: READY. 87365c830 está EN PRODUCCIÓN: deploy de Vercel Ready; main e integracion = 87365c830. Salió con --no-verify.</cross-session-message>`;
const COMPACTACION = 'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\nSummary:\n1. Primary Request and Intent: …';
const AVISO_SESIONES = '<side-sessions-event>La sesión «CRM» terminó un turno.</side-sessions-event>';

async function delTranscript(): Promise<TurnoChat[]> {
  const { turnosDeLineas } = await cartero();
  const { turnos } = turnosDeLineas([
    usuario('u-mar-000001', '2026-10-22T12:41:00Z', MARTIN),
    chatDice('a-el-0000001', '2026-10-22T12:41:30Z', 'Voy a trabajar en sacar del Ops Center lo que se dicen los chats.'),
    fin('f-00000001', '2026-10-22T12:42:00Z'),
    usuario('u-run-000001', '2026-10-22T12:43:00Z', RUNNER),
    chatDice('a-el-0000002', '2026-10-22T12:43:30Z', 'Ya está: el Ops Center muestra sólo lo tuyo.'),
    fin('f-00000002', '2026-10-22T12:44:00Z'),
    usuario('u-otr-000001', '2026-10-22T12:45:00Z', OTRO_CHAT),
    chatDice('a-el-0000003', '2026-10-22T12:45:30Z', 'Recibido, sigo.'),
    fin('f-00000003', '2026-10-22T12:46:00Z'),
    usuario('u-cmp-000001', '2026-10-22T12:47:00Z', COMPACTACION, { isCompactSummary: true, isVisibleInTranscriptOnly: true }),
    usuario('u-sse-000001', '2026-10-22T12:48:00Z', AVISO_SESIONES),
  ]);
  // La PC le pone a cada turno su sesión antes de subirlo; el servidor lo sanea al recibirlo (lib/operaciones.ts).
  return sanearTurnos(turnos.map((t: object) => ({ ...t, local: LOCAL })));
}

const textos = (ls: readonly LineaChat[]) => ls.map((l) => (l.tipo === 'turno' ? l.turno.texto : l.tipo));

test('1. el caso de uso: de un transcript con Martín, el Runner, otro chat y una compactación, se dibuja sólo lo de Martín', async () => {
  const guardados = await delTranscript();
  // El cartero ya deja afuera el aviso de sesiones; el servidor, la compactación.
  assert.ok(!guardados.some((t) => t.texto.includes('terminó un turno')), 'el aviso de sesiones no se sube');
  assert.ok(!guardados.some((t) => t.texto.startsWith('This session is being continued')), 'la compactación no se guarda');
  const runner = guardados.find((t) => t.trabajo === TRABAJO);
  assert.equal(runner?.rol, 'yo', 'un pedido de Martín por el Runner es de Martín (con su trabajo)');
  assert.equal(guardados.find((t) => t.rol === 'otro')?.de, 'Cerebro › Integración', 'el de otro chat se guarda');

  const dibujado = textos(lineasDeConversacion(historialDelChat(chat, new Map(), [], [], guardados, [])));
  assert.deepEqual(dibujado, [
    MARTIN,
    'Voy a trabajar en sacar del Ops Center lo que se dicen los chats.',
    'Ya está: el Ops Center muestra sólo lo tuyo.',
    'Recibido, sigo.',
  ], 'lo que escribió Martín y lo que el chat contestó; el pedido del Runner va como su trabajo, con sus ticks');
  assert.ok(!dibujado.some((t) => t.includes('Integración → Cerebro')), 'lo que se dicen los chats no se dibuja');
});

test('2. lo YA guardado tampoco se dibuja, ni es lo último de la fila', () => {
  // Así estaba en la base el 22/10 (app_settings operaciones.turnos.<local>): un «otro» y una compactación como «yo».
  const guardado = [
    { local: LOCAL, uuid: 'u-mar-000002', rol: 'yo', de: null, texto: 'Hola', at: '2026-10-22T10:00:00Z', trabajo: null },
    { local: LOCAL, uuid: 'u-cmp-000002', rol: 'yo', de: null, texto: COMPACTACION, at: '2026-10-22T10:05:00Z', trabajo: null },
    { local: LOCAL, uuid: 'u-otr-000002', rol: 'otro', de: 'Cerebro', texto: 'Cerebro: te desarchivé. Están EN PRODUCCIÓN…', at: '2026-10-22T10:10:00Z', trabajo: null },
  ];
  const leidos = sanearTurnos(guardado);
  assert.deepEqual(leidos.map((t) => t.uuid), ['u-mar-000002', 'u-otr-000002'], 'la compactación no vuelve al leer');
  const lineas = historialDelChat(chat, new Map(), [], [], leidos, []);
  assert.deepEqual(textos(lineasDeConversacion(lineas)), ['Hola']);
  assert.equal(vistaPrevia(lineas)?.texto, 'Hola', 'lo último para Martín es lo suyo, no el mensaje del Cerebro');
  assert.equal(esParaMartin({ rol: 'el', texto: 'Ya está: …' }), true);
  assert.equal(esParaMartin({ rol: 'otro', texto: 'Cerebro: …' }), false);
});

test('3. la computadora y el teléfono dibujan por la misma regla', () => {
  // Los dos montan Hilo, y Hilo dibuja lo que deja `lineasDeConversacion`.
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /const lineas = sinOcultos\(lineasDeConversacion\(todas\), marcas\);/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /<Hilo lineas=\{lineas\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /<Hilo lineas=\{lineas\}/);
  // El «otro» sigue contando para que una pregunta quede atrás (lo guarda y lo lee `sanearTurnos`).
  assert.match(sinComentarios(leer('lib/centro-preguntas-chat.ts')), /x\.rol === 'yo' \|\| x\.rol === 'otro'/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · `lineasDeConversacion` sin `esParaMartin` (el «otro» se dibuja otra vez)      → 1/2 (1 y 2)
//   · `sanearTurnos` sin sacar la compactación                                     → 1/2 (1 y 2)
//   · `vistaPrevia` sin `esParaMartin`                                             → 2/1 (2)
//   · Hilo dibujando `todas` en vez de `lineasDeConversacion(todas)`               → 2/1 (3)
