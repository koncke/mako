// =============================================================================
// «Quitar» una cuota se ve en el acto (#891, 17/10/2026)
// =============================================================================
// La llamada «Mau <> Martin» del 16/10 (27:42-28:14), en Pagos del lead de Francisco Javier Hernández: «Se me hace que
// no la quitaste... Eso es un error», y al rato «ahí sí se quitó».
//
// Lo medido en el ws1 (lead 91): UNA sola línea de baja en el historial (16/10 20:41), sin recordatorios ni links que
// la frenaran. El primer clic no falló: TARDÓ. La confirmación se cerraba después de la acción, que revalida cinco
// pantallas, y la fila se iba recién cuando la ficha se releía: segundos sin una señal. El diagnóstico obvio (que el
// server rechazó la primera vez) era el equivocado.
//
// Lo que se fija, sobre el fuente (es un componente de cliente):
//   1. la confirmación se cierra y el renglón dice «Quitando…» ANTES de la acción, y afuera de la transición (un
//      setState adentro de `startTransition` puede no dibujarse hasta que termina);
//   2. lo que el server ya quitó no se dibuja, aunque la ficha no se haya releído;
//   3. el renglón que se está quitando no ofrece botones;
//   4. la «Baja del cliente» muestra su «guardando» con el mismo cuidado.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte. Con
// el código como está: 4 pases, 0 fallos. Rota (pases / fallos):
//   · la confirmación se cierra después de la acción (el código de antes)                → 3 / 1
//   · la lista sin sacar lo ya quitado                                                      → 3 / 1
//   · el renglón que se está quitando sigue con sus botones                                 → 3 / 1
//   · el «guardando» de la baja adentro de la transición                                     → 3 / 1
// Correr: npx tsx --test tests/pagos-quitar-al-instante.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx', 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '');
/** El cuerpo de `const nombre = (...) => {` hasta su `};` de cierre (a dos espacios). */
function cuerpo(nombre: string): string {
  const i = SRC.indexOf(`  const ${nombre} = (`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const fin = SRC.indexOf('\n  };\n', i);
  return SRC.slice(i, fin);
}

test('⚠️ «Quitar»: la confirmación se cierra y el renglón dice «Quitando…» ANTES de la acción, afuera de la transición', () => {
  const q = cuerpo('quitar');
  const cerrar = q.indexOf('setAQuitar(null);');
  const marca = q.indexOf('setQuitando((s) => conId(s, q.id, true));');
  const transicion = q.indexOf('start(async () => {');
  const accion = q.indexOf('await quitarCuotaAction(lead.id, q.id, crm);');
  assert.ok(cerrar >= 0 && marca >= 0 && transicion >= 0 && accion >= 0, 'faltan las piezas de «Quitar»');
  assert.ok(cerrar < transicion && marca < transicion, 'cerrar y marcar van ANTES de la transición');
  assert.ok(transicion < accion);
});

test('⚠️ lo que el server ya quitó no se dibuja, aunque la ficha todavía no se haya releído', () => {
  assert.match(cuerpo('quitar'), /if \(r\.quitada\) setQuitadas\(\(s\) => conId\(s, q\.id, true\)\);/);
  assert.match(SRC, /\.filter\(\(q\) => !quitadas\.has\(q\.id\)\);/);
});

test('el renglón que se está quitando dice «Quitando…» y no ofrece botones', () => {
  assert.match(SRC, /\{saliendo && <span[^>]*>Quitando…<\/span>\}/);
  assert.match(SRC, /\{!editando && !saliendo && \(/);
});

test('la «Baja del cliente» marca su «guardando» afuera de la transición', () => {
  const b = cuerpo('baja');
  assert.ok(b.indexOf('setEnBaja(true);') >= 0 && b.indexOf('setEnBaja(true);') < b.indexOf('start('), 'el «guardando» va antes de start');
});
