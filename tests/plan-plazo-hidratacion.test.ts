// =============================================================================
// Ticket #52 (4/11/2026): «La pantalla Plan se volvió a dibujar sola». El plazo de una tarjeta no se puede dibujar en el server
// =============================================================================
// `hoyISO` es la fecha de la máquina. El instante del reporte de Leila (03:39 UTC del 4/11, 22:39 del 3/11 en Cancún) da dos días distintos en el
// server y en su navegador, y la misma tarjeta dos textos: React #418. Lo que se dibuja en el server (y al hidratar) tiene que ser IGUAL en las dos
// zonas: se dibuja la pieza de verdad con cada una. Sin DOM no se ve el paso siguiente (el plazo que aparece al hidratar): lo hace `useSyncExternalStore`.
//
// ROMPIÉNDOLO (4/11/2026, base 3 de 3): `useEnElNavegador` con `() => true` en el server → 1 fallo (es el bug: «faltan 4» contra «faltan 5»).
// Sin efecto (un paréntesis de más en la condición): 0 fallos, 3 pases. ⚠️ Que el plazo aparezca DESPUÉS de hidratar no lo ve este test: pide un navegador.
//
// Correr: node --import tsx --test tests/plan-plazo-hidratacion.test.ts

import { test, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LineaDeadline, diasHasta, hoyISO, plazoTexto } from '../app/plan/board/piezas';

const REPORTE = Date.parse('2026-11-04T03:39:53.386Z');
const TZ_ANTES = process.env.TZ;
after(() => { if (TZ_ANTES === undefined) delete process.env.TZ; else process.env.TZ = TZ_ANTES; mock.timers.reset(); });

/** Lo que dibuja la máquina en esa zona, en el instante del reporte. */
function enLaZona(tz: string, iso: string): { hoy: string; html: string } {
  process.env.TZ = tz;
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: REPORTE });
  const hoy = hoyISO();
  return { hoy, html: renderToStaticMarkup(createElement(LineaDeadline, { iso, hoy })) };
}

test('el instante del reporte son dos días distintos: por eso el plazo no puede salir del server', () => {
  assert.equal(enLaZona('UTC', '2026-11-08').hoy, '2026-11-04');
  assert.equal(enLaZona('America/Cancun', '2026-11-08').hoy, '2026-11-03');
  assert.notEqual(plazoTexto(diasHasta('2026-11-08', '2026-11-04')).texto, plazoTexto(diasHasta('2026-11-08', '2026-11-03')).texto);
});

test('lo que se dibuja en el server es lo mismo en las dos zonas, y dice la fecha', () => {
  const server = enLaZona('UTC', '2026-11-08').html;
  const navegador = enLaZona('America/Cancun', '2026-11-08').html;
  assert.equal(server, navegador);
  assert.match(server, /8 nov/);
  assert.doesNotMatch(server, /faltan|falta |atrasado|vence hoy/);
});

test('lo terminado y lo que no tiene fecha siguen igual', () => {
  assert.match(renderToStaticMarkup(createElement(LineaDeadline, { iso: '2026-11-08', hoy: '2026-11-03', hecho: true })), /ya está hecho/);
  assert.match(renderToStaticMarkup(createElement(LineaDeadline, { iso: '', hoy: '2026-11-03' })), /Falta el deadline/);
});
