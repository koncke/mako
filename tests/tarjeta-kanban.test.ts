// =============================================================================
// La familia de tarjetas de CRM, Clients y Plan: lo puro (lib/tarjeta-kanban.ts, 17/10/2026)
// =============================================================================
// Pedido de Martín del 17/10 22:40 (punto 8), prototipo docs/prototipos/coherencia-1710.html. Lo que se fija,
// EJECUTANDO lo puro (lo que se puede equivocar sin que nada se vea roto):
//   1. las iniciales: dos letras, sin signos, con un solo nombre las dos primeras, sin nombre «?»;
//   2. el color de las iniciales: estable para el mismo nombre (acentos y mayúsculas no lo cambian) y SIEMPRE uno de
//      los cinco — la trampa del prototipo: con `>>` el hash salía negativo y el color, `undefined`;
//   3. la insignia del canal: el de Meta, WhatsApp, la landing, la agenda…; «Sin origen» y lo desconocido, ninguna;
//   4. la plata de la tarjeta: la MISMA regla que el total de la columna (vendido en Ganado, «≈» estimado abierto,
//      nada sin dato) y el subtítulo «plata · por dónde llegó».
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el hash con `>> 0` en vez de `>>> 0`                                        → 3 / 1
//   · `plataDeLead` sin el «≈» del estimado                                       → 3 / 1
//   · la insignia sin el caso de WhatsApp                                         → 3 / 1
// Correr: node --import tsx --test tests/tarjeta-kanban.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorDeNombre, inicialesDe, insigniaDeCanal, plataDeLead, subtituloLead } from '../lib/tarjeta-kanban';

test('las iniciales: dos letras, sin signos', () => {
  assert.equal(inicialesDe('Valeria Núñez'), 'VN');
  assert.equal(inicialesDe('  ana   maría   gómez '), 'AG', 'primera y última palabra');
  assert.equal(inicialesDe('Mauricio'), 'MA');
  assert.equal(inicialesDe('(Sin nombre) #12'), 'S1');
  assert.equal(inicialesDe(''), '?');
  assert.equal(inicialesDe(null), '?');
});

test('el color de las iniciales es estable y siempre uno de los cinco', () => {
  assert.equal(colorDeNombre('Sofía Quiroga'), colorDeNombre('SOFIA QUIROGA'), 'acentos y mayúsculas no lo cambian');
  const validos = new Set(['blue', 'green', 'purple', 'teal', 'grey']);
  // Muchos nombres: con un hash con signo, alguno da negativo y el color sale `undefined`.
  for (let i = 0; i < 2000; i++) assert.ok(validos.has(colorDeNombre(`Lead número ${i} ñandú`)), `sin color para el ${i}`);
});

test('la insignia del canal: los que tienen ícono, y ninguna para «Sin origen» o lo desconocido', () => {
  assert.deepEqual(insigniaDeCanal('Meta · Instant Form'), { icono: 'meta', color: 'blue', nombre: 'Meta Ads' });
  assert.equal(insigniaDeCanal('WhatsApp')?.icono, 'whatsapp');
  assert.equal(insigniaDeCanal('Landing')?.color, 'purple');
  assert.equal(insigniaDeCanal('Cal.com')?.icono, 'calendario');
  assert.equal(insigniaDeCanal('Sin origen'), null);
  assert.equal(insigniaDeCanal(''), null);
  assert.equal(insigniaDeCanal('Prueba del Pixel'), null, 'nada inventado para lo que no tiene ícono');
});

test('la plata de la tarjeta sigue la regla del total de la columna, y el subtítulo junta lo que hay', () => {
  assert.equal(plataDeLead({ ganado: true, monto: 1500 }), '$1.5K');
  assert.equal(plataDeLead({ ganado: true, monto: 0, suscripcionMonto: 97 }), '$97/mes', 'una suscripción, por mes');
  assert.equal(plataDeLead({ ganado: false, ingresoEstimado: 5000 }), '≈ $5K', 'abierto: estimado, no venta');
  assert.equal(plataDeLead({ ganado: false, monto: 1500 }), null, 'abierto sin estimado: nada (el monto es de la venta)');
  assert.equal(plataDeLead({ ganado: true, monto: null }), null, 'sin dato no hay «$0»');
  assert.equal(subtituloLead('≈ $1.5K', 'Meta · Instant Form'), '≈ $1.5K · Meta · Instant Form');
  assert.equal(subtituloLead(null, 'Landing'), 'Landing');
  assert.equal(subtituloLead('$97/mes', 'Sin origen'), '$97/mes');
  assert.equal(subtituloLead(null, null), '');
});
