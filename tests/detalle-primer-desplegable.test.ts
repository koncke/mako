// =============================================================================
// El PRIMER desplegable de un detalle arranca abierto — sea cual sea
// =============================================================================
// «Siempre el primer desplegable del detalle de cada tarea o proyecto debe estar
// desplegado, el resto, plegado» (30/09/2026).
//
// La condición era `esIntro`, o sea «abrí el bloque sin título si lo hay», y eso dejaba
// el documento ENTERO plegado en todo detalle escrito con el molde de la casa: esos
// arrancan con `**Qué es**`, así que el primer hijo ya es un encabezado y no hay intro.
// Medido en el navegador sobre «Feature: Plan» antes del arreglo: las cuatro secciones
// cerradas y cero abiertas.
//
// Es un test de CÓDIGO y no de pantalla a propósito: la decoración la hace un efecto
// sobre el DOM de un `contentEditable`, que no se puede montar sin un navegador. Lo que
// se cuida es la condición, que ya se movió una vez.
//
// ⚠️ PROBADO ROMPIÉNDOLO, dos veces (30/09/2026):
//   1. Volviendo la condición a `?? esIntro`: falla 1 de 3 — «el primero abre por ser
//      PRIMERO». Es la regresión exacta que motivó el pedido.
//   2. Sacando el `yaHuboUno = true`: falla 1 de 3 — «sólo uno arranca abierto». Sin él
//      `esPrimero` es true para todos y el detalle abre entero, que es el otro extremo
//      del mismo bug (un muro de texto en vez de un índice).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shell = () => readFileSync(resolve(import.meta.dirname, '../app/plan/board/BoardShell.tsx'), 'utf8');

/** El cuerpo del efecto que decora el doc: de la declaración del flag al cierre del for. */
function decorador(src: string): string {
  const i = src.indexOf('let yaHuboUno = false;');
  assert.ok(i > 0, 'no encontré el flag del primer desplegable');
  return src.slice(i, i + 2000);
}

test('EL QUE IMPORTA: el primero abre por ser PRIMERO, no por ser el intro', () => {
  const d = decorador(shell());
  assert.ok(/tocados\.get\(k\) \?\? esPrimero/.test(d),
    'el arranque volvió a depender de que exista un bloque sin título');
  assert.ok(!/tocados\.get\(k\) \?\? esIntro/.test(d), 'quedó la condición vieja');
});

test('sólo UNO arranca abierto', () => {
  // Sin bajar el flag, `esPrimero` es true para todos: el detalle abre entero y vuelve a
  // ser el muro de texto que el plegado vino a evitar.
  const d = decorador(shell());
  assert.ok(/const esPrimero = !yaHuboUno;/.test(d), 'no se calcula contra el flag');
  assert.ok(/yaHuboUno = true;/.test(d), 'el flag no se baja: abrirían todos');
});

test('lo que la persona abrió o cerró le gana a la regla', () => {
  // La regla decide el ARRANQUE. Si pisara la decisión, plegar el primero sería
  // imposible: se volvería a abrir en la próxima pasada del efecto.
  const d = decorador(shell());
  const i = d.indexOf('const abierto =');
  assert.ok(i > 0, 'no encontré la decisión');
  assert.ok(/tocados\.get\(k\) \?\?/.test(d.slice(i, i + 120)),
    'la regla pisa lo que la persona eligió');
});
