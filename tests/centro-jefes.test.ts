// =============================================================================
// La organización de los chats (16/10/2026): el Cerebro aparte, los jefes por tab, y «Sin asignar»
// =============================================================================
// Martín: «No estás aplicando la modularización y organización de chats... Quiero chats con los nombres de las tabs que
// sean "jefes"... Y no veo que ningún "jefe" tenga sus chats», y que el orquestador («Estrategia 3 cuentas», que pasó a
// llamarse Cerebro) no es un jefe más. Lo que se fija:
//   · el Cerebro es UN chat (con sus nombres de antes) y va aparte, arriba;
//   · un chat cuyo jefe no se llama como una tab («dashboard-marketing-7d») va a «Sin asignar»;
//   · la lista de tabs sale de los registros que ya existen (la barra y las áreas).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 3 pases:
//   · sin juntar «Estrategia 3 cuentas» con «Cerebro» → 1 fallo («el Cerebro»);
//   · mirando el título entero y no su jefe («CRM › Funnels» no es una tab) → 1 fallo («Sin asignar»);
//   · la lista de tabs sin las áreas → 1 fallo («la lista de tabs»: falta «Closing Analyst», que no tiene tab).
//   Restaurado de memoria: 3 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CEREBRO, SECCION_CEREBRO, SECCION_CHATS, SECCION_SIN_ASIGNAR, completarChats, seccionesDeChats, type CarteroP } from '../lib/centro-chats';
import { aspectoDe } from '../lib/centro-munecos';
import { nombresDeTabs } from '../app/admin/operaciones/tabs';

const AHORA = Date.parse('2026-10-16T12:00:00Z');
const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const chat = (n: number, titulo: string, cuenta = 'claude1') => ({ local: S(n), titulo, cuenta, vivo: true, estado: 'idle' as const, actividad: '2026-10-16T11:00:00Z' });

test('el Cerebro es UN chat (con su nombre de antes en otra cuenta), y va aparte, arriba', () => {
  const carteros: CarteroP[] = [
    { cuenta: 'claude1', vistoAt: '2026-10-16T11:59:00Z', chats: [chat(1, 'Estrategia 3 cuentas'), chat(2, 'CRM')] },
    { cuenta: 'claude3', vistoAt: '2026-10-16T11:59:00Z', chats: [chat(3, 'Cerebro', 'claude3')] },
  ];
  const cs = completarChats([], { carteros, trabajos: [], ahora: AHORA });
  const secs = seccionesDeChats(cs, ['CRM']);
  assert.equal(secs[0].clave, SECCION_CEREBRO, 'arriba de todo');
  assert.deepEqual(secs[0].chats.map((c) => c.titulo), [CEREBRO]);
  assert.equal(secs[0].chats[0].sesiones.length, 2, 'las dos sesiones, en un chat');
  assert.deepEqual(secs.find((s) => s.clave === SECCION_CHATS)?.chats.map((c) => c.titulo), ['CRM'], 'el Cerebro no es un jefe más');
  assert.deepEqual(aspectoDe('Cerebro'), aspectoDe('Estrategia 3 cuentas'), 'el mismo empleado, el mismo muñeco');
});

test('un chat cuyo jefe no se llama como una tab va a «Sin asignar»; un sub-chat de una tab, a su jefe', () => {
  const carteros: CarteroP[] = [{
    cuenta: 'claude2', vistoAt: '2026-10-16T11:59:00Z',
    chats: [chat(1, 'CRM › Funnels', 'claude2'), chat(2, 'dashboard-marketing-7d', 'claude2'), chat(3, 'web generator', 'claude2'), chat(4, 'Arreglar el login', 'claude2')],
  }];
  const cs = completarChats([], { carteros, trabajos: [], ahora: AHORA });
  const secs = seccionesDeChats(cs, ['CRM', 'Web Generator']);
  const titulos = (k: string) => (secs.find((s) => s.clave === k)?.chats.map((c) => c.titulo) ?? []).sort();
  assert.deepEqual(titulos(SECCION_CHATS), ['CRM › Funnels', 'web generator'], 'por su jefe, sin mayúsculas');
  assert.deepEqual(titulos(SECCION_SIN_ASIGNAR), ['Arreglar el login', 'dashboard-marketing-7d']);
  assert.equal(secs.find((s) => s.clave === SECCION_SIN_ASIGNAR)?.titulo, 'Sin asignar');
  // Sin la lista de tabs, como antes: todos a la lista.
  assert.equal(seccionesDeChats(cs).find((s) => s.clave === SECCION_SIN_ASIGNAR), undefined);
});

test('la lista de tabs sale de la barra y de las áreas, sin repetidos', () => {
  const tabs = nombresDeTabs();
  for (const t of ['CRM', 'Web Generator', 'Centro de Operaciones', 'Automations', 'MaKo Mobile', 'Ticketera', 'Closing Analyst']) assert.ok(tabs.includes(t), t);
  assert.equal(new Set(tabs).size, tabs.length);
  assert.ok(tabs.length > 40, `trajo ${tabs.length}: está mirando los registros`);
});
