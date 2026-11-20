// =============================================================================
// Ticket #116 (19/11/2026): «Minified React error #418» en /admin/customers/13 — la línea de tiempo de la ficha
// =============================================================================
// La línea de tiempo decía «hoy / ayer / hace N min» con el reloj y el día LOCAL de quien dibujaba: el server en UTC y el navegador de Martín en
// Argentina. A la noche, un pago de ese día era «hoy» en uno y «ayer» en el otro: React veía otro texto al hidratar (#418) y redibujaba la pantalla.
// Lo que se dibuja en el server (y en la hidratación) tiene que ser IGUAL en cualquier zona y a cualquier hora; lo relativo, recién en el navegador.
// Correr: node --import tsx --test tests/customer-timeline-hidratacion.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CustomerTimeline, fechaFijaDelEvento } from '../app/admin/_polar/web/Customer/CustomerTimeline';
import type { EventoDeTimeline } from '../app/admin/_polar/datos/eventos';
import { TooltipProvider } from '../app/admin/_polar/orbit';

const eventos = [
  { id: 'p1', nombre: 'pago', label: 'Pagó US$ 59,54', timestamp: '2026-11-18T00:00:00.000Z', soloDia: true, resumen: null, href: null, negativo: false, importancia: 'alta', source: 'system' },
  { id: 'e1', nombre: 'reporte', label: 'Ticket', timestamp: '2026-11-19T03:50:00.000Z', soloDia: false, resumen: null, href: null, negativo: false, importancia: 'alta', source: 'system' },
] as unknown as EventoDeTimeline[];

function dibujarEn(zona: string, ahora: number): string {
  const tz = process.env.TZ;
  const Real = Date;
  process.env.TZ = zona;
  // El reloj de ESE momento, también para `new Date()` sin argumentos (lo que usaba «hoy»).
  class Reloj extends Real {
    constructor(...a: unknown[]) {
      if (a.length) super(a[0] as string);
      else super(ahora);
    }
    static now() { return ahora; }
  }
  globalThis.Date = Reloj as DateConstructor;
  try {
    return renderToString(createElement(TooltipProvider, null, createElement(CustomerTimeline, { eventos, viewAllHref: '/admin/analytics/events' })));
  } finally {
    globalThis.Date = Real;
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
}

test('el server dibuja la MISMA línea de tiempo en UTC y en Argentina, a cualquier hora (sin «hoy», «ayer» ni «hace»)', () => {
  // La noche del ticket: 00:57 en Argentina = 03:57 UTC. El server ya está en el 19; el navegador, todavía en el 18. Y hidrata un minuto después.
  const server = dibujarEn('UTC', Date.parse('2026-11-19T03:57:00Z'));
  const navegador = dibujarEn('America/Argentina/Buenos_Aires', Date.parse('2026-11-19T03:58:30Z'));
  assert.equal(navegador, server, 'otro texto según la zona o el reloj: React lo ve al hidratar (#418)');
  assert.match(server, /18 nov/);
  assert.doesNotMatch(server, />\s*(hoy|ayer|ahora|hace [^<]+)\s*</);
});

test('la fecha fija es la del evento en UTC (un pago del 18 es el 18 en cualquier zona)', () => {
  assert.equal(fechaFijaDelEvento('2026-11-18T00:00:00.000Z'), fechaFijaDelEvento('2026-11-18T23:59:00.000Z'));
  assert.equal(fechaFijaDelEvento('no es fecha'), '');
});

test('lo relativo sólo después de llegar al navegador', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'admin', '_polar', 'web', 'Customer', 'CustomerTimeline.tsx'), 'utf8');
  assert.match(src, /\{enNavegador \? formatRelativeTime\(evento\.timestamp, evento\.soloDia\) : fechaFijaDelEvento\(evento\.timestamp\)\}/);
  assert.match(src, /const enNavegador = useEnElNavegador\(\)/);
});
