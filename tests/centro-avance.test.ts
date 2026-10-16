// =============================================================================
// El avance de UN chat: el roadmap de la barra derecha (15/10/2026)
// =============================================================================
// Martín: «quiero que cada chat tenga arriba, en su topbar un botón para ver los avances, que despliegue la sidebar
// derecha... un roadmap simple... el estado es el COLOR del punto: gris = no empezado». Y la cuenta «en el
// progreso, en el detalle». Lo arma `avanceDelChat` (lib/centro-chats.ts) desde el historial del chat.
//
// Lo que fija, cada uno probado rompiéndolo (15/10/2026, con la base en 0 fallos):
//   1. Los estados: un trabajo entregado está en curso, uno que no salió es rojo, y un pedido sin pasos es gris.
//      Mapeando `entregado` a «sin empezar» → 1 fallo.
//   2. Los pasos y los commits son los de ESTE chat, y las cuentas salen de esos pasos. Tomando los commits de todo
//      el pedido → 1 fallo; las cuentas del pedido entero → 1 fallo (el mismo test).
//   3. El conteo («3/5») cuenta sólo lo terminado (contando lo empezado → 1 fallo), y el título de un trabajo es su
//      primer renglón.

import test from 'node:test';
import assert from 'node:assert/strict';
import { avanceDelChat, conteoAvance, mensajeDeCommit, tituloDeTexto, type LineaChat, type TrabajoP } from '../lib/centro-chats';
import type { PasoP, PedidoP } from '../lib/progreso-reglas';

const T = Date.parse('2026-10-15T16:00:00Z');
const paso = (chat: string, sesion: string, cuenta: string, sha?: string, tipo = 'implementacion'): PasoP => ({
  instante: T + 60_000, chat, sesion, tipo, titulo: `${tipo} de ${chat}`, cuenta, commits: sha ? [{ sha, msg: `feat(crm): ${sha}` }] : [],
});
const pedido = (id: string, estado: PedidoP['estado'], pasos: PasoP[]): PedidoP => ({
  id, texto: `El prompt ${id}, entero.`, titulo: `Título ${id}`, instante: T, areas: ['CRM'], tomo: pasos[0]?.chat ?? null, estado, pasos,
  commits: pasos.flatMap((s) => s.commits), junto: 0, ultimo: T, cierre: null, pidioEn: { chat: 'CRM', sesion: 'local_a' },
});
const trabajo = (id: string, estado: TrabajoP['estado'], texto: string, extra: Partial<TrabajoP> = {}): TrabajoP => ({
  id, destino: 'local_a', destino_titulo: 'CRM', destino_cuenta: 'claude2', created_at: '2026-10-15T17:00:00Z', texto, estado, ...extra,
});

test('los estados son el color del rombo: gris sin empezar, amarillo en curso, verde terminado, rojo si no salió', () => {
  const lineas: LineaChat[] = [
    { tipo: 'pedido', instante: T, pedido: pedido('a', 'pendiente', []), pasos: [], desde: null },
    { tipo: 'pedido', instante: T + 1, pedido: pedido('b', 'en_curso', [paso('CRM', 'local_a', 'claude1', undefined, 'investigacion')]), pasos: [], desde: null },
    { tipo: 'pedido', instante: T + 2, pedido: pedido('c', 'hecho', []), pasos: [], desde: null },
    { tipo: 'trabajo', instante: T + 3, trabajo: trabajo('w1', 'escrito', 'Hola') },
    { tipo: 'trabajo', instante: T + 4, trabajo: trabajo('w2', 'entregado', 'Hola') },
    { tipo: 'trabajo', instante: T + 5, trabajo: trabajo('w3', 'hecho', 'Hola', { cierre: { hecho: 'Listo el filtro' } as TrabajoP['cierre'] }) },
    { tipo: 'trabajo', instante: T + 6, trabajo: trabajo('w4', 'no_entregado', 'Hola', { motivo: 'El chat se cerró: ábrelo y vuelve a mandarlo' }) },
  ];
  const n = avanceDelChat(lineas);
  assert.deepEqual(n.map((x) => x.estado), ['sin_empezar', 'en_curso', 'hecho', 'sin_empezar', 'en_curso', 'hecho', 'no_salio']);
  assert.equal(n[5].cierre, 'Listo el filtro', 'el cierre del chat va al detalle');
  assert.equal(n[6].motivo, 'El chat se cerró: ábrelo y vuelve a mandarlo', 'y el motivo, sólo si no salió');
  assert.equal(n[4].motivo, null);
  assert.deepEqual(n[3].cuentas, ['claude2'], 'un trabajo, la cuenta a la que se mandó');
  assert.deepEqual(conteoAvance(n), { hechos: 2, total: 7 });
});

test('los pasos, los commits y las cuentas son los de ESTE chat; si lo trabajó otro, los de todo el pedido', () => {
  const p = pedido('d', 'hecho', [paso('CRM', 'local_a', 'claude1', 'aaaaaaa1'), paso('Graphics', 'local_b', 'claude3', 'bbbbbbb2')]);
  const [propio] = avanceDelChat([{ tipo: 'pedido', instante: T, pedido: p, pasos: [p.pasos[0]], desde: null }]);
  assert.deepEqual(propio.commits.map((c) => c.sha), ['aaaaaaa1'], 'sólo el commit de este chat');
  assert.deepEqual(propio.cuentas, ['claude1'], 'y la cuenta donde lo trabajó este chat');
  assert.deepEqual(propio.pasos.map((s) => s.titulo), ['implementacion de CRM']);
  assert.equal(propio.prompt, 'El prompt d, entero.', 'el prompt textual, entero');
  const [derivado] = avanceDelChat([{ tipo: 'derivado', instante: T, pedido: p, trabajaron: ['CRM', 'Graphics'] }]);
  assert.deepEqual(derivado.commits.map((c) => c.sha), ['aaaaaaa1', 'bbbbbbb2'], 'se lo pediste acá y lo trabajaron otros: todo');
  assert.deepEqual(derivado.cuentas, ['claude1', 'claude3']);
  assert.deepEqual(derivado.trabajaron, ['CRM', 'Graphics']);
});

test('el título de un trabajo es su primer renglón, y un commit se lee sin su prefijo', () => {
  assert.equal(tituloDeTexto('Revisa el filtro por etapa\ny después lo demás'), 'Revisa el filtro por etapa');
  const largo = tituloDeTexto('Que el tablero permita arrastrar varias tarjetas a la vez y deshacer el movimiento entero sin perder nada');
  assert.ok(largo.endsWith('…') && largo.length <= 73, largo);
  assert.ok(!/\s…$/.test(largo), 'corta en una palabra entera');
  assert.equal(mensajeDeCommit('feat(operaciones): el cartero se llama Runner'), 'El cartero se llama Runner');
  assert.equal(mensajeDeCommit('Merge commit abc'), 'Merge commit abc');
});
