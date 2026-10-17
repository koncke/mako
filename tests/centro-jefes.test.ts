// =============================================================================
// La organización de los chats (16/10/2026): el Cerebro aparte, los jefes por tab, y una sola lista (17/10/2026)
// =============================================================================
// Martín: «No estás aplicando la modularización y organización de chats... Quiero chats con los nombres de las tabs que
// sean "jefes"... Y no veo que ningún "jefe" tenga sus chats», y que el orquestador («Estrategia 3 cuentas», que pasó a
// llamarse Cerebro) no es un jefe más. Lo que se fija:
//   · el Cerebro es UN chat (con sus nombres de antes) y va aparte, arriba;
//   · desde el 17/10 NO hay «Sin asignar» (Martín: «No entiendo el desplegable de "Sin asignar", no tiene sentido,
//     elimínalo... Y que los chats trabajando siempre estén arriba... Y los que tienen notificaciones también»): una
//     sola lista, con lo que trabaja arriba, después lo que espera a Martín y después el resto por actividad, y «Mostrar
//     más» nunca esconde a uno de los dos primeros;
//   · la lista de tabs sale de los registros que ya existen (la barra y las áreas).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 3 pases:
//   · sin juntar «Estrategia 3 cuentas» con «Cerebro» → 1 fallo («el Cerebro»);
//   · (17/10/2026) sin ordenar por prioridad → 1 fallo («una sola lista»); sin el escalón de lo que espera a Martín → 1
//     fallo (el mismo); el teléfono cortando con `slice` (sin `esPrioritario`) → 1 fallo («Mostrar más»);
//   · la lista de tabs sin las áreas → 1 fallo («la lista de tabs»: falta «Closing Analyst», que no tiene tab).
//   Restaurado de memoria: 3 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CEREBRO, SECCION_CEREBRO, SECCION_CHATS, completarChats, esPrioritario, seccionesDeChats, type CarteroP, type ChatCentro } from '../lib/centro-chats';
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
  const secs = seccionesDeChats(cs);
  assert.equal(secs[0].clave, SECCION_CEREBRO, 'arriba de todo');
  assert.deepEqual(secs[0].chats.map((c) => c.titulo), [CEREBRO]);
  assert.equal(secs[0].chats[0].sesiones.length, 2, 'las dos sesiones, en un chat');
  assert.deepEqual(secs.find((s) => s.clave === SECCION_CHATS)?.chats.map((c) => c.titulo), ['CRM'], 'el Cerebro no es un jefe más');
  assert.deepEqual(aspectoDe('Cerebro'), aspectoDe('Estrategia 3 cuentas'), 'el mismo empleado, el mismo muñeco');
});

test('una sola lista: primero lo que trabaja, después lo que espera a Martín, después por actividad', () => {
  const t = (titulo: string, n: number, hora: string, busy = false) => ({ ...chat(n, titulo, 'claude2'), estado: busy ? 'busy' as const : 'idle' as const, actividad: `2026-10-16T${hora}:00Z` });
  const carteros: CarteroP[] = [{
    cuenta: 'claude2', vistoAt: '2026-10-16T11:59:00Z',
    chats: [t('CRM', 1, '11:00'), t('dashboard-marketing-7d', 2, '11:30'), t('Pagos', 3, '09:00', true), t('Offer', 4, '08:00'), t('Web Generator', 5, '07:00', true)],
  }];
  const cs = completarChats([], { carteros, trabajos: [], ahora: AHORA });
  const avisos = (c: ChatCentro) => (c.titulo === 'Offer' ? 1 : 0);
  const secs = seccionesDeChats(cs, avisos);
  assert.deepEqual(secs.map((s) => [s.clave, s.titulo]), [[SECCION_CHATS, null]], 'una sola lista, sin «Sin asignar»');
  const orden = secs[0].chats.map((c) => c.titulo);
  assert.deepEqual(new Set(orden.slice(0, 2)), new Set(['Pagos', 'Web Generator']), 'los que trabajan, arriba');
  assert.deepEqual(orden.slice(2), ['Offer', 'dashboard-marketing-7d', 'CRM'], 'después lo que espera a Martín; después por actividad');
  assert.ok(orden.includes('dashboard-marketing-7d'), 'un chat que no se llama como una tab está en la lista');
  const de = (titulo: string) => cs.find((c) => c.titulo === titulo)!;
  assert.equal(esPrioritario(de('Pagos'), avisos), true);
  assert.equal(esPrioritario(de('Offer'), avisos), true);
  assert.equal(esPrioritario(de('CRM'), avisos), false);
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('«Mostrar más» nunca esconde lo que trabaja o espera a Martín, en la computadora y en el teléfono', () => {
  for (const f of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(leer(f), /const corte = [^;]*esPrioritario\(c, avisos\)/, f);
  }
});

test('la lista de tabs sale de la barra y de las áreas, sin repetidos', () => {
  const tabs = nombresDeTabs();
  for (const t of ['CRM', 'Web Generator', 'Centro de Operaciones', 'Automations', 'MaKo Mobile', 'Ticketera', 'Closing Analyst']) assert.ok(tabs.includes(t), t);
  assert.equal(new Set(tabs).size, tabs.length);
  assert.ok(tabs.length > 40, `trajo ${tabs.length}: está mirando los registros`);
});
